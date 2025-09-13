// nuxt.config.ts
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
export default defineNuxtConfig({
  app: {
    head: {
      title: "B-Bud - A Barangay Management System",
      htmlAttrs: {
        lang: "en",
      },
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          hid: "description",
          name: "description",
          content:
            "B-Bud is a modern, user-friendly barangay management system designed to streamline local governance with powerful features and real-time insights.",
        },
        {
          name: "keywords",
          content:
            "B-Bud, barangay system, barangay management, local governance, resident database, document requests, barangay tools, community ERP",
        },
        { name: "author", content: "B-Bud Team" },

        // Open Graph
        { property: "og:type", content: "website" },
        { property: "og:url", content: "/" },
        {
          property: "og:title",
          content: "B-Bud - A Barangay Management System",
        },
        {
          property: "og:description",
          content:
            "Streamline local governance and community services with B-Bud – a powerful, modern system built for barangays.",
        },
        { property: "og:image", content: "/og-image.png" },

        // Twitter Card
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:url", content: "/" },
        {
          name: "twitter:title",
          content: "B-Bud - A Barangay Management System",
        },
        {
          name: "twitter:description",
          content:
            "Streamline local governance and community services with B-Bud – a powerful, modern system built for barangays.",
        },
        { name: "twitter:image", content: "/og-image.png" },
      ],
      link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
    },
  },

  // START: Added Security Headers
  // These rules are applied by Nuxt's server to add security headers to every response.
  routeRules: {
    '/**': { // Apply to all routes
      headers: {
        // Content-Security-Policy: Helps prevent XSS attacks. This is a strict policy, 
        // you may need to adjust it if you load resources from external domains.
        // **UPDATED CSP LINE BELOW**
        'Content-Security-Policy': "default-src 'self' http://localhost:3001; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; object-src 'none'; frame-ancestors 'none';",
        
        // X-Content-Type-Options: Prevents the browser from MIME-sniffing a response away from the declared content-type.
        'X-Content-Type-Options': 'nosniff',
        
        // X-Frame-Options: Protects against clickjacking attacks.
        'X-Frame-Options': 'SAMEORIGIN',
        
        // Referrer-Policy: Controls how much referrer information is included with requests.
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        
        // Permissions-Policy: Controls which browser features and APIs can be used on the site.
        'Permissions-Policy': "geolocation=(), microphone=(), camera=()",
      },
    },
  },
  // END: Added Security Headers

  ssr: false,
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  build: {
    transpile: ["vuetify"],
  },
  css: ["vuetify/lib/styles/main.sass", "@/assets/css/main.scss"],
  modules: [
    (_options, nuxt) => {
      nuxt.hooks.hook("vite:extendConfig", (config) => {
        // @ts-expect-error
        config.plugins.push(vuetify({ autoImport: true }));
      });
    },
    'nuxt-booster'
    //...
  ],
  // nitro: {
  //   output: {
  //     dir: 'backend'
  //   }
  // },
  plugins: ["~/plugins/swal.js"],
  vite: {
    vue: {
      template: {
        transformAssetUrls,
      },
    },
  },
  runtimeConfig: {
    public: {
      baseURL: process.env.BASE_URL || "http://localhost:3001",
      apiBase: process.env.BASE_URL || "http://localhost:3001",
    },
  },
});