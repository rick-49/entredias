import { MOODS } from '/shared.js';
import { getSetting, setSetting } from '/local-data.js';

export async function askDailyReference(date, reference) {
  const all = await getSetting('dailyReferences', {});
  const previous = all[date];
  return new Promise(resolve => {
    const dialog = document.createElement('dialog'); dialog.className = 'reference-dialog';
    const title = document.createElement('h2'); title.textContent = `Referência de ${date.split('-').reverse().join('/')}`;
    const explanation = document.createElement('p'); explanation.textContent = `Qual a intensidade de ${MOODS.find(m => m.id === reference.moodId).name.toLocaleLowerCase('pt-BR')} para usar nos intervalos sem avaliação? Isso preenche lacunas como estimativa, sem mudar os sentimentos que você registrou.`;
    const label = document.createElement('label'); label.className = 'field-label'; label.textContent = 'Intensidade da referência'; label.htmlFor = 'daily-reference-level';
    const select = document.createElement('select'); select.id = 'daily-reference-level'; select.setAttribute('aria-label', 'Intensidade da referência');
    ['Neutro · Não senti', 'I · Leve', 'II · Moderada', 'III · Intensa'].forEach((text, index) => { const option = document.createElement('option'); option.value = index; option.textContent = text; select.append(option); });
    select.value = previous?.level ?? reference.level; label.append(select);
    const actions = document.createElement('div'); actions.className = 'feature-actions';
    const save = document.createElement('button'); save.className = 'primary-button'; save.textContent = 'Usar referência neste dia';
    const cancel = document.createElement('button'); cancel.className = 'today-button'; cancel.textContent = 'Agora não';
    const status = document.createElement('p'); status.className = 'diary-status'; status.setAttribute('role', 'status');
    actions.append(save, cancel); dialog.append(title, explanation, label, actions, status); document.body.append(dialog);
    let result = null;
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        result = { date, moodId: reference.moodId, level: Number(select.value), confirmedAt: new Date().toISOString() };
        const latest = await getSetting('dailyReferences', {}); latest[date] = result;
        await setSetting('dailyReferences', latest); dialog.close();
      } catch (error) { status.textContent = error.message; save.disabled = false; }
    });
    cancel.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { dialog.remove(); resolve(result); });
    dialog.showModal();
  });
}
