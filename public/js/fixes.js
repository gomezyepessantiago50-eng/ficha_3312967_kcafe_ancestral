/* ═══════════════════════════════════════════════════
   KAFE ANCESTRAL — fixes.js
   Cargar DESPUÉS de api.js y app.js
═══════════════════════════════════════════════════ */

/* ── Auth.user() → Auth.getUser() ───────────────── */
if (typeof Auth !== 'undefined' && !Auth.user) {
  Auth.user = () => Auth.getUser();
}

/* ── buildCalLight → buildCal ───────────────────── */
window.buildCalLight = function(id, y, m, reserved = [], blocked = []) {
  buildCal(id, y, m, reserved, blocked, null);
};

/* ── regCal para los calendarios de admin/cliente ── */
/* ya está en app.js pero registramos los defaults */
window.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  regCal('dash-cal',  now.getFullYear(), now.getMonth(), () => refreshDashCal?.());
  regCal('admin-cal', now.getFullYear(), now.getMonth(), () => refreshAdminCal?.());
  regCal('cli-cal',   now.getFullYear(), now.getMonth(), () => refreshCal?.());
});
