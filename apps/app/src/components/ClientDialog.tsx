import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { Client } from '../data/clients'
import type { ClientDraft, ProfessionalOption } from '../data/useClientBook'
import { Button } from './ui'
import { Switch } from './controls'
import { Modal } from './Modal'

const splitLines = (v: string) =>
  v
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean)

const REFERRALS = ['Instagram', 'Indicação', 'Google', 'Passou na frente', 'Outro'] as const
type Referral = (typeof REFERRALS)[number]
const REFERRED_BY = 'Indicação de '

/** "Indicação de Aline" → Indicação + Aline; texto livre antigo vira Outro */
function parseReferral(v: string): { kind: Referral | null; who: string } {
  if (!v) return { kind: null, who: '' }
  if (v.startsWith(REFERRED_BY)) return { kind: 'Indicação', who: v.slice(REFERRED_BY.length) }
  const kind = REFERRALS.find((r) => r === v)
  return kind ? { kind, who: '' } : { kind: 'Outro', who: v }
}

function composeReferral(kind: Referral | null, who: string) {
  if (!kind) return ''
  const w = who.trim()
  if (kind === 'Indicação') return w ? `${REFERRED_BY}${w}` : kind
  if (kind === 'Outro') return w || kind
  return kind
}

/** cadastro e edição de cliente (o mesmo formulário para os dois) */
export function ClientDialog({
  client,
  professionals,
  onSave,
  onClose,
}: {
  client?: Client
  professionals: ProfessionalOption[]
  onSave: (draft: ClientDraft) => Promise<string | null>
  onClose: () => void
}) {
  const initialReferral = parseReferral(client?.referral ?? '')
  const [name, setName] = useState(client?.name ?? '')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [email, setEmail] = useState(client?.email ?? '')
  const [instagram, setInstagram] = useState(client?.instagram ?? '')
  const [birthday, setBirthday] = useState(client?.birthday ? `2000-${client.birthday}` : '')
  const [occupation, setOccupation] = useState(client?.occupation ?? '')
  const [address, setAddress] = useState(client?.address ?? '')
  const [referralKind, setReferralKind] = useState<Referral | null>(initialReferral.kind)
  const [referralWho, setReferralWho] = useState(initialReferral.who)
  const [vip, setVip] = useState(client?.vip ?? false)
  const [professionalId, setProfessionalId] = useState<string | null>(client?.professionalId ?? null)
  const [allergies, setAllergies] = useState(client?.allergies.join(', ') ?? '')
  const [preferences, setPreferences] = useState(client?.preferences.join('\n') ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2) {
      setError('Informe o nome da cliente.')
      return
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Confira o e-mail.')
      return
    }
    setBusy(true)
    const err = await onSave({
      name: name.trim(),
      phone: phone.trim(),
      birthday,
      vip,
      professionalId,
      allergies: allergies
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      preferences: splitLines(preferences),
      email: email.trim(),
      instagram: instagram.trim().replace(/^@/, ''),
      address: address.trim(),
      occupation: occupation.trim(),
      referral: composeReferral(referralKind, referralWho),
    })
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <Modal label={client ? 'Editar cliente' : 'Nova cliente'} onClose={onClose} wide>
      <form onSubmit={onSubmit}>
        <div className="dialog__head">
          <h2>{client ? 'Editar cliente' : 'Nova cliente'}</h2>
          <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div className="form">
          <div className="dsec">
            <p className="dsec__title">Contato</p>
            <label className="field">
              <span className="field__label">Nome</span>
              <span className="input">
                <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} autoComplete="off" autoFocus />
              </span>
            </label>
            <div className="form__pair">
              <label className="field">
                <span className="field__label">WhatsApp</span>
                <span className="input">
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={20} placeholder="(11) 99999-9999" autoComplete="off" />
                </span>
              </label>
              <label className="field">
                <span className="field__label">Instagram</span>
                <span className="input">
                  <span className="input__prefix">@</span>
                  <input value={instagram} onChange={(e) => setInstagram(e.target.value.replace(/\s/g, ''))} maxLength={60} placeholder="usuario" autoComplete="off" />
                </span>
              </label>
            </div>
            <label className="field">
              <span className="field__label">E-mail (opcional)</span>
              <span className="input">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="off" />
              </span>
            </label>
          </div>

          <div className="dsec">
            <p className="dsec__title">Sobre ela</p>
            <div className="form__pair">
              <label className="field">
                <span className="field__label">Aniversário</span>
                <span className="input">
                  <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
                </span>
              </label>
              <label className="field">
                <span className="field__label">Profissão</span>
                <span className="input">
                  <input value={occupation} onChange={(e) => setOccupation(e.target.value)} maxLength={60} autoComplete="off" />
                </span>
              </label>
            </div>
            <label className="field">
              <span className="field__label">Endereço ou bairro</span>
              <span className="input">
                <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={160} autoComplete="off" />
              </span>
            </label>
            <div className="field">
              <span className="field__label">Como conheceu o salão</span>
              <div className="chips chips--tight" role="group" aria-label="Como conheceu o salão">
                {REFERRALS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="chip"
                    aria-pressed={referralKind === r}
                    onClick={() => setReferralKind(referralKind === r ? null : r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {(referralKind === 'Indicação' || referralKind === 'Outro') && (
              <label className="field">
                <span className="field__label">{referralKind === 'Indicação' ? 'Quem indicou?' : 'Como foi?'}</span>
                <span className="input">
                  <input value={referralWho} onChange={(e) => setReferralWho(e.target.value)} maxLength={60} autoComplete="off" />
                </span>
              </label>
            )}
          </div>

          <div className="dsec">
            <p className="dsec__title">Atendimento</p>
            {professionals.length > 0 && (
              <div className="field">
                <span className="field__label">Profissional de preferência</span>
                <div className="chips chips--tight" role="group" aria-label="Profissional de preferência">
                  {professionals.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="chip"
                      aria-pressed={professionalId === p.id}
                      onClick={() => setProfessionalId(professionalId === p.id ? null : p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="field">
              <span className="field__label">Alergias (separe por vírgula)</span>
              <span className="input">
                <input value={allergies} onChange={(e) => setAllergies(e.target.value)} maxLength={200} placeholder="Formol, amônia" autoComplete="off" />
              </span>
            </label>
            <label className="field">
              <span className="field__label">Preferências (uma por linha)</span>
              <span className="input">
                <textarea value={preferences} onChange={(e) => setPreferences(e.target.value)} rows={3} maxLength={400} />
              </span>
            </label>
            <Switch checked={vip} onChange={setVip} label="Cliente VIP" />
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
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
