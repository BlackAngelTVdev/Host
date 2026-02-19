import UsersController from '#controllers/users_controller'
import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

router.get('/', async ({ view }) => {
  const plans = [
    {
      name: 'Gratuit',
      price: '0',
      storage: '5 Go',
      features: ['Hébergement en Suisse 🇨🇭', 'Vitesse standard', 'Soutenu par la pub'],
      cta: 'Démarrer',
      highlight: false
    },
    {
      name: 'Premium',
      price: '9',
      storage: '100 Go',
      features: ['Zéro publicité', 'Vitesse Prioritaire', 'Sauvegarde auto', 'Support direct Discord'],
      cta: 'Prendre Premium',
      highlight: true
    },
    {
      name: 'Ultra',
      price: '24',
      storage: '500 Go',
      features: ['Performance Maximum', 'Espace massif', 'Support VIP 24/7', 'Accès aux bêtas'],
      cta: 'Devenir Ultra',
      highlight: false
    }
  ]

  return view.render('pages/home', { plans })
}).as('home')

router.post('/logout', [UsersController, 'logout']).as('logout')
router.get('/register', [UsersController, 'register']).as('register')
router.post('/register', [UsersController, 'store']).as('register.store')

router.get('/dashboard/:username', [UsersController, 'dashboard']).as('dashboard').use(middleware.auth())