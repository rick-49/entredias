import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHARE_URL, SHARE_TEXT, shareLinks } from '../share-data.js';

test('compartilhamento envia somente o endereço público e a apresentação do app', () => {
  assert.equal(SHARE_URL, 'https://entredias.online/');
  const links = shareLinks();
  assert.deepEqual(links.map(link => link.name), ['WhatsApp', 'Telegram', 'Facebook', 'E-mail']);
  const whatsapp = new URL(links[0].href);
  assert.equal(whatsapp.searchParams.get('text'), `${SHARE_TEXT} ${SHARE_URL}`);
  const telegram = new URL(links[1].href);
  assert.equal(telegram.searchParams.get('url'), SHARE_URL);
  assert.equal(telegram.searchParams.get('text'), SHARE_TEXT);
  assert.equal(new URL(links[2].href).searchParams.get('u'), SHARE_URL);
  assert.equal(new URL(links[3].href).searchParams.get('body'), `${SHARE_TEXT} ${SHARE_URL}`);
  for (const link of links) assert.ok(!link.href.includes('assessment='));
});
