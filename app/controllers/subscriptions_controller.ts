import Plan from '#models/plan'
import Discount from '#models/discount'
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

    if (!selectedPlan) {
      return response.badRequest('Plan invalide ou introuvable.')
    }

    const planFeatures = selectedPlan.description
      ? selectedPlan.description
          .split('|')
          .map((f) => `• ${f.trim()}`)
          .join('\n')
      : ''

    const displayDescription = `Espace de stockage ${selectedPlan.quotaGb}GB\n${planFeatures}`

    try {
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'chf',
              product_data: {
                name: `Laxacube ${selectedPlan.name}`,
                description: displayDescription,
              },
              unit_amount: Math.round(selectedPlan.price * 100),
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${env.get('APP_URL')}/dashboard/${user.username}?payment=success&session_id={CHECKOUT_SESSION_ID}&planId=${selectedPlan.id}&promo=${promoCode || ''}`,
        cancel_url: `${env.get('APP_URL')}/dashboard/${user.username}?payment=cancel`,
        customer_email: user.email,
        metadata: {

          nextcloudUsername: user.username, 
          planId: selectedPlan.id,
          promoCode: promoCode || null,
        },

        subscription_data: {
          metadata: {
            nextcloudUsername: user.username,
          },
        },
      }

      if (promoCode) {
        const discount = await Discount.query().where('code', promoCode.toUpperCase()).first()
        if (discount && discount.isValid) {
          sessionConfig.discounts = [{ coupon: discount.code.toUpperCase() }]
        }
      }

      const stripeSession = await stripe.checkout.sessions.create(sessionConfig)
      return response.redirect().toPath(stripeSession.url!)
    } catch (error) {
      console.error('Erreur Stripe Checkout:', error)
      return response.internalServerError('Erreur de paiement.')
    }
  }

  async handlePaymentSuccess({ request, session }: HttpContext) {
    const sessionId = request.input('session_id')
    const user = session.get('user')

    if (!sessionId || !user) return

    try {
      const sessionInfo = await stripe.checkout.sessions.retrieve(sessionId)

      if (sessionInfo.payment_status === 'paid') {
        const realPlanId = sessionInfo.metadata?.planId
        const promoCodeMetadata = sessionInfo.metadata?.promoCode

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
        }
      }
    } catch (e) {
      console.error('Erreur validation paiement:', e)
    }
  }

  async openPortal({ session, response }: HttpContext) {
    const sessionUser = session.get('user')

    if (!sessionUser || !sessionUser.email) {
      return response.unauthorized('Email manquant dans la session.')
    }

    try {

      const customers = await stripe.customers.list({
        email: sessionUser.email,
        limit: 1,
      })

      if (customers.data.length === 0) {
        session.flash('error', "Profil de paiement introuvable.")
        return response.redirect().back()
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customers.data[0].id,
        return_url: `${env.get('APP_URL')}/dashboard/${sessionUser.username}`,
      })

      return response.redirect().toPath(portalSession.url)
    } catch (error) {
      console.error('Erreur Portail Stripe:', error)
      return response.internalServerError('Erreur lors de l’accès au portail.')
    }
  }
}