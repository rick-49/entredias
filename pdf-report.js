import { MOODS } from './shared.js';
import { medicationLabel, medicationComparisons, normalizeReference, referenceTimeline, medicationSnapshot, DEFAULT_REFERENCE } from './health-model.js';

const roman = ['Neutro', 'I', 'II', 'III'];
const dateText = date => date.split('-').reverse().join('/');
const safeText = text => String(text).replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/gu, '[símbolo]');

export function createMedicalReport(jsPDF, { assessments, medications = [], intakes = [], dailyReferences = {}, start, end, includeNotes = false, patientName = '', reference = DEFAULT_REFERENCE }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false });
  const records = assessments.filter(entry => entry.date >= start && entry.date <= end).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  const ref = normalizeReference(reference);
  const width = 174; const left = 18; let y = 23;
  const color = [67, 93, 59];
  function page() { doc.addPage(); y = 22; }
  function line(text, size = 10, bold = false, gap = 5.2) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...(bold ? color : [73, 83, 69]));
    const lines = doc.splitTextToSize(safeText(text), width);
    for (const textLine of lines) { if (y > 274) page(); doc.text(textLine, left, y); y += gap; }
  }
  function heading(text) { if (y > 252) page(); y += 5; line(text, 12, true, 6.3); y += 2; }
  line('ENTRE DIAS', 10, true, 7);
  line('Relatório de acompanhamento', 21, true, 10);
  line(`${dateText(start)} a ${dateText(end)}`, 11, false, 7);
  if (patientName.trim()) line(`Identificação informada: ${patientName.trim()}`, 11, true, 6.5);
  const recordedDays = new Set(records.map(e => e.date)).size;
  line(`${records.length} ${records.length === 1 ? 'avaliação registrada' : 'avaliações registradas'} em ${recordedDays} ${recordedDays === 1 ? 'dia' : 'dias'}.`, 10);
  line(`Resenhas: ${includeNotes ? 'incluídas por escolha do usuário' : 'omitidas por escolha do usuário'}.`, 10);
  line('Gerado localmente. Dados autorrelatados, sem verificação de ingestão ou diagnóstico. Correlação temporal não demonstra efeito causado por medicamento.', 9, false, 4.8);
  heading('Como ler este relatório');
  line('Neutro: humor não sentido na avaliação. I: leve. II: moderada. III: intensa.', 10);
  line('Os horários são locais, conforme informados no aparelho. O cadastro de medicamento descreve o esquema informado, não comprova que a dose foi tomada. Avaliações antigas podem não ter medicamentos ou horário.', 9, false, 4.8);
  line(`Duração padrão: ${ref.durationMinutes} minutos; pode ter sido ajustada em cada avaliação. Duração estimada não é medição contínua.`, 9, false, 4.8);
  if (ref.enabled) line(`Referência para lacunas: ${MOODS.find(m => m.id === ref.moodId).name} ${roman[ref.level]}. Ela é uma hipótese de comparação, não uma avaliação real. Os intervalos preenchidos por referência não estão contados nas avaliações deste relatório.`, 9, false, 4.8);
  const comparisons = medicationComparisons(records);
  const taken = intakes.filter(intake => intake.date >= start && intake.date <= end).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  function room(height) { if (y + height > 273) page(); }
  function label(text, x, rowY, size = 8, align = 'left') { doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(79, 96, 69); doc.text(safeText(text), x, rowY, { align }); }
  const levelColors = [[180, 199, 155], [119, 153, 102], [66, 104, 57]];
  const frequency = MOODS.map(mood => ({ ...mood, levels: [1, 2, 3].map(level => records.filter(entry => entry.moods.some(item => item.id === mood.id && item.level === level)).length) })).filter(mood => mood.levels.some(Boolean)).sort((a, b) => b.levels.reduce((s, n) => s + n, 0) - a.levels.reduce((s, n) => s + n, 0));
  if (frequency.length) {
    room(29 + frequency.length * 7); heading('Gráfico 1 - Sentimentos e intensidades registradas');
    const max = Math.max(...frequency.map(mood => mood.levels.reduce((s, n) => s + n, 0)));
    for (const mood of frequency) {
      label(mood.name, left, y + 3.2, 9); let x = left + 49;
      mood.levels.forEach((count, index) => { if (!count) return; doc.setFillColor(...levelColors[index]); const barWidth = count / max * 105; doc.rect(x, y, barWidth, 4.5, 'F'); x += barWidth; });
      label(mood.levels.reduce((s, n) => s + n, 0), left + 169, y + 3.2, 9, 'right'); y += 7;
    }
    y += 3;
    line('Tons de verde: I (claro), II (médio), III (escuro). Contagem de avaliações com o sentimento; neutros e lacunas estimadas não entram nas barras.', 8, false, 4.4);
  }
  if (records.some(entry => entry.time)) {
    room(74); heading('Gráfico 2 - Horários das avaliações e tomadas informadas');
    const bins = Array.from({ length: 24 }, (_, hour) => records.filter(entry => entry.time && Number(entry.time.slice(0, 2)) === hour).length);
    const max = Math.max(1, ...bins); const baseY = y + 31; const cell = width / 24;
    doc.setDrawColor(214, 224, 204); doc.line(left, baseY, left + width, baseY);
    for (let hour = 0; hour < 24; hour++) {
      const x = left + hour * cell; const height = bins[hour] / max * 27;
      if (height) { doc.setFillColor(120, 152, 100); doc.rect(x + 1, baseY - height, cell - 2, height, 'F'); label(bins[hour], x + cell / 2, baseY - height - 1.5, 7, 'center'); }
      if (hour % 3 === 0) label(String(hour).padStart(2, '0') + 'h', x + cell / 2, baseY + 4.5, 7, 'center');
      const doses = taken.filter(intake => Number(intake.time.slice(0, 2)) === hour).length;
      if (doses) { doc.setFillColor(66, 76, 61); doc.circle(x + cell / 2, baseY + 9, 1.2, 'F'); label(doses, x + cell / 2, baseY + 14, 7, 'center'); }
    }
    y = baseY + 21;
    line('Barras: quantidade de avaliações por faixa de hora, somando os dias do período. Círculos e números abaixo: tomadas com horário informado. Posição temporal não indica efeito causal.', 8, false, 4.4);
  }
  const chartDates = [...new Set(records.map(entry => entry.date))].sort().slice(-7);
  if (chartDates.length) {
    room(37 + chartDates.length * 12); heading('Gráfico 3 - Linha do tempo: registros, referência e medicação');
    const chartLeft = left + 23, chartWidth = width - 24;
    for (let hour = 0; hour <= 24; hour += 4) label(String(hour).padStart(2, '0') + 'h', chartLeft + hour / 24 * chartWidth, y + 2, 7, hour === 24 ? 'right' : 'center');
    y += 7;
    const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    for (const date of chartDates) {
      label(dateText(date).slice(0, 5), left, y + 4, 8);
      doc.setFillColor(247, 248, 243); doc.rect(chartLeft, y, chartWidth, 6, 'F');
      const daily = dailyReferences[date] ? { ...ref, ...dailyReferences[date], enabled: true } : ref;
      for (const point of referenceTimeline(records, date, daily)) {
        if (!point.time) continue;
        const from = minutes(point.time); const duration = point.minutes ?? Math.min(point.durationMinutes || ref.durationMinutes, 1440 - from);
        const x = chartLeft + from / 1440 * chartWidth; const w = Math.max(0.7, duration / 1440 * chartWidth);
        doc.setFillColor(...(point.source === 'reference' ? [221, 232, 207] : [79, 119, 64])); doc.rect(x, y, w, 6, 'F');
        if (point.source === 'reference') { doc.setDrawColor(175, 193, 156); for (let stripe = x + 1; stripe < x + w; stripe += 3) doc.line(stripe, y + .7, stripe, y + 5.3); }
      }
      for (const intake of taken.filter(intake => intake.date === date)) { const x = chartLeft + minutes(intake.time) / 1440 * chartWidth; doc.setFillColor(45, 54, 41); doc.circle(x, y + 8.1, 1.1, 'F'); }
      for (const med of medications) for (const time of med.times) {
        if (!medicationSnapshot([med], date, time).length) continue;
        const x = chartLeft + minutes(time) / 1440 * chartWidth; doc.setDrawColor(182, 147, 87); doc.line(x, y - 1.5, x, y + 6.5);
      }
      y += 12;
    }
    y += 2;
    line('Verde escuro: duração dos registros (informada ou estimada). Listrado: referência para lacunas. Traço dourado: horário previsto de medicamento. Círculo preto: tomada informada. Até 7 dias mais recentes; todos os registros estão no detalhamento.', 8, false, 4.4);
  }
  if (comparisons.length && frequency.length) {
    const moods = frequency.slice(0, 4); const visible = comparisons.slice(0, 8);
    room(36 + visible.length * 19); heading('Gráfico 4 - Sentimentos por esquema de medicação');
    const colWidth = 26; const columnStart = left + 69;
    moods.forEach((mood, index) => label(mood.name.length > 15 ? mood.name.slice(0, 14) + '.' : mood.name, columnStart + index * colWidth, y, 7)); y += 6;
    for (const group of visible) {
      const shortName = `${group.name} ${group.dose} ${group.unit}`;
      label(shortName.length > 38 ? shortName.slice(0, 37) + '.' : shortName, left, y + 2, 8);
      label(`${dateText(group.startDate)} | n=${group.evaluations} | 14 dias: ${group.first14}`, left, y + 7, 7);
      label('Horários: ' + group.times.join(', '), left, y + 12, 7);
      moods.forEach((mood, index) => {
        const value = group.moodTotals[mood.id] / group.evaluations; const x = columnStart + index * colWidth;
        doc.setFillColor(239, 244, 231); doc.rect(x, y + 3, 21, 4, 'F');
        doc.setFillColor(113, 150, 91); if (value) doc.rect(x, y + 3, 21 * value, 4, 'F');
        label(Math.round(value * 100) + '%', x, y + 11, 7);
      });
      y += 19;
    }
    line('Percentual de avaliações do esquema com nível I a III de cada sentimento (até 4 sentimentos mais frequentes e 8 esquemas). Sentimentos podem coexistir; percentuais não somam 100%. Não mede eficácia nem demonstra causalidade.', 8, false, 4.4);
  }
  heading('Esquemas de medicamento cadastrados');
  const overlapping = medications.filter(med => med.startDate <= end && (!med.endDate || med.endDate >= start));
  if (!overlapping.length) line('Nenhum esquema cadastrado para o período.', 10);
  for (const med of overlapping) {
    line(medicationLabel(med).replaceAll('·', ' | '), 10, true);
    line(`Início: ${dateText(med.startDate)} ${med.startTime || '00:00'}. Fim: ${med.endDate ? dateText(med.endDate) + ' ' + (med.endTime || '23:59') : 'não encerrado no cadastro'}.`, 9, false, 4.8);
  }
  heading('Tomadas com horário informado');
  if (!taken.length) line('Nenhuma tomada foi informada no período. Horário previsto não comprova ingestão.', 10);
  for (const intake of taken) line(`${dateText(intake.date)} ${intake.time} | ${intake.name} | ${intake.dose} ${intake.unit}`, 10);
  const referenceDays = Object.entries(dailyReferences).filter(([date]) => date >= start && date <= end);
  if (referenceDays.length) {
    heading('Referências diárias para lacunas (estimativas)');
    for (const [date, value] of referenceDays) line(`${dateText(date)}: ${MOODS.find(m => m.id === value.moodId)?.name} ${roman[value.level]}. Informado como referência para intervalos sem avaliação, não como observação contínua.`, 9, false, 4.8);
  }
  if (ref.enabled || referenceDays.length) {
    heading('Intervalos preenchidos por referência (estimados)');
    for (const date of [...new Set(records.map(entry => entry.date))].sort()) {
      const daily = dailyReferences[date] ? { ...ref, ...dailyReferences[date], enabled: true } : ref;
      const gaps = referenceTimeline(records, date, daily).filter(point => point.source === 'reference');
      if (gaps.length) line(`${dateText(date)}: ` + gaps.map(point => `${point.time}-${point.endTime}: ${MOODS.find(m => m.id === point.moods[0].id).name} ${roman[point.moods[0].level]}`).join('; ') + '. Estimativa, não avaliação.', 9, false, 4.8);
    }
  }
  heading('Avaliações vinculadas a cada esquema');
  if (!comparisons.length) line('Nenhuma avaliação do período tem esquema de medicamento informado.', 10);
  for (const group of comparisons) {
    line(`${group.name} | ${group.dose} ${group.unit} | início ${dateText(group.startDate)}: ${group.evaluations} avaliações; ${group.first14} nos primeiros 14 dias.`, 10, true);
    const feelings = MOODS.filter(m => group.moodTotals[m.id]).map(m => `${m.name}: ${group.moodTotals[m.id]}`).join('; ');
    line(`Ocorrências com nível I a III: ${feelings || 'nenhuma'}.`, 9, false, 4.8);
  }
  heading('Registros por data e horário');
  if (!records.length) line('Nenhuma avaliação salva no período selecionado.', 10);
  for (const entry of records) {
    if (y > 245) page();
    line(`${dateText(entry.date)} | ${entry.time || 'horário não informado'} | ${entry.durationMinutes || ref.durationMinutes} min (${entry.durationSource === 'reported' ? 'duração informada' : 'duração estimada'})`, 11, true, 6.3);
    const feelings = entry.moods.filter(m => m.level > 0).map(m => `${MOODS.find(item => item.id === m.id)?.name || m.id} ${roman[m.level]}`);
    line(`Sentimentos: ${feelings.length ? feelings.join('; ') : 'todos os humores neutros'}.`, 10);
    const meds = entry.medications || [];
    line(`Medicamentos: ${entry.medicationsRecorded ? (meds.length ? meds.map(medicationLabel).join('; ').replaceAll('·', '|') : 'nenhum cadastrado em uso neste registro') : 'não informados neste registro antigo'}.`, 9, false, 4.8);
    if (entry.intakes?.length) line('Tomadas informadas nas 24h anteriores: ' + entry.intakes.map(intake => `${intake.name} ${intake.dose} ${intake.unit} em ${dateText(intake.date)} ${intake.time}`).join('; ') + '.', 9, false, 4.8);
    if (includeNotes) line(`Resenha: ${entry.note || 'sem resenha'}`, 10, false, 5.2);
    y += 5;
  }
  const pages = doc.getNumberOfPages();
  for (let index = 1; index <= pages; index++) {
    doc.setPage(index); doc.setDrawColor(218, 226, 211); doc.line(18, 282, 192, 282);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(132, 146, 120);
    doc.text('Entre dias | Registro pessoal para acompanhamento | Símbolos não suportados são substituídos.', 18, 287);
    doc.text(`${index} / ${pages}`, 192, 292, { align: 'right' });
  }
  return doc;
}
