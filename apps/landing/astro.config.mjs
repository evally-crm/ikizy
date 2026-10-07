// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

// https://astro.build/config
export default defineConfig({
  site: 'https://ikizy.com',
  integrations: [sitemap({ filter: (page) => !page.endsWith("/404/") })],
  build: { format: 'directory' },
  redirects: {
    '/recursos': '/#recursos',
    '/precos': '/#precos',
    '/sobre': '/#sobre',
    '/contato': '/#contato',
  },
})
