import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/index.css'
import App from './App.tsx'
import { startAnalytics } from './lib/analytics'
import { startInstallWatch } from './lib/install'
import { startMonitoring } from './lib/monitoring'
import { trackVisualViewport } from './lib/viewport'

startInstallWatch()
startMonitoring()
startAnalytics()
trackVisualViewport()

// service worker: só avisos (push) e o clique neles, sem cache; também faz o navegador oferecer "instalar". Só em produção (no
// `npm run dev` ficaria guardando avisos velhos e atrapalhando a recarga rápida)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
