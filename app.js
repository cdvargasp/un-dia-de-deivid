// ========== Utilidades de fecha ==========
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
const DOW = d => (d.getDay()+6)%7; // 0=lunes ... 6=domingo
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));

// ========== Claves ==========
const K = {
  cfg:'uddd_cfg_v2',
  lives:'uddd_lives_v1',
  lastWeek:'uddd_last_week_v1',
  log:'uddd_log_',
  introSeen:'uddd_intro_seen_v1',
  avatar:'uddd_avatar_dataurl_v1',
  perfectWeeks:'uddd_perfect_weeks_v1'
};

// ========== Config por defecto (v2 con subhábitos) ==========
const defaultCfg = {
  metaSemanal:500,
  umbralComida:300,
  umbralCerveza:500,
  maxVidas:5,
  presupuestoDia:30000,
  habitos:[
    {id:'comer', label:'Comer bien todo el día', xp:30, penalty:20,
      type:'checklist',
      subs:[{id:'desayuno',label:'Desayuno'},{id:'media',label:'Media mañana'},{id:'almuerzo',label:'Almuerzo'},{id:'merienda',label:'Merienda'},{id:'cena',label:'Cena'}]},
    {id:'ingles', label:'Inglés 30 min', xp:20, penalty:15,
      type:'checklist',
      subs:[{id:'verbos',label:'Verbos aprendidos'},{id:'palabras',label:'Palabras clave'},{id:'frases',label:'Frases escritas'},{id:'conjug',label:'Conjugaciones'},{id:'gram',label:'Gramática'}]},
    {id:'trabajo', label:'Trabajo (AM/PM)', xp:25, penalty:20,
      type:'checklist',
      subs:[{id:'am',label:'Bloque AM'},{id:'pm',label:'Bloque PM'}]},
    {id:'estudio', label:'Estudio 45 min', xp:25, penalty:20,
      type:'checklist',
      subs:[{id:'lectura',label:'Lectura'},{id:'estudio',label:'Estudio activo'},{id:'escritura',label:'Escritura'},{id:'practica',label:'Proyecto/Práctica'}]},
    {id:'finanzas', label:'Control de finanzas (10 min)', xp:20, penalty:15, type:'finanzas'},
    {id:'ejercicio', label:'Ejercicio (cardio/fuerza/movilidad)', xp:15, penalty:10,
      type:'checklist',
      subs:[{id:'cardio',label:'Cardio (trote/lazo)'},{id:'fuerza',label:'Fuerza'},{id:'movilidad',label:'Movilidad/estiramientos'}]},
    {id:'sueno', label:'Dormir ≥7h', xp:15, penalty:10, type:'sueno'}
  ]
};

// ========== Carga + Migración v1 → v2 ==========
function loadCfg(){
  let c;
  try{ c = JSON.parse(localStorage.getItem(K.cfg)||'null'); }catch{ c=null; }
  if(!c) return {...defaultCfg};

  // Si no hay "type" asumimos que viene de v1 -> migramos a v2 usando defaultCfg, preservando umbrales
  const needsMigration = !Array.isArray(c.habitos) || c.habitos.some(h=>!h || !h.type);
  if(needsMigration){
    const out = {...defaultCfg};
    out.metaSemanal = typeof c.metaSemanal==='number'? c.metaSemanal : defaultCfg.metaSemanal;
    out.umbralComida = typeof c.umbralComida==='number'? c.umbralComida : defaultCfg.umbralComida;
    out.umbralCerveza = typeof c.umbralCerveza==='number'? c.umbralCerveza : defaultCfg.umbralCerveza;
    out.presupuestoDia = typeof c.presupuestoDia==='number'? c.presupuestoDia : defaultCfg.presupuestoDia;
    // si existía arreglo habitos, intentamos mapear xp/penalty/labels por id
    if(Array.isArray(c.habitos)){
      const byId = Object.fromEntries(defaultCfg.habitos.map(h=>[h.id,h]));
      c.habitos.forEach(old=>{
        if(!old || !old.id || !byId[old.id]) return;
        byId[old.id].label   = old.label   || byId[old.id].label;
        byId[old.id].xp      = typeof old.xp==='number'? old.xp : byId[old.id].xp;
        byId[old.id].penalty = typeof old.penalty==='number'? old.penalty : byId[old.id].penalty;
      });
      out.habitos = Object.values(byId);
    }
    // guardamos migrado
    localStorage.setItem(K.cfg, JSON.stringify(out));
    return out;
  }
  return c;
}

