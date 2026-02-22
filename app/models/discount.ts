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

  // LIEN DB : max_uses
  @column({ columnName: 'max_uses' })
  declare maxUses: number | null

  // LIEN DB : used_count
  @column({ columnName: 'used_count' })
  declare usedCount: number

  // LIEN DB : duration_months
  @column({ columnName: 'duration_months' })
  declare durationMonths: number | null

  // LIEN DB : expires_at
  @column.dateTime({ columnName: 'expires_at' })
  declare expiresAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  public get isValid() {
    const now = DateTime.now()
    if (this.expiresAt && now > this.expiresAt) return false
    if (this.maxUses !== null && this.usedCount >= this.maxUses) return false
    return true
  }
}