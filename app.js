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
  id_movimiento = Number(id_movimiento);   // ⬅ AQUI EL FIX IMPORTANTE

  const res = await fetch(`${API_BASE}/movimientos`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ id_movimiento })
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
    idMov = Number(idMov);  // ⬅ FIX
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
// PANEL DE VOZ (CORREGIDO)
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

    if(e.results[e.resultIndex].isFinal)
      classifyAndAct(order);
  };

  rec.onerror = () => setMicState(false);
  rec.onend = () => { if(listening) rec.start(); };
}

// Clasificador local para respaldo
function localClassify(t){
  t = t.toLowerCase();

  if(t.includes("detener")) return {id:3, key:"detener"};
  if(t.includes("adelante")) return {id:1, key:"adelante"};
  if(t.includes("atrás") || t.includes("atras")) return {id:2, key:"atrás"};

  return {id:3, key:"detener"};
}

// Acción final
function classifyAndAct(text){
  const local = localClassify(text);

  el.detected.textContent = `${local.id} — ${local.key}`;
  performAction(local.id, local.key);
}

// Actualizar estatus voz
function setStatusVoz(texto, fecha=null){
  el.statusVoz.textContent = (texto || "—").toUpperCase();
  el.timestampVoz.textContent = fecha ? new Date(fecha).toLocaleString() : "";
}

// Ejecutar movimiento
function performAction(id, key){
  id = Number(id);   // ⬅ FIX CRÍTICO

  if(!id || id < 1 || id > 11){
    showToast("Comando inválido");
    return;
  }

  el.action.textContent = `Ejecutando: ${key}`;

  postMovimiento(id)
    .then(() => {
      refrescarUltimo();
      cargarMovimientosGlobal();
      showToast(`Registrado: ${key}`);
    })
    .catch(e => {
      console.error("ERROR:", e);
      showToast("Error registrando");
    });
}

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