let cfg = loadCfg();
let vidas = parseInt(localStorage.getItem(K.lives) || '3',10);
const weekNow = isoWeekId(today);
let perfectWeeks = parseInt(localStorage.getItem(K.perfectWeeks) || '0',10);

// ========== Rollover semanal (vidas + semanas perfectas) ==========
(function(){
  const prev = localStorage.getItem(K.lastWeek);
  if(prev && prev !== weekNow){
    const lastXP = xpSumWeek(prev);
    const minReq = Math.min(cfg.umbralComida, Math.floor(cfg.metaSemanal*0.5));
    if(lastXP < minReq) vidas = Math.max(0, vidas-1);
    else if(lastXP >= cfg.umbralCerveza) vidas = Math.min(cfg.maxVidas, vidas+1);
    localStorage.setItem(K.lives, String(vidas));

    const wasPerfect = semanaPerfecta(prev).perfect;
    if(wasPerfect){
      perfectWeeks++; localStorage.setItem(K.perfectWeeks, String(perfectWeeks));
    }
  }
  localStorage.setItem(K.lastWeek, weekNow);
})();

// ========== Logs ==========
const getLog = d => { try{ return JSON.parse(localStorage.getItem(K.log + d) || '{}'); }catch{ return {}; } };
const setLog = (d,obj) => localStorage.setItem(K.log + d, JSON.stringify(obj||{}));

// ========== Helpers XP ==========
function perSubXP(h){
  const n = Math.max(1, (h.subs&&h.subs.length)||0);
  const base = Math.floor(h.xp / n);
  const resto = h.xp - base*n;
  return Array.from({length:n}, (_,i)=> base + (i < resto ? 1 : 0));
}
function perSubPenalty(h){
  const n = Math.max(1, (h.subs&&h.subs.length)||0);
  const base = Math.floor(h.penalty / n);
  const resto = h.penalty - base*n;
  return Array.from({length:n}, (_,i)=> base + (i < resto ? 1 : 0));
}

// ========== Cálculo XP día/semanas ==========
function todayXP(){
  const log = getLog(ymd(today));
  let sum=0;
  for(const h of cfg.habitos){
    const rec = log[h.id] || {};

    if(h.type==='checklist'){
      const xs = perSubXP(h), ps = perSubPenalty(h);
      (h.subs||[]).forEach((s,idx)=>{
        const v = rec.subs ? rec.subs[s.id] : undefined;
        if(v === true) sum += xs[idx];
        if(v === false) sum -= ps[idx];
      });

    }else if(h.type==='finanzas'){
      const gasto = Number(rec.gasto);
      const presupuesto = Number(rec.presupuesto || cfg.presupuestoDia);
      const necesario = !!rec.necesario;
      if(!isNaN(gasto)){
        if(gasto <= presupuesto) sum += h.xp;
        else sum += necesario ? 5 : -h.penalty;
      }

    }else if(h.type==='sueno'){
      if(rec.ok === true) sum += h.xp;
      else if(rec.ok === false) sum -= h.penalty;
    }
  }
  return Math.max(0,sum);
}

function xpSumWeek(weekId){
  let sum=0;
  for(let i=0;i<8;i++){
    const d=new Date(today); d.setDate(d.getDate()-i);
    if(isoWeekId(d)!==weekId) continue;
    const log=getLog(ymd(d));
    let day=0;
    for(const h of cfg.habitos){
      const rec = log[h.id] || {};
      if(h.type==='checklist'){
        const xs = perSubXP(h), ps = perSubPenalty(h);
        (h.subs||[]).forEach((s,idx)=>{
          const v = rec.subs ? rec.subs[s.id] : undefined;
          if(v === true) day += xs[idx];
          if(v === false) day -= ps[idx];
        });
      }else if(h.type==='finanzas'){
        const gasto = Number(rec.gasto);
        const presupuesto = Number(rec.presupuesto || cfg.presupuestoDia);
        const necesario = !!rec.necesario;
        if(!isNaN(gasto)){
          if(gasto <= presupuesto) day += h.xp;
          else day += necesario ? 5 : -h.penalty;
        }
      }else if(h.type==='sueno'){
        if(rec.ok === true) day += h.xp;
        else if(rec.ok === false) day -= h.penalty;
      }
    }
    sum += Math.max(0,day);
  }
  return Math.max(0,sum);
}
const xpWeekNow = ()=> xpSumWeek(weekNow);

