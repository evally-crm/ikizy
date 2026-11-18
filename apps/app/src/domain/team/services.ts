/**
 * Quem faz cada serviço. Serviço sem lista = todas as profissionais fazem (é o que vale para quem
 * entra na equipe depois). Com lista, só as profissionais dela.
 */

/**
 * profissionais que podem atender o serviço; se a lista não bate com ninguém (todas saíram), volta para todas.
 * `seesAll` falso (a profissional, que só enxerga a si mesma): sem essa volta, senão o serviço de outra pessoa viraria dela.
 */
export function prosForService<P extends { id: string }>(pros: P[], professionalIds: readonly string[] | undefined, seesAll = true): P[] {
  if (!professionalIds?.length) return pros
  const only = pros.filter((p) => professionalIds.includes(p.id))
  return only.length || !seesAll ? only : pros
}

/** serviços que dá para agendar com as profissionais que a pessoa enxerga (para a dona, todos) */
export function bookableServices<S extends { professionalIds: readonly string[] }>(services: S[], pros: { id: string }[], seesAll: boolean): S[] {
  return services.filter((s) => prosForService(pros, s.professionalIds, seesAll).length > 0)
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
