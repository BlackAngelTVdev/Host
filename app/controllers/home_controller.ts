// app/controllers/home_controller.ts
import Plan from '#models/plan'
import type { HttpContext } from '@adonisjs/core/http'
import NextcloudService from '#services/nextcloud_service'
import { inject } from '@adonisjs/core'

@inject()
export default class HomeController {
  constructor(protected nextcloudService: NextcloudService) {}

  async index({ view, session }: HttpContext) {

    try {
      await this.nextcloudService.refreshPlansStock()
    } catch (error) {
      console.error('Erreur lors du refresh des stocks:', error)
    
    }


    const loggedInUser = session.get('user')
    let userData = null

    if (loggedInUser) {
      try {
        const result = await this.nextcloudService.getUserData(loggedInUser.username)
        userData = result.success ? result : { ...loggedInUser, groups: ['Free'] }
      } catch (e) {
        userData = { ...loggedInUser, groups: ['Free'] }
      }
    }


    const plans = await Plan.query().orderBy('price', 'asc')

    return view.render('pages/home', { 
      plans, 
      user: userData 
    })
  }
}