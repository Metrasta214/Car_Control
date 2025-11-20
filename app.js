// =========================
// Config / Catálogo
// =========================
const API_BASE = "http://34.234.40.49:5500/api";
const CATALOGO = {
  1:"Adelante", 2:"Atrás", 3:"Detener",
  4:"Vuelta adelante derecha", 5:"Vuelta adelante izquierda",
  6:"Vuelta atrás derecha", 7:"Vuelta atrás izquierda",
  8:"Giro 90° derecha", 9:"Giro 90° izquierda",
  10:"Giro 360° derecha", 11:"Giro 360° izquierda"
};

// =========================
// Utilidades UI
// =========================
const statusEl = document.getElementById("status");
const tsEl = document.getElementById("timestamp");
const toastEl = document.getElementById("toast");
const toastMsg = document.getElementById("toast-msg");
const toast = new bootstrap.Toast(toastEl, { delay: 2000 });
function showToast(msg){ toastMsg.textContent = msg; toast.show(); }
function setStatus(texto, fecha = null) {
  statusEl.textContent = (texto || "—").toUpperCase();
  tsEl.textContent = fecha ? new Date(fecha).toLocaleString() : "";
}

// =========================
/* API Movimientos */
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
function renderMovimientos(rows = []) {
  const tbody = document.getElementById("movimientos-body");
  const stamp = document.getElementById("mov-last-update");
  if (!tbody) return;
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4">Sin registros</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(r => {
      const id = r.id ?? "";
      const mov = r.movimiento ?? r.descripcion ?? "—";
      const fh = r.fecha_hora ? new Date(r.fecha_hora).toLocaleString() : "—";
      return `<tr>
        <td><code>${id}</code></td>
        <td>${mov}</td>
        <td>${fh}</td>
      </tr>`;
    }).join("");
  }
  if (stamp) stamp.textContent = `Actualizado: ${new Date().toLocaleTimeString()}`;
}

// =========================
// Lógica Panel de Control
// =========================
async function enviarMovimiento(idMov) {
  try {
    setStatus(CATALOGO[idMov]);
    await postMovimiento(idMov);
    showToast(`Enviado: ${CATALOGO[idMov]}`);
    await refrescarUltimo();
  } catch (e) {
    showToast(`Error: ${e.message}`);
  }
}
async function refrescarUltimo() {
  try {
    const { data } = await getUltimoMovimiento();
    if (data) {
      setStatus(data.movimiento, data.fecha_hora);
      // sincroniza el estatus también en el panel de voz
      setStatusVoz(data.movimiento, data.fecha_hora);
    }
  } catch (e) {
    // silencioso
  }
}
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-mov]").forEach(btn => {
    btn.addEventListener("click", () => enviarMovimiento(Number(btn.dataset.mov)));
  });
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
  // Mostrar panel control al inicio
  showSection("control");
  // Refrescar estatus al cargar
  refrescarUltimo();
});

// =========================
// Modal Movimientos auto-refresh
// =========================
let movInterval = null;
async function cargarMovimientos(){
  try { const { data } = await getMovimientos(20); renderMovimientos(data || []); }
  catch(e){ renderMovimientos([]); showToast(`Error al cargar movimientos: ${e.message}`); }
}
document.addEventListener("shown.bs.modal", (ev) => {
  if (ev.target.id === "movimientosModal") {
    cargarMovimientos();
    movInterval = setInterval(cargarMovimientos, 2000);
  }
});
document.addEventListener("hidden.bs.modal", (ev) => {
  if (ev.target.id === "movimientosModal") {
    if (movInterval) { clearInterval(movInterval); movInterval = null; }
  }
});

// =========================
// Navegación entre secciones
// =========================
const secControl = document.getElementById("panel-control");
const secVoz = document.getElementById("panel-voz");
document.getElementById("btnShowControl").addEventListener("click", () => showSection("control"));
document.getElementById("btnShowVoz").addEventListener("click", () => showSection("voz"));
function showSection(which){
  if (which === "voz") { secControl.style.display = "none"; secVoz.style.display = ""; }
  else { secVoz.style.display = "none"; secControl.style.display = ""; }
}

