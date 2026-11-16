/*
 * Service worker do IKIZY: só avisos (push) e o clique neles. Não guarda páginas nem respostas em cache de propósito:
 * o sistema mexe em dinheiro e agenda, então mostrar dado velho seria pior do que mostrar "sem conexão".
 * O push chega criptografado de ponta a ponta; o corpo é { title, body, url, tag }.
 */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'IKIZY'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // a mesma etiqueta substitui o aviso anterior em vez de empilhar
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/dashboard' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // já tem o app aberto: leva essa janela para a página do aviso; senão abre uma
      for (const w of windows) {
        if ('focus' in w) return w.navigate(url).then((c) => (c || w).focus())
      }
      return self.clients.openWindow(url)
    }),
  )
})
