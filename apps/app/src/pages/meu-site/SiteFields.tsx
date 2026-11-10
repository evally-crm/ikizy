import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { SiteConfig } from '../../data/catalog'
import { aboutIdeas, cleanSlug, noticeHours, taglineIdeas, windowDays } from '../../domain/site'
import { SITE_DOMAIN } from '../../lib/slug'
import { dash } from '../../lib/routes'
import OnlineBookingChecklist from '../../components/OnlineBookingChecklist'
import { Field } from '../../components/ui'
import { Switch } from '../../components/controls'
import { Group, SettingRow } from './Group'
import type { SetSite } from './types'
import './MeuSite.css'

/** número inteiro que pode ficar vazio enquanto se digita (apagar o 0 e escrever 4);
 * o valor ajustado ao limite vale na hora e o texto volta a ele ao sair do campo */
function WholeInput({ id, value, min, max, toValue, onChange }: { id: string; value: number; min: number; max: number; toValue: (raw: string) => number; onChange: (v: number) => void }) {
  const [text, setText] = useState<string | null>(null)
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text ?? String(value)}
      onChange={(e) => {
        setText(e.target.value)
        if (e.target.value !== '') onChange(toValue(e.target.value))
      }}
      onFocus={(e) => e.target.select()}
      onBlur={() => {
        if (text === '') onChange(toValue(''))
        setText(null)
      }}
    />
  )
}

/** textos prontos para tocar e usar (o campo continua editável) */
function Ideas({ ideas, current, onPick }: { ideas: string[]; current: string; onPick: (text: string) => void }) {
  return (
    <div className="ideas" role="group" aria-label="Textos prontos">
      <span className="ideas__label">Prontos para usar</span>
      {ideas.map((t) => (
        <button key={t} type="button" className="ideas__item" aria-pressed={current === t} onClick={() => onPick(t)}>
          {t}
        </button>
      ))}
    </div>
  )
}

/** nome, frase de destaque e texto "sobre" */
export function TextFields({ site, setSite, categories = [] }: { site: SiteConfig; setSite: SetSite; categories?: string[] }) {
  return (
    <Group title="Textos da página">
      <Field label="Nome do salão">
        {(id) => (
          <span className="input">
            <input id={id} value={site.salonName} maxLength={40} onChange={(e) => setSite('salonName', e.target.value)} />
          </span>
        )}
      </Field>
      <Field label="Frase de destaque" hint="A última palavra vira o destaque em itálico.">
        {(id) => (
          <span className="input">
            <input id={id} value={site.tagline} maxLength={70} onChange={(e) => setSite('tagline', e.target.value)} />
          </span>
        )}
      </Field>
      <Ideas ideas={taglineIdeas(categories)} current={site.tagline} onPick={(t) => setSite('tagline', t)} />
      <Field label="Sobre o salão">
        {(id) => (
          <span className="input input--area">
            <textarea id={id} rows={3} value={site.about} maxLength={220} onChange={(e) => setSite('about', e.target.value)} />
          </span>
        )}
      </Field>
      <Ideas ideas={aboutIdeas(site.salonName, categories)} current={site.about} onPick={(t) => setSite('about', t)} />
    </Group>
  )
}

/** endereço da página, WhatsApp, Instagram e endereço do salão; o horário vem da agenda (um lugar só para mudar) */
export function ContactFields({ site, setSite, slugReserved }: { site: SiteConfig; setSite: SetSite; slugReserved: boolean }) {
  return (
    <>
      <Group title="Endereço da página">
        <Field
          label="Endereço da página"
          hint={slugReserved ? 'Esse endereço é reservado. Escolha outro.' : 'É o link que você coloca no Instagram e no WhatsApp.'}
        >
          {(id) => (
            <span className="input input--suffix">
              <input id={id} value={site.slug} maxLength={40} aria-invalid={slugReserved} onChange={(e) => setSite('slug', cleanSlug(e.target.value))} />
              <span aria-hidden="true">.{SITE_DOMAIN}</span>
            </span>
          )}
        </Field>
      </Group>
      <Group title="Contato e atendimento">
        <div className="form__pair">
          <Field label="WhatsApp">
            {(id) => (
              <span className="input">
                <input id={id} inputMode="tel" value={site.whatsapp} onChange={(e) => setSite('whatsapp', e.target.value)} />
              </span>
            )}
          </Field>
          <Field label="Instagram">
            {(id) => (
              <span className="input">
                <input id={id} value={site.instagram} onChange={(e) => setSite('instagram', e.target.value)} />
              </span>
            )}
          </Field>
        </div>
        <Field label="Endereço do salão" hint="Aparece na página com link para o mapa. Deixe vazio se atende em domicílio.">
          {(id) => (
            <span className="input">
              <input id={id} value={site.address} maxLength={120} autoComplete="street-address" onChange={(e) => setSite('address', e.target.value)} />
            </span>
          )}
        </Field>
        <SettingRow label="Horário de atendimento" hint={site.hours || 'Ainda sem horário definido'}>
          <Link className="textlink" to={dash('/negocio#horario')}>
            Mudar na agenda
          </Link>
        </SettingRow>
      </Group>
    </>
  )
}

/** agendamento online (regras e o que falta para abrir) e o que a página mostra */
export function BookingFields({ site, setSite }: { site: SiteConfig; setSite: SetSite }) {
  return (
    <>
      <Group title="Agendamento online">
        <Switch
          checked={site.onlineBooking}
          onChange={(v) => setSite('onlineBooking', v)}
          label="Aceitar agendamentos pelo site"
          hint="A cliente escolhe serviço, dia e horário livre. O pedido cai na agenda como pendente."
        />
        {site.onlineBooking && (
          <>
            <SettingRow label="Antecedência mínima" hint="Horas antes do atendimento" htmlFor="site-notice">
              <span className="input input--suffix input--mini">
                <WholeInput id="site-notice" min={0} max={168} value={site.bookingNoticeHours} toValue={noticeHours} onChange={(v) => setSite('bookingNoticeHours', v)} />
                <span aria-hidden="true">h</span>
              </span>
            </SettingRow>
            <SettingRow label="Agendar até" hint="Dias à frente" htmlFor="site-window">
              <span className="input input--suffix input--mini">
                <WholeInput id="site-window" min={1} max={90} value={site.bookingWindowDays} toValue={windowDays} onChange={(v) => setSite('bookingWindowDays', v)} />
                <span aria-hidden="true">dias</span>
              </span>
            </SettingRow>
          </>
        )}
      </Group>
      <Group title="Antes de abrir a agenda">
        <OnlineBookingChecklist bare whatsapp={site.whatsapp} online={site.onlineBooking} />
      </Group>
      <Group title="Na página">
        <Switch checked={site.showPrices} onChange={(v) => setSite('showPrices', v)} label="Mostrar preços" hint="Desligado, a cliente pede o valor no WhatsApp." />
        <Switch checked={site.showTeam} onChange={(v) => setSite('showTeam', v)} label="Mostrar a equipe" />
      </Group>
    </>
  )
}
