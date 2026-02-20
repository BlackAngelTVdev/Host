import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class GuestMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { session, response } = ctx

    // Si le mec est DEJÀ connecté
    const loggedInUser = session.get('user')

    if (loggedInUser) {
      // On le dégage vers son dashboard
      return response.redirect().toRoute('dashboard', { username: loggedInUser.username })
    }

    // Sinon, c'est un visiteur, il peut passer
    return next()
  }
}