import NextcloudService from '#services/nextcloud_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Plan from '#models/plan'
import { registerValidator } from '#validators/user'
import SubscriptionsController from '#controllers/subscriptions_controller'
import Stripe from 'stripe'
import env from '#start/env'

const stripe = new Stripe(env.get('STRIPE_SECRET_KEY'))

@inject()
export default class UsersController {
  constructor(
    protected nextcloudService: NextcloudService,
    protected subsController: SubscriptionsController
  ) {}

  async register({ view }: HttpContext) {
    return view.render('pages/auth/register')
  }

  async store({ request, response, session }: HttpContext) {
    try {
      const data = await request.validateUsing(registerValidator)

      // On vérifie s'il reste des places pour le plan gratuit
      const freePlan = await Plan.query().where('name', 'Gratuit').where('isActive', true).first()

      if (!freePlan || freePlan.stockAvailable <= 0) {
        session.flash('error', "Désolé, il n'y a plus de places disponibles.")
        return response.redirect().back()
      }

      const result = await this.nextcloudService.createUser(
        data.username,
        data.password,
        data.email
      )

      if (result.success) {
        // Décrémentation du stock
        freePlan.stockAvailable -= 1
        if (freePlan.stockAvailable <= 0) freePlan.isActive = false
        await freePlan.save()

        // IMPORTANT : On met l'email et le username dans la session
        // C'est ce qui permettra à Stripe de créer le client avec le bon mail
        session.put('user', {
          username: data.username,
          email: data.email,
        })

        return response.redirect().toRoute('dashboard', { username: data.username })
      }

      session.flash('error', result.message)
      return response.redirect().back()
    } catch (error) {
      if (error.messages && Array.isArray(error.messages)) {
        session.flash('error', error.messages[0].message)
      } else {
        session.flash('error', 'Une erreur inattendue est survenue.')
      }
      return response.redirect().back()
    }
  }

  async dashboard(ctx: HttpContext) {
    const { params, view, request, session, response } = ctx
    const user = session.get('user')

    // 1. Si retour de Stripe : On traite l'upgrade Nextcloud
    if (request.input('payment') === 'success' && request.input('session_id')) {
      await this.subsController.handlePaymentSuccess(ctx)
    }

    // 2. LOGIQUE DE DÉSABONNEMENT (Version Ultra-Blindée)
    if (user && user.email) {
      try {
        const customers = await stripe.customers.list({ email: user.email, limit: 1 })

        if (customers.data.length > 0) {
          // On récupère TOUS les abonnements du client (même annulés)
          const subscriptions = await stripe.subscriptions.list({
            customer: customers.data[0].id,
          })

          // On cherche s'il y en a au moins UN qui est vraiment actif (payé)
          const hasActiveSub = subscriptions.data.some((sub) => sub.status === 'active')

          if (!hasActiveSub) {
            console.log(`[Laxacube] Aucun abo actif trouvé pour ${params.username}.`)

            const currentData = await this.nextcloudService.getUserData(params.username)

            // Si le quota est > 5, on remet à 5GB
            if (currentData.success && Number(currentData.total) > 5) {
              console.log(`[ACTION] 📉 Downgrade forcé vers 5GB`)
              await this.nextcloudService.editUserQuota(params.username, '5GB')
            }
          }
        }
      } catch (e) {
        console.error('Erreur Stripe:', e.message)
      }
    }

    // 3. Récupération des infos temps réel (le quota sera à jour)
    const userData = await this.nextcloudService.getUserData(params.username)

    if (!userData.success) {
      session.forget('user')
      return response.redirect().toRoute('home')
    }

    return view.render('pages/loged/dashboard', {
      user: userData,
      username: params.username,
    })
  }

  async login({ view }: HttpContext) {
    return view.render('pages/auth/login')
  }

  async handleLogin({ request, response, session }: HttpContext) {
    const { uid, password } = request.only(['uid', 'password'])

    const result = await this.nextcloudService.checkAuth(uid, password)

    if (result.success) {
      // On remplit la session avec les infos renvoyées par Nextcloud
      session.put('user', {
        username: result.realUsername,
        email: result.userData.email, // Récupéré via l'API Nextcloud dans ton service
      })

      return response.redirect().toRoute('dashboard', { username: result.realUsername })
    }

    session.flash('error', 'Identifiants invalides')
    return response.redirect().back()
  }

  async logout({ session, response }: HttpContext) {
    session.forget('user')
    session.flash('success', 'Tu as été déconnecté. À la prochaine !')
    return response.redirect().toRoute('home')
  }
}
