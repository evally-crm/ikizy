/**
 * Quem faz cada serviço. Serviço sem lista = todas as profissionais fazem (é o que vale para quem
 * entra na equipe depois). Com lista, só as profissionais dela.
 */

/** profissionais que podem atender o serviço; se a lista não bate com ninguém (todas saíram), volta para todas */
export function prosForService<P extends { id: string }>(pros: P[], professionalIds: readonly string[] | undefined): P[] {
  if (!professionalIds?.length) return pros
  const only = pros.filter((p) => professionalIds.includes(p.id))
  return only.length ? only : pros
}

/**
 * serviços que esta profissional faz: os sem lista (todas fazem) e os em que ela está na lista.
 * Não usa prosForService: a profissional só enxerga a si mesma, e lá a lista de outra pessoa "voltaria para todas".
 */
export function servicesOf<S extends { professionalIds: readonly string[] }>(professionalId: string, services: S[]): S[] {
  return services.filter((s) => s.professionalIds.length === 0 || s.professionalIds.includes(professionalId))
}

/** o que gravar: escolher todas as ativas = sem lista (quem entrar depois também faz) */
export function professionalsToSave(selected: readonly string[], activeIds: readonly string[]): string[] {
  const picked = activeIds.filter((id) => selected.includes(id))
  return picked.length === activeIds.length ? [] : picked
}

/** escolha inicial na tela do serviço: as da lista que ainda estão ativas, ou todas */
export function initialSelection(professionalIds: readonly string[] | undefined, activeIds: readonly string[]): string[] {
  const kept = activeIds.filter((id) => professionalIds?.includes(id))
  return kept.length ? kept : [...activeIds]
}
