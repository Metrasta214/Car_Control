// =========================
// Config / Catálogo
// =========================
const API_BASE = "http://34.234.40.49:5500/api";

const CATALOGO = {
  1:"Adelante", 2:"Atrás", 3:"Detener",
  4:"V. adelante der.", 5:"V. adelante izq.",
  6:"V. atrás der.", 7:"V. atrás izq.",
  8:"Giro 90° der.", 9:"Giro 90° izq.",
  10:"Giro 360° der.", 11:"Giro 360° izq."
};

// =========================
// Utilidades UI
// =========================
const statusEl = document.getElementById("status");
const tsEl = document.getElementById("timestamp");
const toastEl = document.getElementById("toast");
const toastMsg = document.getElementById("toast-msg");
const toast = new bootstrap.Toast(toastEl, { delay: 2000 });

function showToast(msg){
  toastMsg.textContent = msg;
  toast.show();
}

function setStatus(texto, fecha = null) {
  statusEl.textContent = (texto || "—").toUpperCase();
  tsEl.textContent = fecha ? new Date(fecha).toLocaleString() : "";
}

// =========================
// API Movimientos
// =========================
async function postMovimiento(id_movimiento) {
  const res = await fetch(`${API_BASE}/movimientos`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ id_movimiento })   // ✔ CORRECTO
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("POST ERROR:", err);
    throw new Error(err.message || `Error HTTP ${res.status}`);
  }

  return res.json();
}

async function getUltimoMovimiento() {
  const res = await fetch(`${API_BASE}/movimientos/ultimo`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getMovimientos(n = 20) {
  const res = await fetch(`${API_BASE}/movimientos/historial?limit=${n}&offset=0`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); 
}

// =========================
// Render tabla
// =========================
function renderMovimientos(rows = []) {
  const modalBody = document.getElementById("movimientos-body");
  const fixedBody = document.getElementById("historial-body");
  const stampModal = document.getElementById("mov-last-update");
  const stampFixed = document.getElementById("historial-update");

  let html = "";

  if (!rows || rows.length === 0) {
    html = `
      <tr>
        <td colspan="3" class="text-center text-muted py-3">Sin registros</td>
      </tr>`;
  } else {
    html = rows.map(r => `
      <tr>
        <td><code>${r.id}</code></td>
        <td>${r.movimiento}</td>
        <td>${new Date(r.fecha_hora).toLocaleString()}</td>
      </tr>
    `).join("");
  }

  if (modalBody) modalBody.innerHTML = html;
  if (fixedBody) fixedBody.innerHTML = html;

  const now = new Date().toLocaleTimeString();
  if (stampModal) stampModal.textContent = `Actualizado: ${now}`;
  if (stampFixed) stampFixed.textContent = `Última actualización: ${now}`;
}

// =========================
// Auto refresh
// =========================
async function cargarMovimientosGlobal() {
  try {
    const response = await getMovimientos(20);
    renderMovimientos(response.data ?? []);
  } catch (e) {
    renderMovimientos([]);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cargarMovimientosGlobal();
  setInterval(cargarMovimientosGlobal, 2000);
});

// =========================
// Panel de Control
// =========================
async function enviarMovimiento(idMov) {
  try {
    setStatus(CATALOGO[idMov]);
    await postMovimiento(idMov);
    showToast(`Enviado: ${CATALOGO[idMov]}`);
    await refrescarUltimo();
    cargarMovimientosGlobal();
  } catch (e) {
    showToast(`Error: ${e.message}`);
  }
}

async function refrescarUltimo() {
  try {
    const { data } = await getUltimoMovimiento();
    if (data) {
      setStatus(data.movimiento, data.fecha_hora);
      setStatusVoz(data.movimiento, data.fecha_hora);
    }
  } catch (e) {}
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-mov]").forEach(btn => {
    btn.addEventListener("click", () => enviarMovimiento(Number(btn.dataset.mov)));
  });

  showSection("control");
  refrescarUltimo();
});

// =========================
// Navegación
// =========================
const secControl = document.getElementById("panel-control");
const secVoz = document.getElementById("panel-voz");

function showSection(which){
  if(which === "voz"){
    secControl.style.display = "none";
    secVoz.style.display = "";
  } else {
    secVoz.style.display = "none";
    secControl.style.display = "";
  }
}

document.getElementById("btnShowControl").onclick = () => showSection("control");
document.getElementById("btnShowVoz").onclick = () => showSection("voz");

// =============================================================
// PANEL DE VOZ
// =============================================================
const OPENAI_MODEL = "gpt-4o-mini";
const WAKE_WORD = "alvaro";

