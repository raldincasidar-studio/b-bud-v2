// https://nuxt.com/docs/api/configuration/nuxt-config
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
export default defineNuxtConfig({
  app: {
    head: {
      title: 'Nex - Modern Accounting & Stocks Management Software',
      htmlAttrs: {
        lang: 'en',
      },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { hid: 'description', name: 'description', content: 'Nex is a modern, user-friendly accounting and stock management software designed to streamline your business operations with powerful features and real-time insights.' },
        { name: 'keywords', content: 'Nex, accounting software, stock management, inventory system, business tools, ERP, finance management' },
        { name: 'author', content: 'Nex Team' },

        // Open Graph
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: '/' }, // Use the root URL
        { property: 'og:title', content: 'Nex - Modern Accounting & Stocks Management Software' },
        { property: 'og:description', content: 'Streamline your accounting and inventory tasks with Nex – a powerful, modern software built for growing businesses.' },
        { property: 'og:image', content: '/og-image.png' }, // Relative path

        // Twitter Card
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:url', content: '/' }, // Use the root URL
        { name: 'twitter:title', content: 'Nex - Modern Accounting & Stocks Management Software' },
        { name: 'twitter:description', content: 'Streamline your accounting and inventory tasks with Nex – a powerful, modern software built for growing businesses.' },
        { name: 'twitter:image', content: '/og-image.png' }, // Relative path
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },



  ssr: false,
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  build: {
    transpile: ['vuetify'],
  },
  css: ['vuetify/lib/styles/main.sass', '@/assets/css/main.scss'],
  modules: [
    (_options, nuxt) => {
      nuxt.hooks.hook('vite:extendConfig', (config) => {
        // @ts-expect-error
        config.plugins.push(vuetify({ autoImport: true }))
      })
    },
    //...
  ],
  // nitro: {
  //   output: {
  //     dir: 'backend'
  //   }
  // },
  plugins: ['~/plugins/swal.js'],
  vite: {
    vue: {
      template: {
        transformAssetUrls,
      },
    },
  },
  runtimeConfig: {
    public: {
      baseURL: process.env.BASE_URL || 'http://localhost:3001',
      apiBase: process.env.BASE_URL || 'http://localhost:3001',
    },
  },
})
