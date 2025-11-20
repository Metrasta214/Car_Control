/* ============================================================
   CONFIG
============================================================ */
const API_BASE = "http://34.234.40.49:5500/api";

const CATALOGO = {
  1:"Adelante", 2:"Atrás", 3:"Detener",
  4:"V. adelante der.", 5:"V. adelante izq.",
  6:"V. atrás der.", 7:"V. atrás izq.",
  8:"Giro 90° der.", 9:"Giro 90° izq.",
  10:"Giro 360° der.", 11:"Giro 360° izq."
};

const WAKE_WORD = "alvaro";

/* ============================================================
   ELEMENTOS UI
============================================================ */
const statusEl = document.getElementById("status");
const tsEl = document.getElementById("timestamp");

const toastEl = document.getElementById("toast");
const toastMsg = document.getElementById("toast-msg");
const toast = new bootstrap.Toast(toastEl, { delay: 2000 });

/* Voz */
const el = {
  btn: document.getElementById("btnToggle"),
  micState: document.getElementById("micState"),
  lastHeard: document.getElementById("lastHeard"),
  detected: document.getElementById("detected"),
  action: document.getElementById("action"),
  statusVoz: document.getElementById("status-voz"),
  timestampVoz: document.getElementById("timestamp-voz"),
};

/* Paneles */
const secControl = document.getElementById("panel-control");
const secVoz = document.getElementById("panel-voz");

/* ============================================================
   UTILIDADES
============================================================ */
function showToast(msg){
  toastMsg.textContent = msg;
  toast.show();
}

function setStatus(txt, fh=null){
  statusEl.textContent = (txt || "—").toUpperCase();
  tsEl.textContent = fh ? new Date(fh).toLocaleString() : "";
}

function setStatusVoz(txt, fh=null){
  el.statusVoz.textContent = (txt || "—").toUpperCase();
  el.timestampVoz.textContent = fh ? new Date(fh).toLocaleString() : "";
}

/* ============================================================
   API MOVIMIENTOS
============================================================ */
async function postMovimiento(id){
  const res = await fetch(`${API_BASE}/movimientos`, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ id_movimiento:id })
  });
  if(!res.ok) throw new Error("Error al registrar movimiento");
  return res.json();
}

async function getUltimo(){
  const res = await fetch(`${API_BASE}/movimientos/ultimo`);
  return res.json();
}

async function getHistorial(){
  const res = await fetch(`${API_BASE}/movimientos/historial?limit=20&offset=0`);
  return res.json();
}

/* ============================================================
   RENDER HISTORIAL
============================================================ */
function renderMovimientos(rows=[]){
  const tbody = document.getElementById("historial-body");
  let html = "";

  if(rows.length === 0){
    html = `<tr><td colspan="3" class="text-center text-muted py-3">Sin registros</td></tr>`;
  } else {
    html = rows.map(r=>`
      <tr>
        <td><code>${r.id}</code></td>
        <td>${r.movimiento}</td>
        <td>${new Date(r.fecha_hora).toLocaleString()}</td>
      </tr>
    `).join("");
  }

  tbody.innerHTML = html;
}

/* ============================================================
   AUTO REFRESH
============================================================ */
async function cargarTodo(){
  try{
    const h = await getHistorial();
    renderMovimientos(h.data || []);
  }catch(e){}
}

setInterval(cargarTodo, 2000);

/* ============================================================
   PANEL CONTROL
============================================================ */
async function enviarMovimiento(id){
  try{
    setStatus(CATALOGO[id]);
    await postMovimiento(id);
    await refrescarUltimo();
    cargarTodo();
    showToast("Enviado: " + CATALOGO[id]);
  }catch(e){
    showToast("Error enviando");
  }
}

async function refrescarUltimo(){
  try{
    const {data} = await getUltimo();
    if(data){
      setStatus(data.movimiento, data.fecha_hora);
      setStatusVoz(data.movimiento, data.fecha_hora);
    }
  }catch(e){}
}

/* ============================================================
   NAVEGACIÓN
============================================================ */
function showSection(section){
  if(section === "voz"){
    secControl.style.display = "none";
    secVoz.style.display = "";

    setTimeout(()=>{
      try{
        if(!rec) initRecognition();
      }catch(e){}
    },300);

  } else {
    secVoz.style.display = "none";
    secControl.style.display = "";
  }
}

document.getElementById("btnShowControl").onclick = ()=> showSection("control");
document.getElementById("btnShowVoz").onclick = ()=> showSection("voz");

/* ============================================================
   RECONOCIMIENTO DE VOZ
============================================================ */
let rec = null;
let listening = false;

function setMicState(on){
  listening = on;
  el.micState.textContent = on ? "Mic ON" : "Mic OFF";
  el.btn.textContent = on ? "🛑 Detener" : "🎙️ Iniciar";
}

function initRecognition(){
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!Speech){ alert("Tu navegador no soporta reconocimiento de voz"); return; }

  rec = new Speech();
  rec.lang = "es-MX";
  rec.continuous = true;
  rec.interimResults = true;

  rec.onresult = evt =>{
    const t = Array.from(evt.results).map(r=>r[0].transcript).join(" ");
    el.lastHeard.textContent = t;

    const low = t.toLowerCase();
    const idx = low.indexOf(WAKE_WORD);
    if(idx === -1) return;

    const after = t.slice(idx + WAKE_WORD.length).trim();
    if(after.length < 1) return;

    const isFinal = evt.results[evt.results.length-1].isFinal;
    if(isFinal) processCommand(after);
  };

  rec.onerror = e => console.warn(e);
  rec.onend = ()=>{ if(listening) rec.start(); };
}

/* ============================================================
   PROCESAR ORDEN
============================================================ */
function normalize(s){
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^\w\s]/g," ")
    .trim();
}

function localCommand(txt){
  const t = normalize(txt);

  if(t.includes("detener") || t.includes("alto")) return 3;
  if(t.includes("adelante")) return 1;
  if(t.includes("atr")) return 2;

  return 3;
}

function processCommand(text){
  el.detected.textContent = text;

  const mov = localCommand(text);
  el.action.textContent = "Ejecutando: " + CATALOGO[mov];

  postMovimiento(mov)
    .then(()=>{
      refrescarUltimo();
      cargarTodo();
      showToast("Registrado: " + CATALOGO[mov]);
    });
}

/* ============================================================
   BOTÓN DEL MICRÓFONO
============================================================ */
el.btn.onclick = async() => {
  try{
    if(!rec) initRecognition();

    if(!listening){
      await rec.start();
      setMicState(true);
    } else {
      rec.stop();
      setMicState(false);
    }

  }catch(e){
    console.error(e);
    showToast("No se pudo activar micrófono");
  }
};

/* ============================================================
   INICIALIZACIÓN
============================================================ */
document.addEventListener("DOMContentLoaded", ()=>{
  cargarTodo();
  refrescarUltimo();

  document.querySelectorAll("[data-mov]").forEach(btn=>{
    btn.onclick = ()=> enviarMovimiento(Number(btn.dataset.mov));
  });

  showSection("control");
});










