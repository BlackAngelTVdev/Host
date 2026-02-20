import Plan from '#models/plan'
import type { HttpContext } from '@adonisjs/core/http'
import NextcloudService from '#services/nextcloud_service'
import { inject } from '@adonisjs/core'

@inject()
export default class HomeController {
  constructor(protected nextcloudService: NextcloudService) {}

  async index({ view }: HttpContext) {
    // On refresh via le service avant d'afficher
    await this.nextcloudService.refreshPlansStock()

    const plans = await Plan.query().orderBy('price', 'asc')
    return view.render('pages/home', { plans })
  }
}