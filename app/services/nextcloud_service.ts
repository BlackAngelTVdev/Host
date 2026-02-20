import env from '#start/env'

export default class NextcloudService {
  /**
   * Crée un utilisateur sur ton instance Nextcloud via l'API OCS
   */
  public async createUser(username: string, password: string, email: string) {
    // Récupération des accès dans ton fichier .env
    const adminUser = env.get('NEXTCLOUD_ADMIN_USER')
    const adminPass = env.get('NEXTCLOUD_ADMIN_PASS')
    const cloudUrl = env.get('NEXTCLOUD_URL')

    // Encodage de l'auth basique
    const auth = Buffer.from(`${adminUser}:${adminPass}`).toString('base64')

    try {
      const response = await fetch(`${cloudUrl}/ocs/v1.php/cloud/users?format=json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'OCS-APIRequest': 'true', // Obligatoire pour l'API Nextcloud
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          userid: username,
          password: password,
          email: email,
          quota: '5GB', // Ton nouveau quota gratuit par défaut
        }),
      })

      const data = await response.json()

      // Nextcloud répond avec un code 100 si c'est un succès total
      if (data.ocs.meta.statuscode === 100) {
        return {
          success: true,
          message: 'Utilisateur créé avec succès',
        }
      } else {
        // En cas d'erreur (ex: utilisateur existe déjà)
        return {
          success: false,
          message: data.ocs.meta.message,
        }
      }
    } catch (error) {
      return {
        success: false,
        message: 'Erreur de connexion au serveur Nextcloud',
      }
    }
  }
  // app/services/nextcloud_service.ts

  public async getUserData(username: string) {
    const adminUser = env.get('NEXTCLOUD_ADMIN_USER')
    const adminPass = env.get('NEXTCLOUD_ADMIN_PASS')
    const cloudUrl = env.get('NEXTCLOUD_URL')
    const auth = Buffer.from(`${adminUser}:${adminPass}`).toString('base64')

    try {
      const response = await fetch(`${cloudUrl}/ocs/v1.php/cloud/users/${username}?format=json`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'OCS-APIRequest': 'true',
        },
      })

      const data = await response.json()
      if (data.ocs.meta.statuscode === 100) {
        const quota = data.ocs.data.quota
        return {
          success: true,
          email: data.ocs.data.email,
          // Nextcloud donne les valeurs en octets, on convertit en GB
          used: (quota.used / 1024 / 1024 / 1024).toFixed(2),
          total: (quota.quota / 1024 / 1024 / 1024).toFixed(0),
          percent: quota.relative.toFixed(1),
        }
      }
      return { success: false }
    } catch (error) {
      return { success: false }
    }
  }
  // app/services/nextcloud_service.ts

  public async checkAuth(identifier: string, password: string) {
    const cloudUrl = env.get('NEXTCLOUD_URL')
    const adminUser = env.get('NEXTCLOUD_ADMIN_USER')
    const adminPass = env.get('NEXTCLOUD_ADMIN_PASS')
    const adminAuth = Buffer.from(`${adminUser}:${adminPass}`).toString('base64')

    let username = identifier

    // Si l'identifiant ressemble à un email, on cherche le vrai username
    if (identifier.includes('@')) {
      try {
        const searchRes = await fetch(
          `${cloudUrl}/ocs/v1.php/cloud/users?search=${identifier}&format=json`,
          {
            headers: { 'Authorization': `Basic ${adminAuth}`, 'OCS-APIRequest': 'true' },
          }
        )
        const searchData = await searchRes.json()
        const users = searchData.ocs.data.users
        if (users && users.length > 0) {
          username = users[0] // On prend le premier utilisateur trouvé
        }
      } catch (e) {
        return { success: false }
      }
    }

    // Maintenant on tente la connexion avec le username (trouvé ou d'origine)
    const auth = Buffer.from(`${username}:${password}`).toString('base64')
    try {
      const response = await fetch(`${cloudUrl}/ocs/v1.php/cloud/user?format=json`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'OCS-APIRequest': 'true',
        },
      })
      const data = await response.json()
      return {
        success: data.ocs.meta.statuscode === 100,
        userData: data.ocs.data,
        realUsername: username, // On renvoie le vrai username pour la session
      }
    } catch (e) {
      return { success: false }
    }
  }
}
