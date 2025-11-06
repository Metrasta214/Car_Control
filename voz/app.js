/* =============== API KEY desde MockAPI =============== */
const MOCKAPI_URL = "https://68e538708e116898997ee557.mockapi.io/apikey";
let __OPENAI_KEY_CACHE=null,__OPENAI_KEY_CACHE_TIME=0;
const KEY_TTL_MS=30*60*1000;

async function obtenerApiKey(){
  const now=Date.now();
  if(__OPENAI_KEY_CACHE && (now-__OPENAI_KEY_CACHE_TIME)<KEY_TTL_MS) return __OPENAI_KEY_CACHE;
  const r=await fetch(MOCKAPI_URL); if(!r.ok) throw new Error(`MockAPI HTTP ${r.status}`);
  const data=await r.json(); const first=Array.isArray(data)?data[0]:data;
  const k=first?.apikey ?? first?.api_key ?? first?.key ?? first?.token ?? first?.["api key"];
  if(!k || typeof k!=="string" || k.trim().length<10) throw new Error("Campo 'apikey' no encontrado o inválido.");
  __OPENAI_KEY_CACHE=k.trim(); __OPENAI_KEY_CACHE_TIME=now; return __OPENAI_KEY_CACHE;
}
function setApiState(ok,msg=""){const el=document.getElementById("apiState"); if(!el) return;
  if(ok){el.textContent="API: OK"; el.style.background="rgba(41,211,152,.18)"; el.style.color="#29d398";}
  else {el.textContent="API: ERROR"+(msg?` (${msg})`:""); el.style.background="rgba(255,93,93,.18)"; el.style.color="#ff8f8f";}}

/* =============== Catálogo (11) =============== */
const CATALOGO=[
  {id:1,dir:"Adelante",clave:"ADELANTE"},
  {id:2,dir:"Atrás",clave:"ATRAS"},
  {id:3,dir:"Detener",clave:"DETENER"},
  {id:4,dir:"Vuelta adelante derecha",clave:"V_ADE_DER"},
  {id:5,dir:"Vuelta adelante izquierda",clave:"V_ADE_IZQ"},
  {id:6,dir:"Vuelta atrás derecha",clave:"V_ATR_DER"},
  {id:7,dir:"Vuelta atrás izquierda",clave:"V_ATR_IZQ"},
  {id:8,dir:"Giro 90° derecha",clave:"G_90_DER"},
  {id:9,dir:"Giro 90° izquierda",clave:"G_90_IZQ"},
  {id:10,dir:"Giro 360° derecha",clave:"G_360_DER"},
  {id:11,dir:"Giro 360° izquierda",clave:"G_360_IZQ"},
];
const CLAVES=new Set(CATALOGO.map(c=>c.clave));
const BY_CLAVE=Object.fromEntries(CATALOGO.map(c=>[c.clave,c]));

/* =============== IA: extraer varias (JSON) =============== */
const OPENAI_MODEL="gpt-4o-mini";
async function extraerInstruccionesOpenAI(texto){
  const key=await obtenerApiKey();
  const systemPrompt=`
Devuelve TODAS las órdenes presentes (en el mismo orden) usando SOLO estas claves:
ADELANTE, ATRAS, DETENER, V_ADE_DER, V_ADE_IZQ, V_ATR_DER, V_ATR_IZQ, G_90_DER, G_90_IZQ, G_360_DER, G_360_IZQ.
Responde EXACTAMENTE:
{"items":[{"clave":"<UNA_DE_ESAS_CLAVES>"}]}
Máximo 11; si no hay, {"items":[]}.
`.trim();
  const body={model:OPENAI_MODEL,temperature:0,response_format:{type:"json_object"},
    messages:[{role:"system",content:systemPrompt},{role:"user",content:texto}]};
  const r=await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},body:JSON.stringify(body)});
  if(!r.ok) throw new Error(`OpenAI HTTP ${r.status}: ${await r.text()}`);
  const data=await r.json(); const raw=data?.choices?.[0]?.message?.content ?? "{}";
  let items=JSON.parse(raw)?.items; if(!Array.isArray(items)) items=[];
  // normaliza a catálogo y devuelve solo claves válidas
  return items.map(it=>String(it?.clave||"").trim()).filter(c=>CLAVES.has(c));
}

