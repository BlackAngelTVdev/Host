import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'discounts'

  // database/migrations/xxxx_discounts.ts
  public async up() {
    this.schema.createTable('discounts', (table) => {
      table.increments('id')
      table.string('code').unique().notNullable()
      table.enum('type', ['percentage', 'fixed']).notNullable() // % ou CHF
      table.float('value').notNullable() // Le montant (ex: 10 ou 2)
      table.integer('max_uses').nullable() // Nombre max d'utilisations total
      table.integer('used_count').defaultTo(0) // Combien de fois utilisé
      table.dateTime('expires_at').nullable() // Date limite
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }
}
