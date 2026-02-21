import Plan from '#models/plan'
import { HttpContext } from '@adonisjs/core/http'
import Stripe from 'stripe'
import env from '#start/env'

// Initialisation de Stripe avec la clé de ton .env
const stripe = new Stripe(env.get('STRIPE_SECRET_KEY'))

export default class SubscriptionsController {
  async confirm({ params, view, response, session }: HttpContext) {
    const planId = params.plan
    const user = session.get('user')

    const selectedPlan = await Plan.find(planId)

    if (!selectedPlan || !selectedPlan.isActive) {
      session.flash('error', 'Plan introuvable.')
      return response.redirect().toRoute('dashboard', { username: user.username })
    }

    return view.render('pages/loged/confirm', {
      plan: selectedPlan,
    })
  }

  async createSession({ request, response, session }: HttpContext) {
    const planId = request.input('planId')
    const user = session.get('user')

    const selectedPlan = await Plan.find(planId)
    if (!selectedPlan) {
      return response.badRequest('Plan invalide')
    }

    try {
      const stripeSession = await stripe.checkout.sessions.create({
        // 'card' pour tout le monde, 'twint' pour les vrais Suisses
        payment_method_types: ['card'],

        line_items: [
          {
            price_data: {
              currency: 'chf',
              product_data: {
                name: `Abonnement Laxacube ${selectedPlan.name}`,
                description: `Accès illimité au plan ${selectedPlan.name}`,
              },
              // Stripe veut des centimes (ex: 10.00 CHF -> 1000)
              unit_amount: Math.round(selectedPlan.price * 100),

              // LA CORRECTION EST ICI :
              // Pour le mode 'subscription', Stripe DOIT savoir la fréquence
              recurring: {
                interval: 'month', // Prélèvement automatique chaque mois
              },
            },
            quantity: 1,
          },
        ],

        mode: 'subscription',

        // Les URLs de redirection après le paiement
        success_url: `${env.get('APP_URL')}/dashboard/${user.username}?payment=success`,
        cancel_url: `${env.get('APP_URL')}/dashboard/${user.username}?payment=cancel`,

        // On garde les metadata pour savoir qui a payé quoi lors du Webhook
        metadata: {
          userId: user.id,
          planId: selectedPlan.id,
        },
      })

      return response.redirect().toPath(stripeSession.url!)
    } catch (error) {
      console.error(error)
      return response.internalServerError('Erreur Stripe : ' + error.message)
    }
  }
}
