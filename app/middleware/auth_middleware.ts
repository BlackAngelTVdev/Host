import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import NextcloudService from '#services/nextcloud_service'
import { inject } from '@adonisjs/core'

@inject()
export default class AuthMiddleware {
  constructor(protected nextcloudService: NextcloudService) {}

  async handle(ctx: HttpContext, next: NextFn) {
    const { session, response, params, view } = ctx


    const loggedInUser = session.get('user')
    if (!loggedInUser || !loggedInUser.username) {
      session.flash('error', 'Tu dois être connecté pour voir ça.')
      return response.redirect().toRoute('auth.login')
    }

 
    if (params.username) {
      const urlUsername = params.username.toLowerCase()
      const sessionUsername = loggedInUser.username.toLowerCase()

      if (urlUsername !== sessionUsername) {
        return response.redirect().toRoute('dashboard', { username: loggedInUser.username })
      }
    }

    try {
      const userData = await this.nextcloudService.getUserData(loggedInUser.username)
      
      
      const sharedUser = userData.success 
        ? userData 
        : { ...loggedInUser, groups: ['Free'] }

      view.share({ user: sharedUser })
    } catch (e) {
      view.share({ user: { ...loggedInUser, groups: ['Free'] } })
    }

    return next()
  }
}