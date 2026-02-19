import router from '@adonisjs/core/services/router'

router.on('/').render('pages/home').as('home')
router.on('/register').render('pages/register').as('register')
router.on('/pricing').render('pages/pricing').as('pricing') // Exemple pour Abonnement