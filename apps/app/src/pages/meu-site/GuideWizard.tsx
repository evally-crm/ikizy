import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { PALETTES, type PaletteId, type SiteConfig, type Studio } from '../../data/catalog'
import { cleanSlug } from '../../domain/site'
import { FONTS, type FontId } from '../../lib/siteTheme'
import { SITE_DOMAIN, siteHost } from '../../lib/slug'
import SiteFrame, { DeviceToggle, type Device } from '../../components/SiteFrame'
import { Em, Field } from '../../components/ui'
import { fontVars, paletteVars } from './AppearanceFields'
import type { SetSite } from './types'
import './GuideWizard.css'

/** guia de criação em tela cheia: visual → endereço (publica) → "está no ar", com a prévia ao lado */
export function GuideWizard({
  site,
  draft,
  setSite,
  step,
  onStep,
  isLive,
  publishedSlug,
  slugReserved,
  addressOk,
  publishing,
  publishError,
  split,
  device,
  onDevice,
  onClose,
  onClaim,
  onComplete,
}: {
  site: SiteConfig
  draft: Studio
  setSite: SetSite
  step: number
  onStep: (step: number) => void
  isLive: boolean
  publishedSlug: string
  slugReserved: boolean
  addressOk: boolean
  publishing: boolean
  publishError: string | null
  /** prévia ao lado do formulário (tela larga) */
  split: boolean
  device: Device
  onDevice: (d: Device) => void
  onClose: () => void
  onClaim: () => void
  onComplete: () => void
}) {
  return (
    <div className="gg" role="dialog" aria-modal="true" aria-label="Criar seu site">
      <header className="gg__head">
        <span className="gg__logo">
          IKIZY<b>.</b>
        </span>
        <button type="button" className="gg__x" aria-label="Fechar o guia" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="gg__main">
        {/* mesmo jeito da criação de conta: progresso no topo, pílulas e o disco escuro para seguir */}
        <section className="gg__form wiz">
          <div className="wiz__bar">
            <button type="button" className="wiz__back" onClick={() => onStep(step - 1)} disabled={step !== 1 || publishing} aria-label="Voltar">
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <div className="wiz__progress" role="progressbar" aria-label="Progresso" aria-valuemin={1} aria-valuemax={2} aria-valuenow={step >= 1 ? 2 : 1}>
              <span className="is-done" />
              <span className={step >= 1 ? 'is-done' : undefined} />
            </div>
            {step < 2 ? (
              <button type="button" className="wiz__skip" onClick={onClose}>
                Pular
              </button>
            ) : (
              <span className="wiz__skip" aria-hidden="true" />
            )}
          </div>

          {step === 0 && (
            <>
              <p className="wiz__eyebrow">Seu site</p>
              <h1 className="auth__title">Escolha o visual</h1>
              <p className="card__sub">Cores já combinadas. Você muda quando quiser.</p>
              <p className="wiz__group-title">Paleta de cores</p>
              <div className="wiz__options">
                {(Object.keys(PALETTES) as PaletteId[]).map((id) => (
                  <button key={id} type="button" className="wiz__opt" aria-pressed={site.palette === id} onClick={() => setSite('palette', id)}>
                    <span className="wiz__dot gg__duo" aria-hidden="true" style={paletteVars(id)} />
                    {PALETTES[id].label}
                  </button>
                ))}
              </div>
              <p className="wiz__group-title">Fonte dos títulos</p>
              <div className="wiz__options">
                {(Object.keys(FONTS) as FontId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="wiz__opt gg__font"
                    aria-pressed={site.font === id}
                    onClick={() => setSite('font', id)}
                    style={fontVars(id)}
                  >
                    {FONTS[id].label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="wiz__eyebrow">Seu site</p>
              <h1 className="auth__title">{isLive ? 'Confirme o endereço' : 'Escolha o endereço'}</h1>
              <p className="card__sub">É o link que você divulga no Instagram e no WhatsApp.</p>
              <Field label="Nome do seu salão">
                {(id) => (
                  <span className="input">
                    <input id={id} value={site.salonName} maxLength={40} onChange={(e) => setSite('salonName', e.target.value)} />
                  </span>
                )}
              </Field>
              <Field label="Endereço do site" hint={slugReserved ? 'Esse endereço é reservado. Escolha outro.' : siteHost(site.slug)}>
                {(id) => (
                  <span className="input input--suffix">
                    <input id={id} value={site.slug} maxLength={40} aria-invalid={slugReserved} onChange={(e) => setSite('slug', cleanSlug(e.target.value))} />
                    <span aria-hidden="true">.{SITE_DOMAIN}</span>
                  </span>
                )}
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <p className="wiz__eyebrow">Tudo certo</p>
              <h1 className="auth__title">
                Seu site <Em>está no ar</Em>.
              </h1>
              <p className="card__sub">Agora complete com logo, foto de capa, textos, contato e serviços. Leva poucos minutos.</p>
              <div className="gg__done">
                <a className="gg__btn gg__btn--light" href={`https://${siteHost(publishedSlug)}`} target="_blank" rel="noreferrer">
                  Ver meu site
                </a>
                <button type="button" className="gg__btn" onClick={onComplete}>
                  Completar meu site
                </button>
              </div>
            </>
          )}

          {publishError && (
            <p className="field__hint" role="alert">
              {publishError}
            </p>
          )}

          {step < 2 && (
            <div className="auth__foot">
              <button type="button" className="textlink" onClick={onClose}>
                Fazer depois
              </button>
              {step === 0 ? (
                <button type="button" className="auth__go" onClick={() => onStep(1)} aria-label="Continuar" title="Continuar">
                  <ArrowRight size={22} aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  className="auth__go"
                  disabled={!addressOk || publishing}
                  onClick={onClaim}
                  aria-label={publishing ? 'Publicando…' : isLive ? 'Salvar alterações' : 'Publicar meu site'}
                  title={isLive ? 'Salvar alterações' : 'Publicar meu site'}
                >
                  <Check size={22} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </section>

        <section className="gg__preview" aria-label="Prévia do seu site">
          {split && <DeviceToggle device={device} onChange={onDevice} />}
          <div className="gg__frame">
            <SiteFrame studio={draft} device={split ? device : 'mobile'} height={split ? 'fill' : 240} />
          </div>
        </section>
      </div>
    </div>
  )
}
