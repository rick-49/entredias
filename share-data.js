export const SHARE_URL = 'https://entredias.online/';
export const SHARE_TITLE = 'Entre dias — Diário de humor';
export const SHARE_TEXT = 'Conheça o Entre dias: um diário de humor gratuito que funciona offline e salva seus registros só no seu dispositivo. Instale no celular:';

export function shareLinks() {
  const message = `${SHARE_TEXT} ${SHARE_URL}`;
  return [
    { name: 'WhatsApp', symbol: 'W', style: 'whatsapp', href: `https://wa.me/?text=${encodeURIComponent(message)}` },
    { name: 'Telegram', symbol: '↗', style: 'telegram', href: `https://t.me/share/url?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent(SHARE_TEXT)}` },
    { name: 'Facebook', symbol: 'f', style: 'facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}` },
    { name: 'E-mail', symbol: '✉', style: 'email', href: `mailto:?subject=${encodeURIComponent(SHARE_TITLE)}&body=${encodeURIComponent(message)}` },
  ];
}
