/**
 * Script e estilos da janela de agendamento da página pública (roda no navegador da cliente, sem bibliotecas).
 * Escrito sem template literals dentro do script para poder morar numa string só.
 * Tudo que vem do negócio é escapado com `e()` antes de entrar no HTML.
 */
export const BOOKING_CSS = `
dialog.sheet{border:0;padding:0;width:min(520px,100%);max-width:100%;max-height:92dvh;margin:auto auto 0;border-radius:28px 28px 0 0;background:var(--panel);color:var(--text);overflow:hidden}
dialog.sheet[open]{display:flex;flex-direction:column}
dialog.sheet::backdrop{background:rgba(14,13,13,.55)}
@media(min-width:720px){dialog.sheet{margin:auto;border-radius:28px}}
body:has(dialog.sheet[open]){overflow:hidden}
.sheet__head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 22px 8px}
.sheet__head h2{font-size:24px}
.sheet__x{display:grid;place-items:center;width:44px;height:44px;border:1px solid var(--line);border-radius:50%;background:var(--panel);font-size:22px;line-height:1;cursor:pointer;color:var(--text)}
.sheet__body{flex:1;overflow-y:auto;padding:8px 22px 18px}
.sheet__foot{display:flex;gap:10px;padding:12px 22px calc(16px + env(safe-area-inset-bottom));border-top:1px solid var(--line)}
.sheet__foot .btn{flex:1;min-height:54px;cursor:pointer;font:inherit;font-weight:500}
.sheet__foot .btn:disabled{opacity:.45;cursor:not-allowed}
.sheet__foot .btn--light{background:var(--panel);color:var(--ink);border-color:var(--line);flex:0 0 auto;padding:0 22px}
.bk-lead{margin:0 0 14px;color:var(--muted);font-size:15px}
.bk-cat{margin:16px 0 6px;font-family:Georgia,serif;font-style:italic;font-size:18px;color:var(--accent)}
.bk-opt{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:60px;padding:10px 16px;margin:0 0 8px;border:1px solid var(--line);border-radius:18px;background:var(--panel);text-align:left;font:inherit;color:inherit;cursor:pointer}
.bk-opt:hover,.bk-opt[aria-pressed=true]{border-color:var(--accent);background:var(--soft)}
.bk-opt small{display:block;color:var(--muted);font-size:13px}
.bk-opt b{color:var(--accent);font-weight:600;white-space:nowrap}
.bk-chosen{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;margin-bottom:14px;border-radius:18px;background:var(--soft)}
.bk-chosen button{border:0;background:none;color:var(--accent);font:inherit;text-decoration:underline;cursor:pointer}
.bk-label{margin:14px 0 8px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.bk-wk{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 0 8px}
.bk-wk span{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.bk-wk div{display:flex;gap:8px}
.bk-arrow{display:grid;place-items:center;width:44px;height:44px;border:1px solid var(--line);border-radius:50%;background:var(--panel);font:inherit;font-size:20px;line-height:1;color:var(--text);cursor:pointer}
.bk-arrow:disabled{opacity:.35;cursor:not-allowed}
.bk-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.bk-day{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:0;min-height:64px;padding:0;border:1px solid var(--line);border-radius:16px;background:var(--panel);font:inherit;color:inherit;cursor:pointer}
.bk-day small{font-size:11px;color:var(--muted);text-transform:capitalize}
.bk-day:disabled{opacity:.3;cursor:default}
.bk-day[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:var(--on)}
.bk-day[aria-pressed=true] small{color:inherit;opacity:.8}
.bk-times{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.bk-time{min-height:48px;border:1px solid var(--line);border-radius:14px;background:var(--panel);font:inherit;color:inherit;cursor:pointer}
.bk-time[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:var(--on)}
.bk-note{margin:10px 0;color:var(--muted);font-size:14px}
.bk-pros{display:flex;flex-wrap:wrap;gap:8px}
.bk-pro{min-height:42px;padding:0 16px;border:1px solid var(--line);border-radius:999px;background:var(--panel);font:inherit;color:inherit;cursor:pointer}
.bk-pro[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:var(--on)}
.bk-field{display:block;margin:0 0 14px}
.bk-field span{display:block;margin-bottom:6px;font-size:14px;font-weight:500;color:var(--ink)}
.bk-field input{width:100%;min-height:54px;padding:0 16px;border:1px solid var(--line);border-radius:16px;background:var(--panel);font:inherit;font-size:16px;color:var(--ink)}
.bk-field input:focus{outline:2px solid var(--accent);outline-offset:1px}
.bk-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.bk-err{margin:0 0 12px;padding:12px 14px;border-radius:14px;background:#fdeaea;color:#8a1c1c;font-size:14px}
.bk-sum{margin:0 0 16px;padding:14px 16px;border-radius:18px;background:var(--soft);line-height:1.5}
.bk-ok{display:grid;place-items:center;width:64px;height:64px;margin:6px auto 14px;border-radius:50%;background:#fbf0d9;color:#9a6200;font-size:30px}
.bk-wait{margin:0 0 14px;padding:12px 14px;border-radius:14px;background:#fbf0d9;color:#6b4400;font-size:14px;line-height:1.5;text-align:left}
.bk-done{text-align:center}
.bk-done h3{font-size:26px;margin-bottom:8px}
`

