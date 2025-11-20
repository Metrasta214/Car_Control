// =========================
// Config / Catálogo
// =========================
const API_BASE = "http://34.234.40.49:5500/api"; // ajusta si cambia

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
  return res.json(); // devuelve {data:[...]}
}

// ============================================================
// Render universal — tabla fija + modal
// ============================================================
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
    html = rows.map(r => {
      const id = r.id ?? "";
      const mov = r.movimiento ?? "—";
      const fh = r.fecha_hora ? new Date(r.fecha_hora).toLocaleString() : "—";

      return `
        <tr>
          <td><code>${id}</code></td>
          <td>${mov}</td>
          <td>${fh}</td>
        </tr>
      `;
    }).join("");
  }

  if (modalBody) modalBody.innerHTML = html;
  if (fixedBody) fixedBody.innerHTML = html;

  const now = new Date().toLocaleTimeString();
  if (stampModal) stampModal.textContent = `Actualizado: ${now}`;
  if (stampFixed) stampFixed.textContent = `Última actualización: ${now}`;
}

// ============================================================
// Auto refresh universal
// ============================================================
async function cargarMovimientosGlobal() {
  try {
    const response = await getMovimientos(20);

    // tu backend regresa: { data: [...] }
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
// Lógica Panel de Control
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

  // Teclas rápidas
  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "w") enviarMovimiento(1);
    if (k === "s") enviarMovimiento(2);
    if (k === " ") enviarMovimiento(3);
    if (k === "e") enviarMovimiento(4);
    if (k === "q") enviarMovimiento(5);
    if (k === "c") enviarMovimiento(6);
    if (k === "z") enviarMovimiento(7);
    if (k === "d") enviarMovimiento(8);
    if (k === "a") enviarMovimiento(9);
    if (k === "x") enviarMovimiento(10);
    if (k === "y") enviarMovimiento(11);
  });

  showSection("control");
  refrescarUltimo();
});

// =========================
// Navegación
// =========================
const secControl = document.getElementById("panel-control");
const secVoz = document.getElementById("panel-voz");

document.getElementById("btnShowControl").addEventListener("click", () => showSection("control"));
document.getElementById("btnShowVoz").addEventListener("click", () => showSection("voz"));

function showSection(which){
  if (which === "voz") {
    secControl.style.display = "none";
    secVoz.style.display = "";
  } else {
    secVoz.style.display = "none";
    secControl.style.display = "";
  }
}

// =========================
// ---- Panel de Voz (sin TTS) ----
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

// MockAPI key cache
let __OPENAI_KEY_CACHE = null, __OPENAI_KEY_CACHE_TIME = 0;
const KEY_TTL_MS = 30 * 60 * 1000;

async function obtenerApiKey() {
  const now = Date.now();

  if (__OPENAI_KEY_CACHE && (now - __OPENAI_KEY_CACHE_TIME) < KEY_TTL_MS)
    return __OPENAI_KEY_CACHE;

  // PON AQUÍ tu URL real
  const url = "https://68e538708e116898997ee557.mockapi.io/apikey";

  const res = await fetch(url);
  if (!res.ok) throw new Error("No pude leer la API Key de MockAPI.");

  const data = await res.json();
  const first = Array.isArray(data) ? data[0] : data;

  const apiKey =
    first?.apikey ??
    first?.api_key ??
    first?.key ??
    first?.token ??
    first?.["api key"];

  if (!apiKey) throw new Error("MockAPI no tiene un campo válido con API key.");

  __OPENAI_KEY_CACHE = apiKey.trim();
  __OPENAI_KEY_CACHE_TIME = now;

  return __OPENAI_KEY_CACHE;
}

