// database/migrations/xxxx_plans.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'plans'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable() // ex: "Laxa Basic"
      table.integer('quota_gb').notNullable() // ex: 50
      table.decimal('price', 8, 2).notNullable()
      table.integer('stock_available').defaultTo(0) // Nombre de slots restants
      table.boolean('is_active').defaultTo(true) // Pour cacher une offre
      table.text('description').nullable() // Stockera les points séparés par des virgules ou retours
      table.boolean('is_featured').defaultTo(false)
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