// ========== Semana perfecta (lun–sab, domingo comodín) ==========
function diaCompleto(h, rec){
  rec = rec || {};
  if(h.type==='checklist'){
    const done = rec.subs ? Object.values(rec.subs).filter(v=>v===true).length : 0;
    if(h.id==='comer') return done >= 5;
    if(h.id==='ingles') return done >= 3;
    if(h.id==='trabajo') return rec.subs && rec.subs.am===true && rec.subs.pm===true;
    if(h.id==='estudio') return done >= 3;
    if(h.id==='ejercicio') return done >= 3;
    return false;
  }else if(h.type==='finanzas'){
    const gasto = Number(rec.gasto);
    const presupuesto = Number(rec.presupuesto || cfg.presupuestoDia);
    if(isNaN(gasto)) return false;
    if(gasto <= presupuesto) return true;
    return !!rec.necesario;
  }else if(h.type==='sueno'){
    return rec.ok === true;
  }
  return false;
}
function semanaPerfecta(weekId){
  // encontrar domingo de esa semana
  const ref = new Date(today);
  let guard=0;
  while(isoWeekId(ref)!==weekId && guard<60){ ref.setDate(ref.getDate()-1); guard++; }
  const monday = new Date(ref); monday.setDate(ref.getDate() - DOW(ref)); // lunes
  const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
  const sundayLog = getLog(ymd(sunday));

  let perfect = true;
  const failsByHabit = {};

  for(const h of cfg.habitos){
    let fallos = 0;
    for(let i=0;i<6;i++){ // lun-sab
      const d = new Date(monday); d.setDate(monday.getDate()+i);
      const log = getLog(ymd(d));
      if(!diaCompleto(h, log[h.id])) fallos++;
    }
    if(fallos>0 && diaCompleto(h, sundayLog[h.id])) fallos = Math.max(0, fallos-1);
    failsByHabit[h.id] = fallos;
    if(fallos>0) perfect=false;
  }
  return { perfect, failsByHabit };
}

// ========== Nivel ==========
function calcNivel(){
  const w = perfectWeeks;
  if(w>=26) return 5; if(w>=16) return 4; if(w>=8) return 3; if(w>=4) return 2; return 1;
}

// ========== UI helpers ==========
const $ = s => document.querySelector(s);

// ========== Render header ==========
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
  try{
    const tl = $('#todayLabel'); if(tl) tl.textContent = new Date().toLocaleDateString('es-CO',{weekday:'long', day:'2-digit', month:'short'}).replace('.','');
    const w = xpWeekNow();
    const pct = Math.min(100, Math.round(w*100/Math.max(1,cfg.metaSemanal)));
    $('#vidas') && ($('#vidas').textContent = String(vidas));
    $('#nivel') && ($('#nivel').textContent = String(calcNivel()));
    $('#xpHoy') && ($('#xpHoy').textContent = String(todayXP()));
    $('#xpSemana') && ($('#xpSemana').textContent = String(w));
    $('#metaText') && ($('#metaText').textContent = `${w} / ${cfg.metaSemanal}`);
    const bar = $('#barSemana'); if(bar){ bar.style.width = pct + '%'; bar.style.background = 'var(--btn)'; }
    renderRewards(w);
  }catch(e){ console.error('renderHeader', e); }
}

