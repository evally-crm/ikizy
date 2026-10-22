import { defineConfig, devices } from '@playwright/test'

/**
 * testes de ponta a ponta (npm run test:e2e). Rodam o app no modo demonstração: sem banco e sem login,
 * com os dados de exemplo; nada é gravado em lugar nenhum. A página pública é gerada pelo mesmo
 * gerador do servidor e a API de agendamento é simulada no próprio teste.
 */
const PORT = 5197

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  projects: [
    // o público é quase todo no celular; a tela larga cobre o computador
    { name: 'celular', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } } },
    { name: 'computador', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // sem os endereços do Neon o app entra no modo demonstração
    env: { VITE_NEON_AUTH_URL: '', VITE_NEON_DATA_API_URL: '' },
    timeout: 60_000,
  },
})
