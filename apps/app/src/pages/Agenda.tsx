import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { addDays, format, isSameDay, parseISO, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, MessageCircle, Plus, X } from 'lucide-react'
import { findConflict, useAgenda, type NewAppointment } from '../data/AgendaProvider'
import { formatBRL, formatTime } from '../lib/format'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Avatar, Button, Card, Em, StatusBadge } from '../components/ui'
import type { Appointment, AppointmentStatus } from '../types'

const START_HOUR = 8
const END_HOUR = 20
const HOUR_H = 72
const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
const toY = (minutes: number) => ((minutes - START_HOUR * 60) / 60) * HOUR_H
const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** próximo passo do atendimento, quando houver */
const NEXT_STEP: Partial<Record<AppointmentStatus, { to: AppointmentStatus; label: string }>> = {
  pendente: { to: 'confirmado', label: 'Confirmar' },
  confirmado: { to: 'atendimento', label: 'Iniciar atendimento' },
  atendimento: { to: 'concluido', label: 'Concluir' },
}

function whatsappLink(a: Appointment) {
  const digits = a.phone.replace(/\D/g, '')
  if (!digits) return null
  const number = digits.startsWith('55') ? digits : `55${digits}`
  const when = format(parseISO(a.date), "EEEE, d 'de' MMMM", { locale: ptBR })
  const text = `Olá, ${a.client.split(' ')[0]}! Passando para confirmar seu horário de ${a.service} em ${when} às ${formatTime(a.start)}. Podemos confirmar?`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="input input--select">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {children}
        </select>
      </span>
    </label>
  )
}

