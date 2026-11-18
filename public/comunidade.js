import { MOODS } from '/shared.js';
const $ = selector => document.querySelector(selector);
let groups = [];
for (const mood of MOODS) { const option = document.createElement('option'); option.value = mood.id; option.textContent = mood.name; $('#community-mood').append(option); }
function render() {
  const medication = $('#community-medication').value; const period = Number($('#community-period').value); const mood = $('#community-mood').value;
  const visible = groups.filter(group => group.day <= period && (!medication || JSON.stringify([group.medication, group.dose]) === medication));
  $('#community-rows').replaceChildren();
  for (const group of visible) {
    const row = document.createElement('tr');
    [group.medication + ' · ' + group.dose, group.day, group.participants, group.evaluations, ...group.moods[mood]].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
    $('#community-rows').append(row);
  }
  if (!visible.length) { const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 8; cell.textContent = 'Ainda não há grupos com amostra suficiente para este filtro.'; row.append(cell); $('#community-rows').append(row); }
  $('#community-status').textContent = `${visible.length} grupos agregados disponíveis neste filtro. A distribuição inclui apenas contribuições autorizadas.`;
}
for (const selector of ['#community-medication', '#community-period', '#community-mood']) $(selector).addEventListener('change', render);
try {
  const response = await fetch('/api/community/summary', { cache: 'no-store' }); const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Análise geral indisponível.');
  groups = data.groups;
  for (const value of new Set(groups.map(group => JSON.stringify([group.medication, group.dose])))) { const option = document.createElement('option'); option.value = value; option.textContent = JSON.parse(value).join(' · '); $('#community-medication').append(option); }
  render();
} catch (error) { $('#community-status').textContent = error.message + ' Nenhum dado pessoal local é enviado por esta página.'; }
