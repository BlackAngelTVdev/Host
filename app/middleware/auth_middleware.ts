import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 */
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { session, response, params } = ctx

    // 1. Est-ce que le mec est connecté ?
    const loggedInUser = session.get('user')

    if (!loggedInUser) {
      session.flash('error', 'Tu dois être connecté pour voir ça.')
      return response.redirect().toRoute('auth.login')
    }

    // 2. Est-ce qu'il essaie de voir le dashboard de quelqu'un d'autre ?
    // On compare le pseudo en session avec celui dans l'URL
    if (params.username && params.username !== loggedInUser.username) {
      session.flash('error', "Ceci n'est pas ton dashboard, petit malin.")
      return response.redirect().toRoute('dashboard', { username: loggedInUser.username })
    }

    return next()
  }
}
