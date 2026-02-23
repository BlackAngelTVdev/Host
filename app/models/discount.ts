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


  @column({ columnName: 'max_uses' })
  declare maxUses: number | null


  @column({ columnName: 'used_count' })
  declare usedCount: number


  @column({ columnName: 'duration_months' })
  declare durationMonths: number | null


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