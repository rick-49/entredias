import { allAssessments, allMedications, allIntakes, getSetting, downloadFile } from '/local-data.js';
import { DEFAULT_REFERENCE } from '/health-model.js';
import { createMedicalReport } from '/pdf-report.js';
import { requireInstalled } from '/install.js';
await requireInstalled();
const $ = selector => document.querySelector(selector);
const now = new Date(); const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
$('#report-end').value = dateKey(now); now.setDate(now.getDate() - 29); $('#report-start').value = dateKey(now);
$('#report-form').addEventListener('submit', async event => {
  event.preventDefault();
  if ($('#report-start').value > $('#report-end').value) { $('#report-status').textContent = 'A data inicial deve ser anterior à final.'; return; }
  $('#generate-report').disabled = true; $('#report-status').textContent = 'Preparando o PDF neste dispositivo…';
  try {
    if (!globalThis.jspdf?.jsPDF) throw new Error('A biblioteca de PDF não carregou. Abra o app uma vez com internet para concluir a atualização.');
    const [assessments, medications, intakes, reference, dailyReferences] = await Promise.all([allAssessments(), allMedications(), allIntakes(), getSetting('reference', DEFAULT_REFERENCE), getSetting('dailyReferences', {})]);
    const doc = createMedicalReport(globalThis.jspdf.jsPDF, { assessments, medications, intakes, reference, dailyReferences, start: $('#report-start').value, end: $('#report-end').value, includeNotes: $('#include-notes').checked, patientName: $('#patient-name').value });
    downloadFile(doc.output('arraybuffer'), 'application/pdf', `entre-dias-${$('#report-start').value}-${$('#report-end').value}.pdf`);
    $('#report-status').textContent = `PDF preparado ${$('#include-notes').checked ? 'com' : 'sem'} as resenhas. Revise antes de compartilhar com seu profissional.`;
  } catch (error) { $('#report-status').textContent = error.message; }
  finally { $('#generate-report').disabled = false; }
});