export const BOOKING_SCRIPT = `
(function(){
  var dlg=document.getElementById('book');
  if(!dlg||typeof dlg.showModal!=='function') return;
  var D=JSON.parse(document.getElementById('book-data').textContent);
  var body=document.getElementById('book-body'), foot=document.getElementById('book-foot');
  var TZ='America/Sao_Paulo';
  var S={off:0,step:0,service:null,date:null,minute:null,pro:'',slots:null,error:'',name:'',phone:'',done:null,busy:false,token:0};
  var ESC={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  function e(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return ESC[c]})}
  function money(n){return n==null?'':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:n%1?2:0}).format(n)}
  function hm(m){var h=Math.floor(m/60),x=m%60;return (h<10?'0':'')+h+':'+(x<10?'0':'')+x}
  function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ}).format(new Date())}
  function mk(s,n){var p=s.split('-');return new Date(Date.UTC(+p[0],+p[1]-1,+p[2]+(n||0),12))}
  function addDays(s,n){return mk(s,n).toISOString().slice(0,10)}
  function wd(s){return mk(s).toLocaleDateString('pt-BR',{weekday:'short',timeZone:'UTC'}).replace('.','')}
  function full(s){return mk(s).toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'})}
  function svc(id){for(var i=0;i<D.services.length;i++){if(D.services[i].id===id)return D.services[i]}return null}

  function openSheet(id){
    S.service=id||null;S.step=id?1:0;S.off=0;S.date=null;S.minute=null;S.slots=null;S.error='';S.done=null;S.busy=false;
    render();
    if(!dlg.open)dlg.showModal();
    if(id)pickDay(today());
  }
  function closeSheet(){if(dlg.open)dlg.close()}

  function pickDay(date){
    S.date=date;S.minute=null;S.slots=null;S.error='';
    var t=++S.token;render();
    var q='/api/booking?slug='+encodeURIComponent(D.slug)+'&service='+encodeURIComponent(S.service)+'&date='+date+(S.pro?'&professional='+encodeURIComponent(S.pro):'');
    fetch(q).then(function(r){return r.json()}).then(function(j){
      if(t!==S.token)return;
      S.slots=j.slots||[];if(j.message&&!j.slots)S.error=j.message;render();
    }).catch(function(){
      if(t!==S.token)return;
      S.slots=[];S.error='Não foi possível carregar os horários. Tente de novo.';render();
    });
  }

  function minutes(){
    var seen={},out=[];
    (S.slots||[]).forEach(function(s){if(!seen[s.minute]){seen[s.minute]=1;out.push(s.minute)}});
    return out.sort(function(a,b){return a-b});
  }

  function view(){
    var s=svc(S.service),h='';
    if(S.step===0){
      h+='<p class="bk-lead">Escolha o serviço que você quer agendar.</p>';
      var cats={},order=[];
      D.services.forEach(function(x){if(!cats[x.category]){cats[x.category]=[];order.push(x.category)}cats[x.category].push(x)});
      order.forEach(function(c){
        h+='<p class="bk-cat">'+e(c)+'</p>';
        cats[c].forEach(function(x){
          h+='<button type="button" class="bk-opt" data-act="svc" data-id="'+e(x.id)+'"><span>'+e(x.name)+'<small>'+e(x.duration)+' min</small></span>'+(D.showPrices&&x.price!=null?'<b>'+e(money(x.price))+'</b>':'')+'</button>';
        });
      });
    }else if(S.step===1){
      h+='<div class="bk-chosen"><span><strong>'+e(s.name)+'</strong><br><small>'+e(s.duration)+' min'+(D.showPrices&&s.price!=null?' · '+e(money(s.price)):'')+'</small></span><button type="button" data-act="change">Trocar</button></div>';
      if(D.pros.length>1){
        h+='<p class="bk-label">Com quem</p><div class="bk-pros"><button type="button" class="bk-pro" data-act="pro" data-id="" aria-pressed="'+(S.pro===''?'true':'false')+'">Qualquer uma</button>';
        D.pros.forEach(function(p){h+='<button type="button" class="bk-pro" data-act="pro" data-id="'+e(p.id)+'" aria-pressed="'+(S.pro===p.id?'true':'false')+'">'+e(p.name)+'</button>'});
        h+='</div>';
      }
      var t0=today(),last=D.windowDays,first=addDays(t0,S.off);
      h+='<div class="bk-wk"><span>'+e(mk(first).toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}))+'</span><div>'
        +'<button type="button" class="bk-arrow" data-act="wk" data-id="-1" aria-label="Semana anterior" '+(S.off<=0?'disabled':'')+'>&lsaquo;</button>'
        +'<button type="button" class="bk-arrow" data-act="wk" data-id="1" aria-label="Próxima semana" '+(S.off+7>last?'disabled':'')+'>&rsaquo;</button></div></div><div class="bk-days">';
      for(var i=0;i<7;i++){
        var n=S.off+i,d=addDays(t0,n);
        h+='<button type="button" class="bk-day" data-act="day" data-id="'+d+'" aria-pressed="'+(S.date===d?'true':'false')+'" '+(n>last?'disabled':'')+'><small>'+e(wd(d))+'</small><strong>'+d.slice(8)+'</strong></button>';
      }
      h+='</div>';
      if(S.date){
        h+='<p class="bk-label">Horários · '+e(full(S.date))+'</p>';
        if(S.error)h+='<p class="bk-err" role="alert">'+e(S.error)+'</p>';
        if(S.slots===null)h+='<p class="bk-note">Buscando horários…</p>';
        else if(!minutes().length&&!S.error)h+='<p class="bk-note">Sem horários livres neste dia. Escolha outro dia.</p>';
        else if(minutes().length){h+='<div class="bk-times">';minutes().forEach(function(m){h+='<button type="button" class="bk-time" data-act="time" data-id="'+m+'" aria-pressed="'+(S.minute===m?'true':'false')+'">'+hm(m)+'</button>'});h+='</div>'}
      }
    }else if(S.step===2){
      h+='<div class="bk-sum"><strong>'+e(s.name)+'</strong><br>'+e(full(S.date))+' às '+hm(S.minute)+'</div>';
      if(S.error)h+='<p class="bk-err" role="alert">'+e(S.error)+'</p>';
      h+='<label class="bk-field"><span>Seu nome</span><input id="bk-name" name="name" autocomplete="name" maxlength="80" value="'+e(S.name)+'"></label>';
      h+='<label class="bk-field"><span>Seu WhatsApp (com DDD)</span><input id="bk-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" value="'+e(S.phone)+'"></label>';
      h+='<div class="bk-hp" aria-hidden="true"><label>Empresa<input id="bk-company" tabindex="-1" autocomplete="off"></label></div>';
      h+='<p class="bk-note">Este é um pedido: o horário só fica confirmado quando o salão responder você pelo WhatsApp.</p>';
    }else{
      var b=S.done;
      h+='<div class="bk-done"><div class="bk-ok" aria-hidden="true">⏳</div><h3>Pedido enviado</h3>';
      h+='<p class="bk-wait" role="status"><strong>Ainda não está confirmado.</strong> O salão vai conferir e responder você pelo WhatsApp. Só considere o horário marcado depois dessa confirmação.</p>';
      h+='<div class="bk-sum"><strong>'+e(b.service)+'</strong><br>'+e(full(S.date))+' às '+hm(S.minute)+(b.professional?'<br>Com '+e(b.professional):'')+'</div></div>';
    }
    return h;
  }

  function footer(){
    if(S.step===0)return '';
    if(S.step===1)return '<button type="button" class="btn" data-act="next" '+(S.minute==null?'disabled':'')+'>Continuar</button>';
    if(S.step===2)return '<button type="button" class="btn btn--light" data-act="back">Voltar</button><button type="button" class="btn" data-act="send" '+(S.busy?'disabled':'')+'>'+(S.busy?'Enviando…':'Pedir horário')+'</button>';
    var f='';
    if(D.wa){
      var b=S.done,msg='Olá! Acabei de pedir um horário pelo site: '+b.service+', '+full(S.date)+' às '+hm(S.minute)+'. Meu nome é '+S.name+'.';
      f+='<a class="btn" href="https://wa.me/'+D.wa+'?text='+encodeURIComponent(msg)+'" rel="noopener">Avisar no WhatsApp</a>';
    }
    return f+'<button type="button" class="btn btn--light" data-act="close">Fechar</button>';
  }

  function render(){
    var keep=body.scrollTop;
    body.innerHTML=view();foot.innerHTML=footer();foot.hidden=!foot.innerHTML;
    body.scrollTop=keep;
  }

  function send(){
    if(S.busy)return;
    var name=(S.name||'').trim(),digits=(S.phone||'').replace(/\\D/g,'');
    if(name.length<2){S.error='Informe seu nome.';render();return}
    if(digits.length<10||digits.length>13){S.error='Informe um WhatsApp com DDD.';render();return}
    S.busy=true;S.error='';render();
    var co=document.getElementById('bk-company');
    fetch('/api/booking',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slug:D.slug,service:S.service,professional:S.pro||null,date:S.date,minute:S.minute,name:name,phone:digits,company:co?co.value:''})})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok,status:r.status,j:j}})})
      .then(function(res){
        S.busy=false;
        if(res.ok){S.done=res.j.booking;S.step=3;render();return}
        S.error=res.j.message||'Não foi possível agendar agora. Tente de novo.';
        if(res.status===409){S.step=1;S.minute=null;pickDay(S.date);return}
        render();
      }).catch(function(){S.busy=false;S.error='Sem conexão. Tente de novo.';render()});
  }

  dlg.addEventListener('click',function(ev){
    if(ev.target===dlg){closeSheet();return}
    var el=ev.target.closest('[data-act]');if(!el)return;
    var act=el.getAttribute('data-act'),id=el.getAttribute('data-id');
    if(act==='close')closeSheet();
    else if(act==='svc'){S.service=id;S.step=1;S.date=null;S.minute=null;S.slots=null;pickDay(today())}
    else if(act==='change'){S.step=0;render()}
    else if(act==='pro'){S.pro=id||'';if(S.date)pickDay(S.date);else render()}
    else if(act==='wk'){S.off=Math.max(0,S.off+7*(+id));render()}
    else if(act==='day')pickDay(id);
    else if(act==='time'){S.minute=+id;render()}
    else if(act==='next'){S.step=2;S.error='';render()}
    else if(act==='back'){S.step=1;S.error='';render()}
    else if(act==='send')send();
  });
  dlg.addEventListener('input',function(ev){
    if(ev.target.id==='bk-name')S.name=ev.target.value;
    if(ev.target.id==='bk-phone')S.phone=ev.target.value;
  });
  document.getElementById('book-x').addEventListener('click',closeSheet);
  document.addEventListener('click',function(ev){
    var el=ev.target.closest&&ev.target.closest('[data-book]');
    if(!el||dlg.contains(el))return;
    ev.preventDefault();openSheet(el.getAttribute('data-book')||'');
  });
})();
`
