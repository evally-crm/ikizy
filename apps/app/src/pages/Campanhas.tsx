import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Megaphone, Plus, QrCode, Smartphone, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { CampaignWizard } from '../components/CampaignWizard'
import { ConfirmDialog, Modal } from '../components/Modal'
import { Button, Card, Em } from '../components/ui'
import { useClientBook } from '../data/useClientBook'
import { useSalonInfo } from '../hooks/useSalonInfo'
import {
  EXTRA_CAMPAIGN_CENTS,
  EXTRA_CAMPAIGN_PACKS,
  FREE_CAMPAIGNS_PER_MONTH,
  MAX_RECIPIENTS,
  MIN_RECIPIENTS,
  OFFER_TEMPLATES,
  SEND_HOURS,
  campaignsLeft,
  type ExtraPack,
} from '../lib/campaigns'
import { formatBRL } from '../lib/format'
import {
  buyExtraCampaigns,
  cancelCampaign,
  connectWhatsapp,
  disconnectWhatsapp,
  fetchOverview,
  type CampaignStatus,
  type CampaignSummary,
  type Overview,
} from '../lib/whatsappApi'

const STATUS: Record<CampaignStatus, { label: string; badge: string }> = {
  sending: { label: 'Enviando', badge: 'pendente' },
  paused: { label: 'Pausada', badge: 'cancelado' },
  done: { label: 'Concluída', badge: 'confirmado' },
  canceled: { label: 'Cancelada', badge: 'concluido' },
}

const phoneLabel = (n: string | null) => {
  if (!n) return ''
  const d = n.replace(/^55/, '')
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : n
}

/** QR code para ligar o WhatsApp do salão; renova sozinho e fecha quando conecta */
function ConnectDialog({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const [qr, setQr] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const ask = async () => {
      try {
        const r = await connectWhatsapp()
        if (!alive) return
        if (r.state === 'open') return onConnected()
        setQr(r.qr)
        setError(null)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Não foi possível gerar o QR code.')
      }
    }
    void ask()
    // o QR do WhatsApp vence em uns 40 s; o estado é conferido a cada 3 s
    const renew = window.setInterval(() => void ask(), 30_000)
    const poll = window.setInterval(async () => {
      const o = await fetchOverview().catch(() => null)
      if (alive && o?.whatsapp.state === 'open') onConnected()
    }, 3_000)
    return () => {
      alive = false
      window.clearInterval(renew)
      window.clearInterval(poll)
    }
  }, [onConnected])

  return (
    <Modal label="Conectar WhatsApp" onClose={onClose}>
      <div className="dialog__head">
        <div>
          <p className="eyebrow">WhatsApp do salão</p>
          <h2>Leia o QR code</h2>
        </div>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      <ol className="camp-steps">
        <li>Abra o WhatsApp no celular do salão.</li>
        <li>
          Toque em <strong>Mais opções</strong> (ou Configurações) e depois em <strong>Dispositivos conectados</strong>.
        </li>
        <li>
          Toque em <strong>Conectar um dispositivo</strong> e aponte a câmera para o código.
        </li>
      </ol>
      <div className="camp-qr">
        {qr ? <img src={qr} alt="QR code para conectar o WhatsApp" /> : <span role="status">{error ?? 'Gerando o QR code…'}</span>}
      </div>
      {qr && error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}
      <p className="card__sub">Esta tela fecha sozinha quando o WhatsApp conectar.</p>
    </Modal>
  )
}

