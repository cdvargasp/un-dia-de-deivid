// app.js
// Aplicación de hábitos con XP y recompensas

const K = {
  habits: 'uddd_habits_v1',
  progress: 'uddd_progress_v1',
  introSeen: 'uddd_intro_seen_v1'
};

// ======================
// Funciones base
// ======================
function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function load(key, def){ 
  try{
    return JSON.parse(localStorage.getItem(key)) ?? def;
  }catch(e){
    return def;
  }
}

function save(key, val){ 
  localStorage.setItem(key, JSON.stringify(val));
}

// ======================
// Estado global
// ======================
let habits = load(K.habits, [
  { name:'Ejercicio', xp:100 },
  { name:'Dormir bien', xp:50 },
  { name:'Comer saludable', xp:50 },
  { name:'Leer o estudiar', xp:50 },
  { name:'No redes 1h antes de dormir', xp:50 }
]);

let progress = load(K.progress, {}); // progress[fecha] = [{habit,done,fail}]
const XP_OBJETIVO = 1000;

// ======================
// Elementos UI
// ======================
const elList = document.getElementById('habitosList');
const elTotal = document.getElementById('totalXP');
const elMensaje = document.getElementById('mensaje');
const btnReiniciar = document.getElementById('btnReiniciar');
const elSemanal = document.getElementById('xpSemanal');
const elInstalar = document.getElementById('btnInstalar');

// ======================
// Renderizado de hábitos
// ======================
function renderHabitos(){
  elList.innerHTML = '';
  habits.forEach((h,i)=>{
    const row = document.createElement('div');
    row.className = 'habit';
    row.innerHTML = `
      <span>${h.name}</span>
      <div class="acciones">
        <button class="btn ok">✔️</button>
        <button class="btn fail">❌</button>
      </div>
    `;
    const ok = row.querySelector('.ok');
    const fail = row.querySelector('.fail');

    ok.onclick = ()=> marcar(i,true);
    fail.onclick = ()=> marcar(i,false);
    elList.appendChild(row);
  });
  actualizarXP();
}

// ======================
// Lógica de progreso
// ======================
function marcar(index, exito){
  const key = todayKey();
  if(!progress[key]) progress[key] = [];
  const item = {habit: habits[index].name, done: exito, xp: habits[index].xp};
  progress[key].push(item);
  save(K.progress, progress);
  actualizarXP();
}

function totalDia(key){
  if(!progress[key]) return 0;
  return progress[key].reduce((t,r)=> t + (r.done ? r.xp : 0), 0);
}

function totalSemana(){
  const hoy = new Date();
  let xp = 0;
  for(let i=0;i<7;i++){
    const d = new Date(hoy);
    d.setDate(hoy.getDate()-i);
    const k = d.toISOString().slice(0,10);
    xp += totalDia(k);
  }
  return xp;
}

// ======================
// Actualización XP y mensaje
// ======================
function actualizarXP(){
  const xpHoy = totalDia(todayKey());
  const xpSemana = totalSemana();
  elTotal.textContent = `${xpHoy} XP hoy`;
  elSemanal.textContent = `${xpSemana} XP esta semana`;

  // --- Frase actualizada según tu solicitud ---
  const xpFaltante = Math.max(0, XP_OBJETIVO - xpSemana);
  if(xpFaltante > 0){
    elMensaje.textContent = `Te faltan al menos ${xpFaltante} XP para alcanzar una recompensa.`;
  }else{
    elMensaje.textContent = '¡Felicidades! Alcanzaste una recompensa.';
  }
}

// ======================
// Reiniciar progreso
// ======================
btnReiniciar.onclick = ()=>{
  if(confirm('¿Seguro que deseas reiniciar el progreso?')){
    progress = {};
    save(K.progress, progress);
    actualizarXP();
  }
};

// ======================
// Instalar PWA
// ======================
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  elInstalar.style.display = 'inline-block';
});
elInstalar.addEventListener('click', async ()=>{
  if(deferredPrompt){
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if(result.outcome === 'accepted'){
      elInstalar.style.display = 'none';
    }
    deferredPrompt = null;
  }
});

// ======================
// Intro (pantalla de inicio)
// ======================
function wireIntro(){
  const intro = document.getElementById('introSheet');
  const btnStart = document.getElementById('btnStart');
  const remember = document.getElementById('chkNoMostrar');
  if(!intro) return;

  if(localStorage.getItem(K.introSeen)){
    intro.hidden = true;
  }

  if(btnStart){
    btnStart.onclick = ()=>{
      if(remember && remember.checked) localStorage.setItem(K.introSeen,'1');
      intro.hidden = true;
    };
  }
}

// ======================
// Inicio
// ======================
document.addEventListener('DOMContentLoaded',()=>{
  renderHabitos();
  wireIntro();
});
