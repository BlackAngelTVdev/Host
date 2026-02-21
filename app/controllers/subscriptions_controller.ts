// app/controllers/subscriptions_controller.ts
import Plan from '#models/plan'
import { HttpContext } from '@adonisjs/core/http'
import Stripe from 'stripe'
import env from '#start/env'
import NextcloudService from '#services/nextcloud_service'
import { inject } from '@adonisjs/core'

const stripe = new Stripe(env.get('STRIPE_SECRET_KEY'))

@inject()
export default class SubscriptionsController {
  constructor(protected nextcloudService: NextcloudService) {}

  // Affiche la page de confirmation avant d'aller sur Stripe
  async confirm({ params, view, response, session }: HttpContext) {
    const planId = params.plan
    const user = session.get('user')
    const selectedPlan = await Plan.find(planId)

    if (!selectedPlan || !selectedPlan.isActive) {
      session.flash('error', 'Plan introuvable.')
      return response.redirect().toRoute('dashboard', { username: user.username })
    }

    return view.render('pages/loged/confirm', { plan: selectedPlan })
  }

  // Crée la session de paiement Stripe
  async createSession({ request, response, session }: HttpContext) {
    const planId = request.input('planId')
    const user = session.get('user')
    const selectedPlan = await Plan.find(planId)

    if (!selectedPlan) return response.badRequest('Plan invalide')

    try {
      const stripeSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'], // Tu peux ajouter 'twint' ici en prod
        line_items: [
          {
            price_data: {
              currency: 'chf',
              product_data: {
                name: `Abonnement Laxacube ${selectedPlan.name}`,
                description: `Accès illimité au plan ${selectedPlan.name}`,
              },
              unit_amount: Math.round(selectedPlan.price * 100),
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        // IMPORTANT : On passe l'ID de session et du plan dans l'URL de retour
        success_url: `${env.get('APP_URL')}/dashboard/${user.username}?payment=success&session_id={CHECKOUT_SESSION_ID}&planId=${selectedPlan.id}`,
        cancel_url: `${env.get('APP_URL')}/dashboard/${user.username}?payment=cancel`,
        metadata: { userId: user.id, planId: selectedPlan.id },
      })

      return response.redirect().toPath(stripeSession.url!)
    } catch (error) {
      return response.internalServerError('Erreur Stripe : ' + error.message)
    }
  }

  // La méthode qui fait le vrai boulot de vérification
  async handlePaymentSuccess({ request, session }: HttpContext) {
    const sessionId = request.input('session_id')
    const user = session.get('user')

    if (!sessionId || !user) return

    try {
      // 1. On récupère la session DIRECTEMENT chez Stripe
      const sessionInfo = await stripe.checkout.sessions.retrieve(sessionId)

      // 2. On vérifie le statut du paiement
      if (sessionInfo.payment_status === 'paid') {
        // SÉCURITÉ : On récupère le planId depuis les metadata de Stripe, pas depuis l'URL !
        const realPlanId = sessionInfo.metadata?.planId

        if (!realPlanId) {
          console.error('Aucun PlanId trouvé dans les metadata Stripe.')
          return
        }

        const selectedPlan = await Plan.find(realPlanId)

        if (selectedPlan) {
          // 3. APPEL À NEXTCLOUD
          await this.nextcloudService.upgradeUser(
            user.username,
            selectedPlan.name,
            `${selectedPlan.quotaGb}GB`
          )

          console.log(`[Laxacube] Upgrade SÉCURISÉ pour ${user.username} vers ${selectedPlan.name}`)
        }
      }
    } catch (e) {
      console.error('Erreur lors de la validation du paiement:', e)
    }
  }
}
