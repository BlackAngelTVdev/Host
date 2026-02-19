import env from '#start/env'

export default class NextcloudService {
  /**
   * Crée un utilisateur sur Nextcloud
   */
  public async createUser(username: string, email: string) {
    const cloudUrl = env.get('NEXTCLOUD_URL')
    const adminUser = env.get('NEXTCLOUD_ADMIN_USER')
    const adminPass = env.get('NEXTCLOUD_ADMIN_PASS')

    // On génère un mot de passe temporaire ou on en passe un vrai
    const tempPassword = 'Laxa' + Math.random().toString(36).slice(-8) + '!'

    const auth = Buffer.from(`${adminUser}:${adminPass}`).toString('base64')

    try {
      const response = await fetch(`${cloudUrl}/ocs/v1.php/cloud/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'OCS-APIRequest': 'true',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          userid: username,
          password: tempPassword,
          email: email,
          groups: ['Gratuit']
        })
      })

      const data = await response.text() // Nextcloud répond souvent en XML par défaut

      if (!response.ok) {
        throw new Error(`Erreur Nextcloud: ${data}`)
      }

      return { success: true, password: tempPassword }
    } catch (error) {
      console.error('Crash API Nextcloud:', error)
      return { success: false, error: error.message }
    }
  }
}