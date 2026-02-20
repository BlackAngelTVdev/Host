import NextcloudService from '#services/nextcloud_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Plan from '#models/plan'

@inject()
export default class UsersController {
  constructor(protected nextcloudService: NextcloudService) {}

  /**
   * Rafraîchit les stocks selon le hardware. 
   * À appeler manuellement (via une route admin ou le HomeController)
   */
  private async refreshPlansStock() {
    const freeSpaceGb = await this.nextcloudService.getServerFreeSpace()
    const plans = await Plan.all()

    for (const plan of plans) {
      const physicalAvailable = Math.floor(freeSpaceGb / plan.quotaGb)
      plan.stockAvailable = physicalAvailable
      plan.isActive = physicalAvailable > 0 && plan.name !== 'Ultra'
      await plan.save()
    }
  }

  // Affiche le formulaire
  async register({ view }: HttpContext) {
    return view.render('pages/auth/register')
  }

  /**
   * Création de compte avec décrémentation manuelle
   */
  async store({ request, response, session }: HttpContext) {
    const data = request.only(['username', 'email', 'password'])

    // 1. On cherche le plan Gratuit
    const freePlan = await Plan.query()
      .where('name', 'Gratuit')
      .where('isActive', true)
      .first()

    // 2. Vérification du stock restant
    if (!freePlan || freePlan.stockAvailable <= 0) {
      session.flash('error', "Désolé, il n'y a plus de places 'Gratuit' disponibles.")
      return response.redirect().back()
    }

    // 3. Création sur Nextcloud
    const result = await this.nextcloudService.createUser(
      data.username,
      data.password,
      data.email
    )

    if (result.success) {
      // 4. ON ENLÈVE 1 AU STOCK "FREE" POUR ÊTRE SUR
      freePlan.stockAvailable = freePlan.stockAvailable - 1
      
      // Si on arrive à 0, on désactive le plan
      if (freePlan.stockAvailable <= 0) {
        freePlan.isActive = false
      }
      
      await freePlan.save()

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