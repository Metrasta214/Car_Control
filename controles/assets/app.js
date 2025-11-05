// === Config ===
const API_BASE = "https://f8c37c894646.ngrok-free.app"; // Cambia si usas otra IP o puerto

// Catálogo local
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

// === UI ===
const statusEl = document.getElementById("status");
const tsEl = document.getElementById("timestamp");
const toastEl = document.getElementById("toast");
const toastMsg = document.getElementById("toast-msg");
const toast = new bootstrap.Toast(toastEl, { delay: 2000 });

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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_movimiento }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getUltimoMovimiento() {
  const res = await fetch(`${API_BASE}/movimientos/ultimo`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// === Controladores ===
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
    if (data) setStatus(data.movimiento, data.fecha_hora);
  } catch (e) {
    showToast(`No se pudo consultar: ${e.message}`);
  }
}

// === Eventos ===
document.querySelectorAll("[data-mov]").forEach(btn =>
  btn.addEventListener("click", () => enviarMovimiento(Number(btn.dataset.mov)))
);

// === Teclado ===
document.addEventListener("keydown", e => {
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

// === Monitoreo ===
const MONITOR_MS = 2000;
let monitorTimer = null;

async function updateMonitorOnce() {
  try {
    const res = await fetch(`${API_BASE}/movimientos/ultimos?n=10`);
    const data = await res.json();
    const rows = data?.data ?? [];
    renderTablaMovs(rows);
    await refrescarUltimo();
    document.getElementById("monitor-foot").textContent = `Actualizado: ${new Date().toLocaleTimeString()}`;
  } catch (e) {
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
      <td>${r.id}</td>
      <td>${r.movimiento}</td>
      <td>${r.fecha_hora}</td>
    </tr>`).join("");
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

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-monitor-once").addEventListener("click", updateMonitorOnce);
  document.getElementById("btn-monitor-toggle").addEventListener("click", e => {
    e.target.dataset.active === "1" ? stopMonitor() : startMonitor();
  });
  refrescarUltimo();
});



