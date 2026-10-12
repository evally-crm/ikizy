import type { SiteConfig } from '../../data/catalog'
import { cleanSlug, depositPercent, noticeHours, windowDays } from '../../domain/site'
import { SITE_DOMAIN } from '../../lib/slug'
import { Field } from '../../components/ui'
import { Switch } from '../../components/controls'
import type { SetSite } from './types'
import './MeuSite.css'

/** nome, frase de destaque e texto "sobre" */
export function TextFields({ site, setSite }: { site: SiteConfig; setSite: SetSite }) {
  return (
    <>
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
    </>
  )
}

/** endereço da página, WhatsApp, Instagram, endereço do salão e horário */
export function ContactFields({ site, setSite, slugReserved }: { site: SiteConfig; setSite: SetSite; slugReserved: boolean }) {
  return (
    <>
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
    </>
  )
}

/** o que aparece na página: preços, equipe, agendamento online e sinal */
export function ShowFields({ site, setSite }: { site: SiteConfig; setSite: SetSite }) {
  return (
    <>
      <div className="form__toggles">
        <Switch checked={site.showPrices} onChange={(v) => setSite('showPrices', v)} label="Mostrar preços na página" hint="Desligado, a cliente pede o valor no WhatsApp." />
        <Switch checked={site.showTeam} onChange={(v) => setSite('showTeam', v)} label="Mostrar a equipe" />
      </div>
      <Switch
        checked={site.onlineBooking}
        onChange={(v) => setSite('onlineBooking', v)}
        label="Aceitar agendamentos online"
        hint="A cliente escolhe serviço, dia e horário livre na sua página. O pedido cai na agenda como pendente."
      />
      {site.onlineBooking && (
        <>
          <div className="form__pair">
            <Field label="Antecedência mínima" hint="Horas antes do atendimento.">
              {(id) => (
                <span className="input input--suffix">
                  <input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={168}
                    value={site.bookingNoticeHours}
                    onChange={(e) => setSite('bookingNoticeHours', noticeHours(e.target.value))}
                  />
                  <span aria-hidden="true">h</span>
                </span>
              )}
            </Field>
            <Field label="Agendar até" hint="Dias à frente.">
              {(id) => (
                <span className="input input--suffix">
                  <input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={90}
                    value={site.bookingWindowDays}
                    onChange={(e) => setSite('bookingWindowDays', windowDays(e.target.value))}
                  />
                  <span aria-hidden="true">dias</span>
                </span>
              )}
            </Field>
          </div>
          <p className="field__hint">Só aparecem horários dentro do expediente de cada profissional. Defina o expediente na Agenda, em Horário de atendimento.</p>
        </>
      )}
      <Field label="Sinal para confirmar o horário" hint="Cobrado via Pix no agendamento online. Use 0 para não cobrar.">
        {(id) => (
          <span className="input input--suffix">
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={site.depositPercent}
              onChange={(e) => setSite('depositPercent', depositPercent(e.target.value))}
            />
            <span aria-hidden="true">%</span>
          </span>
        )}
      </Field>
    </>
  )
}