/* =============== Local (respaldo) =============== */
function normalize(s){return (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\w\s]/g," ").replace(/\s+/g," ").trim();}
function extraerInstruccionesLocal(texto){
  const t=normalize(texto);
  const defs=[
    ["ADELANTE",/\b(adelante|avanza|frente)\b/],
    ["ATRAS",/\b(atr(a|á)s|retrocede|reversa|regresa)\b/],
    ["DETENER",/\b(det(e|é)ner|det(e|é)nte|alto|para|stop)\b/],
    ["V_ADE_DER",/(adelante|avanza|frente).*(vuelta|gira?).*(derech)\w*/],
    ["V_ADE_IZQ",/(adelante|avanza|frente).*(vuelta|gira?).*(izquier)\w*/],
    ["V_ATR_DER",/(atr(a|á)s|retrocede|reversa|regresa).*(vuelta|gira?).*(derech)\w*/],
    ["V_ATR_IZQ",/(atr(a|á)s|retrocede|reversa|regresa).*(vuelta|gira?).*(izquier)\w*/],
    ["G_90_DER",/\b(90|noventa)\b.*\b(derech)\w*/],
    ["G_90_IZQ",/\b(90|noventa)\b.*\b(izquier)\w*/],
    ["G_360_DER",/\b(360|vuelta completa|trescientos\s*sesenta)\b.*\b(derech)\w*/],
    ["G_360_IZQ",/\b(360|vuelta completa|trescientos\s*sesenta)\b.*\b(izquier)\w*/],
  ];
  // devolvemos una vez por clave, en orden de aparición (usamos índice del primer match)
  const hits=[];
  defs.forEach(([clave,re])=>{
    const m=t.match(re);
    if(m){ // posición aproximada
      const idx=t.search(re);
      hits.push({clave,idx});
    }
  });
  return hits.sort((a,b)=>a.idx-b.idx).map(h=>h.clave);
}

/* =============== De-dup preservando orden =============== */
function uniqueInOrder(claves){
  const seen=new Set(); const out=[];
  for(const c of claves){ if(CLAVES.has(c) && !seen.has(c)){ seen.add(c); out.push(c);} }
  return out.slice(0,11);
}

/* =============== Reconocimiento + Wake Word =============== */
const SpeechRec=window.SpeechRecognition||window.webkitSpeechRecognition;
const el={
  micState:document.getElementById("micState"),
  lastHeard:document.getElementById("lastHeard"),
  detected:document.getElementById("detected"),
  micAnim:document.getElementById("micAnim"),
  micModal:document.getElementById("micModal"),
  btnAllow:document.getElementById("btnAllow"),
  btnReset:document.getElementById("btnReset"),
};
let rec=null,wakeActive=false,silenceTimer=null,sessionId=0;
const SILENCE_MS=2000;

// historial persistente hasta Reiniciar
let detectedHistory=[];
function renderDetected(){ el.detected.style.whiteSpace="pre-wrap";
  el.detected.textContent = detectedHistory.length ? detectedHistory.map((s,i)=>`${i+1}. ${s}`).join("\n") : "—"; }
function setMicState(on){ el.micState.textContent=on?"Mic ON":"Mic OFF";
  el.micState.style.background=on?"rgba(41,211,152,.18)":"rgba(255,255,255,.06)"; el.micState.style.color=on?"#29d398":"#c9d1e6";}
function setAnim(on){ el.micAnim.classList.toggle("on",!!on); }
function normalizeWake(s){ return normalize(s).includes("alvaro"); }
function stripWake(s){ return (s||"").replace(/álvaro/gi,"").replace(/alvaro/gi,"").trim(); }

async function processFinalTranscript(txt){
  const clean=stripWake(txt); if(!clean) return;
  el.lastHeard.textContent=clean;

  // IA + Local -> fusionar y de-dup preservando orden
  let claves=[];
  try { const ai=await extraerInstruccionesOpenAI(clean); claves.push(...ai); } catch {}
  const loc=extraerInstruccionesLocal(clean); claves.push(...loc);
  claves=uniqueInOrder(claves);               // <- sin duplicados, ordenado, máx 11

  // acumular en historial
  detectedHistory.push(...claves);
  renderDetected();
}

