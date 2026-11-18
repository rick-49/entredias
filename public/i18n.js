import { translations } from './translations.js';
export const supportedLanguages = ['pt-BR', 'en', 'es'];
let language = 'pt-BR';
try { const saved = localStorage.getItem('entre-dias-language'); if (supportedLanguages.includes(saved)) language = saved; } catch {}
export const locale = () => language;
const patterns = [
  [/^(\d+) instalações$/, '$1 installations', '$1 instalaciones'],
  [/^(\d+) de 7 dias$/, '$1 of 7 days', '$1 de 7 días'],
  [/^(\d+) aval\.$/, '$1 check-ins', '$1 registros'],
  [/^(\d+) avaliações?$/, '$1 check-ins', '$1 registros'],
  [/^(\d+) avaliações? nesta semana$/, '$1 check-ins this week', '$1 registros esta semana'],
  [/^(\d+) neutros$/, '$1 neutral', '$1 neutros'],
  [/^Página (\d+) de (\d+)$/, 'Page $1 of $2', 'Página $1 de $2'],
  [/^Dia (\d+)$/, 'Day $1', 'Día $1'],
  [/^Dias (\d+)–(\d+)$/, 'Days $1–$2', 'Días $1–$2'],
  [/^Dia (\d+) do esquema\.$/, 'Schedule day $1.', 'Día $1 del esquema.'],
  [/^(\d+) registros?$/, '$1 records', '$1 registros'],
  [/^(\d+)% dos (\d+) dias do período$/, '$1% of the $2 days in this period', '$1% de los $2 días del período'],
  [/^(\d+) humores? de I a III; neutros não entram na frequência$/, '$1 moods from I to III; neutral levels are excluded', '$1 estados de I a III; se excluyen los neutros'],
  [/^(\d+) de (\d+) seleções com intensidade intensa$/, '$1 of $2 selections at intense level', '$1 de $2 selecciones de intensidad intensa'],
  [/^Referência de (.+)$/, 'Reference for $1', 'Referencia del $1'],
  [/^Lembrete configurado para (.+)\.$/, 'Reminder set for $1.', 'Recordatorio configurado para las $1.'],
  [/^Lembrete ativado para (.+), no fuso deste aparelho\.$/, 'Reminder enabled for $1 in this device’s time zone.', 'Recordatorio activado a las $1 en la zona horaria de este dispositivo.'],
  [/^PDF preparado com as resenhas\. Revise antes de compartilhar com seu profissional\.$/, 'PDF prepared with notes. Review before sharing with your professional.', 'PDF preparado con notas. Revísalo antes de compartirlo con tu profesional.'],
  [/^PDF preparado sem as resenhas\. Revise antes de compartilhar com seu profissional\.$/, 'PDF prepared without notes. Review before sharing with your professional.', 'PDF preparado sin notas. Revísalo antes de compartirlo con tu profesional.'],
  [/^(\d+) avaliações restauradas\. (\d+) já existiam e foram mantidas\.$/, '$1 check-ins restored. $2 already existed and were kept.', '$1 registros restaurados. $2 ya existían y se conservaron.'],
  [/^(\d+) observações enviadas\. As próximas avaliações elegíveis serão sincronizadas ao salvar\.$/, '$1 observations sent. Future eligible check-ins will sync when saved.', '$1 observaciones enviadas. Los próximos registros elegibles se sincronizarán al guardar.'],
  [/^(\d+) grupos disponíveis · (.+) · mínimo de (\d+) instalações por grupo\.$/, '$1 available groups · $2 · minimum $3 installations per group.', '$1 grupos disponibles · $2 · mínimo de $3 instalaciones por grupo.'],
  [/^(.+) · (\d+) observações · (\d+) dias com dados$/, '$1 · $2 observations · $3 days with data', '$1 · $2 observaciones · $3 días con datos'],
  [/^(\d+) observações$/, '$1 observations', '$1 observaciones'],
  [/^(\d+) avaliações? com cada humor$/, '$1 check-ins with each mood', '$1 registros con cada estado'],
  [/^(\d+) humores$/, '$1 moods', '$1 estados'],
  [/^Avaliação das (.+) salva neste dispositivo\.$/, 'Check-in at $1 saved on this device.', 'Registro de las $1 guardado en este dispositivo.'],
  [/^(.+), (\d+) avaliações$/, '$1, $2 check-ins', '$1, $2 registros'],
  [/^(.+), (\d+) avaliações, hoje$/, '$1, $2 check-ins, today', '$1, $2 registros, hoy'],
];
export function translate(value, lang = language) {
  if (typeof value !== 'string' || lang === 'pt-BR' || !supportedLanguages.includes(lang)) return value;
  const index = lang === 'en' ? 0 : 1;
  const text = value.replace(/\s+/g, ' ').trim();
  const direct = translations[text];
  if (direct) return value.replace(value.trim(), direct[index]);
  const moodLabel = text.match(/^(.+) (Neutro|I{1,3}): (Não estou sentindo|Leve|Moderada|Intensa)$/);
  if(moodLabel) return `${translate(moodLabel[1],lang)} ${translate(moodLabel[2],lang)}: ${translate(moodLabel[3],lang)}`;
  const range = text.match(/^(.+?) a (.+?) · (Análise dos registros salvos\.|Nenhum registro neste período\. Experimente outro intervalo ou comece pelo diário\.)$/);
  if(range) return `${range[1]} – ${range[2]} · ${translate(range[3],lang)}`;
  const reference = text.match(/^Qual a intensidade de (.+) para usar nos intervalos sem avaliação\? Isso preenche lacunas como estimativa, sem mudar os sentimentos que você registrou\.$/);
  if(reference) { const name = Object.keys(translations).find(key => key.toLocaleLowerCase('pt-BR') === reference[1]); const mood = translate(name || reference[1],lang); return index === 0 ? `What intensity of ${mood} should be used for gaps without check-ins? Gaps are estimates and do not change your recorded feelings.` : `¿Qué intensidad de ${mood} debe usarse en los intervalos sin registros? Son estimaciones y no cambian los sentimientos registrados.`; }
  const reflection = text.match(/^Você fez (\d+) avaliações? em (\d+) dias?\. Observe como os sentimentos mudaram entre os horários e releia as resenhas de cada momento\. Avaliações com todos os humores neutros também fazem parte desse histórico\.$/);
  if(reflection) return index === 0 ? `You recorded ${reflection[1]} check-ins over ${reflection[2]} days. Notice changes across times and review your notes. Check-ins with all moods neutral are also included.` : `Hiciste ${reflection[1]} registros en ${reflection[2]} días. Observa los cambios entre horarios y revisa tus notas. También se incluyen registros con todos los estados neutros.`;
  const decorated = text.match(/^([↻＋✓▦◴←]\s*)?(.+?)(\s*[↗→])?$/);
  if (decorated && translations[decorated[2]]) return `${decorated[1] || ''}${translations[decorated[2]][index]}${decorated[3] || ''}`;
  for (const [pattern, en, es] of patterns) if (pattern.test(text)) return text.replace(pattern, index === 0 ? en : es);
  const level = text.match(/^(.+) (I{1,3}|Neutro)$/);
  if (level && translations[level[1]]) return `${translations[level[1]][index]} ${translate(level[2],lang)}`;
  const title = text.match(/^(.*?) · Entre dias$/);
  if (title) return `${translate(title[1],lang)} · Entre dias`;
  return value;
}
export function setLanguage(value) {
  if (!supportedLanguages.includes(value)) return false;
  language = value;
  try { localStorage.setItem('entre-dias-language', value); } catch {}
  if (typeof document !== 'undefined') { applyLanguage(); window.dispatchEvent(new CustomEvent('languagechange')); }
  return true;
}
const originals = new WeakMap();
const excluded = 'script,style,textarea,[data-no-translate],.assessment-note,.history-note,.medication-card h3,#intake-medication,#intake-list,#contribution-preview,.bi-compare strong,#community-medication,#community-rows td:first-child';
let observer;
function replaceText(node) {
  if (!node.parentElement || node.parentElement.closest(excluded)) return;
  const previous = originals.get(node);
  const source = previous && node.nodeValue === previous.output ? previous.source : node.nodeValue;
  const output = translate(source);
  if (node.nodeValue !== output) node.nodeValue = output;
  originals.set(node, { source, output });
}
export function applyLanguage() {
  if (typeof document === 'undefined') return;
  observer?.disconnect();
  document.documentElement.lang = language;
  // Freeze implicit option values before translating their labels.
  document.querySelectorAll('option:not([value])').forEach(option => option.setAttribute('value', option.value));
  const walk = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) replaceText(walk.currentNode);
  for (const element of document.querySelectorAll('[placeholder],[aria-label],[title]')) {
    if (element.closest(excluded) || element.matches('#med-name option')) continue;
    for (const attr of ['placeholder','aria-label','title']) {
      const node = element.getAttributeNode(attr); if (!node) continue;
      const previous = originals.get(node), source = previous && node.value === previous.output ? previous.source : node.value;
      const output = translate(source); if(node.value !== output) node.value = output; originals.set(node,{source,output});
    }
  }
  document.querySelectorAll('[data-language-select]').forEach(select => { select.value = language; });
  observer?.observe(document.documentElement, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['aria-label','placeholder','title'] });
}
if (typeof document !== 'undefined') {
  const start = () => {
    let queued = false;
    observer = new MutationObserver(() => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; applyLanguage(); }); });
    document.querySelectorAll('[data-language-select]').forEach(select => select.addEventListener('change', () => setLanguage(select.value)));
    applyLanguage();
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
  window.addEventListener('storage', event => { if(event.key === 'entre-dias-language') setLanguage(event.newValue || 'pt-BR'); });
}
