// ---- Utilidades fecha
const today = new Date();
const ymd = d => d.toISOString().slice(0,10);
function isoWeekId(d){
  const _d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = _d.getUTCDay() || 7;
  _d.setUTCDate(_d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(_d.getUTCFullYear(),0,1));
  const week = Math.ceil((((_d - yearStart)/86400000)+1)/7);
  return `${_d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}

// ---- Claves
const K = {
  cfg:'uddd_cfg_v1',
  lives:'uddd_lives_v1',
  lastWeek:'uddd_last_week_v1',
  log:'uddd_log_', // + ymd
  introSeen:'uddd_intro_seen_v1',
  avatar:'uddd_avatar_dataurl_v1',
  quest:'uddd_quest_' // + ymd
};

// ---- Config por defecto
const defaultCfg = {
  metaSemanal:500,
  umbralComida:300,
  umbralCerveza:500,
  maxVidas:5,
  habitos:[
    {id:'comer',label:'Comer bien todo el día',xp:30,penalty:20, attr:'vitalidad'},
    {id:'ingles',label:'Inglés 30 min',xp:20,penalty:15, attr:'conocimiento'},
    {id:'trabajo',label:'Deep work 90 min',xp:25,penalty:20, attr:'conocimiento'},
    {id:'estudio',label:'Estudio/maestría 45 min',xp:25,penalty:20, attr:'conocimiento'},
    {id:'finanzas',label:'Control de finanzas (10 min)',xp:20,penalty:15, attr:'sabiduria'},
    {id:'ejercicio',label:'Ejercicio 30 min o 7k pasos',xp:15,penalty:10, attr:'energia'},
    {id:'sueno',label:'Dormir ≥7h',xp:15,penalty:10, attr:'energia'},
  ]
};

// ---- Estado
let cfg = JSON.parse(localStorage.getItem(K.cfg) || 'null') || defaultCfg;
let vidas = parseInt(localStorage.getItem(K.lives) || '3',10);
const weekNow = isoWeekId(today);

// ---- Rollover semanal
(function(){
  const prev = localStorage.getItem(K.lastWeek);
  if(prev && prev !== weekNow){
    const lastXP = xpSumWeek(prev);
    const minReq = Math.min(cfg.umbralComida, Math.floor(cfg.metaSemanal*0.5));
    if(lastXP < minReq) vidas = Math.max(0, vidas-1);
    else if(lastXP >= cfg.umbralCerveza) vidas = Math.min(cfg.maxVidas, vidas+1);
    localStorage.setItem(K.lives, String(vidas));
  }
  localStorage.setItem(K.lastWeek, weekNow);
})();

// ---- Logs
function getLog(d){ return JSON.parse(localStorage.getItem(K.log + d) || '{}'); }
function setLog(d,obj){ localStorage.setItem(K.log + d, JSON.stringify(obj)); }

// ---- Misión del día (persistente por fecha)
function getTodayQuest(){
  const key = K.quest + ymd(today);
  const existing = localStorage.getItem(key);
  if(existing) return JSON.parse(existing);

  const tipos = ['double','deadline'];
  const tipo = tipos[Math.floor(Math.random()*tipos.length)];
  let quest;
  if(tipo==='double'){
    const target = cfg.habitos[Math.floor(Math.random()*cfg.habitos.length)];
    quest = { type:'double', targetId:target.id, text:`Doble XP hoy en “${target.label}”.`, createdAt:Date.now() };
  }else{
    quest = { type:'deadline', deadline:'21:00', text:'Completa 4 hábitos antes de las 21:00 (+20 XP).', createdAt:Date.now() };
  }
  localStorage.setItem(key, JSON.stringify(quest));
  return quest;
}

// ---- Cálculos de XP
function todayXP(){
  const log = getLog(ymd(today));
  const quest = getTodayQuest();
  let sum=0, done=0;
  for(const h of cfg.habitos){
    if(log[h.id]===true){
      let base=h.xp;
      if(quest.type==='double' && quest.targetId===h.id) base*=2;
      sum += base; done++;
    }else if(log[h.id]===false){
      sum -= h.penalty;
    }
  }
  if(quest.type==='deadline'){
    const [hh,mm] = quest.deadline.split(':').map(Number);
    const limite = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hh, mm, 0);
    if(done>=4 && new Date()<=limite) sum += 20;
  }
  return Math.max(0,sum);
}
function xpSumWeek(weekId){
  let sum=0;
  for(let i=0;i<28;i++){
    const d=new Date(today); d.setDate(d.getDate()-i);
    if(isoWeekId(d)!==weekId) continue;
    const log=getLog(ymd(d));
    const qraw = localStorage.getItem(K.quest+ymd(d));
    const quest = qraw ? JSON.parse(qraw) : null;

    let day=0, done=0;
    for(const h of cfg.habitos){
      if(log[h.id]===true){
        let base=h.xp;
        if(quest && quest.type==='double' && quest.targetId===h.id) base*=2;
        day += base; done++;
      }else if(log[h.id]===false){
        day -= h.penalty;
      }
    }
    if(quest && quest.type==='deadline' && done>=4) day += 20;
    sum += Math.max(0,day);
  }
  return Math.max(0,sum);
}
function xpWeekNow(){ return xpSumWeek(weekNow); }
function totalXPHistorico(){
  let sum=0;
  for(let i=0;i<120;i++){
    const d=new Date(today); d.setDate(d.getDate()-i);
    const log=getLog(ymd(d));
    const qraw = localStorage.getItem(K.quest+ymd(d));
    const quest = qraw ? JSON.parse(qraw) : null;

    let day=0, done=0;
    for(const h of cfg.habitos){
      if(log[h.id]===true){
        let base=h.xp;
        if(quest && quest.type==='double' && quest.targetId===h.id) base*=2;
        day += base; done++;
      }else if(log[h.id]===false){
        day -= h.penalty;
      }
    }
    if(quest && quest.type==='deadline' && done>=4) day += 20;
    sum += Math.max(0,day);
  }
  return Math.max(0,sum);
}
function calcNivel(){
  const t=totalXPHistorico();
  if(t>=6000) return 5; if(t>=4000) return 4; if(t>=2000) return 3; if(t>=800) return 2; return 1;
}

// ---- UI helpers
const $ = s => document.querySelector(s);

function renderAvatar(){
  const el = $('#avatarCircle'); if(!el) return;
  const data = localStorage.getItem(K.avatar);
  if(data){
    el.style.backgroundImage = `url(${data})`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.innerHTML = '';
  }else{
    el.style.backgroundImage = '';
    if(!el.innerHTML.trim()) el.innerHTML = '<span>DV</span>';
  }
}

function renderHeader(){
  const todayEl = $('#todayLabel'); if(todayEl){
    todayEl.textContent = new Date().toLocaleDateString('es-CO',{weekday:'long', day:'2-digit', month:'short'}).replace('.','');
  }
  const vidasEl = $('#vidas'); if(vidasEl) vidasEl.textContent = vidas;
  const nivelEl = $('#nivel'); if(nivelEl) nivelEl.textContent = calcNivel();
  const xpHoyEl = $('#xpHoy'); if(xpHoyEl) xpHoyEl.textContent = todayXP();

  const w = xpWeekNow();
  const xpSemEl = $('#xpSemana'); if(xpSemEl) xpSemEl.textContent = w;
  const metaEl = $('#metaText'); if(metaEl) metaEl.textContent = `${w} / ${cfg.metaSemanal}`;

  const pct = Math.min(100, Math.round(w*100/Math.max(1,cfg.metaSemanal)));
  const bar = $('#barSemana'); if(bar){ bar.style.width = pct + '%'; bar.style.background = 'var(--btn)'; }

  renderRewards(w);
  renderQuest();
  renderStats();
}

function renderHabitos(){
  const cont = $('#habitosList'); if(!cont) return;
  cont.innerHTML='';
  const log = getLog(ymd(today));
  const quest = getTodayQuest();

  cfg.habitos.forEach(h=>{
    const row = document.createElement('div'); row.className='habit'+(log[h.id]===true?' done':'');
    const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = log[h.id]===true;
    cb.addEventListener('change', ()=>{
      const l=getLog(ymd(today));
      if(cb.checked) l[h.id]=true; else delete l[h.id];
      setLog(ymd(today),l); renderHeader(); renderHabitos();
    });
    const bonus = (quest.type==='double' && quest.targetId===h.id) ? ' <span class="tiny" style="opacity:.85">(Doble XP)</span>' : '';
    const label = document.createElement('div'); label.innerHTML = `<strong>${h.label}</strong>${bonus}<div class="tiny muted">+${h.xp} XP / <span style="color:#ffd3c2">-${h.penalty}</span></div>`;
    const fail = document.createElement('button'); fail.className='btn'; fail.textContent='Fallar';
    fail.addEventListener('click', ()=>{
      const l=getLog(ymd(today)); l[h.id]=false; setLog(ymd(today),l); renderHeader(); renderHabitos();
    });
    row.append(cb,label,fail); cont.appendChild(row);
  });
}

function renderRewards(total){
  const list = $('#rewardsList'); if(!list) return;
  list.innerHTML='';
  const items = [
    {label:'Comida libre (1 evento)', need: cfg.umbralComida},
    {label:'Cervezas / salida', need: cfg.umbralCerveza}
  ];
  items.forEach(it=>{
    const li=document.createElement('li');
    const ok = total>=it.need;
    li.textContent = (ok?'✅ ':'⏳ ') + `${it.label} — requiere ${it.need} XP`;
    list.appendChild(li);
  });
  const faltan = Math.max(0, cfg.umbralComida - total);
  const hint = $('#recompensaHint'); if(hint){
    hint.textContent = faltan>0 ? `Te faltan ${faltan} XP para comida libre.` : `¡Recompensas desbloqueadas!`;
  }
}

// --- Quest & Stats (no fallan si no existe el HTML) ---
function renderQuest(){
  const q = getTodayQuest();
  const qt = $('#questText'); if(qt) qt.textContent = q.text;
  const qs = $('#questStatus');
  if(qs){
    if(q.type==='deadline') qs.textContent = 'Reto: 4 hábitos antes de las 21:00 (+20 XP).';
    else if(q.type==='double'){
      const h = cfg.habitos.find(x=>x.id===q.targetId);
      qs.textContent = h ? `Bonus en: ${h.label}` : '';
    } else qs.textContent = '';
  }
}
function statsToday(){
  const log = getLog(ymd(today));
  let energia=0, conocimiento=0, sabiduria=0, vitalidad=0;
  for(const h of cfg.habitos){
    if(log[h.id]===true){
      if(h.attr==='energia') energia+=h.xp;
      if(h.attr==='conocimiento') conocimiento+=h.xp;
      if(h.attr==='sabiduria') sabiduria+=h.xp;
      if(h.attr==='vitalidad') vitalidad+=h.xp;
    }else if(log[h.id]===false){
      const p=Math.round(h.penalty/3);
      if(h.attr==='energia') energia-=p;
      if(h.attr==='conocimiento') conocimiento-=p;
      if(h.attr==='sabiduria') sabiduria-=p;
      if(h.attr==='vitalidad') vitalidad-=p;
    }
  }
  const maxDia = cfg.habitos.reduce((a,b)=>a+b.xp,0) || 1;
  const pct = v => Math.max(0,Math.min(100,Math.round(v*100/maxDia)));
  return { energia:pct(energia), conocimiento:pct(conocimiento), sabiduria:pct(sabiduria), vitalidad:pct(vitalidad) };
}
function renderStats(){
  const st = statsToday();
  const set = (sel,val)=>{ const el=$(sel); if(el) el.style.width = Math.max(0,Math.min(100,val)) + '%'; };
  set('#statEnergia', st.energia);
  set('#statConocimiento', st.conocimiento);
  set('#statSabiduria', st.sabiduria);
  set('#statVitalidad', st.vitalidad);
  const hint = $('#statsHint'); if(hint){
    hint.textContent = `Hoy: 💪 ${st.energia}% · 🧠 ${st.conocimiento}% · 💰 ${st.sabiduria}% · 🍎 ${st.vitalidad}%`;
  }
}

// ---- Config UI
function openConfig(open=true){ const p=$('#panelConfig'); if(p){ p.hidden = !open; if(open) fillConfig(); } }
function fillConfig(){
  const setVal = (sel,val)=>{ const el=$(sel); if(el) el.value = val; };
  setVal('#metaSemanal', cfg.metaSemanal);
  setVal('#umbralComida', cfg.umbralComida);
  setVal('#umbralCerveza', cfg.umbralCerveza);
  setVal('#vidasInput', vidas);
  renderCfgTable();
}
function renderCfgTable(){
  const t = $('#tblHabitos'); if(!t) return;
  t.innerHTML = `<tr><th>Hábito</th><th>XP</th><th>Penal</th><th>Atributo</th><th></th></tr>`;
  cfg.habitos.forEach((h,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td><input data-i="${i}" data-k="label" value="${h.label}"></td>
      <td><input type="number" data-i="${i}" data-k="xp" value="${h.xp}"></td>
      <td><input type="number" data-i="${i}" data-k="penalty" value="${h.penalty}"></td>
      <td>
        <select data-i="${i}" data-k="attr">
          <option value="energia" ${h.attr==='energia'?'selected':''}>Energía</option>
          <option value="conocimiento" ${h.attr==='conocimiento'?'selected':''}>Conocimiento</option>
          <option value="sabiduria" ${h.attr==='sabiduria'?'selected':''}>Sabiduría</option>
          <option value="vitalidad" ${h.attr==='vitalidad'?'selected':''}>Vitalidad</option>
        </select>
      </td>
      <td><button class="btn" data-del="${i}">Eliminar</button></td>
    `;
    t.appendChild(tr);
  });
  t.querySelectorAll('input,select').forEach(inp=>{
    inp.addEventListener('change', e=>{
      const i=+e.target.dataset.i; const k=e.target.dataset.k;
      const v=(k==='label')? e.target.value : (k==='attr'? e.target.value : parseInt(e.target.value||'0',10));
      cfg.habitos[i][k]=v; saveCfg(); renderHabitos(); renderHeader();
    });
  });
  t.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const i=+e.target.dataset.del; cfg.habitos.splice(i,1); saveCfg(); renderCfgTable(); renderHabitos(); renderHeader();
    });
  });
}
function saveCfg(){ localStorage.setItem(K.cfg, JSON.stringify(cfg)); }

