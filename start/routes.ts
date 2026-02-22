import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AdminController = () => import('#controllers/admin_controller')
const HomeController = () => import('#controllers/home_controller')
const UsersController = () => import('#controllers/users_controller')
const SubscriptionsController = () => import('#controllers/subscriptions_controller')

router.get('/', [HomeController, 'index']).as('home')
router.get('/api/check-promo', [AdminController, 'checkPromoApi'])

router.on('/cgv').render('pages/condi/cvg').as('cgv')
router.on('/privacy').render('pages/condi/privacy').as('privacy')
router.on('/cloud').redirect('https://cloud.laxacube.ch').as('cloud')

router
  .group(() => {
    router.get('/login', [UsersController, 'login']).as('auth.login')
    router.post('/login', [UsersController, 'handleLogin']).as('auth.login.store')
    router.get('/register', [UsersController, 'register']).as('auth.register')
    router.post('/register', [UsersController, 'store']).as('register.store')
  })
  .use(middleware.guest())

router
  .group(() => {
    router.post('/logout', [UsersController, 'logout']).as('logout')
    router.get('/dashboard/:username', [UsersController, 'dashboard']).as('dashboard')

    router
      .group(() => {
        router.get('/confirm/:plan', [SubscriptionsController, 'confirm']).as('checkout.confirm')
        router
          .post('/create-session', [SubscriptionsController, 'createSession'])
          .as('checkout.createSession')
        router.post('/portal', [SubscriptionsController, 'openPortal']).as('subscriptions.portal')
      })
      .prefix('/checkout')

    router
      .group(() => {
        router.get('/', [AdminController, 'index']).as('admin.index')

        router
          .group(() => {
            router.get('/:id/edit', [AdminController, 'edit']).as('admin.plans.edit')
            router.post('/:id', [AdminController, 'update']).as('admin.plans.update')
          })
          .prefix('/plans')

        router
          .group(() => {
            router.post('/', [AdminController, 'storeDiscount']).as('admin.discounts.store')
            router.delete('/:id', [AdminController, 'deleteDiscount']).as('admin.discounts.delete')
          })
          .prefix('/discounts')
      })
      .prefix('/admin')
  })
  .use(middleware.auth())
