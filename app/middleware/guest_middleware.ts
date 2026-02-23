import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class GuestMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { session, response } = ctx

    const loggedInUser = session.get('user')

    if (loggedInUser) {

      return response.redirect().toRoute('dashboard', { username: loggedInUser.username })
    }


    return next()
  }
}