// ---- Intro (bienvenida) + avatar
function wireIntro(){
  const intro = $('#introSheet');
  const btnStart = $('#btnStart');
  const remember = $('#rememberMe');
  const seen = localStorage.getItem(K.introSeen) === '1';

  if(intro){ intro.hidden = !!seen; }

  // avatar preview existente
  const data = localStorage.getItem(K.avatar);
  const prev = $('#introAvatarPreview');
  if(data && prev){
    prev.style.backgroundImage = `url(${data})`;
    prev.style.backgroundSize = 'cover';
    prev.style.backgroundPosition = 'center';
    prev.innerHTML = '';
  }

  const inp = $('#avatarInput');
  if(inp){
    inp.onchange = e=>{
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = ()=>{
        const dataUrl = reader.result;
        localStorage.setItem(K.avatar, dataUrl);
        if(prev){
          prev.style.backgroundImage = `url(${dataUrl})`;
          prev.style.backgroundSize = 'cover';
          prev.style.backgroundPosition = 'center';
          prev.innerHTML = '';
        }
        renderAvatar();
      };
      reader.readAsDataURL(file);
    };
  }

  if(btnStart){
    btnStart.onclick = ()=>{
      if(remember && remember.checked) localStorage.setItem(K.introSeen,'1');
      if(intro) intro.hidden = true;
    };
  }
}

