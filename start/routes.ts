import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'


// Imports des Controllers
const AdminController = () => import('#controllers/admin_controller')
const HomeController = () => import('#controllers/home_controller')
const UsersController = () => import('#controllers/users_controller')
const SubscriptionsController = () => import('#controllers/subscriptions_controller')

// --- 1. ROUTES PUBLIQUES ---
router.get('/', [HomeController, 'index']).as('home')

// --- 2. ROUTES GUEST (Visiteurs seulement) ---
router.group(() => {
  router.get('/login', [UsersController, 'login']).as('auth.login')
  router.post('/login', [UsersController, 'handleLogin']).as('auth.login.store')
  router.get('/register', [UsersController, 'register']).as('auth.register')
  router.post('/register', [UsersController, 'store']).as('register.store')
}).use(middleware.guest())

// --- 3. ROUTES AUTH (Connectés seulement) ---
router.group(() => {
  // Dashboard
  router.get('/dashboard/:username', [UsersController, 'dashboard']).as('dashboard')
  
  // Tunnel de Paiement Stripe
  router.get('/checkout/confirm/:plan', [SubscriptionsController, 'confirm']).as('checkout.confirm')
  router.post('/checkout/create-session', [SubscriptionsController, 'createSession']).as('checkout.createSession')

  // Déconnexion
  router.post('/logout', [UsersController, 'logout']).as('logout')
}).use(middleware.auth())

// --- 4. ROUTES ADMIN (Sécurisées) ---
// --- ROUTES ADMIN ---
router.group(() => {
  router.get('/admin', [AdminController, 'index']).as('admin.index')
  
  // Plans
  router.get('/admin/plans/:id/edit', [AdminController, 'edit']).as('admin.plans.edit')
  router.post('/admin/plans/:id', [AdminController, 'update']).as('admin.plans.update')

  // Coupons
  router.post('/admin/discounts', [AdminController, 'storeDiscount']).as('admin.discounts.store')
  router.delete('/admin/discounts/:id', [AdminController, 'deleteDiscount']).as('admin.discounts.delete')
})
.use(middleware.auth())
router.get('/api/check-promo', [AdminController, 'checkPromoApi'])
router.post('/subscriptions/portal', [SubscriptionsController, 'openPortal']).as('subscriptions.portal')

