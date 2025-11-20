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
    body: JSON.stringify({ id_movimiento })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error HTTP ${res.status}`);
  }
  return res.json();
}

async function getUltimoMovimiento() {
  const res = await fetch(`${API_BASE}/movimientos/ultimo`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error HTTP ${res.status}`);
  }
  return res.json();
}

async function getMovimientos(n = 20) {
  const res = await fetch(`${API_BASE}/movimientos/historial?limit=${n}&offset=0`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error HTTP ${res.status}`);
  }
  return res.json();
}

// =========================
// Render para tabla fija + modal
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
      </tr>
    `;
  } else {
    html = rows.map(r => `
      <tr>
        <td><code>${r.id ?? ""}</code></td>
        <td>${r.movimiento ?? "—"}</td>
        <td>${r.fecha_hora ? new Date(r.fecha_hora).toLocaleString() : "—"}</td>
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
    const rows = Array.isArray(response?.data) ? response.data : [];
    renderMovimientos(rows);
  } catch (e) {
    console.error("Error cargando historial:", e);
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

  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k==="w") enviarMovimiento(1);
    if (k==="s") enviarMovimiento(2);
    if (k===" ") enviarMovimiento(3);
    if (k==="e") enviarMovimiento(4);
    if (k==="q") enviarMovimiento(5);
    if (k==="c") enviarMovimiento(6);
    if (k==="z") enviarMovimiento(7);
    if (k==="d") enviarMovimiento(8);
    if (k==="a") enviarMovimiento(9);
    if (k==="x") enviarMovimiento(10);
    if (k==="y") enviarMovimiento(11);
  });

  showSection("control");
  refrescarUltimo();

});

// =========================
// Navegación
// =========================
const secControl = document.getElementById("panel-control");
const secVoz = document.getElementById("panel-voz");

document.getElementById("btnShowControl")
  .addEventListener("click", () => showSection("control"));

document.getElementById("btnShowVoz")
  .addEventListener("click", () => showSection("voz"));

function showSection(which){
  if(which === "voz"){
    secControl.style.display = "none";
    secVoz.style.display = "";
  } else {
    secVoz.style.display = "none";
    secControl.style.display = "";
  }
}

// =========================
// -------- PANEL DE VOZ --------
// =========================
const OPENAI_MODEL = "gpt-4o-mini";

// Comandos
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

// Palabra clave
const WAKE_WORD = "alvaro";

// MockAPI KEY cache
let __OPENAI_KEY_CACHE = null, __OPENAI_KEY_CACHE_TIME = 0;
const KEY_TTL_MS = 30 * 60 * 1000;

async function obtenerApiKey() {
  const now = Date.now();
  if (__OPENAI_KEY_CACHE && (now - __OPENAI_KEY_CACHE_TIME) < KEY_TTL_MS)
    return __OPENAI_KEY_CACHE;

  const res = await fetch("https://68e538708e116898997ee557.mockapi.io/apikey");
  if (!res.ok) throw new Error("No pude leer la API Key.");

  const data = await res.json();
  const first = Array.isArray(data) ? data[0] : data;

  const apiKey = first?.apikey ?? first?.api_key ?? first?.key ?? first?.token;
  if (!apiKey) throw new Error("MockAPI no tiene API Key válida.");

  __OPENAI_KEY_CACHE = apiKey.trim();
  __OPENAI_KEY_CACHE_TIME = now;

  return __OPENAI_KEY_CACHE;
}

// Reconocimiento de voz
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
let listening = false;

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
  el.btn.disabled = false;
}

function initRecognition(){
  if (!SpeechRec){
    alert("Tu navegador no soporta reconocimiento de voz.");
    return;
  }

  rec = new SpeechRec();
  rec.lang = "es-MX";
  rec.interimResults = true;
  rec.continuous = true;

  // Reiniciar cuando Chrome corta la sesión
  rec.onend = () => {
    if (listening) setTimeout(() => rec.start(), 300);
  };

  rec.onerror = err => {
    console.warn("Speech error:", err);
    setMicState(false);
  };

  rec.onresult = (e) => {
    const transcript = Array.from(e.results)
      .map(r => r[0].transcript)
      .join(" ")
      .trim();

    if (!transcript) return;

    el.lastHeard.textContent = transcript;

    const lower = transcript.toLowerCase();
    const wakeIdx = lower.indexOf(WAKE_WORD);

    if (wakeIdx === -1) return;

    const afterWake = transcript.slice(wakeIdx + WAKE_WORD.length).trim();
    if (afterWake.length < 1) return;

    const isFinal = Array.from(e.results).pop().isFinal;

    if (isFinal) classifyAndAct(afterWake);
  };
}

function normalize(s){
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^\w\s]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function localClassify(txt){
  const t = normalize(txt);

  if (/\b(detener|alto)\b/.test(t)) return {id:3, key:"detener"};
  if (/\b(adelante|avanza)\b/.test(t)) return {id:1, key:"adelante"};
  if (/\b(atras|retrocede)\b/.test(t)) return {id:2, key:"atrás"};

  return {id:3, key:"detener"};
}

async function classifyAndAct(userText){
  el.detected.textContent = "Analizando…";
  el.action.textContent = "…";

  try {
    const apiKey = await obtenerApiKey();

    const payload = {
      model: OPENAI_MODEL,
      messages: [
        { role:"system", content:`{"command_id":1..11}` },
        { role:"user", content:userText }
      ],
      temperature: 0,
      response_format: { type:"json_object" }
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("OpenAI Error");

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);

    const match = COMMANDS.find(c => c.id === parsed.command_id);
    const key = match?.key || parsed.command_key;

    el.detected.textContent = `${parsed.command_id} — ${key}`;

    performAction(parsed.command_id, key);

  } catch(err){
    const fallback = localClassify(userText);
    el.detected.textContent = `${fallback.id} — ${fallback.key}`;
    performAction(fallback.id, fallback.key);
  }
}

function setStatusVoz(texto, fecha = null){
  el.statusVoz.textContent = (texto || "—").toUpperCase();
  el.timestampVoz.textContent = fecha ? new Date(fecha).toLocaleString() : "";
}

function performAction(id, key){
  el.action.textContent = `Ejecutando: ${key}`;

  postMovimiento(id)
    .then(() => {
      refrescarUltimo();
      cargarMovimientosGlobal();
      showToast(`Registrado: ${key}`);
    })
    .catch(() => showToast("Error registrando"));
}

// Iniciar reconocimiento
document.addEventListener("DOMContentLoaded", () => {

  el.btn.addEventListener("click", async () => {
    if (!rec) initRecognition();

    try {
      el.btn.disabled = true;

      if (!listening){
        await rec.start();
        setMicState(true);
      } else {
        rec.stop();
        setMicState(false);
      }

    } catch(err){
      console.error("Mic start error:", err);
      showToast("No se pudo acceder al micrófono");
      setMicState(false);
    }
  });

  initRecognition();
});









