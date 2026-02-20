import Plan from '#models/plan'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    await Plan.query().delete()

    // database/seeders/plan_seeder.ts
    await Plan.createMany([
      {
        name: 'Gratuit',
        price: 0,
        quotaGb: 5,
        stockAvailable: 100,
        isActive: true,
        isFeatured: false,
        description: 'Vitesse standard|Zéro frais|Soutenu par la pub|Support communautaire',
      },
      {
        name: 'Premium',
        price: 9.9, // Prix psychologique
        quotaGb: 70, // On double pour le même prix, ça va se vendre comme des petits pains
        stockAvailable: 100,
        isActive: true,
        isFeatured: true,
        description: 'Vitesse Prioritaire|Zéro publicité|Sauvegarde auto|Support Discord',
      },
      {
        name: 'Ultra',
        price: 24,
        quotaGb: 500,
        stockAvailable: 0,
        isActive: false, // Toujours en préparation
        isFeatured: false,
        description: 'Performance Maximum|Espace massif|Support VIP 24/7|Accès aux bêtas',
      },
    ])
  }
}
