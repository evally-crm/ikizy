import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { format, isAfter } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, Check, FileSignature, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Client, ClientAppointment } from '../data/clients'
import type { ClientNote, ProfessionalOption } from '../data/useClientBook'
import {
  ANAMNESIS_GROUPS,
  ANAMNESIS_TOTAL,
  answeredCount,
  attentionPoints,
  type Anamnesis,
} from '../lib/anamnesis'
import { formatBRL } from '../lib/format'
import { Button, Card, StatusBadge } from './ui'
import { ConfirmDialog, Modal } from './Modal'
import { SignaturePad } from './SignaturePad'

type Result = Promise<string | null>

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/* ------------------------------------------------------------------ cuidados e preferências */

const SUGGESTIONS = [
  'Prefere manhã',
  'Prefere tarde',
  'Prefere sábado',
  'Gosta de conversar',
  'Prefere silêncio',
  'Aceita café',
  'Aceita água',
  'Chega adiantada',
  'Costuma atrasar',
]

function TagEditor({
  items,
  tone,
  placeholder,
  label,
  onChange,
}: {
  items: string[]
  tone?: 'alert'
  placeholder: string
  label: string
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const add = (v: string) => {
    const t = v.trim().slice(0, 80)
    if (t && !items.some((i) => i.toLowerCase() === t.toLowerCase())) onChange([...items, t])
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    }
  }
  return (
    <div className="tagedit">
      <ul className="tagedit__list" aria-label={label}>
        {items.map((i) => (
          <li key={i} className={`ctag ${tone === 'alert' ? 'ctag--alert' : ''}`}>
            {tone === 'alert' && <AlertTriangle size={13} aria-hidden="true" />}
            {i}
            <button type="button" aria-label={`Tirar ${i}`} onClick={() => onChange(items.filter((x) => x !== i))}>
              <X size={13} />
            </button>
          </li>
        ))}
      </ul>
      <span className="input input--sm">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} placeholder={placeholder} maxLength={80} aria-label={placeholder} />
        {draft.trim() && (
          <button type="button" className="input__add" aria-label="Adicionar" onClick={() => add(draft)}>
            <Plus size={16} />
          </button>
        )}
      </span>
    </div>
  )
}

