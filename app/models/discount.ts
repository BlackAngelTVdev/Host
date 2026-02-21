import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Discount extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare type: 'percentage' | 'fixed'

  @column()
  declare value: number

  @column()
  declare maxUses: number | null

  @column()
  declare usedCount: number

  @column.dateTime()
  declare expiresAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /**
   * Getter pour savoir si le code est encore valide
   */
  public get isValid() {
    const now = DateTime.now()
    
    // 1. Check date d'expiration
    if (this.expiresAt && now > this.expiresAt) {
      return false
    }

    // 2. Check nombre d'utilisations
    if (this.maxUses !== null && this.usedCount >= this.maxUses) {
      return false
    }

    return true
  }
}