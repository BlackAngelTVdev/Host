import Plan from '#models/plan'
import { HttpContext } from '@adonisjs/core/http'
import Stripe from 'stripe'
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export default class SubscriptionsController {
  
  // Affiche la page de "blabla" avant Stripe
  async confirm({ params, view, response, session }: HttpContext) {
    // params.plan contiendra l'ID (ex: 1, 2, 3)
    const planId = params.plan
    const loggedInUser = session.get('user')

    // On cherche par ID
    const selectedPlan = await Plan.find(planId)

    // Si l'ID n'existe pas ou que le plan est désactivé
    if (!selectedPlan || !selectedPlan.isActive) {
      session.flash('error', 'Plan introuvable.')
      return response.redirect().toRoute('dashboard', { username: loggedInUser.username })
    }

    return view.render('pages/loged/confirm', { 
      plan: selectedPlan 
    })
  }

  // C'est ici qu'on crée le lien Stripe quand il clique sur "Confirmer"
//   async createSession({ request, response, session }: HttpContext) {
//     const planName = request.input('planName')
//     const user = session.get('user')

//     const stripeSession = await stripe.checkout.sessions.create({
//       payment_method_types: ['card'],
//       line_items: [{
//         price_data: {
//           currency: 'eur',
//           product_data: { name: `Abonnement Laxacube ${planName}` },
//           unit_amount: planName === 'Premium' ? 999 : 1999, // Prix en centimes
//         },
//         quantity: 1,
//       }],
//       mode: 'subscription',
//       success_url: `https://ton-site.com/dashboard/${user.username}?payment=success`,
//       cancel_url: `https://ton-site.com/dashboard/${user.username}?payment=cancel`,
//       metadata: { username: user.username, plan: planName }
//     })

//     return response.redirect().toPath(stripeSession.url!)
//   }
}