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

  // --- CE QU'IL FAUT AJOUTER ---
  @column()
  declare description: string // Pour stocker "Feature 1|Feature 2|..."

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
  // -----------------------------

  // Getter pour savoir si on peut encore l'acheter
  public get hasStock() {
    return this.isActive && this.stockAvailable > 0
  }
}