// ========== Render hábitos ==========
function renderHabitos(){
  try{
    const cont = $('#habitosList'); if(!cont) return;
    cont.innerHTML='';
    const log = getLog(ymd(today));

    cfg.habitos.forEach(h=>{
      const details = document.createElement('details');
      const summary = document.createElement('summary');

      // mini info
      let mini = '';
      if(h.type==='checklist'){
        const total = (h.subs&&h.subs.length)||0;
        const done = log[h.id] && log[h.id].subs ? Object.values(log[h.id].subs).filter(v=>v===true).length : 0;
        mini = `<span class="small muted">${done}/${total}</span>`;
      }else if(h.type==='sueno'){
        const ok = log[h.id] && log[h.id].ok===true ? 'OK' : '—';
        mini = `<span class="small muted">${ok}</span>`;
      }else if(h.type==='finanzas'){
        const gasto = log[h.id] && typeof log[h.id].gasto!=='undefined' ? log[h.id].gasto : '';
        mini = `<span class="small muted">${gasto?('Gasto: '+gasto):'—'}</span>`;
      }

      summary.innerHTML = `<div><strong>${h.label}</strong><div class="tiny muted">+${h.xp} XP / <span style="color:#ffd3c2">-${h.penalty}</span></div></div>${mini}`;
      details.appendChild(summary);

      const sub = document.createElement('div'); sub.className='sublist';

      if(h.type==='checklist'){
        (h.subs||[]).forEach((s)=>{
          const row = document.createElement('div'); row.className='subrow';
          const cb = document.createElement('input'); cb.type='checkbox';
          cb.checked = !!(log[h.id] && log[h.id].subs && log[h.id].subs[s.id]===true);
          cb.addEventListener('change', ()=>{
            const L = getLog(ymd(today));
            const obj = L[h.id] || (L[h.id]={subs:{}});
            if(cb.checked) obj.subs[s.id]=true; else delete obj.subs[s.id];
            setLog(ymd(today),L); renderHeader(); renderHabitos();
          });
          const label = document.createElement('div'); label.textContent = s.label;
          const right = document.createElement('div'); right.className='right';
          const fail = document.createElement('button'); fail.className='btn'; fail.textContent='Fallar';
          fail.addEventListener('click', ()=>{
            const L = getLog(ymd(today));
            const obj = L[h.id] || (L[h.id]={subs:{}});
            obj.subs[s.id] = false;
            setLog(ymd(today),L); renderHeader(); renderHabitos();
          });
          right.appendChild(fail);
          row.append(cb,label,right); sub.appendChild(row);
        });

      }else if(h.type==='finanzas'){
        const rec = log[h.id] || {};
        const inGasto = document.createElement('input');
        inGasto.type='number'; inGasto.className='input';
        inGasto.placeholder='0'; inGasto.value = rec.gasto||'';
        const rowG = document.createElement('div'); rowG.className='subrow';
        rowG.append(document.createElement('div'), inGasto, document.createElement('div'));

        const chkNec = document.createElement('input'); chkNec.type='checkbox'; chkNec.checked = !!rec.necesario;
        const rowN = document.createElement('div'); rowN.className='subrow';
        rowN.append(document.createElement('div'), document.createTextNode('¿Fue necesario?'), chkNec);

        const txt = document.createElement('textarea'); txt.className='textarea';
        txt.placeholder='Justificación si te pasaste del presupuesto...'; txt.value = rec.nota||'';
        const rowT = document.createElement('div'); rowT.className='subrow';
        rowT.append(document.createElement('div'), txt, document.createElement('div'));

        const save = document.createElement('button'); save.className='btn'; save.textContent='Guardar finanzas';
        save.onclick = ()=>{
          const L = getLog(ymd(today));
          L[h.id] = {
            gasto: parseInt(inGasto.value||'0',10),
            presupuesto: cfg.presupuestoDia,
            necesario: chkNec.checked,
            nota: String(txt.value||'').trim()
          };
          setLog(ymd(today),L); renderHeader(); renderHabitos();
        };
        const rowS = document.createElement('div'); rowS.className='subrow';
        rowS.append(document.createElement('div'), document.createTextNode(''), save);

        sub.append(rowG,rowN,rowT,rowS);

      }else if(h.type==='sueno'){
        const rec = log[h.id] || {};
        const row = document.createElement('div'); row.className='subrow';
        const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = rec.ok===true;
        const label = document.createElement('div'); label.textContent = 'Dormí ≥7 horas';
        row.append(cb,label,document.createElement('div'));

        const txt = document.createElement('textarea'); txt.className='textarea';
        txt.placeholder='Si NO dormiste ≥7h, explica brevemente por qué.'; txt.value = rec.nota||'';
        const rowT = document.createElement('div'); rowT.className='subrow';
        rowT.append(document.createElement('div'), txt, document.createElement('div'));
        const save = document.createElement('button'); save.className='btn'; save.textContent='Guardar';
        const rowS = document.createElement('div'); rowS.className='subrow';
        rowS.append(document.createElement('div'), document.createTextNode(''), save);

        function persist(){
          const L = getLog(ymd(today));
          L[h.id] = { ok: cb.checked, nota: String(txt.value||'').trim() };
          setLog(ymd(today),L); renderHeader(); renderHabitos();
        }
        cb.onchange = persist; save.onclick = persist;

        sub.append(row,rowT,rowS);
      }

      details.appendChild(sub);
      // abrir por defecto (opcional: comenta la siguiente línea si no lo quieres abierto)
      // details.open = true;
      $('#habitosList').appendChild(details);
    });
  }catch(e){
    console.error('renderHabitos', e);
  }
}

