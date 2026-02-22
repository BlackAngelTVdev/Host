import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'discounts'

  public async up() {
    this.schema.createTable('discounts', (table) => {
      table.increments('id')
      table.string('code').unique()
      table.enum('type', ['percentage', 'fixed'])
      table.float('value')
      table.integer('max_uses').nullable() // snake_case ici !
      table.integer('used_count').defaultTo(0)
      table.integer('duration_months').nullable()
      table.dateTime('expires_at').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
+++