// Reconocimiento de voz
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

  el.micState.classList.remove("bg-secondary","bg-success");
  el.micState.classList.add(on ? "bg-success" : "bg-secondary");

  el.btn.innerHTML = on
    ? `<i class="bi bi-stop-circle"></i> Detener escucha`
    : `<i class="bi bi-mic-fill"></i> Iniciar escucha`;

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

  rec.onresult = async (e) => {
    const idx = e.resultIndex;

    const transcript = Array.from(e.results)
      .slice(idx)
      .map(r => r[0].transcript)
      .join(" ")
      .trim();

    if (!transcript) return;

    el.lastHeard.textContent = transcript;

    const tLower = transcript.toLowerCase();
    const wakeIdx = tLower.indexOf(WAKE_WORD);

    if (wakeIdx === -1) return;

    const afterWake = transcript.slice(wakeIdx + WAKE_WORD.length).trim();
    if (afterWake.length < 2) return;

    const isFinal = Array.from(e.results).pop().isFinal;

    if (isFinal) classifyAndAct(afterWake);
  };

  rec.onerror = () => setMicState(false);
  rec.onend = () => { if (listening) rec.start(); };
}

// Normalizar texto
function normalize(s){
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^\w\s]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

// Clasificador local (backup)
function localClassify(text){
  const t = normalize(text);

  if (/\b(detener|alto|stop)\b/.test(t)) return {id:3, key:"detener"};
  if (/\b(adelante|avanza)\b/.test(t)) return {id:1, key:"adelante"};
  if (/\b(atras|retrocede|reversa)\b/.test(t)) return {id:2, key:"atrás"};

  if (/\b(90|noventa)\b/.test(t) && /\bderech/.test(t)) return {id:8, key:"giro 90 derecha"};
  if (/\b(90|noventa)\b/.test(t) && /\bizquier/.test(t)) return {id:9, key:"giro 90 izquierda"};

  if (/\b(360|completo)\b/.test(t) && /\bderech/.test(t)) return {id:10, key:"giro 360 derecha"};
  if (/\b(360|completo)\b/.test(t) && /\bizquier/.test(t)) return {id:11, key:"giro 360 izquierda"};

  return {id:3, key:"detener"};
}

// Clasificar orden
async function classifyAndAct(userText){
  el.detected.textContent = "Analizando…";
  el.action.textContent = "…";

  try {
    const apiKey = await obtenerApiKey();

    const systemPrompt = `
Eres un clasificador de órdenes de un robot.
Responde SOLO:
{"command_id": <1..11>, "command_key": "<texto>"}
    `;

    const payload = {
      model: OPENAI_MODEL,
      messages: [
        { role:"system", content: systemPrompt },
        { role:"user", content: userText }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);

    const match = COMMANDS.find(c => c.id === parsed.command_id);
    const key = match?.key || parsed.command_key || "desconocido";

    el.detected.textContent = `${parsed.command_id} — ${key}`;

    performAction(parsed.command_id, key);

  } catch (err) {
    const local = localClassify(userText);
    el.detected.textContent = `${local.id} — ${local.key}`;
    performAction(local.id, local.key);
  }
}

// Actualizar estatus de voz
function setStatusVoz(texto, fecha = null) {
  el.statusVoz.textContent = (texto || "—").toUpperCase();
  el.timestampVoz.textContent =
    fecha ? new Date(fecha).toLocaleString() : "";
}

// Ejecutar la acción detectada
function performAction(id, key){
  el.action.textContent = `Ejecutando: ${key}`;

  postMovimiento(id)
    .then(() => {
      refrescarUltimo();
      cargarMovimientosGlobal();
      showToast(`Registrado: ${key}`);
    })
    .catch(() => showToast("Error registrando movimiento"));
}

// Iniciar reconocimiento
document.addEventListener("DOMContentLoaded", () => {
  initRecognition();

  el.btn.addEventListener("click", () => {
    if (!rec){
      alert("Tu navegador no soporta Web Speech API.");
      return;
    }

    el.btn.disabled = true;

    if (!listening){
      try {
        rec.start();
        setMicState(true);
      } catch {
        setMicState(false);
      }

    } else {
      try { rec.stop(); }
      finally { setMicState(false); }
    }
  });
});






