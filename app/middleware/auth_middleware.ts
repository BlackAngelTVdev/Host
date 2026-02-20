import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import NextcloudService from '#services/nextcloud_service'
import { inject } from '@adonisjs/core'

@inject()
export default class AuthMiddleware {
  constructor(protected nextcloudService: NextcloudService) {}

  async handle(ctx: HttpContext, next: NextFn) {
    const { session, response, params, view } = ctx

    // 1. Check connexion (Si pas de session, on dégage au login)
    const loggedInUser = session.get('user')
    if (!loggedInUser || !loggedInUser.username) {
      session.flash('error', 'Tu dois être connecté pour voir ça.')
      return response.redirect().toRoute('auth.login')
    }

    // 2. Sécurité Dashboard : ON NE REDIRIGE QUE SI LE PARAM EXISTE
    // Si on est sur une page sans ":username" (comme le checkout), on ignore ce check
    if (params.username) {
      const urlUsername = params.username.toLowerCase()
      const sessionUsername = loggedInUser.username.toLowerCase()

      if (urlUsername !== sessionUsername) {
        return response.redirect().toRoute('dashboard', { username: loggedInUser.username })
      }
    }

    // 3. Partage des données utilisateur pour les vues (.edge)
    try {
      const userData = await this.nextcloudService.getUserData(loggedInUser.username)
      
      // On s'assure que userData contient bien le username pour éviter les erreurs Edge
      const sharedUser = userData.success 
        ? userData 
        : { ...loggedInUser, groups: ['Free'] }

      view.share({ user: sharedUser })
    } catch (e) {
      // En cas de pépin avec l'API Nextcloud, on ne bloque pas l'utilisateur
      view.share({ user: { ...loggedInUser, groups: ['Free'] } })
    }

    return next()
  }
}