function NewAppointmentDialog({
  initial,
  onClose,
}: {
  initial: { date: string; start: number; professionalId?: string }
  onClose: () => void
}) {
  const { professionals, clients, services, appointments, create } = useAgenda()
  const [clientName, setClientName] = useState('')
  const [phone, setPhone] = useState('')
  const [professionalId, setProfessionalId] = useState(initial.professionalId ?? professionals[0]?.id ?? '')
  const [serviceId, setServiceId] = useState(services[0]?.id ?? 'outro')
  const [customService, setCustomService] = useState('')
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(formatTime(initial.start))
  const [duration, setDuration] = useState(services[0]?.duration ?? 60)
  const [price, setPrice] = useState(services[0]?.price ?? 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const existing = clients.find((c) => c.name.trim().toLowerCase() === clientName.trim().toLowerCase())
  const custom = serviceId === 'outro'

  const pickService = (id: string) => {
    setServiceId(id)
    const s = services.find((x) => x.id === id)
    if (s) {
      setDuration(s.duration)
      setPrice(s.price)
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const name = clientName.trim()
    const service = custom ? customService.trim() : (services.find((s) => s.id === serviceId)?.name ?? '')
    if (name.length < 2) return setError('Informe o nome da cliente.')
    if (!service) return setError('Informe o serviço.')
    if (!professionalId) return setError('Escolha a profissional.')
    const start = toMinutes(time)
    const clash = findConflict(appointments, { professionalId, date, start, duration })
    if (clash) {
      return setError(`Esse horário bate com ${clash.client} (${formatTime(clash.start)} – ${formatTime(clash.start + clash.duration)}).`)
    }
    const input: NewAppointment = {
      clientId: existing?.id,
      clientName: existing?.name ?? name,
      phone: existing?.phone || phone.trim(),
      professionalId,
      serviceId: custom ? null : serviceId,
      serviceName: service,
      date,
      start,
      duration,
      price,
    }
    setBusy(true)
    const message = await create(input)
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  return (
    <Modal label="Novo agendamento" onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="dialog__head">
          <h2>
            Novo <Em>agendamento</Em>
          </h2>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div className="form">
          <label className="field">
            <span className="field__label">Cliente</span>
            <span className="input">
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                list="agenda-clients"
                placeholder="Nome da cliente"
                autoComplete="off"
                required
                minLength={2}
                maxLength={120}
              />
            </span>
            <datalist id="agenda-clients">
              {clients.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            {existing ? (
              <span className="field__hint">Cliente já cadastrada.</span>
            ) : clientName.trim().length >= 2 ? (
              <span className="field__hint">Cliente nova: será cadastrada junto com o agendamento.</span>
            ) : null}
          </label>

          {!existing && clientName.trim().length >= 2 && (
            <label className="field">
              <span className="field__label">WhatsApp (opcional)</span>
              <span className="input">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(11) 90000-0000" maxLength={20} />
              </span>
            </label>
          )}

          <SelectField label="Serviço" value={serviceId} onChange={pickService}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="outro">Outro serviço…</option>
          </SelectField>

          {custom && (
            <label className="field">
              <span className="field__label">Nome do serviço</span>
              <span className="input">
                <input value={customService} onChange={(e) => setCustomService(e.target.value)} maxLength={80} required />
              </span>
            </label>
          )}

          <SelectField label="Profissional" value={professionalId} onChange={setProfessionalId}>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>

          <div className="form__pair">
            <label className="field">
              <span className="field__label">Dia</span>
              <span className="input">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </span>
            </label>
            <label className="field">
              <span className="field__label">Horário</span>
              <span className="input">
                <input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} required />
              </span>
            </label>
          </div>

          <div className="form__pair">
            <label className="field">
              <span className="field__label">Duração (min)</span>
              <span className="input">
                <input type="number" min={5} max={600} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} required />
              </span>
            </label>
            <label className="field">
              <span className="field__label">Valor (R$)</span>
              <span className="input input--money">
                <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} required />
              </span>
            </label>
          </div>
        </div>

        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}

        <div className="dialog__actions" style={{ marginTop: 22 }}>
          <Button variant="light" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Agendar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function AppointmentDialog({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const { professionals, appointments, update } = useAgenda()
  const [rescheduling, setRescheduling] = useState(false)
  const [date, setDate] = useState(appointment.date)
  const [time, setTime] = useState(formatTime(appointment.start))
  const [professionalId, setProfessionalId] = useState(appointment.professionalId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pro = professionals.find((p) => p.id === appointment.professionalId)
  const step = NEXT_STEP[appointment.status]
  const open = appointment.status === 'pendente' || appointment.status === 'confirmado'
  const wa = whatsappLink(appointment)

  const run = async (patch: Parameters<typeof update>[1]) => {
    setBusy(true)
    const message = await update(appointment.id, patch)
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  const reschedule = async () => {
    const start = toMinutes(time)
    const clash = findConflict(appointments, { professionalId, date, start, duration: appointment.duration }, appointment.id)
    if (clash) {
      return setError(`Esse horário bate com ${clash.client} (${formatTime(clash.start)} – ${formatTime(clash.start + clash.duration)}).`)
    }
    await run({ date, start, professionalId })
  }

  const cancel = () => {
    if (window.confirm(`Cancelar o atendimento de ${appointment.client}?`)) void run({ status: 'cancelado' })
  }

  return (
    <Modal label={`Atendimento de ${appointment.client}`} onClose={onClose}>
      <div className="dialog__head">
        <div>
          <p className="eyebrow">Atendimento</p>
          <h2>{appointment.client}</h2>
        </div>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      <dl className="dialog__grid">
        <div>
          <dt>Serviço</dt>
          <dd>{appointment.service}</dd>
        </div>
        <div>
          <dt>Profissional</dt>
          <dd>{pro?.name}</dd>
        </div>
        <div>
          <dt>Horário</dt>
          <dd>
            {format(parseISO(appointment.date), 'dd/MM')} · {formatTime(appointment.start)} –{' '}
            {formatTime(appointment.start + appointment.duration)}
          </dd>
        </div>
        <div>
          <dt>Valor</dt>
          <dd>{formatBRL(appointment.price)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={appointment.status} />
          </dd>
        </div>
      </dl>

      {rescheduling && (
        <div className="form" style={{ marginBottom: 18 }}>
          <div className="form__pair">
            <label className="field">
              <span className="field__label">Novo dia</span>
              <span className="input">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </span>
            </label>
            <label className="field">
              <span className="field__label">Novo horário</span>
              <span className="input">
                <input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} required />
              </span>
            </label>
          </div>
          <SelectField label="Profissional" value={professionalId} onChange={setProfessionalId}>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
        </div>
      )}

      {error && (
        <p className="dialog__error" role="alert" style={{ marginBottom: 14 }}>
          {error}
        </p>
      )}

      <div className="dialog__actions">
        {rescheduling ? (
          <>
            <Button variant="light" onClick={() => setRescheduling(false)}>
              Voltar
            </Button>
            <Button disabled={busy} onClick={() => void reschedule()}>
              {busy ? 'Salvando…' : 'Salvar novo horário'}
            </Button>
          </>
        ) : (
          <>
            {step && (
              <Button disabled={busy} onClick={() => void run({ status: step.to })}>
                {step.label}
              </Button>
            )}
            {open && wa && (
              <a className="btn btn--ghost" href={wa} target="_blank" rel="noreferrer">
                <MessageCircle size={16} aria-hidden="true" /> WhatsApp
              </a>
            )}
            {open && (
              <Button variant="ghost" onClick={() => setRescheduling(true)}>
                Remarcar
              </Button>
            )}
          </>
        )}
      </div>

      {open && !rescheduling && (
        <div className="dialog__more">
          <button type="button" disabled={busy} onClick={() => void run({ status: 'faltou' })}>
            Marcar falta
          </button>
          <button type="button" disabled={busy} onClick={cancel}>
            Cancelar atendimento
          </button>
        </div>
      )}
    </Modal>
  )
}

function FirstProfessional() {
  const { addProfessional } = useAgenda()
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const message = await addProfessional(name, title)
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <Card className="agenda__empty">
      <h2 className="card__title">Cadastre quem atende</h2>
      <p className="card__sub">A agenda é organizada por profissional. Comece com a primeira; as outras entram depois.</p>
      <form className="form" onSubmit={onSubmit}>
        <div className="form__pair">
          <label className="field">
            <span className="field__label">Nome</span>
            <span className="input">
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Especialidade (opcional)</span>
            <span className="input">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Nail designer" maxLength={60} />
            </span>
          </label>
        </div>
        {error && (
          <p className="dialog__error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Adicionar profissional'}
        </Button>
      </form>
    </Card>
  )
}

export default function Agenda() {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const { professionals, appointments, loading, error, focus, reload } = useAgenda()
  const [date, setDate] = useState(() => new Date())
  const [proFilter, setProFilter] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState<{ date: string; start: number; professionalId?: string } | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => focus(date), [date, focus])

  const week = useMemo(() => {
    const start = startOfWeek(date, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [date])

  // no mobile mostramos uma profissional por vez
  const activePro = isMobile && proFilter === 'all' ? (professionals[0]?.id ?? 'all') : proFilter
  const visiblePros = activePro === 'all' ? professionals : professionals.filter((p) => p.id === activePro)
  const selected = appointments.find((a) => a.id === selectedId) ?? null

  const today = dayKey(date)
  const dayAppointments = appointments.filter((a) => a.date === today && a.status !== 'cancelado')
  const countByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of appointments) if (a.status !== 'cancelado') map.set(a.date, (map.get(a.date) ?? 0) + 1)
    return map
  }, [appointments])

  const isToday = isSameDay(date, now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const showNow = isToday && nowMinutes >= START_HOUR * 60 && nowMinutes < END_HOUR * 60
  const gridHeight = hours.length * HOUR_H

  const openSlot = (e: React.MouseEvent<HTMLDivElement>, professionalId: string) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('agenda__line')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const minutes = START_HOUR * 60 + Math.floor(((e.clientY - rect.top) / HOUR_H) * 4) * 15
    setCreating({ date: today, start: minutes, professionalId })
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <p className="eyebrow">Agenda</p>
          <h1 className="page__title">
            {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })
              .split(',')
              .map((part, i) =>
                i === 0 ? <Em key={i}>{part[0].toUpperCase() + part.slice(1)}</Em> : <span key={i}>,{part}</span>,
              )}
          </h1>
          <p className="card__sub">
            {loading
              ? 'Carregando…'
              : dayAppointments.length === 0
                ? 'Nenhum atendimento neste dia.'
                : `${dayAppointments.length} ${dayAppointments.length === 1 ? 'atendimento' : 'atendimentos'}`}
          </p>
        </div>
        <div className="page__actions">
          <Button variant="ghost" size="sm" icon aria-label="Dia anterior" onClick={() => setDate((d) => addDays(d, -1))}>
            <ChevronLeft size={18} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(new Date())}>
            Hoje
          </Button>
          <Button variant="ghost" size="sm" icon aria-label="Próximo dia" onClick={() => setDate((d) => addDays(d, 1))}>
            <ChevronRight size={18} />
          </Button>
          <Button
            size="sm"
            disabled={professionals.length === 0}
            onClick={() => setCreating({ date: today, start: Math.max(8 * 60, Math.ceil(nowMinutes / 30) * 30) })}
          >
            <Plus size={16} aria-hidden="true" />
            <span className="hide-sm">Novo</span>
          </Button>
        </div>
      </header>

      {error && (
        <p className="dialog__error" role="alert">
          {error}{' '}
          <button type="button" className="textlink" onClick={reload}>
            Tentar de novo
          </button>
        </p>
      )}

      {!loading && professionals.length === 0 && !error ? (
        <FirstProfessional />
      ) : (
        <>
          <div className="weekstrip" role="tablist" aria-label="Dias da semana">
            {week.map((d) => {
              const n = countByDay.get(dayKey(d)) ?? 0
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  role="tab"
                  aria-selected={isSameDay(d, date)}
                  className={`weekstrip__day ${isSameDay(d, now) ? 'is-today' : ''}`}
                  onClick={() => setDate(d)}
                  aria-label={`${format(d, "EEEE, d 'de' MMMM", { locale: ptBR })}${n ? `, ${n} atendimentos` : ''}`}
                >
                  <span className="weekstrip__name">{format(d, 'EEEE', { locale: ptBR }).slice(0, 3)}</span>
                  <span className="weekstrip__num">{format(d, 'd')}</span>
                  <span className={`weekstrip__dot ${n ? 'is-on' : ''}`} aria-hidden="true" />
                </button>
              )
            })}
          </div>

          <div className="chips" role="group" aria-label="Filtrar por profissional">
            {!isMobile && (
              <button type="button" className="chip" aria-pressed={activePro === 'all'} onClick={() => setProFilter('all')}>
                Todas
              </button>
            )}
            {professionals.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip"
                aria-pressed={activePro === p.id}
                onClick={() => setProFilter(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="agenda">
            <div className="agenda__head" style={{ gridTemplateColumns: `52px repeat(${visiblePros.length}, minmax(0, 1fr))` }}>
              <span />
              {visiblePros.map((p) => (
                <div key={p.id} className="agenda__pro">
                  <Avatar name={p.name} size="sm" />
                  <div className="agenda__pro-text">
                    <p className="agenda__pro-name">{p.name}</p>
                    <p className="agenda__pro-role">{p.role}</p>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="agenda__body"
              style={{ height: gridHeight, gridTemplateColumns: `52px repeat(${visiblePros.length}, minmax(0, 1fr))` }}
            >
              <div className="agenda__hours" aria-hidden="true">
                {hours.map((h) => (
                  <span key={h} className="agenda__hour" style={{ top: (h - START_HOUR) * HOUR_H }}>
                    {String(h).padStart(2, '0')}:00
                  </span>
                ))}
              </div>

              {visiblePros.map((p) => (
                <div key={p.id} className="agenda__col agenda__col--click" onClick={(e) => openSlot(e, p.id)}>
                  {hours.map((h) => (
                    <div key={h} className="agenda__line" style={{ top: (h - START_HOUR) * HOUR_H }} />
                  ))}
                  {dayAppointments
                    .filter((a) => a.professionalId === p.id)
                    .map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={`appt appt--${a.status}`}
                        style={{ top: toY(a.start) + 2, height: (a.duration / 60) * HOUR_H - 4 }}
                        onClick={() => setSelectedId(a.id)}
                      >
                        <span className="appt__time">
                          {formatTime(a.start)} – {formatTime(a.start + a.duration)}
                        </span>
                        <span className="appt__client">{a.client}</span>
                        <span className="appt__service">{a.service}</span>
                      </button>
                    ))}
                </div>
              ))}

              {showNow && (
                <div className="agenda__now" style={{ top: toY(nowMinutes) }} aria-hidden="true">
                  <span className="agenda__now-dot" />
                </div>
              )}
            </div>
          </div>

          <ul className="legend" aria-label="Legenda de status">
            <li><span className="legend__dot legend__dot--confirmado" />Confirmado</li>
            <li><span className="legend__dot legend__dot--pendente" />Aguardando</li>
            <li><span className="legend__dot legend__dot--atendimento" />Em atendimento</li>
            <li><span className="legend__dot legend__dot--concluido" />Concluído</li>
            <li><span className="legend__dot legend__dot--faltou" />Faltou</li>
          </ul>
        </>
      )}

      {selected && <AppointmentDialog key={selected.id} appointment={selected} onClose={() => setSelectedId(null)} />}
      {creating && <NewAppointmentDialog initial={creating} onClose={() => setCreating(null)} />}
    </div>
  )
}
