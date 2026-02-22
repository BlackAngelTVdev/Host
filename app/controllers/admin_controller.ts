import Plan from '#models/plan'
import Discount from '#models/discount'
import type { HttpContext } from '@adonisjs/core/http'
import NextcloudService from '#services/nextcloud_service'
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import Stripe from 'stripe' // <--- AJOUTE ÇA
import env from '#start/env' // <--- AJOUTE ÇA

// Initialisation de Stripe avec ta clé secrète
const stripe = new Stripe(env.get('STRIPE_SECRET_KEY'))

@inject()
export default class AdminController {
  constructor(protected nextcloudService: NextcloudService) {}

  /**
   * Dashboard Admin : Liste les plans et les codes promo
   */
  async index({ view }: HttpContext) {
    const plans = await Plan.all()
    const discounts = await Discount.query().orderBy('createdAt', 'desc')

    return view.render('pages/loged/admin/index', { plans, discounts })
  }

  /**
   * Plans : Formulaire d'édition
   */
  async edit({ params, view }: HttpContext) {
    const plan = await Plan.findOrFail(params.id)
    return view.render('pages/loged/admin/edit_plan', { plan })
  }

  /**
   * Plans : Mise à jour
   */
  async update({ params, request, response, session }: HttpContext) {
    const plan = await Plan.findOrFail(params.id)
    const data = request.only(['isActive' /* ... autres champs */])

    // L'astuce : si la checkbox "Ventes Ouvertes" est décochée,
    // on met isManuallyDisabled à true.
    plan.isManuallyDisabled = !data.isActive

    await plan.save()

    // On relance le calcul pour mettre à jour isActive selon le stock
    await this.nextcloudService.refreshPlansStock()

    session.flash('success', 'Réglages enregistrés')
    return response.redirect().toRoute('admin.index')
  }

  /**
   * Coupons : Création d'un code promo (Sync avec Stripe)
   */
  // AdminController.ts
  async storeDiscount({ request, response, session }: HttpContext) {
    // AJOUT : On récupère TOUT ce qui vient du formulaire
    const data = request.only([
      'code',
      'type',
      'value',
      'duration_months',
      'max_uses',
      'expires_at',
    ])

    const codeUpper = data.code.toUpperCase().trim()

    try {
      // 1. Sync avec Stripe
      await stripe.coupons.create({
        duration: data.duration_months ? 'repeating' : 'forever',
        duration_in_months: data.duration_months ? Number(data.duration_months) : undefined,
        currency: 'chf',
        [data.type === 'percentage' ? 'percent_off' : 'amount_off']:
          data.type === 'percentage' ? data.value : data.value * 100,
        id: codeUpper,
      })

      // 2. Création en DB (Adonis fera la conversion camelCase -> snake_case grâce au modèle)
      await Discount.create({
        code: codeUpper,
        type: data.type,
        value: data.value,
        durationMonths: data.duration_months || null,
        maxUses: data.max_uses || null, // Sera maintenant rempli
        expiresAt: data.expires_at ? DateTime.fromISO(data.expires_at) : null, // Sera maintenant rempli
        usedCount: 0,
      })

      session.flash('success', `Code ${codeUpper} créé avec succès !`)
    } catch (error) {
      console.error(error)
      session.flash('error', 'Erreur : ' + error.message)
    }
    return response.redirect().back()
  }

  /**
   * Coupons : Suppression
   */
  async deleteDiscount({ params, response, session }: HttpContext) {
    const discount = await Discount.findOrFail(params.id)

    try {
      // 1. On tente de le supprimer chez Stripe d'abord
      // On utilise discount.code car c'est l'ID qu'on a donné au coupon Stripe
      try {
        await stripe.coupons.del(discount.code.toUpperCase())
      } catch (stripeError) {
        // Si le coupon n'existe déjà plus sur Stripe, on log juste l'info
        // sans bloquer la suppression en base de données locale
        console.warn(
          `Coupon ${discount.code} non trouvé sur Stripe, suppression locale uniquement.`
        )
      }

      // 2. On le supprime de notre base de données
      await discount.delete()

      session.flash('success', `Le code ${discount.code} a été supprimé partout.`)
    } catch (e) {
      console.error(e)
      session.flash('error', 'Erreur lors de la suppression du code promo.')
    }

    return response.redirect().back()
  }

  async checkPromoApi({ request, response }: HttpContext) {
    const code = request.input('code')
    const discount = await Discount.query().where('code', code.toUpperCase()).first()

    if (discount && discount.isValid) {
      return response.json({
        valid: true,
        type: discount.type,
        value: discount.value,
      })
    }
    return response.json({ valid: false })
  }
}