function BuyDialog({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState<ExtraPack | null>(null)
  const [error, setError] = useState<string | null>(null)
  const buy = async (q: ExtraPack) => {
    setBusy(q)
    setError(null)
    try {
      await buyExtraCampaigns(q)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível abrir o pagamento agora.')
      setBusy(null)
    }
  }
  return (
    <Modal label="Campanha extra" onClose={onClose}>
      <div className="dialog__head">
        <div>
          <p className="eyebrow">Campanha extra</p>
          <h2>Quer enviar mais uma este mês?</h2>
        </div>
        <Button variant="ghost" size="sm" icon aria-label="Fechar" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      <p className="dialog__text">
        Todo mês você tem {FREE_CAMPAIGNS_PER_MONTH} campanha grátis. Cada extra custa {formatBRL(EXTRA_CAMPAIGN_CENTS / 100)}, no cartão ou Pix, e não vence: fica guardada até
        você usar. Cada cliente continua recebendo no máximo uma oferta por mês.
      </p>
      {error && (
        <p className="dialog__error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog__actions">
        {EXTRA_CAMPAIGN_PACKS.map((q, i) => (
          <Button key={q} variant={i === 0 ? 'primary' : 'light'} disabled={busy !== null} onClick={() => void buy(q)}>
            {busy === q ? 'Abrindo…' : `${q} ${q === 1 ? 'campanha' : 'campanhas'} · ${formatBRL((EXTRA_CAMPAIGN_CENTS * q) / 100)}`}
          </Button>
        ))}
      </div>
    </Modal>
  )
}

function CampaignItem({ c, onCancel }: { c: CampaignSummary; onCancel: () => void }) {
  const st = STATUS[c.status]
  const done = c.sent + c.failed
  const pct = c.total ? Math.round((done / c.total) * 100) : 0
  return (
    <li className="camp-item">
      <div className="camp-item__head">
        <div>
          <p className="camp-item__title">{OFFER_TEMPLATES[c.template]?.label ?? 'Oferta'}</p>
          <p className="card__sub">
            {format(new Date(c.createdAt), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
            {c.usedCredit && ' · extra'}
          </p>
        </div>
        <span className={`badge badge--${st.badge}`}>{st.label}</span>
      </div>
      <p className="camp-item__preview">{c.preview}</p>
      <div className="camp-item__bar" role="progressbar" aria-label="Enviadas" aria-valuemin={0} aria-valuemax={c.total} aria-valuenow={done}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="camp-item__foot">
        <span>
          {c.sent} de {c.total} enviadas{c.failed > 0 && ` · ${c.failed} não chegaram (número sem WhatsApp)`}
        </span>
        {(c.status === 'sending' || c.status === 'paused') && (
          <button type="button" className="textlink" onClick={onCancel}>
            Cancelar envio
          </button>
        )}
      </div>
      {c.status === 'paused' && <p className="camp-item__warn">O WhatsApp do salão desconectou. Conecte de novo para continuar de onde parou.</p>}
    </li>
  )
}

export default function Campanhas() {
  const { status } = useAuth()
  const book = useClientBook()
  const { salonName, siteUrl } = useSalonInfo()
  const [params, setParams] = useSearchParams()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'connect' | 'disconnect' | 'buy' | 'wizard' | null>(null)
  const [canceling, setCanceling] = useState<CampaignSummary | null>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const returned = params.get('retorno')

  const load = useCallback(async () => {
    try {
      setOverview(await fetchOverview())
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Não foi possível carregar as campanhas.')
    }
  }, [])

  const demo = status === 'demo'
  useEffect(() => {
    if (!demo) void load()
  }, [load, demo])

  // campanha enviando: atualiza o progresso de tempos em tempos
  const sending = overview?.campaigns.some((c) => c.status === 'sending')
  useEffect(() => {
    if (!sending) return
    const t = window.setInterval(() => void load(), 20_000)
    return () => window.clearInterval(t)
  }, [sending, load])

  // voltou do Stripe: o webhook leva alguns segundos para somar a campanha extra
  useEffect(() => {
    if (returned !== 'ok') return
    let tries = 0
    const t = window.setInterval(() => {
      void load()
      if (++tries >= 8) window.clearInterval(t)
    }, 2500)
    return () => window.clearInterval(t)
  }, [returned, load])

  const left = overview ? campaignsLeft(overview.quota) : 0
  const connected = overview?.whatsapp.state === 'open'
  const eligible = book.clients.length

  // vindo de Clientes (?nova=1): abre o fluxo assim que der
  useEffect(() => {
    if (params.get('nova') !== '1' || !overview || book.loading) return
    setParams({}, { replace: true })
    if (connected && left > 0) setDialog('wizard')
  }, [params, overview, book.loading, connected, left, setParams])

  const startCampaign = () => {
    setNote(null)
    if (!overview) return
    if (!connected) return setDialog('connect')
    if (left === 0) {
      if (overview.canBuy) return setDialog('buy')
      return setNote({ ok: false, text: 'A campanha deste mês já foi usada. Peça para a dona do negócio comprar uma campanha extra.' })
    }
    setDialog('wizard')
  }

  const onConnected = useCallback(() => {
    setDialog(null)
    setNote({ ok: true, text: 'WhatsApp conectado! As ofertas vão sair pelo número do salão.' })
    void load()
  }, [load])

  async function doDisconnect() {
    try {
      await disconnectWhatsapp()
      await load()
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Não foi possível desconectar agora.' })
    }
  }

  async function doCancel(c: CampaignSummary) {
    try {
      const r = await cancelCampaign(c.id)
      setNote({ ok: true, text: r.refunded ? 'Envio cancelado. Como nada tinha saído, a campanha não conta no mês.' : 'Envio cancelado. O que já saiu continua com as clientes.' })
      await load()
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Não foi possível cancelar agora.' })
    }
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <p className="eyebrow">WhatsApp</p>
          <h1 className="page__title">
            Campanhas de <Em>oferta</Em>
          </h1>
        </div>
        {overview?.available && (
          <div className="page__actions">
            <Button onClick={startCampaign} disabled={book.loading}>
              <Plus size={16} aria-hidden="true" /> Nova campanha
            </Button>
          </div>
        )}
      </header>

      {returned === 'ok' && (
        <p className="billing-note billing-note--ok" role="status">
          Pagamento enviado. A campanha extra aparece aqui assim que o pagamento for confirmado (no Pix, pode levar alguns minutos).
        </p>
      )}
      {returned === 'cancelado' && (
        <p className="billing-note" role="status">
          Pagamento cancelado. Nada foi cobrado.
        </p>
      )}
      {note && (
        <p className={`billing-note ${note.ok ? 'billing-note--ok' : 'billing-note--error'}`} role="status">
          {note.text}
        </p>
      )}
      {(loadError || demo) && (
        <p className="billing-note" role="alert">
          {demo ? 'As campanhas pelo WhatsApp funcionam na sua conta (não no modo demonstração).' : loadError}
        </p>
      )}

      {overview && !overview.available && (
        <Card className="empty">
          <Megaphone size={28} aria-hidden="true" />
          <p>O envio de ofertas pelo WhatsApp ainda não foi ativado no IKIZY. Enquanto isso, use as mensagens prontas na ficha das clientes.</p>
        </Card>
      )}

      {overview?.available && (
        <>
          <div className="camp-top">
            <Card className="camp-card">
              <p className="camp-card__label">
                <Smartphone size={16} aria-hidden="true" /> WhatsApp do salão
              </p>
              {connected ? (
                <>
                  <p className="camp-card__big">
                    Conectado <span className="camp-dot" aria-hidden="true" />
                  </p>
                  <p className="card__sub">{overview.whatsapp.phone ? `Número ${phoneLabel(overview.whatsapp.phone)}` : 'As ofertas saem por este número.'}</p>
                  <Button variant="light" size="sm" onClick={() => setDialog('disconnect')}>
                    Desconectar
                  </Button>
                </>
              ) : (
                <>
                  <p className="camp-card__big">Desconectado</p>
                  <p className="card__sub">Conecte o WhatsApp do salão lendo um QR code, como no WhatsApp Web.</p>
                  <Button size="sm" onClick={() => setDialog('connect')}>
                    <QrCode size={16} aria-hidden="true" /> Conectar WhatsApp
                  </Button>
                </>
              )}
            </Card>

            <Card className="camp-card">
              <p className="camp-card__label">
                <Megaphone size={16} aria-hidden="true" /> Este mês
              </p>
              <p className="camp-card__big">
                {left} {left === 1 ? 'campanha disponível' : 'campanhas disponíveis'}
              </p>
              <p className="card__sub">
                {overview.quota.usedFree >= FREE_CAMPAIGNS_PER_MONTH ? 'Grátis do mês já usada' : `${FREE_CAMPAIGNS_PER_MONTH} grátis por mês`}
                {overview.quota.credits > 0 && ` · ${overview.quota.credits} ${overview.quota.credits === 1 ? 'extra' : 'extras'}`}
              </p>
              {overview.canBuy ? (
                <Button variant="light" size="sm" onClick={() => setDialog('buy')}>
                  Comprar extra · {formatBRL(EXTRA_CAMPAIGN_CENTS / 100)}
                </Button>
              ) : (
                <p className="card__sub">Só a dona do negócio compra campanhas extras.</p>
              )}
            </Card>
          </div>

          <Card>
            <h2 className="card__title">Suas campanhas</h2>
            {overview.campaigns.length === 0 ? (
              <p className="card__sub" style={{ marginTop: 8 }}>
                Nenhuma campanha ainda. Escolha de {MIN_RECIPIENTS} a {MAX_RECIPIENTS} clientes, um modelo de oferta, e o IKIZY envia pelo WhatsApp do salão.
              </p>
            ) : (
              <ul className="camp-list">
                {overview.campaigns.map((c) => (
                  <CampaignItem key={c.id} c={c} onCancel={() => setCanceling(c)} />
                ))}
              </ul>
            )}
          </Card>

          <Card variant="soft">
            <h2 className="card__title">Como funciona</h2>
            <ul className="camp-rules">
              <li>
                Cada campanha vai para {MIN_RECIPIENTS} a {MAX_RECIPIENTS} clientes. Para menos, use a mensagem pronta na ficha da cliente.
              </li>
              <li>
                {FREE_CAMPAIGNS_PER_MONTH} campanha grátis por mês; as extras custam {formatBRL(EXTRA_CAMPAIGN_CENTS / 100)} cada.
              </li>
              <li>Cada cliente recebe no máximo uma oferta por mês, mesmo que você faça mais campanhas.</li>
              <li>
                O envio é aos poucos (uma mensagem a cada 1 ou 2 minutos, das {SEND_HOURS.from}h às {SEND_HOURS.to}h) para proteger o número do salão.
              </li>
              <li>Quem responder SAIR não recebe mais ofertas.</li>
            </ul>
          </Card>
        </>
      )}

      {dialog === 'connect' && <ConnectDialog onClose={() => setDialog(null)} onConnected={onConnected} />}
      {dialog === 'buy' && <BuyDialog onClose={() => setDialog(null)} />}
      {dialog === 'disconnect' && (
        <ConfirmDialog
          title="Desconectar o WhatsApp?"
          text="As campanhas em andamento ficam pausadas até você conectar de novo."
          confirmLabel="Desconectar"
          onConfirm={() => void doDisconnect()}
          onClose={() => setDialog(null)}
        />
      )}
      {canceling && (
        <ConfirmDialog
          title="Cancelar o envio?"
          text={`${canceling.total - canceling.sent - canceling.failed} mensagens que ainda não saíram serão canceladas.`}
          confirmLabel="Cancelar envio"
          onConfirm={() => void doCancel(canceling)}
          onClose={() => setCanceling(null)}
        />
      )}
      {dialog === 'wizard' && overview && (
        <CampaignWizard
          clients={book.clients}
          overview={overview}
          salonName={salonName}
          siteUrl={siteUrl}
          onClose={() => setDialog(null)}
          onCreated={(total) => {
            setDialog(null)
            setNote({ ok: true, text: `Campanha criada! ${total} mensagens vão sair aos poucos pelo WhatsApp do salão.` })
            void load()
          }}
        />
      )}
      {overview?.available && eligible > 0 && eligible < MIN_RECIPIENTS && (
        <p className="card__sub">Você tem {eligible} clientes cadastradas. A campanha precisa de pelo menos {MIN_RECIPIENTS}.</p>
      )}
    </div>
  )
}
