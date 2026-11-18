import '/share.js';

export function isInstalled() {
  return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: minimal-ui)').matches || navigator.standalone === true;
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
    button.textContent = isInstalled() ? 'Abrir meu diário ↗' : ios ? 'Instalar no iPhone ↗' : installPrompt ? 'Instalar no celular ↗' : 'Instalar o app ↗';
  });
}
function showHelp(message) {
  const status = document.querySelector('#install-status');
  if (status) status.textContent = message;
  document.querySelector('#como-instalar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function showIphoneInstall() {
  let dialog = document.querySelector('#iphone-install');
  if (!dialog) {
    dialog = document.createElement('dialog'); dialog.id = 'iphone-install'; dialog.className = 'iphone-install';
    const title = document.createElement('h2'); title.id = 'iphone-install-title'; title.textContent = 'Instalar no iPhone';
    dialog.setAttribute('aria-labelledby', title.id);
    const intro = document.createElement('p'); intro.textContent = 'O iPhone confirma a instalação pelo menu do Safari. Siga estes passos:';
    const list = document.createElement('ol');
    for (const text of ['Abra entredias.online no Safari. Se estiver no Instagram ou WhatsApp, use Abrir no navegador.', 'Toque em Compartilhar (quadrado com seta para cima). Em algumas versões, abra primeiro o menu do Safari.', 'Role as ações e escolha Adicionar à Tela de Início. Se não aparecer, use Editar Ações para localizar essa opção.', 'Ative Abrir como App, se aparecer, e toque em Adicionar.', 'Volte à tela inicial do iPhone e abra o ícone Entre dias. É por ele que você usa o diário e ativa os lembretes.']) { const item = document.createElement('li'); item.textContent = text; list.append(item); }
    const note = document.createElement('p'); note.textContent = 'Mantenha a conexão até aparecer “App preparado para uso offline”. Para notificações, use iOS 16.4 ou mais recente.';
    const close = document.createElement('button'); close.className = 'landing-button'; close.textContent = 'Entendi, vou adicionar pelo Safari'; close.addEventListener('click', () => dialog.close());
    dialog.append(title, intro, list, note, close); document.body.append(dialog);
  }
  dialog.showModal();
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
  if (ios) { showIphoneInstall(); return; }
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
  let interacted = false;
  let refreshing = false;
  let hadController = Boolean(navigator.serviceWorker.controller);
  document.addEventListener('input', () => { interacted = true; }, true);
  document.addEventListener('change', () => { interacted = true; }, true);
  document.addEventListener('click', event => { if (event.target.closest('form, #new-assessment')) interacted = true; }, true);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }
    if (refreshing) return;
    if (!interacted) { refreshing = true; location.reload(); return; }
    if (document.querySelector('#app-update-notice')) return;
    const notice = document.createElement('aside'); notice.id = 'app-update-notice';
    notice.setAttribute('role', 'status');
    Object.assign(notice.style, { position: 'fixed', bottom: '90px', left: '12px', right: '12px', zIndex: '10000', padding: '16px', background: '#fff', color: '#243b26', border: '2px solid #435d3b', borderRadius: '16px', boxShadow: '0 4px 24px #0003' });
    const message = document.createElement('p'); message.textContent = 'Nova versão pronta. Salve o que estiver preenchendo antes de atualizar.';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'today-button'; button.textContent = 'Atualizar agora';
    button.addEventListener('click', () => { if (confirm('Já salvou suas alterações? Atualizar recarrega esta tela.')) location.reload(); });
    notice.append(message, button); document.body.append(notice);
  });
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(async registration => {
    const checkUpdate = () => { if (navigator.onLine) registration.update().catch(() => {}); };
    checkUpdate();
    window.addEventListener('online', checkUpdate);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
    setInterval(() => { if (document.visibilityState === 'visible') checkUpdate(); }, 5 * 60 * 1000);
    await navigator.serviceWorker.ready;
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
