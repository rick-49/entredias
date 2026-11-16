import { allAssessments, makeBackup, restoreBackup, downloadFile } from '/local-data.js';
import { entriesToCsv } from '/csv.js';
import { requireInstalled } from '/install.js';
await requireInstalled();
const status = document.querySelector('#backup-status');
const day = () => new Date().toISOString().slice(0, 10);
async function storageInfo() {
  const records = await allAssessments();
  const persistent = await navigator.storage?.persisted?.();
  document.querySelector('#storage-info').textContent = `${records.length} avaliações salvas neste dispositivo. ${persistent ? 'O navegador concedeu armazenamento persistente.' : 'O navegador ainda não concedeu armazenamento persistente; mantenha seus backups.'}`;
}
document.querySelector('#backup').addEventListener('click', async () => {
  try { downloadFile(JSON.stringify(makeBackup(await allAssessments()), null, 2), 'application/json', `entre-dias-backup-${day()}.json`); status.textContent = 'Backup preparado. Guarde o arquivo em um lugar privado.'; }
  catch (error) { status.textContent = error.message; }
});
document.querySelector('#csv').addEventListener('click', async () => {
  try { downloadFile(entriesToCsv(await allAssessments()), 'text/csv;charset=utf-8', `entre-dias-${day()}.csv`); status.textContent = 'CSV preparado com os registros deste dispositivo.'; }
  catch (error) { status.textContent = error.message; }
});
document.querySelector('#restore').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('Escolha um backup de até 20 MB.');
    const input = JSON.parse(await file.text());
    if (!confirm('Restaurar as avaliações deste backup neste dispositivo? Os registros atuais serão mantidos.')) return;
    const result = await restoreBackup(input);
    status.textContent = `${result.imported} avaliações restauradas. ${result.skipped} já existiam e foram mantidas.`;
    await storageInfo();
  } catch (error) { status.textContent = error instanceof SyntaxError ? 'O arquivo não contém um JSON válido.' : error.message; }
  finally { event.target.value = ''; }
});
document.querySelector('#persist').addEventListener('click', async () => {
  try {
    const granted = await navigator.storage?.persist?.();
    status.textContent = granted ? 'Proteção concedida pelo navegador. Continue fazendo backups.' : 'O navegador não concedeu essa proteção. O app continua funcionando; faça backups regularmente.';
    await storageInfo();
  } catch { status.textContent = 'Não foi possível solicitar a proteção. Continue fazendo backups.'; }
});
storageInfo().catch(error => { status.textContent = error.message; });
