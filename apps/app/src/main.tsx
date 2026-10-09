import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/index.css'
import App from './App.tsx'
// começa a escutar o aviso de "pode instalar" do navegador desde o carregamento
import './lib/install'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// app instalável: o service worker só entra no build de produção (em desenvolvimento atrapalharia o recarregamento)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sem service worker o sistema funciona normalmente, só não fica instalável */
    })
  })
}
