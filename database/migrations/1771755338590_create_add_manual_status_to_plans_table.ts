import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'plans'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {

      table.boolean('is_manually_disabled').defaultTo(false).after('is_active')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_manually_disabled')
    })
  }
}