// ---- Botones superiores
document.getElementById('btnConfig')?.addEventListener('click', ()=> openConfig(true));
document.getElementById('closeConfig')?.addEventListener('click', ()=> openConfig(false));
document.getElementById('btnResetDia')?.addEventListener('click', ()=>{
  localStorage.removeItem(K.log + ymd(today));
  renderHeader(); renderHabitos();
});
document.getElementById('btnResumen')?.addEventListener('click', ()=>{
  const r = document.getElementById('resumenContent');
  if(r) r.innerHTML = weeklyReportHTML();
  const p = document.getElementById('panelResumen');
  if(p) p.hidden = false;
});
document.getElementById('closeResumen')?.addEventListener('click', ()=>{
  const p = document.getElementById('panelResumen');
  if(p) p.hidden = true;
});

document.getElementById('metaSemanal')?.addEventListener('change', e=>{ cfg.metaSemanal=+e.target.value||500; saveCfg(); renderHeader(); });
document.getElementById('umbralComida')?.addEventListener('change', e=>{ cfg.umbralComida=+e.target.value||300; saveCfg(); renderHeader(); });
document.getElementById('umbralCerveza')?.addEventListener('change', e=>{ cfg.umbralCerveza=+e.target.value||500; saveCfg(); renderHeader(); });
document.getElementById('vidasInput')?.addEventListener('change', e=>{
  vidas = Math.max(0, Math.min(cfg.maxVidas, +e.target.value||vidas));
  localStorage.setItem(K.lives, String(vidas));
  renderHeader();
});
document.getElementById('addHab')?.addEventListener('click', ()=>{
  const nameEl=document.getElementById('newHabName');
  const xpEl=document.getElementById('newHabXP');
  const penEl=document.getElementById('newHabPenalty');
  const name=(nameEl?.value||'').trim(); const xp=parseInt(xpEl?.value||'0',10);
  const pen=parseInt(penEl?.value||'0',10);
  if(!name || xp<=0) return;
  cfg.habitos.push({id:'h'+Date.now(), label:name, xp:xp, penalty:pen, attr:'conocimiento'});
  saveCfg(); if(nameEl) nameEl.value=''; if(xpEl) xpEl.value=''; if(penEl) penEl.value='';
  renderCfgTable(); renderHabitos(); renderHeader();
});

