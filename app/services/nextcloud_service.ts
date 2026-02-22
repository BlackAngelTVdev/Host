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

    // 1. Si l'identifiant est un email, on cherche le vrai username
    if (identifier.includes('@')) {
      try {
        const res = await fetch(
          `${this.cloudUrl}/ocs/v1.php/cloud/users?search=${identifier}&format=json`,
          { headers: this.getHeaders() }
        )
        const searchData = await res.json()
        const users = searchData.ocs.data.users || []

        // On vérifie chaque utilisateur trouvé pour voir si l'email matche exactement
        let foundUsername = null
        for (const u of users) {
          const detailRes = await fetch(
            `${this.cloudUrl}/ocs/v1.php/cloud/users/${u}?format=json`,
            { headers: this.getHeaders() }
          )
          const detailData = await detailRes.json()
          if (detailData.ocs.data.email === identifier) {
            foundUsername = u
            break
          }
        }

        if (foundUsername) {
          username = foundUsername
        } else {
          return { success: false } // Email non trouvé
        }
      } catch (e) {
        console.error('Erreur résolution email:', e)
        return { success: false }
      }
    }

    // 2. Tentative de login avec le username (trouvé via l'email ou saisi directement)
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

    // 1. Tes limites commerciales MAX (Le plafond)
    const limits = {
      Gratuit: 70,
      Premium: 8,
      Ultra: 2,
    }

    for (const plan of plans) {
      const physicalAvailable = Math.floor(freeSpaceGb / plan.quotaGb)
      const currentUsersCount = await this.getCurrentUsersCountForGroup(plan.name)
      const commercialRemaining = (limits[plan.name] || 0) - currentUsersCount

      const finalStock = Math.max(0, Math.min(physicalAvailable, commercialRemaining))
      plan.stockAvailable = finalStock

      // LOGIQUE CORRIGÉE :
      // Le plan est actif SI (stock > 0) ET SI (pas désactivé manuellement)
      if (plan.isManuallyDisabled) {
        plan.isActive = false
      } else {
        plan.isActive = finalStock > 0
      }

      await plan.save()
    }
  }

  /**
   * Helper pour compter les membres d'un groupe via l'API Nextcloud
   */
  private async getCurrentUsersCountForGroup(groupName: string): Promise<number> {
    try {
      const response = await fetch(
        `${this.cloudUrl}/ocs/v1.php/cloud/groups/${groupName}?format=json`,
        { headers: this.getHeaders() }
      )
      const data = await response.json()

      // L'API renvoie la liste des users dans data.ocs.data.users
      const users = data?.ocs?.data?.users || []
      return users.length
    } catch (e) {
      console.error(`Erreur comptage groupe ${groupName}:`, e)
      return 0
    }
  }
  public async upgradeUser(username: string, planName: string, quota: string) {
    try {
      // 1. Update Quota
      await fetch(`${this.cloudUrl}/ocs/v1.php/cloud/users/${username}?format=json`, {
        method: 'PUT',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ key: 'quota', value: quota }),
      })

      // 2. Nettoyage : On dégage l'ancien groupe
      // Si l'user était "Free", on le vire. S'il était déjà "Premium", on le vire (pour remettre à propre)
      const oldGroups = ['Free', 'Gratuit', 'Premium', 'Ultra']

      for (const group of oldGroups) {
        // On supprime systématiquement (Nextcloud s'en fout si l'user n'est pas dedans, il renverra juste un code 404/101 caché)
        await fetch(`${this.cloudUrl}/ocs/v1.php/cloud/users/${username}/groups?format=json`, {
          method: 'DELETE',
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ groupid: group }),
        })
      }

      // 3. On ajoute le nouveau groupe (celui du plan acheté)
      // planName doit correspondre pile poil au nom du groupe dans Nextcloud
      await fetch(`${this.cloudUrl}/ocs/v1.php/cloud/users/${username}/groups?format=json`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ groupid: planName }),
      })

      return { success: true }
    } catch (error) {
      console.error('Nextcloud Upgrade Error:', error)
      return { success: false }
    }
  }
  public async editUserQuota(username: string, quota: string) {
    try {
      // 1. Changement du quota (ex: 5GB)
      const url = `${this.cloudUrl}/ocs/v1.php/cloud/users/${username}?format=json`
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ key: 'quota', value: quota }),
      })

      const data = await response.json()

      if (data.ocs.meta.statuscode === 100) {
        console.log(`[Nextcloud API] Quota de ${username} mis à jour : ${quota}`)

        // 2. NETTOYAGE DES GROUPES (On remet l'utilisateur en "Free")
        const paidGroups = ['Premium', 'Ultra']

        for (const group of paidGroups) {
          await fetch(`${this.cloudUrl}/ocs/v1.php/cloud/users/${username}/groups?format=json`, {
            method: 'DELETE',
            headers: {
              ...this.getHeaders(),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ groupid: group }),
          })
        }

        // 3. On s'assure qu'il est bien dans le groupe Free
        await fetch(`${this.cloudUrl}/ocs/v1.php/cloud/users/${username}/groups?format=json`, {
          method: 'POST',
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ groupid: 'Free' }), // Ou 'Gratuit' selon ton Nextcloud
        })

        return true
      }
      return false
    } catch (error) {
      console.error('Erreur API Nextcloud Downgrade:', error)
      return false
    }
  }
}
