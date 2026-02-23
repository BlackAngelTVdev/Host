# 🚀 Host
![Stars](https://img.shields.io/github/stars/BlackAngelTVdev/Host?style=for-the-badge&color=yellow)
![Commits](https://img.shields.io/github/commit-activity/m/BlackAngelTVdev/Host?style=for-the-badge&color=blue)
![Issues](https://img.shields.io/github/issues/BlackAngelTVdev/Host?style=for-the-badge&color=orange)
![Forks](https://img.shields.io/github/forks/BlackAngelTVdev/Host?style=for-the-badge&color=808080)
![Last Commit](https://img.shields.io/github/last-commit/BlackAngelTVdev/Host?style=for-the-badge&color=blue)

> **Une solution cloud simplifiée pour gérer tes données en un clin d'œil.**

---

## 🧐 Aperçu
![Banner](Asset/Img/banner.png)

## ✨ Fonctionnalités
- ✅ **Déploiement Rapide** : Automatise la mise en ligne de tes applications.
- ✅ **Gestion Centralisée** : Un seul endroit pour monitorer tous tes serveurs et instances.
- ✅ **Sécurité Renforcée** : Configuration optimisée pour protéger tes données et tes accès.

## 🛠 Tech Stack
| Technologie | Usage |
| :--- | :--- |
| ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white) | Runtime principal |
| ![AdonisJS](https://img.shields.io/badge/AdonisJS-220052?style=flat-square&logo=adonisjs&logoColor=white) | Framework Backend |
| ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white) | Base de données |

## 🚀 Installation & Lancement

1. **Cloner le projet**
   ```bash
   git clone https://github.com/BlackAngelTVdev/Host.git
   cd Host
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configurer les variables d'environnement**
   ```bash
   cp .env.example .env
   ```

4. **Lancer l'application**
   ```bash
   node ace migration:run
   npm run dev
   ```

---

## 📖 Utilisation

Pour géré les plan database/seeders/plan_seeder.ts :

```javascript
import Plan from '#models/plan'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    await Plan.query().delete()

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
        price: 9.9,
        quotaGb: 70, 
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
```

---

## 🤝 Contribution

1. Forkez le projet
2. Créez votre branche (`git checkout -b feature/AmazingFeature`)
3. Commit (`git commit -m 'Add some AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

---

## 👤 Auteur

**BlackAngelTVdev**

---

## 📄 Licence

Ce projet est sous licence :
![GitHub License](https://img.shields.io/github/license/BlackAngelTVdev/NOM-DU-REPO?style=flat-square&color=blue)
