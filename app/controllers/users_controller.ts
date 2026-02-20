import NextcloudService from '#services/nextcloud_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Plan from '#models/plan'
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

  // 1. Chercher le plan Gratuit qui est encore actif
  const freePlan = await Plan.query()
    .where('name', 'Gratuit')
    .where('isActive', true)
    .first()
  
  // 2. Vérifier si on peut encore inscrire quelqu'un
  if (!freePlan || freePlan.stockAvailable <= 0) {
    session.flash('error', "Désolé, il n'y a plus de place disponible pour le moment.")
    return response.redirect().back()
  }

  // 3. Créer l'utilisateur sur Nextcloud
  const result = await this.nextcloudService.createUser(data.username, data.password, data.email)

  if (result.success) {
    // 4. Décrémenter le stock
    freePlan.stockAvailable = freePlan.stockAvailable - 1
    
    // 5. Si c'était la dernière place, on désactive le plan
    if (freePlan.stockAvailable === 0) {
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
    // On dégage les infos de l'utilisateur de la session
    session.forget('user')

    // Petit message pour confirmer
    session.flash('success', 'Tu as été déconnecté. À la prochaine !')

    // Retour à l'accueil
    return response.redirect().toRoute('home')
  }
  // Affiche la page de login
  async login({ view }: HttpContext) {
    return view.render('pages/auth/login')
  }

  // Traite la connexion
  async handleLogin({ request, response, session }: HttpContext) {
    // On renomme 'username' en 'uid' pour plus de clarté (peut être email ou pseudo)
    const { uid, password } = request.only(['uid', 'password'])

    const result = await this.nextcloudService.checkAuth(uid, password)

    if (result.success) {
      session.put('user', {
        username: result.realUsername, // On utilise le vrai pseudo trouvé par le service
        email: result.userData.email,
      })

      return response.redirect().toRoute('dashboard', { username: result.realUsername })
    }

    session.flash('error', 'Identifiants invalides')
    return response.redirect().back()
  }
}
