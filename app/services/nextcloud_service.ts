import Plan from '#models/plan'
import env from '#start/env'

export default class NextcloudService {
  private readonly cloudUrl = env.get('NEXTCLOUD_URL')
  private readonly adminUser = env.get('NEXTCLOUD_ADMIN_USER')
  private readonly adminPass = env.get('NEXTCLOUD_ADMIN_PASS')

  /**
   * Génère les headers d'authentification pour l'API OCS
   */
  private getHeaders(customAuth?: string) {
    const authString =
      customAuth || Buffer.from(`${this.adminUser}:${this.adminPass}`).toString('base64')
    return {
      'Authorization': `Basic ${authString}`,
      'OCS-APIRequest': 'true',
      'Accept': 'application/json',
    }
  }

  /**
   * Crée un utilisateur avec quota et groupe par défaut
   */
  public async createUser(
    username: string,
    password: string,
    email: string,
    quota = '5GB',
    group = 'Free'
  ) {
    try {
      const response = await fetch(`${this.cloudUrl}/ocs/v1.php/cloud/users?format=json`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'userid': username,
          'password': password,
          'email': email,
          'quota': quota,
          'groups[]': group,
        }),
      })

      const data = await response.json()
      const success = data.ocs.meta.statuscode === 100

      return {
        success,
        message: success ? 'Utilisateur créé' : data.ocs.meta.message,
      }
    } catch (error) {
      console.error('Nextcloud CreateUser Error:', error)
      return { success: false, message: 'Erreur de connexion au serveur' }
    }
  }

  /**
   * Récupère les infos de stockage et les groupes d'un utilisateur
   */
  public async getUserData(username: string) {
    try {
      const response = await fetch(
        `${this.cloudUrl}/ocs/v1.php/cloud/users/${username}?format=json`,
        {
          headers: this.getHeaders(),
        }
      )

      const data = await response.json()
      if (data.ocs.meta.statuscode !== 100) return { success: false }

      const { quota, email, groups } = data.ocs.data
      return {
        success: true,
        email,
        groups,
        used: (quota.used / 1024 ** 3).toFixed(2),
        total: (quota.quota / 1024 ** 3).toFixed(0),
        percent: quota.relative.toFixed(1),
      }
    } catch (error) {
      return { success: false }
    }
  }

  /**
   * Vérifie les identifiants et récupère le username réel (si email fourni)
   */
  public async checkAuth(identifier: string, password: string) {
    let username = identifier

    // Résolution du username si c'est un email
    if (identifier.includes('@')) {
      try {
        const res = await fetch(
          `${this.cloudUrl}/ocs/v1.php/cloud/users?search=${identifier}&format=json`,
          {
            headers: this.getHeaders(),
          }
        )
        const searchData = await res.json()
        const users = searchData.ocs.data.users
        if (users?.length > 0) username = users[0]
      } catch (e) {
        return { success: false }
      }
    }

    // Tentative de login
    try {
      const userAuth = Buffer.from(`${username}:${password}`).toString('base64')
      const response = await fetch(`${this.cloudUrl}/ocs/v1.php/cloud/user?format=json`, {
        headers: this.getHeaders(userAuth),
      })
      const data = await response.json()

      return {
        success: data.ocs.meta.statuscode === 100,
        userData: data.ocs.data,
        realUsername: username,
      }
    } catch (e) {
      return { success: false }
    }
  }

  /**
   * Calcule l'espace libre total du serveur (arrondi à 50Go)
   */
  public async getServerFreeSpace() {
    try {
      const response = await fetch(
        `${this.cloudUrl}/ocs/v1.php/apps/serverinfo/api/v1/info?format=json`,
        { headers: this.getHeaders() }
      )
      const json = await response.json()

      // Le chemin exact selon ton log : ocs -> data -> nextcloud -> system -> freespace
      const freeBytes = json?.ocs?.data?.nextcloud?.system?.freespace

      if (typeof freeBytes === 'undefined') {
        console.error('Clé freespace introuvable dans le JSON')
        return 0
      }

      // Conversion en GB
      const freeGb = Math.floor(freeBytes / 1024 ** 3)
      console.log(`Stockage réel détecté : ${freeGb} GB libres`)

      // On garde l'arrondi à 50 pour la sécurité (ex: 917 Go -> 900 Go)
      return Math.floor(freeGb / 50) * 50
    } catch (e) {
      console.error('Erreur Fetch Nextcloud:', e)
      return 0
    }
  }
  // app/services/nextcloud_service.ts

  public async refreshPlansStock() {
    const freeSpaceGb = await this.getServerFreeSpace()
    const plans = await Plan.all()

    // On définit tes limites ici
    const limits = {
      Gratuit: 100,
      Premium: 8,
      Ultra: 2,
    }

    for (const plan of plans) {
      // 1. Calcul selon le hardware (ex: 190 places physiques)
      const physicalAvailable = Math.floor(freeSpaceGb / plan.quotaGb)

      // 2. Ta limite commerciale (ex: 100 places)
      const commercialLimit = limits[plan.name] || 0

      // 3. On prend le plus petit des deux
      // Si physique dit 190 mais limite dit 100 -> On affiche 100
      // Si physique dit 2 mais limite dit 100 -> On affiche 2 (Sécurité !)
      const finalStock = Math.min(physicalAvailable, commercialLimit)

      plan.stockAvailable = finalStock

      // On désactive si stock à 0 OU si tu as forcé le plan à "Ultra"
      plan.isActive = finalStock > 0 && plan.name !== 'Ultra'

      await plan.save()
    }
  }
}
