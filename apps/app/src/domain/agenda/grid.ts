/** altura de uma hora na grade, em px */
export const HOUR_HEIGHT = 72

/** de quanto em quanto tempo o clique na grade "gruda" (minutos) */
export const SNAP_MINUTES = 15

/** distância do topo da grade para um horário (minutos desde 00:00) */
export const yFor = (minutes: number, startHour: number) => ((minutes - startHour * 60) / 60) * HOUR_HEIGHT

/** altura de um bloco de atendimento, com respiro de 4px entre blocos vizinhos */
export const blockHeight = (duration: number) => (duration / 60) * HOUR_HEIGHT - 4

/** altura total da grade para a janela de horas */
export const gridHeight = (startHour: number, endHour: number) => (endHour - startHour) * HOUR_HEIGHT

/** as horas cheias mostradas na grade, de `startHour` até antes de `endHour` */
export const gridHours = (startHour: number, endHour: number) => Array.from({ length: Math.max(endHour - startHour, 0) }, (_, i) => startHour + i)

/** o minuto do dia sob um clique a `offsetY` px do topo da coluna, arredondado para baixo de 15 em 15 */
export function minuteAt(offsetY: number, startHour: number): number {
  const steps = Math.floor((offsetY / HOUR_HEIGHT) * (60 / SNAP_MINUTES))
  return startHour * 60 + steps * SNAP_MINUTES
}

/** a linha de "agora" aparece só quando é hoje e o horário está dentro da janela */
export const showsNow = (isToday: boolean, nowMinutes: number, startHour: number, endHour: number) =>
  isToday && nowMinutes >= startHour * 60 && nowMinutes < endHour * 60

/** onde a rolagem da grade começa: uma hora antes do horário de referência (agora, ou o primeiro atendimento) */
export const scrollTopFor = (anchorMinutes: number, startHour: number) => Math.max(0, yFor(anchorMinutes, startHour) - HOUR_HEIGHT)

/** 1 a 6: cada profissional ganha um tom próprio, na ordem do cadastro */
export const proTone = (index: number) => (index % 6) + 1
