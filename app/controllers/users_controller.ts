import NextcloudService from '#services/nextcloud_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Plan from '#models/plan'
import { registerValidator } from '#validators/user'

@inject()
export default class UsersController {
  constructor(protected nextcloudService: NextcloudService) {}

  // Affiche le formulaire
  async register({ view }: HttpContext) {
    return view.render('pages/auth/register')
  }

  /**
   * Création de compte avec décrémentation manuelle
   */
  async store({ request, response, session }: HttpContext) {
    try {
      // 1. Validation (Mails jetables + format)
      const data = await request.validateUsing(registerValidator)

      // 2. Check Stock
      const freePlan = await Plan.query().where('name', 'Gratuit').where('isActive', true).first()

      if (!freePlan || freePlan.stockAvailable <= 0) {
        session.flash('error', "Désolé, il n'y a plus de places disponibles.")
        return response.redirect().back()
      }

      // 3. Création Nextcloud
      const result = await this.nextcloudService.createUser(
        data.username,
        data.password,
        data.email
      )

      if (result.success) {
        // 4. Update Stock
        freePlan.stockAvailable -= 1
        if (freePlan.stockAvailable <= 0) freePlan.isActive = false
        await freePlan.save()

        session.put('user', { username: data.username, email: data.email })
        return response.redirect().toRoute('dashboard', { username: data.username })
      }

      // Erreur venant de Nextcloud (ex: user déjà existant)
      session.flash('error', result.message)
      return response.redirect().back()
    } catch (error) {
      // --- MODIFICATION ICI ---
      if (error.messages && Array.isArray(error.messages)) {
        // On prend le premier message d'erreur de VineJS pour l'afficher en flash
        session.flash('error', error.messages[0].message)
      } else {
        session.flash('error', 'Une erreur inattendue est survenue.')
      }

      session.flashAll()
      console.error('Validation failed:', error.messages)
      return response.redirect().back()
      // --- FIN MODIFICATION ---
    }
  }
  async dashboard({ params, view }: HttpContext) {
    const userData = await this.nextcloudService.getUserData(params.username)
    if (!userData.success) {
      return view.render('pages/error', { message: 'Utilisateur non trouvé' })
    }
    return view.render('pages/loged/dashboard', { user: userData, username: params.username })
  }

  async logout({ session, response }: HttpContext) {
    session.forget('user')
    session.flash('success', 'Tu as été déconnecté. À la prochaine !')
    return response.redirect().toRoute('home')
  }

  async login({ view }: HttpContext) {
    return view.render('pages/auth/login')
  }

  async handleLogin({ request, response, session }: HttpContext) {
    const { uid, password } = request.only(['uid', 'password'])
    const result = await this.nextcloudService.checkAuth(uid, password)

    if (result.success) {
      session.put('user', {
        username: result.realUsername,
        email: result.userData.email,
      })
      return response.redirect().toRoute('dashboard', { username: result.realUsername })
    }

    session.flash('error', 'Identifiants invalides')
    return response.redirect().back()
  }
}
