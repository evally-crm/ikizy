/** lê a imagem escolhida e devolve um data URL pequeno (lado maior até `max` px), pronto para guardar no banco */
export async function resizeToDataUrl(file: File, max = 256): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error('Escolha uma imagem PNG, JPG ou WebP.')
  if (file.size > 8 * 1024 * 1024) throw new Error('A imagem é grande demais. Use uma de até 8 MB.')

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Não foi possível ler essa imagem.'))
      el.src = url
    })
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Seu navegador não conseguiu processar a imagem.')
    ctx.drawImage(img, 0, 0, w, h)
    // webp mantém a transparência com pouco peso; se o navegador não gerar webp, cai para png
    let out = canvas.toDataURL('image/webp', 0.9)
    if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/png')
    if (out.length > 140_000) out = canvas.toDataURL('image/jpeg', 0.8)
    if (out.length > 140_000) throw new Error('A imagem ficou pesada demais. Tente outra.')
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}