// ========== Recompensas ==========
function renderRewards(total){
  try{
    const list = $('#rewardsList'); if(!list) return;
    list.innerHTML='';
    let perfect=false;
    try{ perfect = semanaPerfecta(weekNow).perfect; }catch{}

    const tiers = [
      {name:'🍻 Salida con amigos (mayor)', need:cfg.metaSemanal, cond: perfect},
      {name:'🛍️ Compra pequeña', need:400, cond: total>=400},
      {name:'🍽️ Cena libre', need:300, cond: total>=300},
      {name:'🍦 Helado / snack', need:200, cond: total>=200}
    ];
    tiers.forEach(t=>{
      const li=document.createElement('li');
      li.textContent = (t.cond?'✅ ':'⏳ ') + `${t.name} — referencia ${t.need} XP`;
      list.appendChild(li);
    });

    const faltan = Math.max(0, cfg.umbralComida - total);
    const hint = $('#recompensaHint'); if(hint){
      hint.textContent = faltan>0
        ? `Te faltan al menos ${faltan} XP para alcanzar una recompensa.`
        : `¡Recompensas desbloqueadas!`;
    }
  }catch(e){ console.error('renderRewards', e); }
}

// ========== Config ==========
function openConfig(open=true){ const p=$('#panelConfig'); if(p){ p.hidden = !open; if(open) fillConfig(); } }
function fillConfig(){
  const setVal = (sel,val)=>{ const el=$(sel); if(el) el.value = val; };
  setVal('#metaSemanal', cfg.metaSemanal);
  setVal('#umbralComida', cfg.umbralComida);
  setVal('#umbralCerveza', cfg.umbralCerveza);
  setVal('#presupuestoDiario', cfg.presupuestoDia);
  setVal('#vidasInput', vidas);
  renderCfgTable();
}
function renderCfgTable(){
  const t = $('#tblHabitos'); if(!t) return;
  t.innerHTML = `<tr><th>Hábito</th><th>XP</th><th>Penal</th><th>Tipo</th><th></th></tr>`;
  cfg.habitos.forEach((h,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td><input data-i="${i}" data-k="label" value="${h.label}"></td>
      <td><input type="number" data-i="${i}" data-k="xp" value="${h.xp}"></td>
      <td><input type="number" data-i="${i}" data-k="penalty" value="${h.penalty}"></td>
      <td class="tiny">${h.type}</td>
      <td><button class="btn" data-del="${i}">Eliminar</button></td>
    `;
    t.appendChild(tr);
  });
  t.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('change', e=>{
      const i=+e.target.dataset.i; const k=e.target.dataset.k;
      const v=(k==='label')? e.target.value : parseInt(e.target.value||'0',10);
      cfg.habitos[i][k]=v; saveCfg(); renderHabitos(); renderHeader();
    });
  });
  t.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const i=+e.target.dataset.del; cfg.habitos.splice(i,1); saveCfg(); renderCfgTable(); renderHabitos(); renderHeader();
    });
  });
}
const saveCfg = ()=> localStorage.setItem(K.cfg, JSON.stringify(cfg));

// ========== Intro + avatar ==========
function wireIntro(){
  const intro = $('#introSheet');
  const btnStart = $('#btnStart');
  const remember = $('#rememberMe');
  const seen = localStorage.getItem(K.introSeen) === '1';
  if(intro){ intro.hidden = !!seen; }

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

// ========== Botones ==========
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
document.getElementById('presupuestoDiario')?.addEventListener('change', e=>{ cfg.presupuestoDia=+e.target.value||cfg.presupuestoDia; saveCfg(); });
document.getElementById('vidasInput')?.addEventListener('change', e=>{
  vidas = clamp(+e.target.value||vidas, 0, cfg.maxVidas);
  localStorage.setItem(K.lives, String(vidas));
  renderHeader();
});
document.getElementById('addHab')?.addEventListener('click', ()=>{
  const name=document.getElementById('newHabName')?.value.trim()||''; 
  const xp=parseInt(document.getElementById('newHabXP')?.value||'0',10);
  const pen=parseInt(document.getElementById('newHabPenalty')?.value||'0',10);
  if(!name || xp<=0) return;
  cfg.habitos.push({id:'h'+Date.now(), label:name, xp:xp, penalty:pen, type:'checklist', subs:[]});
  saveCfg(); 
  ['newHabName','newHabXP','newHabPenalty'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  renderCfgTable(); renderHabitos(); renderHeader();
});

// ========== Resumen semanal ==========
function weeklyReportHTML(){
  const base = new Date(today);
  const monday = new Date(base); monday.setDate(base.getDate()-DOW(base));
  const rows=[]; let total=0; const notes=[];

  for(let i=0;i<7;i++){
    const d=new Date(monday); d.setDate(monday.getDate()+i);
    const id=ymd(d); const log=getLog(id);
    let xp=0; let tags=[];
    for(const h of cfg.habitos){
      const rec = log[h.id] || {};
      if(h.type==='checklist'){
        const xs=perSubXP(h), ps=perSubPenalty(h);
        (h.subs||[]).forEach((s,idx)=>{
          const v=rec.subs ? rec.subs[s.id] : undefined;
          if(v===true){ xp+=xs[idx]; tags.push('✅ '+s.label); }
          else if(v===false){ xp-=ps[idx]; tags.push('❌ '+s.label); }
        });
      }else if(h.type==='finanzas'){
        const gasto = Number(rec.gasto);
        const presupuesto = Number(rec.presupuesto || cfg.presupuestoDia);
        const necesario = !!rec.necesario;
        if(!isNaN(gasto)){
          if(gasto<=presupuesto){ xp+=h.xp; tags.push('💰 dentro presupuesto'); }
          else { xp += necesario?5:-h.penalty; tags.push(necesario?'💬 necesario':'⚠️ exceso'); if(rec.nota) notes.push(`Finanzas ${id}: ${rec.nota}`); }
        }
      }else if(h.type==='sueno'){
        if(rec.ok===true){ xp+=h.xp; tags.push('😴 OK'); }
        else if(rec.ok===false){ xp-=h.penalty; tags.push('😴 fallo'); if(rec.nota) notes.push(`Sueño ${id}: ${rec.nota}`); }
      }
    }
    rows.push(`<tr><td>${d.toLocaleDateString('es-CO',{weekday:'short',day:'2-digit'})}</td><td>${Math.max(0,xp)} XP</td><td class="muted tiny">${tags.join(' · ')||'—'}</td></tr>`);
    total += Math.max(0,xp);
  }

  const perfect = (function(){ try{return semanaPerfecta(weekNow).perfect;}catch{return false;} })();
  const unlocked = `${perfect?'✅ Semana perfecta':'⏳ Aún no'} · ${total>=cfg.metaSemanal?'✅ Meta':'⏳ Meta'} (${total} / ${cfg.metaSemanal})`;
  const notesHtml = notes.length? `<p class="tiny"><b>Notas:</b><br>${notes.map(n=>`• ${n}`).join('<br>')}</p>`: '';
  return `<table class="table"><tr><th>Día</th><th>XP</th><th>Detalles</th></tr>${rows.join('')}<tr><td><b>Total</b></td><td><b>${total} XP</b></td><td>${unlocked}</td></tr></table>${notesHtml}`;
}

// ========== Init ==========
document.addEventListener('DOMContentLoaded',()=>{
  try{
    $('#todayLabel') && ($('#todayLabel').textContent = new Date().toLocaleDateString('es-CO',{weekday:'long', day:'2-digit', month:'short'}).replace('.',''));
    renderAvatar();
    renderHeader();
    renderHabitos();
    wireIntro();
  }catch(err){
    console.error('Init error:', err);
  }
});
