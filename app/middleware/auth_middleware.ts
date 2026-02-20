import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import NextcloudService from '#services/nextcloud_service' // Vérifie ton chemin
import { inject } from '@adonisjs/core'

@inject()
export default class AuthMiddleware {
  // On injecte le service pour parler à Nextcloud
  constructor(protected nextcloudService: NextcloudService) {}

  async handle(ctx: HttpContext, next: NextFn) {
    const { session, response, params, view } = ctx

    // 1. Est-ce que le mec est connecté ?
    const loggedInUser = session.get('user')

    if (!loggedInUser) {
      session.flash('error', 'Tu dois être connecté pour voir ça.')
      return response.redirect().toRoute('auth.login')
    }

    // 2. Sécurité : Dashboard d'autrui
    if (params.username && params.username !== loggedInUser.username) {
      session.flash('error', "Ceci n'est pas ton dashboard, petit malin.")
      return response.redirect().toRoute('dashboard', { username: loggedInUser.username })
    }

    // --- LE NOUVEAU BAIL ICI ---
    // 3. Récupérer les infos Nextcloud et les partager avec TOUTES les vues
    const userData = await this.nextcloudService.getUserData(loggedInUser.username)
    
    if (userData.success) {
      // view.share rend la variable "user" disponible dans TOUS tes fichiers .edge
      view.share({
        user: userData
      })
    }

    return next()
  }
}