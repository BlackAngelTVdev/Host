import Plan from '#models/plan'
import type { HttpContext } from '@adonisjs/core/http'

export default class HomeController {
  async index({ view }: HttpContext) {
    // On récupère TOUS les plans (même isActive: false)
    const plans = await Plan.query().orderBy('price', 'asc')

    return view.render('pages/home', { plans })
  }
}