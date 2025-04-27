// import this after install `@mdi/font` package

import "@/assets/css/main.scss";
import '@mdi/font/css/materialdesignicons.css'

import 'vuetify/styles'
import { createVuetify } from 'vuetify'

export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    // ... your configuration
    theme: {
        themes: {
            light: {
                dark: false,
                colors: {
                    primary: '#1F13BB', // #E53935
                }
            },
        },
    },
  })
  app.vueApp.use(vuetify)
})
