import { MOODS } from '/shared.js';
import { analyze } from '/analytics.js';

const $ = selector => document.querySelector(selector);
const romans = ['Neutro', 'I', 'II', 'III'];
const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const key = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const shortDate = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const percent = (n, total) => total ? Math.round(n / total * 100) : 0;
let entries = [];
let report;
let page = 0;
let period = '30';
let loaded = false;

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function setPeriod(value) {
  period = value;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (Number(value) - 1));
  const dates = entries.map(entry => entry.date).sort();
  $('#start').value = value === 'all' ? dates[0] || key(end) : key(start);
  $('#end').value = value === 'all' && dates.at(-1) > key(end) ? dates.at(-1) : key(end);
  document.querySelectorAll('[data-period]').forEach(button => {
    button.classList.toggle('selected', button.dataset.period === value);
    button.setAttribute('aria-pressed', String(button.dataset.period === value));
  });
}
function applyFilters() {
  if (!loaded) return;
  const start = $('#start').value;
  const end = $('#end').value;
  if (!$('#filters').reportValidity()) return;
  if (start > end) { $('#status').textContent = 'A data inicial deve ser anterior ou igual à data final. A análise abaixo mantém o último período válido.'; return; }
  report = analyze(entries, start, end);
  page = 0;
  $('#analysis').hidden = false;
  $('#status').textContent = `${new Date(`${start}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a ${new Date(`${end}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} · ${report.records.length ? 'Análise dos registros salvos.' : 'Nenhum registro neste período. Experimente outro intervalo ou comece pelo diário.'}`;
  $('#metric-days').textContent = report.recordedDays;
  $('#metric-coverage').textContent = `${percent(report.recordedDays, report.days)}% dos ${report.days} dias do período`;
  $('#metric-total').textContent = report.records.length;
  $('#metric-evaluations-detail').textContent = `${report.total} ${report.total === 1 ? 'humor' : 'humores'} de I a III; neutros não entram na frequência`;
  const top = report.ranking[0];
  const ties = top ? report.ranking.filter(m => m.count === top.count) : [];
  $('#metric-top').textContent = top ? (ties.length > 1 ? `${ties.length} humores` : top.name) : 'Sem dados';
  $('#metric-top-detail').textContent = top ? `${ties.length > 1 ? 'Empatados: ' + ties.map(m => m.name).join(', ') + '. ' : ''}${top.count} ${top.count === 1 ? 'avaliação' : 'avaliações'} com cada humor` : 'Nenhum humor de I a III neste período';
  $('#metric-intense').textContent = report.total ? `${percent(report.levels[2], report.total)}%` : '—';
  $('#metric-intense-detail').textContent = `${report.levels[2]} de ${report.total} seleções com intensidade intensa`;
  renderRanking();
  renderLevels();
  renderTrend();
  renderWeekdays();
  renderHistory();
  $('#reflection').textContent = report.records.length ? `Você fez ${report.records.length} avaliações em ${report.recordedDays} ${report.recordedDays === 1 ? 'dia' : 'dias'}. Observe como os sentimentos mudaram entre os horários e releia as resenhas de cada momento. Avaliações com todos os humores neutros também fazem parte desse histórico.` : 'Seu primeiro registro é um ponto de partida. Escolha um dia e inicie uma avaliação.';
}
function renderRanking() {
  const target = $('#ranking');
  target.replaceChildren();
  if (!report.ranking.length) { target.append(el('p', 'chart-empty', 'Os humores registrados aparecerão aqui, do mais frequente ao menos frequente.')); return; }
  for (const mood of report.ranking) {
    const row = el('div', 'rank-row');
    const label = el('div', 'rank-label');
    label.append(el('span', `mood-symbol ${mood.color}`, mood.icon), el('span', '', mood.name), el('strong', '', `${mood.count} aval.`));
    const track = el('div', 'rank-track');
    const bar = el('div', `rank-fill ${mood.color}`);
    bar.style.width = `${mood.count / report.records.length * 100}%`;
    track.append(bar);
    row.append(label, track);
    target.append(row);
  }
}
function renderLevels() {
  const colors = ['#a9bd92', '#809b71', '#46664f'];
  const p1 = report.total ? report.levels[0] / report.total * 100 : 0;
  const p2 = report.total ? (report.levels[0] + report.levels[1]) / report.total * 100 : 0;
  $('#donut').style.background = report.total ? `conic-gradient(${colors[0]} 0% ${p1}%,${colors[1]} ${p1}% ${p2}%,${colors[2]} ${p2}% 100%)` : '#e9ede3';
  $('#donut').setAttribute('aria-label', report.total ? `Intensidades: leve ${report.levels[0]}, moderada ${report.levels[1]}, intensa ${report.levels[2]}` : 'Nenhum humor no período');
  $('#donut-total').textContent = report.total;
  $('#level-legend').replaceChildren();
  ['I · Leve', 'II · Moderada', 'III · Intensa'].forEach((label, index) => {
    const row = el('div', 'legend-row');
    const dot = el('i', 'legend-dot');
    dot.style.background = colors[index];
    row.append(dot, el('span', '', label), el('strong', '', `${report.levels[index]} (${percent(report.levels[index], report.total)}%)`));
    $('#level-legend').append(row);
  });
}
function renderTrend() {
  if (!report) return;
  const selectedMood = $('#trend-mood').value;
  const moments = [...report.records].reverse().slice(-120);
  const chart = $('#trend');
  chart.replaceChildren();
  const plot = el('div', 'daily-plot');
  plot.style.minWidth = `${Math.max(280, moments.length * 68)}px`;
  const mood = MOODS.find(m => m.id === selectedMood);
  if (!moments.length) { chart.append(el('p', 'chart-empty', 'As avaliações deste período aparecerão aqui com data e horário.')); $('#trend-footnote').textContent = ''; return; }
  plot.setAttribute('role', 'list');
  plot.setAttribute('aria-label', `Intensidade de ${mood.name} em cada avaliação`);
  moments.forEach(entry => {
    const level = entry.moods.find(m => m.id === selectedMood)?.level ?? 0;
    const column = el('div', 'daily-column');
    column.setAttribute('role', 'listitem');
    const description = `${entry.date} ${entry.time ?? 'horário não informado'}: ${mood.name} ${romans[level]}`;
    column.title = description;
    column.setAttribute('aria-label', description);
    const value = el('span', 'daily-value', romans[level]);
    const bar = el('div', `daily-bar ${level ? 'level-' + level : 'no-value'}`);
    bar.style.height = level ? `${level * 34}px` : '3px';
    const label = el('span', 'daily-label', `${shortDate(entry.date)} ${entry.time ?? 's/ hora'}`);
    column.append(value, bar, label);
    plot.append(column);
  });
  chart.append(plot);
  $('#trend-footnote').textContent = `${moments.length} avaliações exibidas em ordem cronológica. Neutro significa não estar sentindo esse humor na avaliação. Dias sem avaliação não são representados como neutros.${report.records.length > 120 ? ' O gráfico mostra as últimas 120 avaliações do período; os demais painéis consideram todas.' : ''}`;
}
function renderWeekdays() {
  const target = $('#weekdays');
  target.replaceChildren();
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    const data = report.weekdays[day];
    const row = el('div', 'weekday-row');
    const track = el('div', 'weekday-track');
    const fill = el('div', 'weekday-fill');
    fill.style.width = `${percent(data.recorded, data.possible)}%`;
    track.append(fill);
    row.append(el('span', '', dayNames[day]), track, el('small', '', `${data.recorded}/${data.possible} dias`));
    target.append(row);
  }
}
function renderHistory() {
  const target = $('#history');
  target.replaceChildren();
  $('#history-count').textContent = `${report.records.length} registros`;
  for (const entry of report.records.slice(page * 10, (page + 1) * 10)) {
    const date = entry.date;
    const row = document.createElement('tr');
    const dateCell = el('td', 'history-date', `${new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} · ${entry.time ?? 'Horário não informado'}`);
    const moods = el('td', 'history-moods');
    entry.moods.filter(item => item.level > 0).forEach(item => {
      const mood = MOODS.find(m => m.id === item.id);
      moods.append(el('span', `history-pill ${mood.color}`, `${mood.name} ${romans[item.level]}`));
    });
    const active = entry.moods.filter(item => item.level > 0).length;
    moods.append(el('span', 'neutral-chip', active ? `${MOODS.length - active} neutros` : 'Todos os humores neutros'));
    const note = el('td', 'history-note', entry.note || 'Sem anotação');
    const action = el('td', '');
    const link = el('a', 'edit-link', 'Ver avaliação ↗');
    link.href = `/?date=${date}&assessment=${entry.id}`;
    link.setAttribute('aria-label', `Ver avaliação de ${date} ${entry.time ?? 'sem horário'}`);
    action.append(link);
    row.append(dateCell, moods, note, action);
    target.append(row);
  }
  if (!report.records.length) {
    const cell = el('td', 'chart-empty', 'Nenhum registro neste período.');
    cell.colSpan = 4;
    const row = document.createElement('tr'); row.append(cell); target.append(row);
  }
  $('#page-label').textContent = `Página ${page + 1} de ${Math.max(1, Math.ceil(report.records.length / 10))}`;
  $('#prev-page').disabled = page === 0;
  $('#next-page').disabled = (page + 1) * 10 >= report.records.length;
}
async function load() {
  $('#refresh').disabled = true;
  $('#status').textContent = 'Carregando seus registros…';
  try {
    const response = await fetch('/api/assessments');
    if (!response.ok) throw new Error();
    entries = await response.json();
    loaded = true;
    if (period) setPeriod(period);
    applyFilters();
  } catch { $('#status').textContent = 'Não foi possível atualizar os registros. Clique em Atualizar dados para tentar novamente.'; }
  finally { $('#refresh').disabled = false; }
}
MOODS.forEach(mood => {
  const option = el('option', '', mood.name);
  option.value = mood.id;
  $('#trend-mood').append(option);
});
$('#filters').addEventListener('submit', event => {
  event.preventDefault();
  period = null;
  document.querySelectorAll('[data-period]').forEach(button => { button.classList.remove('selected'); button.setAttribute('aria-pressed', 'false'); });
  applyFilters();
});
document.querySelectorAll('[data-period]').forEach(button => button.addEventListener('click', () => { setPeriod(button.dataset.period); applyFilters(); }));
$('#trend-mood').addEventListener('change', renderTrend);
$('#prev-page').addEventListener('click', () => { if (page > 0) { page--; renderHistory(); } });
$('#next-page').addEventListener('click', () => { if ((page + 1) * 10 < report.records.length) { page++; renderHistory(); } });
$('#refresh').addEventListener('click', load);
setPeriod('30');
load();
