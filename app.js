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
  id_movimiento = Number(id_movimiento);

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
// Render tabla (Modal + Fijo)
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
// Auto refresh DEL HISTORIAL (20 segundos)
// =========================
async function cargarMovimientosGlobal() {
  try {
    const response = await getMovimientos(20);
    renderMovimientos(response.data ?? []);
  } catch (e) {
    renderMovimientos([]);
  }
}

async function loopHistorial() {
  await cargarMovimientosGlobal();
  setTimeout(loopHistorial, 20000); // 🔥 CADA 20 SEGUNDOS
}

document.addEventListener("DOMContentLoaded", () => {
  loopHistorial(); // iniciar loop
});

// =========================
// Panel de Control
// =========================
async function enviarMovimiento(idMov) {
  try {
    idMov = Number(idMov);
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
const WAKE_WORD = "álvaro";

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
  el.btn.textContent = on ? "🛑 Detener" : "🎙️ Iniciar";
}

function initRecognition(){
  rec = new SpeechRec();
  rec.lang = "es-MX";
  rec.interimResults = true;
  rec.continuous = true;

  rec.onresult = (e) => {
    const result = e.results[e.resultIndex];
    if (!result) return;

    const text = result[0].transcript.trim();
    if (!text) return;

    el.lastHeard.textContent = text;

    const t = text.toLowerCase();
    if (!t.includes(WAKE_WORD)) return;

    const afterWake = t.replace(WAKE_WORD, "").trim();
    if (!afterWake || afterWake.length < 2) return;

    if (result.isFinal) {
      classifyAndAct(afterWake);
    }
  };

  rec.onerror = () => setMicState(false);
  rec.onend = () => { if (listening) rec.start(); };
}

function classifyAndAct(text){
  const id = localClassify(text);

  el.detected.textContent = `${id} — ${CATALOGO[id]}`;
  performAction(id, CATALOGO[id]);
}

function localClassify(text){
  const t = text.toLowerCase();

  if(t.includes("detener")) return 3;
  if(t.includes("adelante")) return 1;
  if(t.includes("atrás") || t.includes("atras")) return 2;
  if(t.includes("360") && t.includes("dere")) return 10;
  if(t.includes("360") && t.includes("izq")) return 11;
  if(t.includes("90") && t.includes("dere")) return 8;
  if(t.includes("90") && t.includes("izq")) return 9;
  if(t.includes("vuelta") && t.includes("adelante") && t.includes("dere")) return 4;
  if(t.includes("vuelta") && t.includes("adelante") && t.includes("izq")) return 5;
  if(t.includes("vuelta") && t.includes("atrás") && t.includes("dere")) return 6;
  if(t.includes("vuelta") && t.includes("atrás") && t.includes("izq")) return 7;

  return 3;
}

function setStatusVoz(texto, fecha=null){
  el.statusVoz.textContent = (texto || "—").toUpperCase();
  el.timestampVoz.textContent = fecha ? new Date(fecha).toLocaleString() : "";
}

function performAction(id, key){
  id = Number(id);

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
    .catch(() => showToast("Error registrando"));
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
