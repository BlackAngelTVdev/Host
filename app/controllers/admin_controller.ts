import Plan from '#models/plan'
import Discount from '#models/discount' // Assure-toi que le modèle existe
import type { HttpContext } from '@adonisjs/core/http'
import NextcloudService from '#services/nextcloud_service'
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

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
    const data = request.only(['price', 'quotaGb', 'isActive', 'isFeatured', 'name', 'description'])

    plan.merge({
      name: data.name,
      price: data.price,
      quotaGb: data.quotaGb,
      description: data.description,
      isActive: !!data.isActive,
      isFeatured: !!data.isFeatured,
    })

    await plan.save()
    await this.nextcloudService.refreshPlansStock()

    session.flash('success', `Plan ${plan.name} mis à jour !`)
    return response.redirect().toRoute('admin.index')
  }

  /**
   * Coupons : Création d'un code promo
   */
  async storeDiscount({ request, response, session }: HttpContext) {
    const data = request.only(['code', 'type', 'value', 'max_uses', 'expires_at'])

    try {
      await Discount.create({
        code: data.code.toUpperCase().trim(),
        type: data.type, // 'percentage' ou 'fixed'
        value: data.value,
        maxUses: data.max_uses || null,
        usedCount: 0,
        expiresAt: data.expires_at ? DateTime.fromISO(data.expires_at) : null,
      })

      session.flash('success', 'Nouveau code promo activé !')
    } catch (error) {
      session.flash('error', 'Erreur lors de la création du code (peut-être déjà existant).')
    }

    return response.redirect().back()
  }

  /**
   * Coupons : Suppression
   */
  async deleteDiscount({ params, response, session }: HttpContext) {
    const discount = await Discount.findOrFail(params.id)
    await discount.delete()

    session.flash('success', 'Code promo supprimé avec succès.')
    return response.redirect().back()
  }
  async checkPromoApi({ request, response }: HttpContext) {
  const code = request.input('code')
  const discount = await Discount.query().where('code', code.toUpperCase()).first()

  if (discount && discount.isValid) {
    return response.json({ 
        valid: true, 
        type: discount.type, 
        value: discount.value 
    })
  }
  return response.json({ valid: false })
}
}