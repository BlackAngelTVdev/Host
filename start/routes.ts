import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const HomeController = () => import('#controllers/home_controller')
const UsersController = () => import('#controllers/users_controller')

// --- ACCÈS PUBLIC (Tout le monde) ---
router.get('/', [HomeController, 'index']).as('home')


// --- ACCÈS VISITEURS UNIQUEMENT (Guest) ---
// Si l'utilisateur est déjà connecté, il sera redirigé vers le dashboard
router.group(() => {
  router.get('/login', [UsersController, 'login']).as('auth.login')
  router.post('/login', [UsersController, 'handleLogin']).as('auth.login.store')
  router.get('/register', [UsersController, 'register']).as('auth.register')
  router.post('/register', [UsersController, 'store']).as('register.store')
}).use(middleware.guest())


// --- ACCÈS CONNECTÉS UNIQUEMENT (Auth) ---
router.group(() => {
  router.get('/dashboard/:username', [UsersController, 'dashboard']).as('dashboard')
  router.post('/logout', [UsersController, 'logout']).as('logout')
}).use(middleware.auth())