import { SHARE_URL, SHARE_TITLE, SHARE_TEXT, shareLinks } from '/share-data.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const header = document.querySelector('.topbar');
if (header) {
  const trigger = element('button', 'today-button share-trigger', 'Compartilhar');
  trigger.type = 'button';
  trigger.setAttribute('aria-label', 'Compartilhar app');
  trigger.setAttribute('aria-haspopup', 'dialog');
  header.append(trigger);

  const dialog = element('dialog', 'share-dialog');
  dialog.setAttribute('aria-labelledby', 'share-title');
  dialog.setAttribute('aria-describedby', 'share-description');
  const heading = element('div', 'share-heading');
  const title = element('h2', '', 'Um espaço bom de compartilhar.');
  title.id = 'share-title';
  const close = element('button', 'share-close', '×');
  close.type = 'button'; close.setAttribute('aria-label', 'Fechar compartilhamento');
  heading.append(title, close);
  const description = element('p', 'share-description', 'Convide alguém para conhecer o Entre dias. Escolha onde deseja compartilhar o link de instalação.');
  description.id = 'share-description';
  const native = element('button', 'primary-button share-native', 'Compartilhar em outros aplicativos ↗');
  native.type = 'button'; native.hidden = typeof navigator.share !== 'function';
  const options = element('div', 'share-options');
  for (const item of shareLinks()) {
    const link = element('a', 'share-option');
    link.href = item.href;
    if (item.href.startsWith('https:')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    link.append(element('span', `share-symbol ${item.style}`, item.symbol), element('span', '', item.name));
    options.append(link);
  }
  const copyLabel = element('label', 'share-link-label', 'Link do aplicativo');
  copyLabel.htmlFor = 'share-link';
  const linkRow = element('div', 'share-link-row');
  const input = element('input', 'share-link');
  input.id = 'share-link'; input.value = SHARE_URL; input.readOnly = true; input.type = 'url';
  const copy = element('button', 'today-button share-copy', 'Copiar link');
  copy.type = 'button'; linkRow.append(input, copy);
  const status = element('p', 'share-status');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const privacy = element('p', 'share-privacy', 'Somente o link do app é compartilhado. Suas avaliações e resenhas continuam neste dispositivo.');
  dialog.append(heading, description, native, options, copyLabel, linkRow, status, privacy);
  document.body.append(dialog);

  trigger.addEventListener('click', () => { status.textContent = ''; dialog.showModal(); });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => trigger.focus({ preventScroll: true }));
  native.addEventListener('click', async () => {
    try {
      await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL });
      dialog.close();
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? 'Compartilhamento cancelado.' : 'Não foi possível abrir os aplicativos. Use uma opção abaixo ou copie o link.';
    }
  });
  copy.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(SHARE_URL);
      status.textContent = 'Link copiado! Cole onde quiser compartilhar.';
    } catch {
      input.focus(); input.select(); input.setSelectionRange(0, input.value.length);
      status.textContent = 'Selecione e copie o link acima para compartilhar.';
    }
  });
}