// ---- Instalación PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt = e; const btn = document.getElementById('btnInstall');
  if(!btn) return;
  btn.hidden=false;
  btn.onclick = async ()=>{
    btn.hidden = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  };
});

// ---- Resumen semanal
function weeklyReportHTML(){
  const base = new Date(today);
  const currentDow = (today.getDay()+6)%7;
  let days=[];
  for(let i=0;i<7;i++){
    const d=new Date(base); d.setDate(d.getDate()-currentDow+i);
    const id=ymd(d); const log=getLog(id);
    let xp=0; let tags=[];
    for(const h of cfg.habitos){
      if(log[h.id]===true){ xp+=h.xp; tags.push('✅ '+h.label);}
      else if(log[h.id]===false){ xp-=h.penalty; tags.push('❌ '+h.label);}
    }
    days.push({d, xp:Math.max(0,xp), tags:tags.join(' · ')||'—'});
  }
  const total = days.reduce((a,b)=>a+b.xp,0);
  const unlocked = `${total>=cfg.umbralComida?'✅':'⏳'} Comida · ${total>=cfg.umbralCerveza?'✅':'⏳'} Cervezas`;
  const rows = days.map(x=>`<tr><td>${x.d.toLocaleDateString('es-CO',{weekday:'short',day:'2-digit'})}</td><td>${x.xp} XP</td><td class="muted tiny">${x.tags}</td></tr>`).join('');
  return `<table class="table"><tr><th>Día</th><th>XP</th><th>Detalles</th></tr>${rows}<tr><td><b>Total</b></td><td><b>${total} XP</b></td><td>${unlocked}</td></tr></table>`;
}

// ---- Init
document.addEventListener('DOMContentLoaded',()=>{
  const tl = document.getElementById('todayLabel');
  if(tl) tl.textContent = new Date().toLocaleDateString('es-CO',{weekday:'long', day:'2-digit', month:'short'}).replace('.','');
  renderAvatar();
  renderHeader();
  renderHabitos();
  wireIntro();
});
