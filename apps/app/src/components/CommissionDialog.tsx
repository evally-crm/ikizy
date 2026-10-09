import { useState, type FormEvent } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Modal } from './Modal'
import { Select, Switch } from './controls'
import { Button } from './ui'
import { describeRule, ruleProblem, type CommissionBase, type CommissionKind, type CommissionRule } from '../lib/commission'
import type { CommissionConfig, FinanceProfessional, FinanceService } from '../data/useFinance'

/** regra em edição: o valor fica como texto até salvar ("" = sem regra, vale a de cima) */
interface Draft {
  kind: CommissionKind
  value: string
}
interface ExceptionDraft extends Draft {
  key: string
  serviceId: string
  /** '' = todas as profissionais */
  professionalId: string
}

const toDraft = (r: CommissionRule | undefined): Draft => (r ? { kind: r.kind, value: String(r.value).replace('.', ',') } : { kind: 'percent', value: '' })
/** aceita 12,5 · 12.5 · 1.200,00 */
const toNumber = (v: string) => {
  const t = v.trim()
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
}
let seq = 0
const key = () => `x${++seq}`

/** % ou R$ por atendimento + valor */
function RuleField({ label, draft, onChange, placeholder }: { label: string; draft: Draft; onChange: (d: Draft) => void; placeholder: string }) {
  return (
    <div className="cmrule">
      <div className="cmrule__kind" role="radiogroup" aria-label={`${label}: tipo`}>
        {(['percent', 'fixed'] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={draft.kind === k} onClick={() => onChange({ ...draft, kind: k })}>
            {k === 'percent' ? '%' : 'R$'}
          </button>
        ))}
      </div>
      <span className="input cmrule__value">
        <input
          aria-label={label}
          inputMode="decimal"
          value={draft.value}
          onChange={(e) => onChange({ ...draft, value: e.target.value.replace(/[^\d,.]/g, '') })}
          placeholder={placeholder}
          maxLength={9}
        />
        {draft.kind === 'fixed' && draft.value && <span className="cmrule__unit">por atend.</span>}
      </span>
    </div>
  )
}

