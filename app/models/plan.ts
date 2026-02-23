import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Plan extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare quotaGb: number

  @column()
  declare price: number

  @column()
  declare stockAvailable: number

  @column()
  declare isActive: boolean

  @column()
  declare isFeatured: boolean


  @column()
  declare description: string 

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare isManuallyDisabled: boolean

  public get hasStock() {
    return this.isActive && this.stockAvailable > 0
  }
}
