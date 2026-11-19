/** atualiza o item de id `id` com os campos de `patch` (os outros ficam como estão) */
export function patchById<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item))
}

/** remove o item de id `id` */
export function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id)
}

/** plano, pacote ou promoção novo, vazio e visível, com a etiqueta "Novidade" */
export function blankPlan(id: string) {
  return { id, name: '', description: '', kind: 'assinatura' as const, price: 0, oldPrice: null as number | null, validUntil: null as string | null, includes: [] as string[], isNew: true, visible: true }
}

/** produto à venda novo, vazio e visível */
export function blankShowcaseItem(id: string) {
  return { id, name: '', description: '', price: 0, visible: true, photo: '', photoId: null as string | null }
}