export function CareCard({
  client,
  onSave,
  onOpenFile,
}: {
  client: Client
  onSave: (care: { preferences: string[]; allergies: string[] }) => Result
  onOpenFile: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const attention = attentionPoints(client.anamnesis)
  const save = async (care: { preferences: string[]; allergies: string[] }) => setError(await onSave(care))
  const suggestions = SUGGESTIONS.filter((s) => !client.preferences.includes(s))

  return (
    <Card className="care">
      <div className="card__head">
        <div>
          <p className="eyebrow">Cuidados</p>
          <h3 className="card__title">Saúde e preferências</h3>
        </div>
      </div>

      <div className="care__block">
        <p className="care__label">Alergias</p>
        <TagEditor
          items={client.allergies}
          tone="alert"
          label="Alergias"
          placeholder={client.allergies.length ? 'Outra alergia' : 'Nenhuma anotada. Ex.: formol'}
          onChange={(allergies) => save({ allergies, preferences: client.preferences })}
        />
      </div>

      {attention.length > 0 && (
        <div className="care__block">
          <p className="care__label">
            Pela anamnese{' '}
            <button type="button" className="textlink" onClick={onOpenFile}>
              ver ficha
            </button>
          </p>
          <ul className="attention">
            {attention.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="care__block">
        <p className="care__label">Preferências</p>
        <TagEditor
          items={client.preferences}
          label="Preferências"
          placeholder="Ex.: formato amendoado, cor nude"
          onChange={(preferences) => save({ preferences, allergies: client.allergies })}
        />
        {suggestions.length > 0 && (
          <div className="care__suggest" role="group" aria-label="Sugestões de preferência">
            {suggestions.slice(0, 6).map((s) => (
              <button
                key={s}
                type="button"
                className="chip chip--ghost chip--sm"
                onClick={() => save({ preferences: [...client.preferences, s], allergies: client.allergies })}
              >
                <Plus size={12} aria-hidden="true" /> {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ dados pessoais */

export function PersonalCard({
  client,
  professionals,
  onEdit,
}: {
  client: Client
  professionals: ProfessionalOption[]
  onEdit: () => void
}) {
  const pro = professionals.find((p) => p.id === client.professionalId)?.name
  const rows: [string, string][] = [
    ['WhatsApp', client.phone],
    ['E-mail', client.email],
    ['Instagram', client.instagram && `@${client.instagram}`],
    ['Aniversário', client.birthday && format(new Date(2000, Number(client.birthday.slice(0, 2)) - 1, Number(client.birthday.slice(3))), "dd 'de' MMMM", { locale: ptBR })],
    ['Profissão', client.occupation],
    ['Endereço', client.address],
    ['Como conheceu', client.referral],
    ['Profissional preferida', pro ?? ''],
    ['Cliente desde', format(client.since, "dd/MM/yyyy")],
  ]
  const missing = rows.filter(([, v]) => !v).length

  return (
    <Card className="detail-grid__wide">
      <div className="card__head">
        <div>
          <p className="eyebrow">Cadastro</p>
          <h3 className="card__title">Dados pessoais</h3>
        </div>
        <Button size="sm" variant="light" onClick={onEdit}>
          <Pencil size={14} aria-hidden="true" /> Editar
        </Button>
      </div>
      <dl className="facts">
        {rows.map(([k, v]) => (
          <div key={k} className={v ? '' : 'is-empty'}>
            <dt>{k}</dt>
            <dd>{v || '—'}</dd>
          </div>
        ))}
      </dl>
      {missing > 2 && (
        <p className="card__sub facts__hint">
          Faltam {missing} informações.{' '}
          <button type="button" className="textlink" onClick={onEdit}>
            Completar cadastro
          </button>
        </p>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ ficha de anamnese (resumo + modal) */

/** resumo da ficha na aba "Ficha"; o preenchimento e a assinatura ficam no modal */
export function AnamnesisSummary({ client, onOpen }: { client: Client; onOpen: () => void }) {
  const answered = answeredCount(client.anamnesis)
  const attention = attentionPoints(client.anamnesis)
  const signed = Boolean(client.anamnesisSignedAt)
  const started = answered > 0 || signed

  return (
    <Card className={`detail-grid__wide anamnesis ${signed ? 'is-signed' : ''}`}>
      <div className="card__head">
        <div>
          <p className="eyebrow">Ficha de anamnese</p>
          <h3 className="card__title">{signed ? 'Assinada' : started ? 'Falta assinar' : 'Ainda não preenchida'}</h3>
          <p className="card__sub">
            {answered} de {ANAMNESIS_TOTAL} perguntas respondidas
            {client.anamnesisSignedAt && ` · assinada em ${format(client.anamnesisSignedAt, 'dd/MM/yyyy')}`}
          </p>
        </div>
        <FileSignature size={20} aria-hidden="true" />
      </div>

      {attention.length > 0 ? (
        <ul className="attention">
          {attention.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : (
        answered > 0 && <p className="card__sub">Nenhum ponto de atenção.</p>
      )}
      {client.anamnesis.notes && <p className="anam__notes">{client.anamnesis.notes}</p>}
      {client.anamnesisSignature && <img className="consent__sig consent__sig--sm" src={client.anamnesisSignature} alt={`Assinatura de ${client.name}`} />}

      <Button size="sm" className="card__cta" onClick={onOpen}>
        {started ? 'Abrir ficha' : 'Preencher ficha'}
      </Button>
    </Card>
  )
}

/** ficha completa num modal: perguntas, observações, termo e assinatura, tudo salvo de uma vez */
export function AnamnesisDialog({
  client,
  salonName,
  onSave,
  onSign,
  onClose,
}: {
  client: Client
  salonName: string
  onSave: (a: Anamnesis) => Result
  onSign: (signature: string | null) => Result
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Anamnesis>(client.anamnesis)
  const [dirty, setDirty] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [redo, setRedo] = useState(!client.anamnesisSignedAt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const answered = answeredCount(draft)
  const firstName = client.name.split(' ')[0]

  const change = (fn: (d: Anamnesis) => Anamnesis) => {
    setDraft(fn)
    setDirty(true)
    setError(null)
  }

  const setAnswer = (id: string, yes: boolean) =>
    change((d) => {
      const prev = d.answers[id]
      const answers = { ...d.answers }
      if (prev && prev.yes === yes) delete answers[id]
      else answers[id] = { yes, detail: yes ? prev?.detail : undefined }
      return { ...d, answers }
    })

  /** agiliza a ficha: o que ainda não foi respondido vira "não" e só se ajustam os "sim" */
  const fillRest = () =>
    change((d) => {
      const answers = { ...d.answers }
      for (const g of ANAMNESIS_GROUPS) for (const q of g.questions) if (!(q.id in answers)) answers[q.id] = { yes: false }
      return { ...d, answers }
    })

  const save = async () => {
    setBusy(true)
    let err: string | null = null
    if (dirty) err = await onSave(draft)
    if (!err && signature) err = await onSign(signature)
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <Modal label={`Ficha de ${client.name}`} onClose={onClose} wide>
      <div className="dialog__head">
        <div>
          <p className="eyebrow">Ficha de anamnese</p>
          <h2>{client.name}</h2>
        </div>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      <div className="anam">
        <div className="anam__top">
          <span className="card__sub">
            {answered} de {ANAMNESIS_TOTAL} respondidas
          </span>
          <span className="anam__meter" aria-hidden="true">
            <span style={{ width: `${(answered / ANAMNESIS_TOTAL) * 100}%` }} />
          </span>
        </div>
        {answered < ANAMNESIS_TOTAL && (
          <button type="button" className="chip chip--ghost chip--sm anam__rest" onClick={fillRest}>
            <Check size={14} aria-hidden="true" /> {answered === 0 ? 'Marcar tudo como “não”' : 'Marcar o resto como “não”'}
          </button>
        )}

        {ANAMNESIS_GROUPS.map((g) => (
          <fieldset key={g.title} className="anam__group">
            <legend>{g.title}</legend>
            {g.questions.map((q) => {
              const a = draft.answers[q.id]
              return (
                <div key={q.id} className={`anam__q ${a?.yes ? 'is-yes' : ''}`}>
                  <span className="anam__text">{q.text}</span>
                  <span className="yn" role="group" aria-label={q.text}>
                    <button type="button" aria-pressed={a?.yes === false} onClick={() => setAnswer(q.id, false)}>
                      Não
                    </button>
                    <button type="button" aria-pressed={a?.yes === true} onClick={() => setAnswer(q.id, true)}>
                      Sim
                    </button>
                  </span>
                  {a?.yes && q.ask && (
                    <span className="input input--sm anam__detail">
                      <input
                        value={a.detail ?? ''}
                        onChange={(e) => change((d) => ({ ...d, answers: { ...d.answers, [q.id]: { yes: true, detail: e.target.value } } }))}
                        maxLength={120}
                        placeholder={q.ask}
                        aria-label={q.ask}
                      />
                    </span>
                  )}
                </div>
              )
            })}
          </fieldset>
        ))}

        <label className="field">
          <span className="field__label">Observações da avaliação</span>
          <span className="input">
            <textarea
              value={draft.notes}
              rows={3}
              maxLength={1000}
              placeholder="Tipo de pele, estado das unhas, curvatura dos cílios, o que foi combinado..."
              onChange={(e) => change((d) => ({ ...d, notes: e.target.value }))}
            />
          </span>
        </label>

        <div className="consent">
          <p className="anam__legend">Termo de consentimento</p>
          <p className="consent__text">
            Eu, <strong>{client.name}</strong>, declaro que as informações desta ficha são verdadeiras, que fui orientada sobre os
            cuidados antes e depois dos procedimentos e autorizo {salonName || 'o salão'} a realizá-los, a fotografá-los para acompanhamento e a guardar estes
            dados e fotos para o meu atendimento, conforme a LGPD.
          </p>
          {redo ? (
            <SignaturePad label={`Assinatura de ${firstName}`} onChange={setSignature} />
          ) : (
            <div className="consent__done">
              {client.anamnesisSignature ? (
                <img className="consent__sig" src={client.anamnesisSignature} alt={`Assinatura de ${client.name}`} />
              ) : (
                <p className="card__sub">Assinatura colhida em papel.</p>
              )}
              <p className="card__sub">
                Assinado em {format(client.anamnesisSignedAt!, "dd/MM/yyyy 'às' HH:mm")}.{' '}
                <button type="button" className="textlink" onClick={() => setRedo(true)}>
                  Assinar de novo
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}

      <div className="dialog__actions">
        <Button variant="light" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={busy || (!dirty && !signature)} onClick={save}>
          {busy ? 'Salvando…' : signature ? 'Salvar e assinar' : 'Salvar ficha'}
        </Button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ histórico */

export function HistoryCard({
  appointments,
  proName,
  limit,
  onSeeAll,
}: {
  appointments: ClientAppointment[]
  proName: (id: string) => string
  limit?: number
  onSeeAll?: () => void
}) {
  const now = new Date()
  const past = appointments.filter((a) => !isAfter(a.date, now) || a.status === 'concluido')
  const shown = limit ? past.slice(0, limit) : past
  const done = past.filter((a) => a.status === 'concluido').length
  const missed = past.filter((a) => a.status === 'faltou').length
  const cancelled = past.filter((a) => a.status === 'cancelado').length

  return (
    <Card className="detail-grid__wide">
      <div className="card__head">
        <div>
          <p className="eyebrow">Histórico</p>
          <h3 className="card__title">{limit ? 'Últimos atendimentos' : 'Todos os atendimentos'}</h3>
        </div>
        {onSeeAll && past.length > (limit ?? 0) ? (
          <button type="button" className="textlink" onClick={onSeeAll}>
            Ver todos ({past.length})
          </button>
        ) : (
          <span className="card__sub">{plural(done, 'concluído', 'concluídos')}</span>
        )}
      </div>
      {!limit && (missed > 0 || cancelled > 0) && (
        <p className="card__sub history__summary">
          {plural(missed, 'falta', 'faltas')} · {plural(cancelled, 'cancelamento', 'cancelamentos')}
        </p>
      )}
      {shown.length === 0 && <p className="card__sub">Os atendimentos aparecem aqui depois do primeiro horário.</p>}
      <ol className="history">
        {shown.map((v, i) => (
          <li key={i} className={`history__item ${v.status !== 'concluido' ? 'is-off' : ''}`}>
            <span className="history__date">
              <strong>{format(v.date, 'dd')}</strong>
              {format(v.date, 'MMM yy', { locale: ptBR }).replace('.', '')}
            </span>
            <span className="history__body">
              <span className="history__service">{v.service}</span>
              <span className="card__sub">
                {format(v.date, 'HH:mm')}
                {proName(v.professionalId) && ` · com ${proName(v.professionalId)}`}
              </span>
            </span>
            {v.status === 'concluido' ? (
              <span className="history__price">{formatBRL(v.price)}</span>
            ) : (
              <StatusBadge status={v.status} />
            )}
          </li>
        ))}
      </ol>
    </Card>
  )
}

/* ------------------------------------------------------------------ anotações */

export function NotesCard({
  notes,
  loading,
  loadError,
  onAdd,
  onRemove,
}: {
  notes: ClientNote[]
  loading: boolean
  loadError: string | null
  onAdd: (body: string) => Result
  onRemove: (id: string) => Result
}) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ClientNote | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setBusy(true)
    const err = await onAdd(body)
    setBusy(false)
    setError(err)
    if (!err) setDraft('')
  }

  return (
    <Card className="detail-grid__wide">
      <div className="card__head">
        <div>
          <p className="eyebrow">Anotações</p>
          <h3 className="card__title">Linha do tempo</h3>
        </div>
        <span className="card__sub">{plural(notes.length, 'anotação', 'anotações')}</span>
      </div>
      <form className="note__form" onSubmit={submit}>
        <span className="input">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Como foi o atendimento, o que usar da próxima vez, conversa importante..."
            aria-label="Nova anotação"
          />
        </span>
        <Button type="submit" size="sm" disabled={!draft.trim() || busy}>
          {busy ? 'Salvando…' : 'Anotar'}
        </Button>
      </form>
      {(error || loadError) && (
        <p className="dialog__error" role="alert">
          {error ?? loadError}
        </p>
      )}
      {loading && <p className="card__sub">Carregando…</p>}
      {!loading && notes.length === 0 && <p className="card__sub">Nada anotado ainda.</p>}
      <ol className="notes">
        {notes.map((n) => (
          <li key={n.id}>
            <span className="notes__date">{format(n.date, "dd 'de' MMM yyyy · HH:mm", { locale: ptBR })}</span>
            <p className="notes__body">{n.body}</p>
            <button type="button" className="notes__del" aria-label="Apagar anotação" onClick={() => setConfirm(n)}>
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ol>
      {confirm && (
        <ConfirmDialog
          title="Apagar anotação?"
          text="Ela sai da ficha da cliente e não dá para desfazer."
          confirmLabel="Apagar"
          onConfirm={async () => setError(await onRemove(confirm.id))}
          onClose={() => setConfirm(null)}
        />
      )}
    </Card>
  )
}
