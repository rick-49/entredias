import { MOODS } from '/shared.js';
import { summarizeGroups, groupSeries } from '/community-analysis.js';
const $ = s => document.querySelector(s);
const el = (tag, text = '', cls = '') => { const n = document.createElement(tag); n.textContent = text; n.className = cls; return n; };
const pct = n => n === null ? '—' : n.toLocaleString('pt-BR', {maximumFractionDigits: 1}) + '%';
let groups = [], detailDay = null;
for (const mood of MOODS) { const o = el('option', mood.name); o.value = mood.id; $('#community-mood').append(o); }
function render() {
 const selected = $('#community-medication').value, period = Number($('#community-period').value), mood = $('#community-mood').value, minimum = Number($('#community-minimum').value);
 const rows = groups.filter(g => g.day <= period && g.participants >= minimum && (!selected || JSON.stringify([g.medication,g.dose]) === selected));
 const stats = summarizeGroups(rows,mood);
 $('#bi-metrics').replaceChildren();
 for (const [label,value] of [['Observações de medicamento',stats.total],['Medicamentos e doses',new Set(rows.map(g=>JSON.stringify([g.medication,g.dose]))).size],['Com o sentimento',pct(stats.felt)],['Intensidade III',pct(stats.intense)]]) { const card=el('article','','bi-metric'); card.append(el('span',label),el('strong',String(value))); $('#bi-metrics').append(card); }
 $('#bi-timeline').replaceChildren();
 for (const day of groupSeries(rows,g=>g.day,mood).sort((a,b)=>a.label-b.label)) {
  const button=el('button','','bi-day'); button.type='button'; const bar=el('span','','bi-stack');
  day.levels.forEach((count,i)=>{ if(!count)return; const segment=el('span','',`bi-level-${i}`); segment.style.width=`${count/day.total*100}%`; segment.title=`${['Neutro','I','II','III'][i]}: ${count}`; bar.append(segment); });
  button.setAttribute('aria-label',`Dia ${day.label}, ${day.total} observações. Neutro ${day.levels[0]}, I ${day.levels[1]}, II ${day.levels[2]}, III ${day.levels[3]}. Ver detalhes.`);
  button.append(el('span',`Dia ${day.label}`),bar,el('small',`n=${day.total}`)); button.onclick=()=>{detailDay=day.label;render();$('#bi-detail-label').scrollIntoView({behavior:'smooth',block:'center'});}; $('#bi-timeline').append(button);
 }
 $('#bi-timeline').append(el('p',rows.length?'Cinza: Neutro · Verde claro: I · Verde médio: II · Verde escuro: III':'Ainda não há amostra suficiente para estes filtros.','small-explanation'));
 $('#bi-comparison').replaceChildren();
 for (const item of groupSeries(rows,g=>`${g.medication} · ${g.dose}`,mood).sort((a,b)=>a.label.localeCompare(b.label))) { const card=el('div','','bi-compare'), track=el('div','','bi-stack'), bar=el('span','','bi-level-2');bar.style.width=`${item.felt||0}%`;track.append(bar);card.append(el('strong',item.label),track,el('small',`${pct(item.felt)} · ${item.total} observações · ${item.days} dias com dados`));$('#bi-comparison').append(card); }
 if(!rows.length)$('#bi-comparison').append(el('p','Ainda não há amostra suficiente para estes filtros.','small-explanation'));
 const table=el('table','','community-table bi-heatmap'), head=el('thead'), tr=el('tr');tr.append(el('th','Sentimento'));
 for(let w=0;w<Math.ceil(period/7);w++)tr.append(el('th',`Dias ${w*7+1}–${Math.min(period,(w+1)*7)}`));head.append(tr);table.append(head);const body=el('tbody');
 for(const item of MOODS){const row=el('tr'),label=el('th'),button=el('button',item.name,'bi-mood-button');button.type='button';button.setAttribute('aria-pressed',String(item.id===mood));button.onclick=()=>{$('#community-mood').value=item.id;detailDay=null;render();};label.append(button);row.append(label);
  for(let w=0;w<Math.ceil(period/7);w++){const s=summarizeGroups(rows.filter(g=>g.day>w*7&&g.day<=(w+1)*7),item.id),cell=el('td',pct(s.felt));cell.title=`${s.total} observações`;if(s.total)cell.style.backgroundColor=`rgba(119,153,102,${.08+s.felt/100*.42})`;row.append(cell);}body.append(row);
 }table.append(body);$('#bi-heatmap').replaceChildren(table);
 $('#bi-detail-label').textContent=detailDay===null?'Todos os dias do filtro selecionado.':`Dia ${detailDay} do esquema.`;$('#bi-clear-day').hidden=detailDay===null;
 $('#community-rows').replaceChildren();const details=rows.filter(g=>detailDay===null||g.day===detailDay);
 for(const g of details){const row=el('tr');[`${g.medication} · ${g.dose}`,g.day,g.participants,g.evaluations,...g.moods[mood]].forEach(v=>row.append(el('td',String(v))));$('#community-rows').append(row);}
 if(!details.length){const row=el('tr'),cell=el('td','Ainda não há grupos com amostra suficiente para este filtro.');cell.colSpan=8;row.append(cell);$('#community-rows').append(row);}
 $('#community-status').textContent=`${rows.length} grupos disponíveis · ${MOODS.find(m=>m.id===mood).name} · mínimo de ${minimum} instalações por grupo.`;
}
for(const id of ['community-medication','community-period','community-mood','community-minimum'])$('#'+id).addEventListener('change',()=>{detailDay=null;render();});
$('#bi-clear-day').onclick=()=>{detailDay=null;render();};
$('#community-reset').onclick=()=>{$('#community-medication').value='';$('#community-period').value='14';$('#community-minimum').value='5';$('#community-mood').value=MOODS[0].id;detailDay=null;render();};
async function load(){ $('#community-refresh').disabled=true;$('#community-status').textContent='Atualizando análise geral…';try{const response=await fetch('/api/community/summary',{cache:'no-store'}),data=await response.json();if(!response.ok)throw new Error(data.error||'Análise indisponível.');groups=data.groups;const previous=$('#community-medication').value;$('#community-medication').replaceChildren();const all=el('option','Todos os grupos disponíveis');all.value='';$('#community-medication').append(all);for(const value of new Set(groups.map(g=>JSON.stringify([g.medication,g.dose])))){const option=el('option',JSON.parse(value).join(' · '));option.value=value;$('#community-medication').append(option);}$('#community-medication').value=[...$('#community-medication').options].some(o=>o.value===previous)?previous:'';render();}catch(error){$('#community-status').textContent=error.message+' Nenhum dado pessoal local é enviado por esta página.';}finally{$('#community-refresh').disabled=false;}}
$('#community-refresh').onclick=load;load();
