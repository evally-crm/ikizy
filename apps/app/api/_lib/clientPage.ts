import { paletteFor } from '../../src/lib/siteTheme.js'
import { WHATSAPP_PATH } from '../../src/lib/social.js'
import { CHANGE_NOTICE_HOURS } from './booking.js'
import { esc, whatsappLink, type PublicSite } from './siteHtml.js'

/**
 * Página da cliente (slug.ikizy.com/pedido/<token>): o status do pedido e, depois de concluído, a avaliação.
 * Sem conta e sem pedir dados de novo: quem tem o link é a cliente daquele pedido.
 *
 * Visual: o dia em destaque num cartão cinza no alto e, por cima, uma folha branca que sobe do rodapé
 * (alça, botão redondo de voltar, título no meio, seletor em pílula, seções separadas por linha fina).
 */

export type BookingState = 'pendente' | 'confirmado' | 'concluido' | 'cancelado' | 'faltou'

/** formato devolvido por public.get_booking_status() */
export interface BookingStatus {
  salon: { name: string; slug: string; whatsapp: string }
  client: string | null
  status: BookingState
  items: { service: string; starts_at: string; duration: number; professional: string | null; status: string }[]
  review: { rating: number; comment: string; created_at: string } | null
  /** ainda dá para remarcar ou cancelar (mais de 2 horas até o primeiro horário) */
  can_change?: boolean
  /** até quantos dias à frente o salão aceita agendar */
  window_days?: number
}

export const TOKEN = /^[a-f0-9]{64}$/

/** endereço da página da cliente (o mesmo domínio do site do salão) */
export const bookingLink = (slug: string, token: string) => `https://${slug}.ikizy.com/pedido/${token}`