function initRecognition(){
  if(!SpeechRec){ alert("Tu navegador no soporta Web Speech API. Usa Chrome."); return; }
  const mySession=sessionId;
  rec=new SpeechRec(); rec.lang="es-MX"; rec.interimResults=true; rec.continuous=true;

  rec.onstart=()=>{ if(mySession===sessionId) setMicState(true); };
  rec.onend=()=>{ if(mySession!==sessionId) return; setMicState(false); try{rec.start();}catch{} };

  rec.onresult=async (e)=>{
    if(mySession!==sessionId) return;
    const transcript=Array.from(e.results).map(r=>r[0].transcript).join(" ").trim();
    if(!transcript) return;

    // wake word
    if(!wakeActive && normalizeWake(transcript)){ wakeActive=true; setAnim(true); if(silenceTimer) clearTimeout(silenceTimer); return; }

    // solo procesar finales cuando ya está activo
    const isFinal=Array.from(e.results).pop().isFinal;
    if(wakeActive && isFinal){
      await processFinalTranscript(transcript);
      if(silenceTimer) clearTimeout(silenceTimer);
      silenceTimer=setTimeout(()=>{ if(mySession!==sessionId) return; wakeActive=false; setAnim(false); },SILENCE_MS);
    }
  };

  rec.onerror=(ev)=>{ if(mySession!==sessionId) return; console.warn("Mic error:",ev.error); el.micState.textContent="Error de micrófono"; };
}

/* =============== Reinicio TOTAL (cero real) =============== */
function resetAll(){
  sessionId++;
  try{ if(rec){ rec.onresult=null; rec.onerror=null; rec.onend=null; try{rec.stop();}catch{} try{rec.abort&&rec.abort();}catch{} } }catch{}
  rec=null; wakeActive=false;
  if(silenceTimer){ clearTimeout(silenceTimer); silenceTimer=null; }
  setAnim(false); setMicState(false);
  document.getElementById("lastHeard").textContent="—";
  detectedHistory=[]; renderDetected();
  initRecognition(); try{rec&&rec.start();}catch{}
}

/* =============== Boot =============== */
document.addEventListener("DOMContentLoaded", async ()=>{
  try{ await obtenerApiKey(); setApiState(true); }catch(e){ setApiState(false,e.message||"Sin MockAPI"); }
  renderDetected();
  document.getElementById("micModal").classList.add("show");
  document.getElementById("btnAllow").addEventListener("click",()=>{ document.getElementById("micModal").classList.remove("show"); resetAll(); });
  document.getElementById("btnReset").addEventListener("click", resetAll);
});

// === MONITOREO DE MOVIMIENTOS (compartido con Controles) ===
const API_BASE = "http://34.234.40.49:5500/api"; // cambia por tu IP o dominio

const MONITOR_MS = 2000;
let monitorTimer = null;

async function updateMonitorOnce() {
  try {
    const res = await fetch(`${API_BASE}/movimientos/ultimos?n=10`);
    const data = await res.json();
    const rows = data?.data ?? [];
    renderTablaMovs(rows);
    document.getElementById("monitor-foot").textContent = `Actualizado: ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    console.error("Error al actualizar monitoreo:", e);
  }
}

function renderTablaMovs(rows) {
  const tbody = document.getElementById("tabla-movs");
  if (!tbody) return;
  if (!rows?.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">Sin datos</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${r.id}</td>
        <td>${r.movimiento}</td>
        <td>${r.fecha_hora}</td>
      </tr>`
    )
    .join("");
}

function startMonitor() {
  if (monitorTimer) return;
  updateMonitorOnce();
  monitorTimer = setInterval(updateMonitorOnce, MONITOR_MS);
  const btn = document.getElementById("btn-monitor-toggle");
  btn.classList.replace("btn-outline-primary", "btn-primary");
  btn.textContent = "Detener";
  btn.dataset.active = "1";
}

function stopMonitor() {
  clearInterval(monitorTimer);
  monitorTimer = null;
  const btn = document.getElementById("btn-monitor-toggle");
  btn.classList.replace("btn-primary", "btn-outline-primary");
  btn.textContent = "Auto (2s)";
  btn.dataset.active = "0";
}

document.addEventListener("DOMContentLoaded", () => {
  const btnAuto = document.getElementById("btn-monitor-toggle");
  const btnOnce = document.getElementById("btn-monitor-once");
  if (btnAuto && btnOnce) {
    btnOnce.addEventListener("click", updateMonitorOnce);
    btnAuto.addEventListener("click", (e) =>
      e.target.dataset.active === "1" ? stopMonitor() : startMonitor()
    );
  }
});


