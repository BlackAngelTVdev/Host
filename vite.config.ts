import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    adonisjs({
      entrypoints: [
        // Scripts
        'resources/js/app.js',
        
        // CSS de base
        'resources/css/app.css',
        'resources/css/home.css',
        'resources/css/var.css',
        
        // Dossier Auth
        'resources/css/auth/login.css',
        'resources/css/auth/register.css',
        
        // Dossier Pages
        'resources/css/pages/admin.css',
        'resources/css/pages/condi.css',
        'resources/css/pages/confirm.css',
        'resources/css/pages/dashboard.css',
        'resources/css/pages/pricing.css'
      ],
      reload: ['resources/views/**/*.edge'],
    }),
  ],
})