/** ícones do lucide (mesmo desenho da biblioteca do app), embutidos porque a página é HTML puro */
const LUCIDE: Record<string, string> = {
  hourglass:
    '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  'calendar-check': '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="m9 15 2 2 4-4"/>',
  'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m16 9-5.5 5.5L8 12"/>',
  'circle-x': '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  'calendar-x': '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="m14 13-4 4"/><path d="m10 13 4 4"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
}
const icon = (name: string, size = 20, stroke = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LUCIDE[name]}</svg>`

const STATE: Record<BookingState, { icon: string; title: string; text: string }> = {
  pendente: { icon: 'hourglass', title: 'Aguardando confirmação', text: 'O salão vai conferir e responder você pelo WhatsApp. Só considere o horário marcado depois dessa confirmação.' },
  confirmado: { icon: 'calendar-check', title: 'Horário confirmado', text: 'Está tudo certo. Se precisar remarcar ou não puder ir, avise o salão pelo WhatsApp.' },
  concluido: { icon: 'circle-check', title: 'Atendimento concluído', text: 'Agradecemos pela visita.' },
  cancelado: { icon: 'circle-x', title: 'Pedido cancelado', text: 'Este horário não está mais reservado. Se quiser, escolha outro no site do salão.' },
  faltou: { icon: 'calendar-x', title: 'Horário não realizado', text: 'Se quiser marcar de novo, escolha um horário no site do salão.' },
}

/** as três etapas do pedido, no seletor em pílula (a atual fica em branco) */
const STEPS: { id: BookingState; icon: string; label: string }[] = [
  { id: 'pendente', icon: 'hourglass', label: 'Enviado' },
  { id: 'confirmado', icon: 'calendar-check', label: 'Confirmado' },
  { id: 'concluido', icon: 'circle-check', label: 'Concluído' },
]

/** notas de 1 a 5, sem estrelas: o nome de cada uma aparece embaixo */
export const RATING_LABEL = ['Ruim', 'Regular', 'Bom', 'Muito bom', 'Excelente'] as const

const TZ = 'America/Sao_Paulo'
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, ...o }).format(new Date(iso))
const weekdayOf = (iso: string) => {
  const w = fmt(iso, { weekday: 'long' })
  return w.charAt(0).toUpperCase() + w.slice(1)
}
const dateOf = (iso: string) => fmt(iso, { day: 'numeric', month: 'long' })
const timeOf = (iso: string) => fmt(iso, { hour: '2-digit', minute: '2-digit' })
const when = (iso: string) => `${fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' })}, às ${timeOf(iso)}`
const mins = (n: number) => {
  const h = Math.floor(n / 60)
  const m = n % 60
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`
}

/** bolinhas da nota (cheias até a nota) */
export const ratingDots = (rating: number) =>
  `<span class="dots" role="img" aria-label="Nota ${rating} de 5">${[1, 2, 3, 4, 5].map((i) => `<i${i <= rating ? ' class="on"' : ''}></i>`).join('')}</span>`

const CSS = `
*{box-sizing:border-box}
html{background:#d9d9dc}
body{margin:0;min-height:100vh;background:#d9d9dc;color:#111;font:16px/1.45 'Outfit',system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{max-width:480px;margin:0 auto;padding:16px 16px 0}
.day{padding:14px 20px 82px;color:#6e6e73;font-size:14px;font-weight:500;text-align:center}
.day__week::after{content:", "}
.day__date::after{content:" · "}
.day.is-off .day__date,.day.is-off .day__time{text-decoration:line-through}
.sheet{position:relative;min-height:calc(100vh - 50px);margin:-64px -16px 0;padding:10px 20px 36px;border-radius:32px 32px 0 0;background:#fff;box-shadow:0 -8px 30px rgba(0,0,0,.06)}
.grab{display:block;width:44px;height:5px;margin:0 auto 14px;border-radius:999px;background:#dedee1}
.head{display:grid;grid-template-columns:52px 1fr 52px;align-items:center;margin-bottom:22px}
.back{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:#f2f2f4;text-decoration:none}
.back:active{transform:scale(.94)}
.head h1{margin:0;font-size:22px;font-weight:700;letter-spacing:-.02em;text-align:center}
.seg{display:flex;gap:4px;padding:6px;border-radius:999px;background:#f2f2f4}
.seg span{display:flex;flex:1;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 10px;border-radius:999px;color:#9a9a9f;font-size:16px;font-weight:700;white-space:nowrap}
.seg span.is-on{flex:2.4}
.seg span.is-done{color:#111}
.seg span.is-on{background:#fff;color:#111;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.sec{padding:20px 0;border-top:1px solid #ededf0}
.seg+.sec{margin-top:20px}
.sec:last-child{padding-bottom:0}
.sec h2{margin:0 0 12px;font-size:16px;font-weight:700;letter-spacing:-.01em}
.status{margin:0;font-size:24px;font-weight:700;line-height:1.15;letter-spacing:-.02em}
.text{margin:8px 0 0;color:#5f5f64;font-size:15px}
.rows{list-style:none;margin:0;padding:0}
.rows li{display:flex;align-items:center;gap:12px;padding:10px 0}
.rows li:first-child{padding-top:0}
.rows li:last-child{padding-bottom:0}
.rows svg{flex:none}
.rows b{flex:1;min-width:0;font-weight:600}
.rows small{display:block;font-size:13px;font-weight:400;color:#7a7a7f}
.rows span{flex:none;font-size:15px;font-weight:600}
.rows .off b,.rows .off span{text-decoration:line-through;color:#9a9a9f}
.rate{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding-top:6px}
.rate button{position:relative;aspect-ratio:1;border:2px solid #ededf0;border-radius:18px;background:#fff;color:#111;font:inherit;font-size:24px;font-weight:700;cursor:pointer;transition:transform .12s ease}
.rate button:active{transform:scale(.95)}
.rate button[aria-pressed=true]{border:3px solid #111}
.rate button i{position:absolute;top:-9px;right:-9px;display:none;place-items:center;width:26px;height:26px;border:2px solid #fff;border-radius:50%;background:#111;color:#fff}
.rate button[aria-pressed=true] i{display:grid}
.rate__ends{display:flex;justify-content:space-between;margin:8px 2px 0;font-size:12px;color:#7a7a7f}
.picked{min-height:22px;margin:8px 0 12px;font-size:15px;font-weight:700;text-align:center}
label.text{display:block;margin:0 0 8px}
textarea{width:100%;min-height:104px;padding:14px 16px;border:0;border-radius:18px;background:#f2f2f4;color:#111;font:inherit;font-size:15px;resize:vertical}
textarea:focus,.rate button:focus-visible,.btn:focus-visible,.back:focus-visible{outline:2px solid #111;outline-offset:2px}
.note{margin:8px 2px 16px;font-size:13px;color:#7a7a7f}
.err{margin:0 0 12px;color:#b3261e;font-size:14px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:54px;padding:0 20px;border:0;border-radius:999px;background:#111;color:#fff;font:inherit;font-weight:600;text-decoration:none;white-space:nowrap;cursor:pointer;transition:transform .12s ease}
.btn:active{transform:scale(.98)}
.btn:disabled{opacity:.3;cursor:not-allowed}
.btn--light{background:#f2f2f4;color:#111}
.actions{display:grid;gap:10px}
.dots{display:inline-flex;gap:5px;vertical-align:middle}
.dots i{width:10px;height:10px;border-radius:50%;background:#e1e1e4}
.dots i.on{background:#111}
.chg{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
.chg>*{min-width:0}
.chg__panel{margin-top:14px}
.chg__panel[hidden]{display:none}
.days{display:flex;gap:8px;margin:0 -20px;padding:2px 20px 10px;overflow-x:auto;scrollbar-width:none}
.days::-webkit-scrollbar{display:none}
.dchip{display:flex;flex:none;flex-direction:column;align-items:center;gap:2px;min-width:58px;padding:10px 8px;border:2px solid #ededf0;border-radius:18px;background:#fff;color:#111;font:inherit;cursor:pointer}
.dchip small{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7a7a7f}
.dchip b{font-size:20px;font-weight:700;line-height:1}
.dchip[aria-pressed=true]{border:3px solid #111;padding:9px 7px}
.times{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:6px 0 14px}
.times button{min-height:48px;border:2px solid #ededf0;border-radius:14px;background:#fff;color:#111;font:inherit;font-size:15px;font-weight:700;cursor:pointer}
.times button[aria-pressed=true]{border:3px solid #111}
.chg__hint{margin:8px 0 0;font-size:14px;color:#7a7a7f}
.chg__pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mine{display:flex;align-items:center;gap:10px;font-weight:700}
.mine+p{margin:10px 0 0}
`

const SCRIPT = `
(function(){
  var f=document.getElementById('rv');if(!f)return;
  var L=${JSON.stringify(RATING_LABEL)},rating=0,busy=false;
  var btns=f.querySelectorAll('[data-r]'),out=document.getElementById('rv-picked'),err=document.getElementById('rv-err'),send=document.getElementById('rv-send');
  btns.forEach(function(b){b.addEventListener('click',function(){
    rating=+b.getAttribute('data-r');
    btns.forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
    out.textContent=L[rating-1];send.disabled=false;err.hidden=true;
  })});
  f.addEventListener('submit',function(ev){
    ev.preventDefault();if(busy)return;
    if(!rating){err.textContent='Escolha uma nota de 1 a 5.';err.hidden=false;return}
    busy=true;send.disabled=true;send.textContent='Enviando…';
    fetch('/api/booking',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'review',token:f.getAttribute('data-token'),rating:rating,comment:document.getElementById('rv-text').value})})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j}})})
      .then(function(res){if(res.ok){location.reload();return}busy=false;send.disabled=false;send.textContent='Enviar avaliação';err.textContent=res.j.message||'Não foi possível enviar agora. Tente de novo.';err.hidden=false})
      .catch(function(){busy=false;send.disabled=false;send.textContent='Enviar avaliação';err.textContent='Sem conexão. Tente de novo.';err.hidden=false});
  });
})();
`

const SCRIPT_CHANGE = `
(function(){
  var root=document.getElementById('chg');if(!root)return;
  var token=root.getAttribute('data-token'),today=root.getAttribute('data-today'),span=+root.getAttribute('data-span')||14;
  var pRe=document.getElementById('chg-re'),pCa=document.getElementById('chg-ca');
  var bRe=document.getElementById('chg-open-re'),bCa=document.getElementById('chg-open-ca');
  var days=document.getElementById('chg-days'),times=document.getElementById('chg-times'),hint=document.getElementById('chg-hint');
  var go=document.getElementById('chg-go'),err=document.getElementById('chg-err'),yes=document.getElementById('chg-yes'),errC=document.getElementById('chg-err-ca');
  var day=null,minute=null,busy=false,WD=['dom','seg','ter','qua','qui','sex','sáb'];
  function two(n){return (n<10?'0':'')+n}
  function hhmm(m){return two(Math.floor(m/60))+':'+two(m%60)}
  function show(which){pRe.hidden=which!=='re';pCa.hidden=which!=='ca';bRe.setAttribute('aria-expanded',which==='re');bCa.setAttribute('aria-expanded',which==='ca')}
  bRe.addEventListener('click',function(){show(pRe.hidden?'re':'')});
  bCa.addEventListener('click',function(){show(pCa.hidden?'ca':'')});
  document.getElementById('chg-back').addEventListener('click',function(){show('')});
  var base=new Date(today+'T12:00:00Z');
  for(var i=0;i<span;i++){(function(i){
    var d=new Date(base.getTime()+i*86400000),iso=d.toISOString().slice(0,10);
    var b=document.createElement('button');b.type='button';b.className='dchip';b.setAttribute('aria-pressed','false');
    b.innerHTML='<small>'+WD[d.getUTCDay()]+'</small><b>'+d.getUTCDate()+'</b>';
    b.addEventListener('click',function(){
      day=iso;minute=null;go.disabled=true;err.hidden=true;
      [].forEach.call(days.children,function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
      times.innerHTML='';hint.textContent='Procurando horários…';
      fetch('/api/booking?pedido='+token+'&date='+iso).then(function(r){return r.json()}).then(function(j){
        if(day!==iso)return;
        var seen={},list=((j&&j.slots)||[]).filter(function(s){if(seen[s.minute])return false;seen[s.minute]=1;return true});
        hint.textContent=list.length?'':'Sem horários livres neste dia. Escolha outro.';
        list.forEach(function(s){
          var t=document.createElement('button');t.type='button';t.textContent=hhmm(s.minute);t.setAttribute('aria-pressed','false');
          t.addEventListener('click',function(){minute=s.minute;go.disabled=false;err.hidden=true;[].forEach.call(times.children,function(x){x.setAttribute('aria-pressed',x===t?'true':'false')})});
          times.appendChild(t);
        });
      }).catch(function(){hint.textContent='Sem conexão. Tente de novo.'});
    });
    days.appendChild(b);
  })(i)}
  function post(body,btn,label,e){
    if(busy)return;busy=true;btn.disabled=true;btn.textContent='Enviando…';
    fetch('/api/booking',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j}})})
      .then(function(res){if(res.ok){location.reload();return}busy=false;btn.disabled=false;btn.textContent=label;e.textContent=res.j.message||'Não foi possível agora. Tente de novo.';e.hidden=false})
      .catch(function(){busy=false;btn.disabled=false;btn.textContent=label;e.textContent='Sem conexão. Tente de novo.';e.hidden=false});
  }
  go.addEventListener('click',function(){if(day&&minute!==null)post({action:'reschedule',token:token,date:day,minute:minute},go,'Confirmar novo horário',err)});
  yes.addEventListener('click',function(){post({action:'cancel',token:token},yes,'Cancelar pedido',errC)});
})();
`

export function renderBookingStatus(b: BookingStatus, site: PublicSite | null, token: string): string {
  const { p: pal } = paletteFor(site?.settings ?? {})
  const state = STATE[b.status] ?? STATE.pendente
  const name = b.salon.name
  const first = (b.client ?? '').trim()
  const items = b.items ?? []
  const services = items.map((i) => i.service).join(' + ')
  const firstItem = items[0]
  const off = b.status === 'cancelado' || b.status === 'faltou'
  const total = items.filter((i) => off || i.status !== 'cancelado').reduce((n, i) => n + i.duration, 0)

  // cartão do alto: o dia da semana apagado, a data forte e a hora numa pílula
  const day = firstItem
    ? `<section class="day${off ? ' is-off' : ''}"><span class="day__week">${esc(weekdayOf(firstItem.starts_at))}</span><span class="day__date">${esc(
        dateOf(firstItem.starts_at),
      )}</span><span class="day__time">${esc(timeOf(firstItem.starts_at))}</span></section>`
    : '<section class="day"></section>'

  // seletor em pílula com as etapas; cancelado/faltou mostram só o estado
  const at = STEPS.findIndex((s) => s.id === b.status)
  const seg = off
    ? `<div class="seg seg--one"><span class="is-on">${icon(state.icon, 18)}${esc(state.title)}</span></div>`
    : `<div class="seg" role="list" aria-label="Etapas do pedido">${STEPS.map(
        // como na referência: só a etapa atual mostra o nome; as outras só o ícone
        (s, i) =>
          i === at
            ? `<span role="listitem" class="is-on" aria-current="step">${icon(s.icon, 18)}${s.label}</span>`
            : `<span role="listitem"${i < at ? ' class="is-done"' : ''} aria-label="${s.label}">${icon(s.icon, 20)}</span>`,
      ).join('')}</div>`

  const rows = items
    .map(
      (i) =>
        `<li${i.status === 'cancelado' ? ' class="off"' : ''}>${icon('clock', 20)}<b>${esc(i.service)}<small>${esc(mins(i.duration))}${
          i.professional ? ` · com ${esc(i.professional)}` : ''
        }</small></b><span>${esc(timeOf(i.starts_at))}</span></li>`,
    )
    .join('')

  let review = ''
  if (b.status === 'concluido' && b.review) {
    review = `<section class="sec"><h2>Sua avaliação</h2><div class="mine">${ratingDots(b.review.rating)}<span>${esc(RATING_LABEL[b.review.rating - 1] ?? '')}</span></div>${
      b.review.comment ? `<p>${esc(b.review.comment)}</p>` : ''
    }<p class="note">Agradecemos por contar como foi. Sua avaliação aparece no site do salão.</p></section>`
  } else if (b.status === 'concluido') {
    review = `<section class="sec"><form id="rv" data-token="${esc(token)}" novalidate><h2>Como foi?</h2><div class="rate" role="group" aria-label="Nota de 1 a 5">${[1, 2, 3, 4, 5]
      .map(
        (n) =>
          `<button type="button" data-r="${n}" aria-pressed="false" aria-label="${n}, ${RATING_LABEL[n - 1]}">${n}<i>${icon('check', 14, 3)}</i></button>`,
      )
      .join('')}</div><div class="rate__ends"><span>Ruim</span><span>Excelente</span></div><p class="picked" id="rv-picked" aria-live="polite"></p><label for="rv-text" class="text">Conte como foi (opcional)</label><textarea id="rv-text" maxlength="500" placeholder="O que você achou do atendimento e do resultado?"></textarea><p class="note">Aparece no site de ${esc(
      name,
    )} com o seu primeiro nome${first ? ` (${esc(first)})` : ''}.</p><p class="err" id="rv-err" role="alert" hidden></p><button type="submit" class="btn" id="rv-send" disabled>Enviar avaliação</button></form></section>`
  }

  // mudar o pedido: só enquanto está em aberto; até 2 horas antes dá para remarcar ou cancelar sozinha
  const open = b.status === 'pendente' || b.status === 'confirmado'
  const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const span = Math.max(1, Math.min(b.window_days ?? 14, 14))
  const change = !open
    ? ''
    : b.can_change
      ? `<section class="sec chg" id="chg" data-token="${esc(token)}" data-today="${todayIso}" data-span="${span}"><h2>Precisa mudar?</h2><div class="chg__pair"><button type="button" class="btn btn--light" id="chg-open-re" aria-expanded="false">Remarcar</button><button type="button" class="btn btn--light" id="chg-open-ca" aria-expanded="false">Cancelar</button></div>` +
        `<div class="chg__panel" id="chg-re" hidden><h2>Novo horário</h2><span class="lead">Escolha o dia e o horário. O salão confirma de novo.</span><div class="days" id="chg-days"></div><p class="chg__hint" id="chg-hint">Escolha um dia.</p><div class="times" id="chg-times"></div><p class="err" id="chg-err" role="alert" hidden></p><button type="button" class="btn" id="chg-go" disabled>Confirmar novo horário</button></div>` +
        `<div class="chg__panel" id="chg-ca" hidden><h2>Cancelar o pedido?</h2><span class="lead">O horário volta a ficar livre. Se mudar de ideia, é só fazer um novo pedido no site.</span><p class="err" id="chg-err-ca" role="alert" hidden></p><div class="chg__pair"><button type="button" class="btn btn--light" id="chg-back">Voltar</button><button type="button" class="btn" id="chg-yes">Cancelar pedido</button></div></div></section>`
      : `<section class="sec"><h2>Precisa mudar?</h2><p class="text">Faltam menos de ${CHANGE_NOTICE_HOURS} horas para o horário. Para remarcar ou cancelar, fale com o salão pelo WhatsApp.</p></section>`

  const waText = firstItem ? `Olá! Sobre o meu horário de ${services}, ${when(firstItem.starts_at)}.` : 'Olá!'
  const wa = whatsappLink(b.salon.whatsapp, waText)
  const site_ = `https://${b.salon.slug}.ikizy.com`
  const again = b.status === 'concluido' || b.status === 'cancelado' || b.status === 'faltou'
  // com o formulário de avaliação aberto, o botão principal da página é "Enviar avaliação"
  const reviewing = b.status === 'concluido' && !b.review
  const actions = `<section class="sec"><div class="actions">${
    wa
      ? `<a class="btn${again ? ' btn--light' : ''}" href="${esc(wa)}" rel="noopener"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${WHATSAPP_PATH}"/></svg>Falar com o salão</a>`
      : ''
  }<a class="btn ${again && !reviewing ? '' : 'btn--light'}" href="${esc(site_)}">${again ? 'Agendar de novo' : `Ver o site de ${esc(name)}`}</a></div></section>`

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#d9d9dc">
<title>${esc(state.title)} · ${esc(name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap">
<style>:root{--accent:${pal.accent};color-scheme:light}${CSS}</style>
</head>
<body>
<main class="wrap">
${day}
<div class="sheet">
<span class="grab" aria-hidden="true"></span>
<div class="head"><a class="back" href="${esc(site_)}" aria-label="Voltar ao site de ${esc(name)}">${icon('chevron-left', 22, 2.5)}</a><h1>Seu pedido</h1><span></span></div>
${seg}
<section class="sec">${first ? `<h2>Olá, ${esc(first)}</h2>` : ''}<p class="status">${esc(state.title)}</p><p class="text">${esc(state.text)}</p></section>
<section class="sec"><h2>${items.length > 1 ? `Serviços · ${esc(mins(total))}` : 'Serviço'}</h2><ul class="rows">${rows}</ul></section>
${change}
${review}
${actions}
</div>
</main>
${b.status === 'concluido' && !b.review ? `<script>${SCRIPT}</script>` : ''}${open && b.can_change ? `<script>${SCRIPT_CHANGE}</script>` : ''}
</body>
</html>`
}
