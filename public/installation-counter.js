let pending = false;
export async function countInstallation(installed) {
  if (!installed || pending || !navigator.onLine || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;
  pending = true;
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
  try {
    if(localStorage.getItem('entre-dias-install-counted') === 'yes') return;
    let token = localStorage.getItem('entre-dias-install-token');
    if(!token) { token = [...crypto.getRandomValues(new Uint8Array(32))].map(byte=>byte.toString(16).padStart(2,'0')).join(''); localStorage.setItem('entre-dias-install-token', token); }
    const response = await fetch('/api/installations', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token}), signal:controller.signal });
    if(response.ok) localStorage.setItem('entre-dias-install-counted','yes');
  } catch { /* Retry on next installed opening or online event; diary stays available. */ }
  finally { clearTimeout(timer); pending = false; }
}
export async function showInstallationCount() {
  const target = document.querySelector('#installation-total'); if(!target) return;
  try {
    const response = await fetch('/api/installations', {cache:'no-store'});
    if(!response.ok) throw new Error(); const data = await response.json();
    target.textContent = Number(data.total).toLocaleString(document.documentElement.lang || 'pt-BR');
  } catch { target.textContent = '—'; }
}
