import NextcloudService from '#services/nextcloud_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class UsersController {
  constructor(protected nextcloudService: NextcloudService) {}

  // Affiche le formulaire
  async register({ view }: HttpContext) {
    return view.render('pages/auth/register')
  }

  // Traite l'inscription
  async store({ request, response, session }: HttpContext) {
    const data = request.only(['username', 'email', 'password'])

    const result = await this.nextcloudService.createUser(data.username, data.password, data.email)

    if (result.success) {
      // CRUCIAL : On stocke l'user pour que le middleware 'auth' le trouve
      session.put('user', { username: data.username, email: data.email })

      return response.redirect().toRoute('dashboard', { username: data.username })
    }

    session.flash('error', result.message)
    return response.redirect().back()
  }
  async dashboard({ params, view }: HttpContext) {
    const userData = await this.nextcloudService.getUserData(params.username)

    if (!userData.success) {
      return view.render('pages/error', { message: 'Utilisateur non trouvé' })
    }

    return view.render('pages/loged/dashboard', { user: userData, username: params.username })
  }
  async logout({ session, response }: HttpContext) {
    // On dégage les infos de l'utilisateur de la session
    session.forget('user')

    // Petit message pour confirmer
    session.flash('success', 'Tu as été déconnecté. À la prochaine !')

    // Retour à l'accueil
    return response.redirect().toRoute('home')
  }
}