const COMMANDS = [
  { id: 1, key: "adelante" },
  { id: 2, key: "atrás" },
  { id: 3, key: "detener" },
  { id: 4, key: "vuelta adelante derecha" },
  { id: 5, key: "vuelta adelante izquierda" },
  { id: 6, key: "vuelta atrás derecha" },
  { id: 7, key: "vuelta atrás izquierda" },
  { id: 8, key: "giro 90 derecha" },
  { id: 9, key: "giro 90 izquierda" },
  { id:10, key: "giro 360 derecha" },
  { id:11, key: "giro 360 izquierda" },
];

// Obtener API key desde MockAPI
let KEY_CACHE = null, KEY_TIME = 0;
const KEY_TTL = 30 * 60 * 1000;

async function obtenerApiKey(){
  const now = Date.now();

  if(KEY_CACHE && now - KEY_TIME < KEY_TTL) return KEY_CACHE;

  const res = await fetch("https://68e538708e116898997ee557.mockapi.io/apikey");
  const data = await res.json();
  const apiKey = data[0]?.apikey?.trim();

  KEY_CACHE = apiKey;
  KEY_TIME = now;

  return apiKey;
}

// Reconocimiento de Voz
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;

const el = {
  btn: document.getElementById("btnToggle"),
  micState: document.getElementById("micState"),
  lastHeard: document.getElementById("lastHeard"),
  detected: document.getElementById("detected"),
  action: document.getElementById("action"),
  statusVoz: document.getElementById("status-voz"),
  timestampVoz: document.getElementById("timestamp-voz"),
};

function setMicState(on){
  listening = on;
  el.micState.textContent = on ? "Mic ON" : "Mic OFF";
  el.btn.innerHTML = on ? "🛑 Detener" : "🎙️ Iniciar";
}

function initRecognition(){
  rec = new SpeechRec();
  rec.lang = "es-MX";
  rec.interimResults = true;
  rec.continuous = true;

  rec.onresult = (e) => {
    const text = Array.from(e.results).map(r => r[0].transcript).join(" ").trim();
    if(!text) return;

    el.lastHeard.textContent = text;

    const t = text.toLowerCase();
    const idx = t.indexOf(WAKE_WORD);
    if(idx === -1) return;

    const order = text.slice(idx + WAKE_WORD.length).trim();
    if(order.length < 1) return;

    const final = e.results[e.resultIndex].isFinal;
    if(final) classifyAndAct(order);
  };

  rec.onerror = () => setMicState(false);
  rec.onend = () => { if(listening) rec.start(); };
}

// Normalizador
function normalize(s){
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^\w\s]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

// Clasificador local de respaldo
function localClassify(t){
  t = normalize(t);

  if(t.includes("detener") || t.includes("alto")) return {id:3, key:"detener"};
  if(t.includes("adelante")) return {id:1, key:"adelante"};
  if(t.includes("atras") || t.includes("retrocede")) return {id:2, key:"atrás"};

  return {id:3, key:"detener"};
}

// Clasificación con OpenAI
async function classifyAndAct(txt){
  el.detected.textContent = "Analizando...";
  el.action.textContent = "…";

  try {
    const apiKey = await obtenerApiKey();

    const payload = {
      model: OPENAI_MODEL,
      messages:[
        {role:"system", content:`Responde SOLO {"command_id":1..11, "command_key":"texto"}`},
        {role:"user", content:txt}
      ],
      temperature:0,
      response_format:{type:"json_object"}
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${apiKey}`
      },
      body:JSON.stringify(payload)
    });

    const data = await res.json();
    const raw = data.choices[0].message.content;
    const parsed = JSON.parse(raw);

    const cmd = COMMANDS.find(c => c.id === parsed.command_id);
    const key = cmd?.key || parsed.command_key;

    el.detected.textContent = `${parsed.command_id} — ${key}`;

    performAction(parsed.command_id, key);

  } catch (e) {
    const f = localClassify(txt);
    el.detected.textContent = `${f.id} — ${f.key}`;
    performAction(f.id, f.key);
  }
}

// Actualizar estatus en panel de voz
function setStatusVoz(texto, fecha = null){
  el.statusVoz.textContent = (texto || "—").toUpperCase();
  el.timestampVoz.textContent = fecha ? new Date(fecha).toLocaleString() : "";
}

// Ejecutar la orden
function performAction(id, key){
  el.action.textContent = `Ejecutando: ${key}`;

  postMovimiento(id)
    .then(() => {
      refrescarUltimo();
      cargarMovimientosGlobal();
      showToast(`Registrado: ${key}`);
    })
    .catch(e => showToast("Error registrando"));
}

// Inicio
document.addEventListener("DOMContentLoaded", () => {
  initRecognition();

  el.btn.onclick = () => {
    if(!rec) initRecognition();
    if(!listening){
      rec.start();
      setMicState(true);
    } else {
      rec.stop();
      setMicState(false);
    }
  };
});