/** configurar comissões: liga/desliga, base de cálculo, padrão, por profissional e exceções por serviço */
export function CommissionDialog({
  config,
  professionals,
  services,
  onSave,
  onClose,
}: {
  config: CommissionConfig
  professionals: FinanceProfessional[]
  services: FinanceService[]
  onSave: (config: CommissionConfig) => Promise<string | null>
  onClose: () => void
}) {
  const find = (p: string | null, s: string | null) => config.rules.find((r) => r.professionalId === p && r.serviceId === s)
  const [enabled, setEnabled] = useState(config.enabled)
  const [base, setBase] = useState<CommissionBase>(config.base)
  const [fallback, setFallback] = useState<Draft>(toDraft(find(null, null)))
  const [perPro, setPerPro] = useState<Record<string, Draft>>(() => Object.fromEntries(professionals.map((p) => [p.id, toDraft(find(p.id, null))])))
  const [exceptions, setExceptions] = useState<ExceptionDraft[]>(() =>
    config.rules
      .filter((r) => r.serviceId)
      .map((r) => ({ key: key(), serviceId: r.serviceId as string, professionalId: r.professionalId ?? '', ...toDraft(r) })),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const proName = (id: string) => professionals.find((p) => p.id === id)?.name ?? 'Profissional'
  const serviceOptions = services.map((s) => ({ value: s.id, label: s.name, hint: s.category }))
  const proOptions = [{ value: '', label: 'Todas as profissionais' }, ...professionals.map((p) => ({ value: p.id, label: p.name }))]

  const addException = () => {
    const first = services[0]
    if (!first) return
    setExceptions((list) => [...list, { key: key(), serviceId: first.id, professionalId: '', kind: 'percent', value: '' }])
  }
  const patchException = (k: string, patch: Partial<ExceptionDraft>) => setExceptions((list) => list.map((x) => (x.key === k ? { ...x, ...patch } : x)))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const rules: CommissionRule[] = []
    const push = (label: string, d: Draft, professionalId: string | null, serviceId: string | null): string | null => {
      if (!d.value.trim()) return null
      const rule = { professionalId, serviceId, kind: d.kind, value: toNumber(d.value) }
      const problem = ruleProblem(rule)
      if (problem) return `${label}: ${problem}`
      rules.push(rule)
      return null
    }
    const problems = [
      push('Padrão', fallback, null, null),
      ...professionals.map((p) => push(p.name, perPro[p.id] ?? { kind: 'percent', value: '' }, p.id, null)),
      ...exceptions.map((x) => push(services.find((s) => s.id === x.serviceId)?.name ?? 'Exceção', x, x.professionalId || null, x.serviceId)),
    ].filter(Boolean)
    if (problems.length) return setError(problems[0] as string)
    const seen = new Set<string>()
    for (const r of rules.filter((r) => r.serviceId)) {
      const id = `${r.professionalId ?? '*'}|${r.serviceId}`
      if (seen.has(id)) return setError('Há duas exceções iguais (mesmo serviço e mesma profissional). Deixe só uma.')
      seen.add(id)
    }
    if (enabled && rules.length === 0) return setError('Defina pelo menos o padrão ou o valor de uma profissional.')

    setBusy(true)
    const err = await onSave({ enabled, base, rules })
    setBusy(false)
    if (err) return setError(err)
    onClose()
  }

  return (
    <Modal label="Comissões" onClose={onClose} wide>
      <form onSubmit={onSubmit}>
        <div className="dialog__head">
          <h2>Comissões</h2>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div className="form">
          <Switch
            checked={enabled}
            onChange={setEnabled}
            label="Pagar comissão para a equipe"
            hint="Desligado, o financeiro não desconta comissão de ninguém."
          />

          {enabled && (
            <>
              <div className="dsec">
                <p className="dsec__title">Calcular sobre</p>
                <div className="chips chips--tight" role="radiogroup" aria-label="Base de cálculo">
                  <button type="button" className="chip" role="radio" aria-checked={base === 'price'} aria-pressed={base === 'price'} onClick={() => setBase('price')}>
                    Valor cobrado
                  </button>
                  <button
                    type="button"
                    className="chip"
                    role="radio"
                    aria-checked={base === 'price_minus_card_fee'}
                    aria-pressed={base === 'price_minus_card_fee'}
                    onClick={() => setBase('price_minus_card_fee')}
                  >
                    Valor sem a taxa do cartão
                  </button>
                </div>
                <p className="field__hint">
                  {base === 'price'
                    ? 'A porcentagem vale sobre o preço do atendimento.'
                    : 'Em crédito e débito, a taxa da maquininha sai antes de calcular a porcentagem.'}
                </p>
              </div>

              <div className="dsec">
                <p className="dsec__title">Padrão para todas</p>
                <RuleField label="Comissão padrão" draft={fallback} onChange={setFallback} placeholder="Sem comissão" />
                <p className="field__hint">Vale para quem não tiver um valor próprio abaixo.</p>
              </div>

              {professionals.length > 0 && (
                <div className="dsec">
                  <p className="dsec__title">Por profissional</p>
                  <ul className="cmlist">
                    {professionals.map((p) => (
                      <li key={p.id} className="cmlist__row">
                        <span className="cmlist__name">{p.name}</span>
                        <RuleField
                          label={`Comissão de ${p.name}`}
                          draft={perPro[p.id] ?? { kind: 'percent', value: '' }}
                          onChange={(d) => setPerPro((m) => ({ ...m, [p.id]: d }))}
                          placeholder={fallback.value ? `Padrão (${describeRule({ kind: fallback.kind, value: toNumber(fallback.value) || 0 })})` : 'Padrão'}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="dsec">
                <p className="dsec__title">Exceções por serviço</p>
                <p className="field__hint">Ex.: mechas pagam 50% para todas, ou R$ 120 fixos só para uma profissional. A exceção vale mais que o resto.</p>
                {exceptions.length > 0 && (
                  <ul className="cmlist">
                    {exceptions.map((x) => (
                      <li key={x.key} className="cmlist__row cmlist__row--exc">
                        <div className="cmlist__pick">
                          <Select label="Serviço" hideLabel value={x.serviceId} options={serviceOptions} onChange={(v) => patchException(x.key, { serviceId: v })} />
                          {professionals.length > 1 && (
                            <Select label="Profissional" hideLabel value={x.professionalId} options={proOptions} onChange={(v) => patchException(x.key, { professionalId: v })} />
                          )}
                        </div>
                        <div className="cmlist__end">
                          <RuleField
                            label={`Comissão de ${services.find((s) => s.id === x.serviceId)?.name ?? 'serviço'}${x.professionalId ? ` com ${proName(x.professionalId)}` : ''}`}
                            draft={x}
                            onChange={(d) => patchException(x.key, d)}
                            placeholder="Valor"
                          />
                          <button type="button" className="chevbtn" aria-label="Remover exceção" onClick={() => setExceptions((l) => l.filter((y) => y.key !== x.key))}>
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {services.length > 0 ? (
                  <Button variant="light" size="sm" onClick={addException}>
                    <Plus size={14} aria-hidden="true" /> Adicionar exceção
                  </Button>
                ) : (
                  <p className="field__hint">Cadastre serviços em Meu site para criar exceções.</p>
                )}
              </div>
            </>
          )}
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
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
