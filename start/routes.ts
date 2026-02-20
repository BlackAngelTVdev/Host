import UsersController from '#controllers/users_controller'
import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'
import HomeController from '#controllers/home_controller'

router.get('/', [HomeController, 'index']).as('home')

router.post('/logout', [UsersController, 'logout']).as('logout')
router.get('/register', [UsersController, 'register']).as('auth.register')
router.post('/register', [UsersController, 'store']).as('register.store')

router.get('/dashboard/:username', [UsersController, 'dashboard']).as('dashboard').use(middleware.auth())
router.get('/login', [UsersController, 'login']).as('auth.login')
router.post('/login', [UsersController, 'handleLogin']).as('auth.login.store')