// =========================
// ---- Panel de Voz ----
// =========================
const OPENAI_MODEL = "gpt-4o-mini";
const COMMANDS = [
  { id: 1, key: "adelante" }, { id: 2, key: "atrás" }, { id: 3, key: "detener" },
  { id: 4, key: "vuelta adelante derecha" }, { id: 5, key: "vuelta adelante izquierda" },
  { id: 6, key: "vuelta atrás derecha" }, { id: 7, key: "vuelta atrás izquierda" },
  { id: 8, key: "giro 90 derecha" }, { id: 9, key: "giro 90 izquierda" },
  { id:10, key: "giro 360 derecha" }, { id:11, key: "giro 360 izquierda" },
];
const WAKE_WORD = "Alvaro";

// Cache API key (MockAPI)
let __OPENAI_KEY_CACHE = null, __OPENAI_KEY_CACHE_TIME = 0;
const KEY_TTL_MS = 30*60*1000;
async function obtenerApiKey() {
  const now = Date.now();
  if (__OPENAI_KEY_CACHE && (now - __OPENAI_KEY_CACHE_TIME) < KEY_TTL_MS) return __OPENAI_KEY_CACHE;
  const url = "https://68e538708e116898997ee557.mockapi.io/apikey";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No pude leer la API key de MockAPI (HTTP ${res.status}).`);
  const data = await res.json();
  const first = Array.isArray(data) ? data[0] : data;
  const apiKey = first?.apikey ?? first?.api_key ?? first?.key ?? first?.token ??
    (typeof first?.["api key"] !== "undefined" ? first["api key"] : undefined);
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10)
    throw new Error("No encontré un campo válido con la API key en MockAPI.");
  __OPENAI_KEY_CACHE = apiKey.trim();
  __OPENAI_KEY_CACHE_TIME = now;
  return __OPENAI_KEY_CACHE;
}

// TTS
const speak = (text) => {
  const enabled = document.getElementById("chkTTS").checked;
  if (!enabled) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-MX";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
};

// Reconocimiento
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
  el.micState.style.background = on ? "rgba(41,211,152,.18)" : "rgba(255,255,255,.06)";
  el.micState.style.color = on ? "#29d398" : "#c9d1e6";
  el.btn.textContent = on ? "🛑 Detener" : "🎙️ Iniciar";
  el.btn.disabled = false;
}
function initRecognition(){
  if (!SpeechRec){ alert("Tu navegador no soporta Web Speech API. Prueba en Chrome."); return; }
  rec = new SpeechRec();
  rec.lang = "es-MX"; rec.interimResults = true; rec.continuous = true;

  rec.onresult = async (e) => {
    const idx = e.resultIndex;
    const transcript = Array.from(e.results).slice(idx).map(r => r[0].transcript).join(" ").trim();
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
  rec.onerror = (ev) => { console.warn("Speech error:", ev.error); el.action.textContent = `Error de micrófono: ${ev.error}`; setMicState(false); };
  rec.onend = () => { if (listening) rec.start(); };
}
function normalize(s){
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\w\s]/g," ").replace(/\s+/g," ").trim();
}
function localClassify(text){
  const t = normalize(text);
  if (/\b(detener|para|alto|stop)\b/.test(t)) return {id:3, key:"detener"};
  if (/\b(adelante|avanza|frente)\b/.test(t)) return {id:1, key:"adelante"};
  if (/\b(atras|retrocede|reversa|regresa)\b/.test(t)) return {id:2, key:"atrás"};
  if (/\b(360|completo|vuelta completa)\b/.test(t) && /\bderech/.test(t)) return {id:10, key:"giro 360 derecha"};
  if (/\b(360|completo|vuelta completa)\b/.test(t) && /\bizquier/.test(t)) return {id:11, key:"giro 360 izquierda"};
  if (/\b(90|noventa)\b/.test(t) && /\bderech/.test(t)) return {id:8, key:"giro 90 derecha"};
  if (/\b(90|noventa)\b/.test(t) && /\bizquier/.test(t)) return {id:9, key:"giro 90 izquierda"};
  if (/\b(adelante|frente|avanza)\b/.test(t) && /\bderech/.test(t) && /\bvuelta\b/.test(t)) return {id:4, key:"vuelta adelante derecha"};
  if (/\b(adelante|frente|avanza)\b/.test(t) && /\bizquier/.test(t) && /\bvuelta\b/.test(t)) return {id:5, key:"vuelta adelante izquierda"};
  if (/\b(atras|reversa|retrocede)\b/.test(t) && /\bderech/.test(t) && /\bvuelta\b/.test(t)) return {id:6, key:"vuelta atrás derecha"};
  if (/\b(atras|reversa|retrocede)\b/.test(t) && /\bizquier/.test(t) && /\bvuelta\b/.test(t)) return {id:7, key:"vuelta atrás izquierda"};
  return {id:3, key:"detener"};
}
async function classifyAndAct(userText){
  el.detected.textContent = "Analizando…";
  el.action.textContent = "…";
  try{
    const apiKey = await obtenerApiKey();
    const systemPrompt = `
Eres un clasificador de órdenes de un robot. 
Responde SOLO un objeto JSON con esta forma exacta:
{"command_id": <1..11>, "command_key": "<texto>"}
Debes mapear variaciones en español a una de estas 11 claves EXACTAS:
1 "adelante" 2 "atrás" 3 "detener" 4 "vuelta adelante derecha" 5 "vuelta adelante izquierda"
6 "vuelta atrás derecha" 7 "vuelta atrás izquierda" 8 "giro 90 derecha" 9 "giro 90 izquierda"
10 "giro 360 derecha" 11 "giro 360 izquierda"
Si el usuario dice algo ajeno, devuelve {"command_id":3,"command_key":"detener"}.
`;
    const payload = {
      model: OPENAI_MODEL,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userText }],
      temperature: 0,
      response_format: { type: "json_object" }
    };
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type":"application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(payload)
    });
    if(!res.ok){ const errTxt = await res.text(); throw new Error(`OpenAI HTTP ${res.status}: ${errTxt}`); }
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.command_id !== "number") throw new Error("Respuesta sin command_id.");
    const match = COMMANDS.find(c => c.id === parsed.command_id);
    const key = match?.key || parsed.command_key || "desconocido";
    el.detected.textContent = `${parsed.command_id} — ${key}`;
    performAction(parsed.command_id, key);
  }catch(err){
    console.error("OpenAI/MockAPI error:", err);
    el.detected.textContent = "Fallo OpenAI/MockAPI, usando clasificador local.";
    const local = localClassify(userText);
    el.detected.textContent += `  → ${local.id} — ${local.key}`;
    performAction(local.id, local.key);
    el.action.textContent = `Detalle: ${String(err).slice(0,220)}…`;
  }
}
function setStatusVoz(texto, fecha = null) {
  const elText = document.getElementById("status-voz");
  const elTs = document.getElementById("timestamp-voz");
  if (elText) elText.textContent = (texto || "—").toUpperCase();
  if (elTs) elTs.textContent = fecha ? new Date(fecha).toLocaleString() : "";
}
function performAction(id, key){
  el.action.textContent = `Ejecutando: ${key}`;
  // Registrar en backend
  postMovimiento(id)
    .then(() => {
      refrescarUltimo(); // sincroniza tarjetas de estatus
      // refrescar modal si está abierto
      const modalEl = document.getElementById("movimientosModal");
      const isOpen = modalEl && modalEl.classList.contains("show");
      if (isOpen) cargarMovimientos();
      showToast(`Registrado: ${key}`);
    })
    .catch(err => {
      showToast(`No se pudo registrar: ${err.message}`);
      console.warn("Error registrando movimiento:", err);
    });

  const confirmations = {
    1:"Avanzando.", 2:"Retrocediendo.", 3:"Deteniendo.",
    4:"Adelante con giro a la derecha.", 5:"Adelante con giro a la izquierda.",
    6:"Atrás con giro a la derecha.", 7:"Atrás con giro a la izquierda.",
    8:"Giro noventa grados a la derecha.", 9:"Giro noventa grados a la izquierda.",
    10:"Giro completo a la derecha.", 11:"Giro completo a la izquierda."
  };
  speak(confirmations[id] || "Listo.");
}

// UI Voz
document.addEventListener("DOMContentLoaded", () => {
  initRecognition();
  const btn = document.getElementById("btnToggle");
  btn.addEventListener("click", () => {
    if (!rec){ alert("Tu navegador no soporta Web Speech API. Prueba en Chrome."); return; }
    btn.disabled = true;
    if (!listening){
      try { rec.start(); setMicState(true); speak("Listo. Di Fernando y tu orden."); }
      catch(e){ console.error(e); setMicState(false); }
    } else {
      try { rec.stop(); } finally { setMicState(false); }
    }
  });
});

