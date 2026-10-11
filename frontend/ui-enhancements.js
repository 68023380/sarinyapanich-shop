// ลูกเล่นกลางที่ไม่แตะ business logic ของแต่ละหน้า
function showNeoToast(title, message = '') {
  document.querySelectorAll('.neo-toast').forEach(item => item.remove());
  const toast = document.createElement('div');
  toast.className = 'neo-toast';
  toast.innerHTML = `<strong>${escapeNeoText(title)}</strong><span>${escapeNeoText(message)}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function escapeNeoText(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function markBackendReady(isReady = true) {
  const target = document.querySelector('[data-backend-status]');
  if (!target) return;
  target.innerHTML = `<span class="neo-status-dot"></span>${isReady ? 'ระบบออนไลน์' : 'กำลังเชื่อมต่อ'}`;
}
