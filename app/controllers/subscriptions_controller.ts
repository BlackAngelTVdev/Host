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

    // 1. Sécurité : Vérifier si le plan existe
    if (!selectedPlan) {
      return response.badRequest('Plan invalide ou introuvable.')
    }

    // 2. Formatage de la description (gestion des séparateurs '|')
    const planFeatures = selectedPlan.description
      ? selectedPlan.description
          .split('|')
          .map((f) => `• ${f.trim()}`) // On ajoute une puce devant chaque feature
          .join('\n') // On joint avec un retour à la ligne
      : ''

    const displayDescription = `Espace de stockage ${selectedPlan.quotaGb}GB. Inclus : ${planFeatures}`

    try {
      // 3. Configuration de base de la session Stripe
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'chf',
              product_data: {
                name: `Laxacube ${selectedPlan.name}`,
                description: displayDescription, // Affiche maintenant les features séparées par des virgules
              },
              unit_amount: Math.round(selectedPlan.price * 100), // Prix plein (Stripe gère la remise via le coupon)
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${env.get('APP_URL')}/dashboard/${user.username}?payment=success&session_id={CHECKOUT_SESSION_ID}&planId=${selectedPlan.id}&promo=${promoCode || ''}`,
        cancel_url: `${env.get('APP_URL')}/dashboard/${user.username}?payment=cancel`,

        // On lie la session au client par son email (pré-rempli sur Stripe)
        customer_email: user.email,

        metadata: {
          userId: user.id,
          planId: selectedPlan.id,
          promoCode: promoCode || null,
        },
      }

      // 4. Application du code promo (Coupons natifs Stripe)
      if (promoCode) {
        const discount = await Discount.query().where('code', promoCode.toUpperCase()).first()

        if (discount && discount.isValid) {
          // Stripe applique la réduction définie (durée, montant, etc.) configurée dans ton AdminController
          sessionConfig.discounts = [{ coupon: discount.code.toUpperCase() }]
        }
      }

      // 5. Création et redirection
      const stripeSession = await stripe.checkout.sessions.create(sessionConfig)

      return response.redirect().toPath(stripeSession.url!)
    } catch (error) {
      console.error('Erreur Stripe Checkout:', error)
      return response.internalServerError('Erreur lors de la génération de la session de paiement.')
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
