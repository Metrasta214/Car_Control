// === CONFIGURACIÓN ===
const API_BASE = "https://310f84bbc7e4.ngrok-free.app/api"; // Cambia si tu URL de ngrok cambia

// === CATÁLOGO LOCAL ===
const CATALOGO = {
  1: "Adelante",
  2: "Atrás",
  3: "Detener",
  4: "Vuelta adelante derecha",
  5: "Vuelta adelante izquierda",
  6: "Vuelta atrás derecha",
  7: "Vuelta atrás izquierda",
  8: "Giro 90° derecha",
  9: "Giro 90° izquierda",
  10: "Giro 360° derecha",
  11: "Giro 360° izquierda",
};

// === ELEMENTOS UI ===
const statusEl = document.getElementById("status");
const tsEl = document.getElementById("timestamp");
const toastEl = document.getElementById("toast");
const toastMsg = document.getElementById("toast-msg");
const toast = new bootstrap.Toast(toastEl, { delay: 2500 });

function showToast(msg) {
  toastMsg.textContent = msg;
  toast.show();
}

function setStatus(texto, fecha = null) {
  statusEl.textContent = (texto || "—").toUpperCase();
  tsEl.textContent = fecha ? new Date(fecha).toLocaleString() : "";
}

// === API ===
async function postMovimiento(id_movimiento) {
  const url = `${API_BASE}/movimientos`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    mode: "cors",
    body: JSON.stringify({ id_movimiento }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${url} → ${res.status} ${text}`);
  }
  return res.json();
}

async function getUltimoMovimiento() {
  const url = `${API_BASE}/movimientos/ultimo`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
    mode: "cors",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${url} → ${res.status} ${text}`);
  }
  return res.json();
}

// === CONTROLADORES ===
async function enviarMovimiento(idMov) {
  try {
    setStatus(CATALOGO[idMov]);
    await postMovimiento(idMov);
    showToast(`Enviado: ${CATALOGO[idMov]}`);
    await refrescarUltimo();
  } catch (e) {
    console.error("❌ Error al enviar:", e);
    showToast(`Error: ${e.message}`);
  }
}

async function refrescarUltimo() {
  try {
    const { data } = await getUltimoMovimiento();
    if (data) setStatus(data.movimiento, data.fecha_hora);
  } catch (e) {
    console.warn("⚠️ Error al actualizar:", e);
    showToast(`No se pudo consultar: ${e.message}`);
  }
}

// === EVENTOS ===
document.querySelectorAll("[data-mov]").forEach(btn => {
  btn.addEventListener("click", () => enviarMovimiento(Number(btn.dataset.mov)));
});

// === ATAJOS DE TECLADO ===
document.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  const map = {
    w: 1, s: 2, " ": 3,
    e: 4, q: 5,
    c: 6, z: 7,
    d: 8, a: 9,
    x: 10, y: 11,
  };
  if (map[k]) enviarMovimiento(map[k]);
});

// === MONITOREO AUTOMÁTICO ===
const MONITOR_MS = 2000;
let monitorTimer = null;

async function updateMonitorOnce() {
  try {
    const url = `${API_BASE}/movimientos/ultimos?n=10`;
    const res = await fetch(url, { headers: { "Accept": "application/json" }, mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rows = data?.data ?? [];
    renderTablaMovs(rows);
    await refrescarUltimo();
    document.getElementById("monitor-foot").textContent =
      `Actualizado: ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    console.error("⚠️ Error monitor:", e);
    showToast(`Error: ${e.message}`);
  }
}

function renderTablaMovs(rows) {
  const tbody = document.getElementById("tabla-movs");
  if (!rows?.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">Sin datos</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.id ?? "-"}</td>
      <td>${r.movimiento ?? "—"}</td>
      <td>${r.fecha_hora ? new Date(r.fecha_hora).toLocaleString() : "—"}</td>
    </tr>
  `).join("");
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

// === INICIO ===
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-monitor-once").addEventListener("click", updateMonitorOnce);
  document.getElementById("btn-monitor-toggle").addEventListener("click", e => {
    e.target.dataset.active === "1" ? stopMonitor() : startMonitor();
  });
  refrescarUltimo();
});








