import { useState, type FormEvent } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MessageCircle, X } from 'lucide-react'
import { useAgenda, type NewAppointment } from '../data/AgendaProvider'
import { findConflict } from '../domain/agenda'
import { formatDuration } from '../lib/agendaTime'
import { formatBRL, formatTime } from '../lib/format'
import { Button, Em, StatusBadge } from './ui'
import { ClientField, MoneyField, Select, Stepper, parseMoney } from './controls'
import { ConfirmDialog, Modal } from './Modal'
import { DateStrip, SlotPicker } from './Schedule'
import { PAYMENT_LABEL, type Appointment, type AppointmentStatus, type PaymentMethod } from '../types'

/** próximo passo do atendimento, quando houver */
const NEXT_STEP: Partial<Record<AppointmentStatus, { to: AppointmentStatus; label: string }>> = {
  pendente: { to: 'confirmado', label: 'Confirmar' },
  confirmado: { to: 'atendimento', label: 'Iniciar atendimento' },
  atendimento: { to: 'concluido', label: 'Concluir' },
}

export function whatsappLink(a: Appointment) {
  const digits = a.phone.replace(/\D/g, '')
  if (!digits) return null
  const number = digits.startsWith('55') ? digits : `55${digits}`
  const when = format(parseISO(a.date), "EEEE, d 'de' MMMM", { locale: ptBR })
  const text = `Olá, ${a.client.split(' ')[0]}! Passando para confirmar seu horário de ${a.service} em ${when} às ${formatTime(a.start)}. Podemos confirmar?`
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

function ProfessionalChips({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  const { professionals } = useAgenda()
  return (
    <div className="chips chips--tight" role="group" aria-label="Profissional">
      {professionals.map((p) => (
        <button key={p.id} type="button" className="chip" aria-pressed={value === p.id} onClick={() => onChange(p.id)}>
          {p.name}
        </button>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="dsec">
      <p className="dsec__title">{title}</p>
      {children}
    </div>
  )
}

export interface NewInitial {
  date: string
  start: number | null
  professionalId?: string
  clientName?: string
  serviceId?: string
}

export function NewAppointmentDialog({
  initial,
  onClose,
  notify,
}: {
  initial: NewInitial
  onClose: () => void
  notify: (message: string) => void
}) {
  const { professionals, clients, services, appointments, workingHours, create } = useAgenda()
  const first = services.find((s) => s.id === initial.serviceId) ?? services[0]
  const [clientName, setClientName] = useState(initial.clientName ?? '')
  const [phone, setPhone] = useState('')
  const [professionalId, setProfessionalId] = useState(initial.professionalId ?? professionals[0]?.id ?? '')
  const [serviceId, setServiceId] = useState(first?.id ?? 'outro')
  const [customService, setCustomService] = useState('')
  const [date, setDate] = useState(initial.date)
  const [start, setStart] = useState<number | null>(initial.start)
  const [duration, setDuration] = useState(first?.duration ?? 60)
  const [price, setPrice] = useState(first && first.price ? String(first.price).replace('.', ',') : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const existing = clients.find((c) => c.name.trim().toLowerCase() === clientName.trim().toLowerCase())
  const custom = serviceId === 'outro'
  const isNew = !existing && clientName.trim().length >= 2

  const pickService = (id: string) => {
    setServiceId(id)
    const s = services.find((x) => x.id === id)
    if (s) {
      setDuration(s.duration)
      setPrice(s.price ? String(s.price).replace('.', ',') : '')
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const name = clientName.trim()
    const service = custom ? customService.trim() : (services.find((s) => s.id === serviceId)?.name ?? '')
    if (name.length < 2) return setError('Informe o nome da cliente.')
    if (!service) return setError('Informe o serviço.')
    if (!professionalId) return setError('Escolha a profissional.')
    if (start === null) return setError('Escolha um horário.')
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
      price: parseMoney(price),
    }
    setBusy(true)
    const message = await create(input)
    setBusy(false)
    if (message) setError(message)
    else {
      notify(`Agendado: ${input.clientName}, ${formatTime(start)}`)
      onClose()
    }
  }

  return (
    <Modal label="Novo agendamento" onClose={onClose} wide>
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
          <ClientField
            label="Cliente"
            value={clientName}
            onChange={setClientName}
            clients={clients}
            hint={existing ? 'Cliente já cadastrada.' : isNew ? 'Cliente nova: será cadastrada junto.' : undefined}
          />

          {isNew && (
            <label className="field">
              <span className="field__label">WhatsApp (opcional)</span>
              <span className="input">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(11) 90000-0000" maxLength={20} />
              </span>
            </label>
          )}

          <Select
            label="Serviço"
            value={serviceId}
            onChange={pickService}
            options={[
              ...services.map((s) => ({ value: s.id, label: s.name, hint: formatDuration(s.duration) })),
              { value: 'outro', label: 'Outro serviço…' },
            ]}
          />

          {custom && (
            <label className="field">
              <span className="field__label">Nome do serviço</span>
              <span className="input">
                <input value={customService} onChange={(e) => setCustomService(e.target.value)} maxLength={80} />
              </span>
            </label>
          )}

          <div className="form__pair">
            <Stepper label="Duração" value={duration} onChange={setDuration} format={formatDuration} min={15} max={600} step={15} />
            <MoneyField label="Valor" value={price} onChange={setPrice} />
          </div>

          <Section title="Profissional">
            <ProfessionalChips value={professionalId} onChange={setProfessionalId} />
          </Section>

          <Section title="Dia">
            <DateStrip value={date} onChange={setDate} />
          </Section>

          <Section title="Horário">
            <SlotPicker
              date={date}
              professionalId={professionalId}
              duration={duration}
              value={start}
              onChange={setStart}
              appointments={appointments}
              hours={workingHours[professionalId]}
            />
          </Section>
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
          <Button type="submit" disabled={busy || start === null}>
            {busy ? 'Salvando…' : 'Agendar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function AppointmentDialog({
  appointment,
  startRescheduling,
  onClose,
  notify,
  onDuplicate,
  onMessage,
}: {
  appointment: Appointment
  startRescheduling?: boolean
  onClose: () => void
  notify: (message: string) => void
  onDuplicate: (a: Appointment) => void
  /** abre as mensagens prontas do WhatsApp para este horário */
  onMessage: (a: Appointment) => void
}) {
  const { professionals, appointments, workingHours, update } = useAgenda()
  const [rescheduling, setRescheduling] = useState(Boolean(startRescheduling))
  const [date, setDate] = useState(appointment.date)
  const [start, setStart] = useState<number | null>(appointment.start)
  const [professionalId, setProfessionalId] = useState(appointment.professionalId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [payment, setPayment] = useState<PaymentMethod>('pix')

  const pro = professionals.find((p) => p.id === appointment.professionalId)
  const step = NEXT_STEP[appointment.status]
  const open = appointment.status === 'pendente' || appointment.status === 'confirmado'
  const wa = whatsappLink(appointment)

  const run = async (patch: Parameters<typeof update>[1], done: string) => {
    setBusy(true)
    const message = await update(appointment.id, patch)
    setBusy(false)
    if (message) setError(message)
    else {
      notify(done)
      onClose()
      // pedido do site confirmado: já abre a mensagem para avisar a cliente que está garantido
      if (appointment.status === 'pendente' && patch.status === 'confirmado' && appointment.phone.replace(/\D/g, '')) onMessage(appointment)
    }
  }

  const reschedule = async () => {
    if (start === null) return setError('Escolha um horário.')
    const clash = findConflict(appointments, { professionalId, date, start, duration: appointment.duration }, appointment.id)
    if (clash) {
      return setError(`Esse horário bate com ${clash.client} (${formatTime(clash.start)} – ${formatTime(clash.start + clash.duration)}).`)
    }
    await run({ date, start, professionalId }, `Remarcado para ${format(parseISO(date), 'dd/MM')} às ${formatTime(start)}`)
  }

  return (
    <Modal label={`Atendimento de ${appointment.client}`} onClose={onClose} wide={rescheduling}>
      <div className="dialog__head">
        <div>
          <p className="eyebrow">{rescheduling ? 'Remarcar' : 'Atendimento'}</p>
          <h2>{appointment.client}</h2>
        </div>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      {rescheduling ? (
        <div className="form" style={{ marginBottom: 18 }}>
          <p className="card__sub">
            {appointment.service} · {formatDuration(appointment.duration)}
          </p>
          <Section title="Profissional">
            <ProfessionalChips value={professionalId} onChange={setProfessionalId} />
          </Section>
          <Section title="Dia">
            <DateStrip value={date} onChange={setDate} />
          </Section>
          <Section title="Horário">
            <SlotPicker
              date={date}
              professionalId={professionalId}
              duration={appointment.duration}
              value={start}
              onChange={setStart}
              appointments={appointments}
              ignoreId={appointment.id}
              hours={workingHours[professionalId]}
            />
          </Section>
        </div>
      ) : (
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
      )}

      {!rescheduling && step?.to === 'concluido' && (
        <Section title="Como a cliente pagou?">
          <div className="chips chips--tight" role="group" aria-label="Forma de pagamento" style={{ marginBottom: 18 }}>
            {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={payment === m} onClick={() => setPayment(m)}>
                {PAYMENT_LABEL[m]}
              </button>
            ))}
          </div>
        </Section>
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
            <Button disabled={busy || start === null} onClick={() => void reschedule()}>
              {busy ? 'Salvando…' : 'Salvar novo horário'}
            </Button>
          </>
        ) : (
          <>
            {step && (
              <Button disabled={busy} onClick={() => void run(step.to === 'concluido' ? { status: step.to, paymentMethod: payment } : { status: step.to }, `${appointment.client}: ${step.label.toLowerCase()}`)}>
                {step.label}
              </Button>
            )}
            {wa && (
              <Button
                variant="ghost"
                onClick={() => {
                  onMessage(appointment)
                  onClose()
                }}
              >
                <MessageCircle size={16} aria-hidden="true" /> Mensagem
              </Button>
            )}
            {open && (
              <Button variant="ghost" onClick={() => setRescheduling(true)}>
                Remarcar
              </Button>
            )}
          </>
        )}
      </div>

      {!rescheduling && (
        <div className="dialog__more">
          <button
            type="button"
            onClick={() => {
              onDuplicate(appointment)
              onClose()
            }}
          >
            Duplicar
          </button>
          {open && (
            <>
              <button type="button" disabled={busy} onClick={() => void run({ status: 'faltou' }, `Falta registrada: ${appointment.client}`)}>
                Marcar falta
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirmCancel(true)}>
                Cancelar atendimento
              </button>
            </>
          )}
        </div>
      )}

      {confirmCancel && (
        <ConfirmDialog
          title="Cancelar atendimento?"
          text={`O horário de ${appointment.client} (${formatTime(appointment.start)}) volta a ficar livre.`}
          confirmLabel="Cancelar atendimento"
          onClose={() => setConfirmCancel(false)}
          onConfirm={() => void run({ status: 'cancelado' }, `Cancelado: ${appointment.client}`)}
        />
      )}
    </Modal>
  )
}

