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

      const data: any = await response.json() // Corrigé : any
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

      const data: any = await response.json() // Corrigé : any
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

    if (identifier.includes('@')) {
      try {
        const res = await fetch(
          `${this.cloudUrl}/ocs/v1.php/cloud/users?search=${identifier}&format=json`,
          { headers: this.getHeaders() }
        )
        const searchData: any = await res.json() // Corrigé : any
        const users = searchData.ocs.data.users || []

        let foundUsername = null
        for (const u of users) {
          const detailRes = await fetch(
            `${this.cloudUrl}/ocs/v1.php/cloud/users/${u}?format=json`,
            { headers: this.getHeaders() }
          )
          const detailData: any = await detailRes.json() // Corrigé : any
          if (detailData.ocs.data.email === identifier) {
            foundUsername = u
            break
          }
        }

        if (foundUsername) {
          username = foundUsername
        } else {
          return { success: false }
        }
      } catch (e) {
        console.error('Erreur résolution email:', e)
        return { success: false }
      }
    }

    try {
      const userAuth = Buffer.from(`${username}:${password}`).toString('base64')
      const response = await fetch(`${this.cloudUrl}/ocs/v1.php/cloud/user?format=json`, {
        headers: this.getHeaders(userAuth),
      })
      const data: any = await response.json() // Corrigé : any

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
   * Calcule l'espace libre total du serveur
   */
  public async getServerFreeSpace() {
    try {
      const response = await fetch(
        `${this.cloudUrl}/ocs/v1.php/apps/serverinfo/api/v1/info?format=json`,
        { headers: this.getHeaders() }
      )
      const json: any = await response.json() // Corrigé : any

      const freeBytes = json?.ocs?.data?.nextcloud?.system?.freespace

      if (typeof freeBytes === 'undefined') {
        console.error('Clé freespace introuvable dans le JSON')
        return 0
      }

      const freeGb = Math.floor(freeBytes / 1024 ** 3)
      return Math.floor(freeGb / 50) * 50
    } catch (e) {
      console.error('Erreur Fetch Nextcloud:', e)
      return 0
    }
  }

  public async refreshPlansStock() {
    const freeSpaceGb = await this.getServerFreeSpace()
    const plans = await Plan.all()

    const limits: Record<string, number> = { // Corrigé : Record pour l'indexation
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

      if (plan.isManuallyDisabled) {
        plan.isActive = false
      } else {
        plan.isActive = finalStock > 0
      }

      await plan.save()
    }
  }

  private async getCurrentUsersCountForGroup(groupName: string): Promise<number> {
    try {
      const response = await fetch(
        `${this.cloudUrl}/ocs/v1.php/cloud/groups/${groupName}?format=json`,
        { headers: this.getHeaders() }
      )
      const data: any = await response.json() // Corrigé : any

      const users = data?.ocs?.data?.users || []
      return users.length
    } catch (e) {
      console.error(`Erreur comptage groupe ${groupName}:`, e)
      return 0
    }
  }

  public async upgradeUser(username: string, planName: string, quota: string) {
    try {
      await fetch(`${this.cloudUrl}/ocs/v1.php/cloud/users/${username}?format=json`, {
        method: 'PUT',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ key: 'quota', value: quota }),
      })

      const oldGroups = ['Free', 'Gratuit', 'Premium', 'Ultra']

      for (const group of oldGroups) {
        await fetch(`${this.cloudUrl}/ocs/v1.php/cloud/users/${username}/groups?format=json`, {
          method: 'DELETE',
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ groupid: group }),
        })
      }

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
      const url = `${this.cloudUrl}/ocs/v1.php/cloud/users/${username}?format=json`
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ key: 'quota', value: quota }),
      })

      const data: any = await response.json() // Corrigé : any

      if (data.ocs.meta.statuscode === 100) {
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

        await fetch(`${this.cloudUrl}/ocs/v1.php/cloud/users/${username}/groups?format=json`, {
          method: 'POST',
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ groupid: 'Free' }),
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