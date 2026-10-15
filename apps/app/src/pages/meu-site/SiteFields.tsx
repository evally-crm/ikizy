import { useState } from 'react'
import type { SiteConfig } from '../../data/catalog'
import { cleanSlug, depositPercent, noticeHours, windowDays } from '../../domain/site'
import { SITE_DOMAIN } from '../../lib/slug'
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

/** nome, frase de destaque e texto "sobre" */
export function TextFields({ site, setSite }: { site: SiteConfig; setSite: SetSite }) {
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
      <Field label="Sobre o salão">
        {(id) => (
          <span className="input input--area">
            <textarea id={id} rows={3} value={site.about} maxLength={220} onChange={(e) => setSite('about', e.target.value)} />
          </span>
        )}
      </Field>
    </Group>
  )
}

/** endereço da página, WhatsApp, Instagram, endereço do salão e horário */
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
        <Field label="Horário de atendimento">
          {(id) => (
            <span className="input">
              <input id={id} value={site.hours} maxLength={50} onChange={(e) => setSite('hours', e.target.value)} />
            </span>
          )}
        </Field>
      </Group>
    </>
  )
}

/** o que aparece na página: preços, equipe, agendamento online e sinal */
export function ShowFields({ site, setSite }: { site: SiteConfig; setSite: SetSite }) {
  return (
    <>
      <Group title="Na página">
        <Switch checked={site.showPrices} onChange={(v) => setSite('showPrices', v)} label="Mostrar preços" hint="Desligado, a cliente pede o valor no WhatsApp." />
        <Switch checked={site.showTeam} onChange={(v) => setSite('showTeam', v)} label="Mostrar a equipe" />
      </Group>
      <Group title="Agendamento online">
        <Switch
          checked={site.onlineBooking}
          onChange={(v) => setSite('onlineBooking', v)}
          label="Aceitar agendamentos"
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
            <p className="srow__note">Só aparecem horários dentro do expediente de cada profissional (Agenda › Horário de atendimento).</p>
          </>
        )}
      </Group>
      <Group title="Sinal">
        <SettingRow label="Sinal para confirmar" hint="Cobrado via Pix no agendamento online. 0 para não cobrar." htmlFor="site-deposit">
          <span className="input input--suffix input--mini">
            <WholeInput id="site-deposit" min={0} max={100} value={site.depositPercent} toValue={depositPercent} onChange={(v) => setSite('depositPercent', v)} />
            <span aria-hidden="true">%</span>
          </span>
        </SettingRow>
      </Group>
    </>
  )
}
