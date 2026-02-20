// app/controllers/home_controller.ts
import Plan from '#models/plan'
import type { HttpContext } from '@adonisjs/core/http'
import NextcloudService from '#services/nextcloud_service'
import { inject } from '@adonisjs/core'

@inject()
export default class HomeController {
  constructor(protected nextcloudService: NextcloudService) {}

  async index({ view, session }: HttpContext) {
    // 1. On récupère l'user de la session (s'il existe)
    const loggedInUser = session.get('user')
    let userData = null

    // 2. Si on a un user en session, on récupère ses infos Nextcloud (groupes, etc.)
    if (loggedInUser) {
      try {
        const result = await this.nextcloudService.getUserData(loggedInUser.username)
        userData = result.success ? result : { ...loggedInUser, groups: ['Free'] }
      } catch (e) {
        userData = { ...loggedInUser, groups: ['Free'] }
      }
    }

    // 3. On récupère les plans
    const plans = await Plan.query().orderBy('price', 'asc')

    // 4. On envoie TOUT à la vue explicitement
    return view.render('pages/home', { 
      plans, 
      user: userData // On force le passage de la variable 'user'
    })
  }
}