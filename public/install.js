import '/share.js';

export function isInstalled() {
  return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
}

export async function requireInstalled() {
  const development = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (isInstalled() || development) return;
  location.replace('/?instalar=1');
  await new Promise(() => {});
}

let installPrompt;
let offlineReady = false;
const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function syncInstallButtons() {
  document.querySelectorAll('[data-install]').forEach(button => {
    button.textContent = isInstalled() ? 'Abrir meu diário ↗' : installPrompt ? 'Instalar no celular ↗' : 'Instalar o app ↗';
  });
}
function showHelp(message) {
  const status = document.querySelector('#install-status');
  if (status) status.textContent = message;
  document.querySelector('#como-instalar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event; syncInstallButtons();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null; syncInstallButtons();
  const status = document.querySelector('#install-status');
  if (status) status.textContent = 'Instalado! Abra o Entre dias pelo ícone na tela inicial do seu celular.';
});
document.querySelectorAll('[data-install]').forEach(button => button.addEventListener('click', async () => {
  if (isInstalled()) { location.assign('/app'); return; }
  if (installPrompt) {
    const prompt = installPrompt; installPrompt = null;
    await prompt.prompt();
    const result = await prompt.userChoice;
    syncInstallButtons();
    if (result.outcome === 'accepted') showHelp('Instalação solicitada. Quando terminar, abra o ícone Entre dias na tela inicial.');
    else showHelp('Você pode instalar depois, por este botão ou pelo menu do navegador.');
    return;
  }
  showHelp(ios ? 'No iPhone: abra este endereço no Safari, toque em Compartilhar e em Adicionar à Tela de Início. Ative Abrir como App, se aparecer, e confirme em Adicionar.' : 'No Android: abra este endereço no Chrome, toque no menu ⋮ e procure Instalar app ou Adicionar à tela inicial. Se estiver dentro do Instagram ou WhatsApp, abra primeiro no navegador.');
}));
syncInstallButtons();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(async () => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    offlineReady = Boolean(worker);
    const status = document.querySelector('#offline-status');
    if (status) status.textContent = offlineReady ? 'App preparado para uso offline neste dispositivo.' : 'Preparando o app para funcionar offline…';
  }).catch(() => {
    const status = document.querySelector('#offline-status');
    if (status) status.textContent = 'Não foi possível preparar o modo offline. Confira a conexão e recarregue a página.';
  });
}
if (new URLSearchParams(location.search).has('instalar')) showHelp('Para registrar seus sentimentos, instale o app e abra pelo ícone na tela inicial.');

const connectionStatus = document.querySelector('#connection-status');
function connectivity() { if (connectionStatus) connectionStatus.textContent = navigator.onLine ? 'Dados salvos só neste dispositivo' : 'Offline · seu diário continua disponível'; }
window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity); connectivity();
