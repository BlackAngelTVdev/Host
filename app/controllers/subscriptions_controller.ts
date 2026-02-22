import Plan from '#models/plan'
import Discount from '#models/discount' // Importe ton nouveau modèle
import { HttpContext } from '@adonisjs/core/http'
import Stripe from 'stripe'
import env from '#start/env'
import NextcloudService from '#services/nextcloud_service'
import { inject } from '@adonisjs/core'

const stripe = new Stripe(env.get('STRIPE_SECRET_KEY'))

@inject()
export default class SubscriptionsController {
  constructor(protected nextcloudService: NextcloudService) {}

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

  async createSession({ request, response, session }: HttpContext) {
    const { planId, promoCode } = request.only(['planId', 'promoCode'])
    const user = session.get('user')
    const selectedPlan = await Plan.find(planId)

    if (!selectedPlan) return response.badRequest('Plan invalide')

    try {
      // 1. On prépare la session Stripe avec le PRIX RÉEL du plan
      const sessionConfig: any = {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'chf',
              product_data: {
                name: `Abonnement Laxacube ${selectedPlan.name}`,
                description: `Espace de stockage ${selectedPlan.quotaGb}GB`,
              },
              // /!\ TRÈS IMPORTANT : On envoie le prix NORMAL ici
              unit_amount: Math.round(selectedPlan.price * 100),
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${env.get('APP_URL')}/dashboard/${user.username}?payment=success&session_id={CHECKOUT_SESSION_ID}&planId=${selectedPlan.id}&promo=${promoCode || ''}`,
        cancel_url: `${env.get('APP_URL')}/dashboard/${user.username}?payment=cancel`,
        metadata: {
          userId: user.id,
          planId: selectedPlan.id,
          promoCode: promoCode || null,
        },
      }

      // 2. Si un code promo est présent, on l'ajoute à la session
      if (promoCode) {
        const discount = await Discount.query().where('code', promoCode.toUpperCase()).first()

        if (discount && discount.isValid) {
          // Au lieu de calculer nous-mêmes, on passe l'ID du coupon à Stripe
          // Stripe doit avoir un coupon créé avec le MÊME code (ex: "SALO50")
          sessionConfig.discounts = [{ coupon: discount.code.toUpperCase() }]
        }
      }

      const stripeSession = await stripe.checkout.sessions.create(sessionConfig)

      return response.redirect().toPath(stripeSession.url!)
    } catch (error) {
      console.error('Erreur Stripe:', error)
      return response.internalServerError('Erreur lors de la création du paiement.')
    }
  }

  async handlePaymentSuccess({ request, session }: HttpContext) {
    const sessionId = request.input('session_id')
    const user = session.get('user')
    const promoUsed = request.input('promo') // On récupère le code de l'URL pour le traiter

    if (!sessionId || !user) return

    try {
      const sessionInfo = await stripe.checkout.sessions.retrieve(sessionId)

      if (sessionInfo.payment_status === 'paid') {
        const realPlanId = sessionInfo.metadata?.planId
        const promoCodeMetadata = sessionInfo.metadata?.promoCode

        // --- GESTION DU CODE PROMO (Incrémentation) ---
        if (promoCodeMetadata) {
          const discount = await Discount.query().where('code', promoCodeMetadata).first()
          if (discount) {
            discount.usedCount += 1
            await discount.save()
          }
        }

        const selectedPlan = await Plan.find(realPlanId)

        if (selectedPlan) {
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
