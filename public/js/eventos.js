/* ═══════════════════════════════════════════
   KAFE ANCESTRAL — Global Event Handlers
═══════════════════════════════════════════ */

/* Keyboard close modal */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open'));
  }
});

/* Auto-hide alerts after 5s */
function autoHideAlert(id, ms = 5000) {
  const el = document.getElementById(id);
  if (el) setTimeout(() => { el.innerHTML = ''; }, ms);
}

/* Confirm dialog helper */
function confirmAction(msg, onConfirm) {
  if (window.confirm(msg)) onConfirm();
}

/* Format input as date min = today */
function setDateMin(ids) {
  const today = new Date().toISOString().split('T')[0];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.min = today; });
}

/* Sync end date min with start date */
function syncDateRange(startId, endId) {
  const start = document.getElementById(startId);
  const end   = document.getElementById(endId);
  if (!start || !end) return;
  start.addEventListener('change', () => {
    if (start.value) end.min = start.value;
    if (end.value && end.value <= start.value) end.value = '';
  });
}
