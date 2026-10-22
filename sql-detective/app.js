import {cases,allTasks} from './tasks.js';
import {buildDataset,DATA_VERSION} from './data.js';
import {createAttempt,isCurrent,editAttempt,recordAttempt,chooseAnswer,currentPassed,readyStatus} from './model.js';
import {illustration,chartSpec} from './visuals.js';
import './guard.js';
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const {validateSQL}=globalThis.SQLDetectiveGuard;
const params=new URLSearchParams(location.search);
let mode=params.get('mode')==='practice'?'practice':'guide',sample=[0,1,2].includes(Number(params.get('sample')))?Number(params.get('sample')):0;
let active=cases[0],task=active.tasks[0],feedback='guided',previewTable=null,previewPage=0;
const states=new Map(),datasets=new Map();
const key=(t=task)=>`${mode}:${sample}:${t.id}`;
function state(t=task){const k=key(t);if(!states.has(k))states.set(k,createAttempt(t.starter,t.choices));return states.get(k);}
function dataset(v=sample){const k=mode+':'+v;if(!datasets.has(k))datasets.set(k,buildDataset(mode,v));return datasets.get(k);}
function status(text,error=false){$('query-status').textContent=text;$('query-status').classList.toggle('error',error);}
function parseRoute(){const [id,index]=location.hash.slice(1).split('/');active=cases.find(c=>c.id===id)||cases[0];const i=Number(index);task=active.tasks[Number.isInteger(i)&&i>=0&&i<3?i:0];}
const storageKey='sql-detective-progress-v2';let keepProgress=false;
function loadProgress(){try{const raw=localStorage.getItem(storageKey);if(!raw)return;const saved=JSON.parse(raw);if(saved.version!==DATA_VERSION||!Array.isArray(saved.keys))return;keepProgress=true;for(const item of saved.keys){const [m,v,id]=String(item).split(':');if(!['guide','practice'].includes(m)||!['0','1','2'].includes(v))continue;const t=allTasks.find(t=>t.id===id);if(!t)continue;const s=createAttempt(t.starter,t.choices);s.completed={version:DATA_VERSION,restored:true};states.set(item,s);}}catch{$('storage-status').textContent='无法读取本机记录，仍可正常练习。';}}
function persist(){if(!keepProgress)return;try{localStorage.setItem(storageKey,JSON.stringify({version:DATA_VERSION,keys:[...states].filter(([,s])=>s.completed).map(([k])=>k)}));$('storage-status').textContent='仅保存完成标记，不保存SQL。';}catch{$('storage-status').textContent='本机存储不可用，本次进度仍保留在页面中。';}}
let worker,ready=false,pending=null,engineTimer,queryTimer,sequence=0,generation=0;
function controls(){const busy=!!pending;$('run-button').disabled=!ready||busy;$('run-button').textContent=busy?'◌ 执行与验证中…':'▶ 运行并验证';$('retry-button').hidden=ready||(!worker&&busy);}
function failEngine(message){clearTimeout(engineTimer);clearTimeout(queryTimer);if(worker)worker.terminate();ready=false;const failed=pending;pending=null;if(failed&&failed.key===key()){recordAttempt(state(),failed.sql,null,'引擎失败');renderHistory();renderAssessment();}status(message,true);$('engine-state').textContent='引擎未就绪';$('retry-button').hidden=false;controls();}
function startEngine(retry=false){
  if(worker)worker.terminate();clearTimeout(engineTimer);clearTimeout(queryTimer);const currentGeneration=++generation;
  ready=false;pending=null;$('engine-state').textContent='引擎加载中…';status(retry?'正在重新加载数据库引擎…':'正在准备虚构训练数据库…');controls();$('retry-button').hidden=true;
  try{worker=new Worker(new URL('./worker.js',import.meta.url));}catch{failEngine('不能启动查询引擎。请使用浏览器打开HTTP网站。');return;}
  engineTimer=setTimeout(()=>{if(currentGeneration===generation)failEngine('数据库加载超过15秒，请检查网络后重新加载。');},15000);
  worker.onerror=()=>{if(currentGeneration===generation)failEngine('数据库引擎加载失败，请重新加载。');};
  worker.onmessage=({data})=>{
    if(currentGeneration!==generation)return;
    if(data.type==='ready'){clearTimeout(engineTimer);ready=true;$('engine-state').textContent='SQLite 已就绪';status(readyStatus(retry?'retry':'initial'));controls();return;}
    if(data.type==='fatal'){failEngine(data.error);return;}
    if(!pending||data.id!==pending.id)return;
    const request=pending;pending=null;clearTimeout(queryTimer);controls();if(request.key!==key())return;
    if(data.type==='error'){recordAttempt(state(),request.sql,null,'SQL执行失败：'+data.error);emptyResult('SQL尚未执行成功','检查字段、表名和语法后重试。');status('SQL执行失败：'+data.error,true);}
    else {recordAttempt(state(),request.sql,data,data.matched?'三组样本全部吻合':'尚未通过全部样本',data.matched);renderResult(data);status('查询已执行，三组验证共耗时 '+data.elapsed+' ms（含初始化）。');}
    renderHistory();renderAssessment();
  };
}
function execute(){
  const sql=$('sql-editor').value,s=state();editAttempt(s,sql);
  if(!ready||pending){status('请等待引擎就绪或当前查询结束。',true);return;}
  const validation=validateSQL(sql);
  if(!validation.ok){recordAttempt(s,sql,null,'输入被拦截');emptyResult('请调整查询',validation.error);status(validation.error,true);renderHistory();renderAssessment();return;}
  const id=++sequence;pending={id,key:key(),sql};controls();renderAssessment();status('正在运行当前SQL，并验证三组不同样本…');
  queryTimer=setTimeout(()=>{
    if(!pending||pending.id!==id)return;
    recordAttempt(state(),sql,null,'查询超时');emptyResult('查询已中止','请检查连接条件并缩小计算范围。');startEngine(true);status('查询超过1.5秒，已中止，正在恢复数据库…',true);renderHistory();renderAssessment();
  },1500);
  worker.postMessage({id,sql:validation.sql,seeds:[0,1,2].map(i=>dataset((sample+i)%3).seed),reference:task.answer});
}
function renderNavigation(){
  const nav=$('case-list');nav.replaceChildren();
  for(const c of cases){const count=c.tasks.filter(t=>state(t).completed).length;const a=el('a','case-link');a.href='#'+c.id+'/0';a.setAttribute('aria-label',`案件${c.number} ${c.title}`);if(c.id===active.id)a.setAttribute('aria-current','page');a.append(el('span','case-index',c.number));const label=el('span');label.append(el('span','case-name',c.title),el('small','',count+' / '+c.tasks.length+' 项曾完成'));a.append(label);if(count===c.tasks.length)a.append(el('span','completion','✓'));nav.append(a);}
  const count=allTasks.filter(t=>state(t).completed).length;$('progress-text').textContent=count+' / '+allTasks.length;$('progress').max=allTasks.length;$('progress').value=count;
  $('task-nav').replaceChildren();for(const t of active.tasks){const a=el('a','task-link');a.href='#'+active.id+'/'+t.index;if(t.id===task.id)a.setAttribute('aria-current','step');a.append(el('span','',String(t.index+1).padStart(2,'0')),el('strong','',t.stage),el('small','',state(t).completed?'曾完成':'待调查'));$('task-nav').append(a);}
}
function renderCase(){
  parseRoute();const s=state();document.body.dataset.case=active.id;document.title=task.title+' · SQL探案室';
  for(const[id,value]of Object.entries({'case-number':'案件 '+active.number,'case-level':active.level,'case-title':active.title,'case-subtitle':active.subtitle,'case-brief':active.brief,'case-task':task.task,'task-title':task.stage+'任务 · '+task.title,'case-caution':active.caution,'reference-code':task.answer,'reason-question':task.question}))$(id).textContent=value;
  $('case-art').innerHTML=illustration(active.id);$('case-tags').replaceChildren(...active.tags.map(t=>el('span','',t)));$('sql-editor').value=s.sql;
  $('mode-select').value=mode;$('sample-select').value=String(sample);$('save-progress').checked=keepProgress;
  const tables=dataset().tables,total=active.tables.reduce((n,t)=>n+tables[t.name].length,0);
  $('dataset-note').textContent=`${mode==='guide'?'引导':'练习'}样本 · ${active.tables.length}张证据表 / ${total}条记录 · 当前${'ABC'[sample]}组 · 执行时交叉验证全部三组。${active.id==='refund'?'金额以分存储，图表以元展示。':''}`;
  $('schema-list').replaceChildren();for(const table of active.tables){const card=el('div','schema-card'),b=el('button','table-button');b.type='button';b.append(el('strong','',table.name),el('span','',tables[table.name].length+'条 ↗'));b.setAttribute('aria-label','查看 '+table.name+' 示例数据');b.onclick=()=>{previewTable=table;previewPage=0;$('preview-search').value='';$('data-browser').open=true;renderPreview();};const list=el('ul','fields');for(const[name,type]of table.fields){const li=el('li');li.append(el('code','',name),el('span','',type));list.append(li);}card.append(b,el('p','',table.label),list);$('schema-list').append(card);}
  $('relation').textContent=active.id==='inventory'?'products.product_id  1 → 多  stock_moves.product_id':active.id==='refund'?'orders.order_id  1 → 多  refunds.order_id':'实际台账 ↔ 批准清单：角色 + 表名 + 操作，同时匹配';
  previewTable=null;previewPage=0;$('data-browser').open=false;$('preview-title').textContent='选择上方表名';
  $('reference').open=false;$('reference').dataset.owner=key();
  $('reason-choices').replaceChildren(el('legend','sr-only','选择符合证据边界的判断'));
  for(const i of s.order){const label=el('label','choice'),input=el('input');input.type='radio';input.name='reason';input.value=String(i);input.onchange=()=>{chooseAnswer(state(),i,task.correct,{version:DATA_VERSION,dataKey:key(),at:new Date().toISOString()});renderNavigation();persist();renderAssessment();};label.append(input,el('span','',task.choices[i]));$('reason-choices').append(label);}
  if(s.last?.result)renderResult(s.last.result);else emptyResult('证据等待被发现','先读表，再提交当前任务的调查SQL。');
  renderNavigation();renderHints();renderHistory();renderAssessment();controls();
  if(!ready)status('数据库尚未就绪，请等待或重新加载。',true);else status(s.last?.label||'数据库已就绪，准备后运行当前任务。');
  if(s.last&&!isCurrent(s))status('当前SQL尚未执行。下方是上次提交的结果，已标记过期。');
}
function renderPreview(){
  if(!previewTable)return;
  const all=dataset().tables[previewTable.name],needle=$('preview-search').value.trim().toLowerCase();const rows=all.filter(row=>!needle||row.some(v=>String(v).toLowerCase().includes(needle)));const pages=Math.max(1,Math.ceil(rows.length/12));previewPage=Math.min(previewPage,pages-1);
  $('preview-title').textContent=previewTable.name;$('preview-meta').textContent=rows.length+' / '+all.length+' 条';$('preview-page').textContent=(previewPage+1)+' / '+pages+' 页';$('preview-prev').disabled=previewPage===0;$('preview-next').disabled=previewPage>=pages-1;
  tableInto($('preview-panel'),{columns:previewTable.fields.map(f=>f[0]),values:rows.slice(previewPage*12,previewPage*12+12)},'证据表 '+previewTable.name);
}
function tableInto(container,data,caption){const scroll=el('div','table-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','可滚动的'+caption);const table=el('table');table.append(el('caption','sr-only',caption));const head=el('thead'),hr=el('tr');for(const c of data.columns){const th=el('th','',c);th.scope='col';hr.append(th);}head.append(hr);table.append(head);const body=el('tbody');for(const row of data.values){const tr=el('tr');for(const v of row)tr.append(el('td',v===null?'null-value':'',v===null?'NULL':v instanceof Uint8Array?'[二进制]':String(v)));body.append(tr);}table.append(body);scroll.append(table);container.replaceChildren(scroll);if(!data.values.length)container.append(el('p','result-foot','没有匹配的记录。'));}
function emptyResult(title,description){const box=el('div','empty-state');box.append(el('span','','▤'),el('strong','',title),el('p','',description));$('result-panel').replaceChildren(box);$('result-meta').textContent='';}
function renderResult(data){tableInto($('result-panel'),data,'调查查询结果');$('result-meta').textContent=data.values.length+(data.truncated?'＋':'')+' 行 / '+data.columns.length+' 列';if(data.truncated)$('result-panel').append(el('p','result-foot','超过200行，仅显示前200行，本次不通过。'));}
function renderAssessment(){
  const s=state(),fresh=isCurrent(s),result=s.last?.result;
  for(const id of ['grade','interpretation','verification','chart-panel'])$(id).hidden=true;
  $('trail-query').className='';$('trail-conclude').className='';$('next-task').hidden=true;$('result-panel').classList.toggle('outdated',!!s.last&&!fresh);
  if(!s.last)return;
  $('grade').hidden=false;$('grade').className='grade';
  if(!fresh){$('grade').textContent='当前SQL未执行：下表为上次提交结果，已过期。';return;}
  if(pending){$('grade').textContent='正在验证当前提交；暂不使用上次结论。';return;}
  if(!result){$('grade').textContent=s.last.label;return;}
  const passed=result.checks.filter(c=>c.matched).length;$('grade').classList.toggle('success',s.last.matched);
  $('grade').textContent=s.last.matched?'✓ 三组数据全部吻合。继续完成证据判断。':`${passed} / ${result.checks.length} 组通过。请核查字段顺序、筛选和聚合口径。`;
  $('verification').hidden=false;$('verification').replaceChildren();for(const check of result.checks){const chip=el('div','check-chip '+(check.matched?'pass':''));chip.append(el('strong','',`样本${'ABC'[(sample+check.group-1)%3]} ${check.matched?'✓':'待核查'}`));if(feedback==='guided'&&!check.matched)chip.append(el('small','',check.truncated?'超过200行':`缺少${check.missing}行 / 多出${check.extra}行`));$('verification').append(chip);}
  if(!s.last.matched)return;
  $('trail-query').className='trail-active';$('interpretation').hidden=false;
  const correct=currentPassed(s,task.correct);$('reason-feedback').textContent=s.choice===null?'':(correct?'✓ 本次作答通过。':'本次判断需要调整。')+task.explain;$('reason-feedback').classList.toggle('error',s.choice!==null&&!correct);
  for(const input of $('reason-choices').querySelectorAll('input'))input.checked=Number(input.value)===s.choice;
  $('trail-conclude').className=correct?'trail-active':'';
  if(correct){const index=allTasks.findIndex(t=>t.id===task.id);$('next-task').hidden=index===allTasks.length-1;$('next-task').textContent='进入下一任务 →';}
  renderChart(result);
}
function renderChart(result){
  const spec=chartSpec(task.id,result),panel=$('chart-panel');if(!spec)return;panel.hidden=false;panel.replaceChildren(el('h4','',spec.title));
  if(spec.kind==='note'){panel.append(el('p','small muted',spec.text));return;}
  if(spec.kind==='matrix'){const rows=spec.roles.map(role=>[role,...spec.objects.map(obj=>spec.rows.filter(r=>String(r[0])===role&&String(r[1])===obj).map(r=>r[2]||'SELECT').join('、')||'—')]);const box=el('div');tableInto(box,{columns:['角色',...spec.objects],values:rows},'查询结果权限矩阵');panel.append(box);panel.append(el('p','small muted','仅展示本次查询返回的授权；矩阵不代表完整系统权限。'));return;}
  panel.append(el('p','small muted','与上方实际查询结果对应 · 单位：'+spec.unit));const max=Math.max(1,...spec.items.flatMap(i=>i.values.map(Math.abs)));
  const list=el('div','chart-bars');for(const item of spec.items){const row=el('div','chart-row');row.append(el('strong','chart-name',item.name));item.values.forEach((value,i)=>{const line=el('div','bar-line'),track=el('div','bar-track'),bar=el('span','bar-fill series-'+i+(value<0?' negative':''));bar.style.width=Math.max(1,Math.abs(value)/max*100)+'%';track.append(bar);line.append(el('span','bar-label',spec.labels[i]),track,el('span','bar-number',new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(value)));row.append(line);});list.append(row);}panel.append(list);
}
function renderHints(){const s=state();$('hint-count').textContent=s.hints+' / '+task.hints.length;$('hint-list').replaceChildren(...task.hints.slice(0,s.hints).map(t=>el('li','',t)));$('hint-button').disabled=s.hints>=task.hints.length||feedback==='challenge';$('hint-button').textContent=feedback==='challenge'?'挑战模式：线索已收起':s.hints>=task.hints.length?'全部线索已展开':s.hints?'再看一条线索 ＋':'打开第一条线索 ＋';$('hint-list').hidden=feedback==='challenge';$('reference').hidden=feedback==='challenge';}
function renderHistory(){$('history-count').textContent=String(state().history.length);$('history-list').replaceChildren(...state().history.map(item=>{const li=el('li');li.append(el('span','',item.label),el('code','',item.sql));return li;}));if(!state().history.length)$('history-list').append(el('li','','还没有调查查询记录；浏览证据表不计入提交。'));}
function exportRecap(){const s=state(),last=s.last,result=last?.result,lines=['SQL探案室 · 任务复盘','案件：'+active.title,'任务：'+task.stage+' / '+task.title,'导出时间：'+new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'medium'}).format(new Date()),'数据库：sql.js 1.13.0 / SQLite；未接入MySQL和Coze','数据：虚构 / '+mode+' / 样本'+'ABC'[sample]+' / 版本'+DATA_VERSION,'','任务目标',task.task,'','最近提交SQL',last?.sql||'无','当前编辑器：'+(last&&!isCurrent(s)?'已更改，尚未执行':'与提交一致或尚未提交'),'执行状态：'+(last?.label||'未执行'),'三组验证：'+(result?result.checks.map(c=>'组'+c.group+':'+(c.matched?'通过':'未通过')).join('；'):'无'),'本次作答：'+(s.choice===null?'尚未判断':currentPassed(s,task.correct)?'通过':'未通过'),'历史完成：'+(s.completed?'曾完成':'未完成'),'提示：'+s.hints+'/'+task.hints.length+'；参考解法：'+(s.reference?'已查看':'未查看'),'','提交结果',result?JSON.stringify({columns:result.columns,rows:result.values,truncated:result.truncated},null,2):'无','证据判断',s.choice===null?'未作答':task.choices[s.choice],'','方法复盘',task.knowledge,'','边界',active.caution,task.explain,'前端三组验证不等于全部数据正确，也不具备考试防作弊能力。'];const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\n')],{type:'text/plain;charset=utf-8'}));const a=el('a');a.href=url;a.download='SQL探案室-'+task.title+'-复盘.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status('复盘已生成，请查看浏览器下载列表。');}
function dataChanged(){if(pending)startEngine(true);const url=new URL(location.href);url.searchParams.set('mode',mode);url.searchParams.set('sample',sample);history.replaceState(null,'',url);renderCase();}
$('sql-editor').addEventListener('input',()=>{editAttempt(state(),$('sql-editor').value);renderAssessment();if(state().last)status(isCurrent(state())?'编辑器与上次提交一致。':'当前SQL尚未执行。上次结果已标记过期，请重新运行。');});
$('sql-editor').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();execute();}});
$('run-button').onclick=execute;$('retry-button').onclick=()=>startEngine(true);
$('mode-select').onchange=e=>{mode=e.target.value;dataChanged();};$('sample-select').onchange=e=>{sample=Number(e.target.value);dataChanged();};$('help-select').onchange=e=>{feedback=e.target.value;renderHints();renderAssessment();};
$('preview-search').oninput=()=>{previewPage=0;renderPreview();};$('preview-prev').onclick=()=>{previewPage--;renderPreview();};$('preview-next').onclick=()=>{previewPage++;renderPreview();};
$('hint-button').onclick=()=>{state().hints=Math.min(task.hints.length,state().hints+1);renderHints();};
$('reference').addEventListener('toggle',()=>{if($('reference').open){const owner=states.get($('reference').dataset.owner);if(owner)owner.reference=true;}});
$('load-answer').onclick=()=>{state().reference=true;editAttempt(state(),task.answer);$('sql-editor').value=task.answer;renderAssessment();status('已载入参考解法，尚未执行。复盘会记录已查看参考。');$('sql-editor').focus();};
$('reset-button').onclick=()=>{if(!window.confirm('清空当前任务在本组数据中的查询、线索和完成记录？'))return;if(pending)startEngine(true);states.set(key(),createAttempt(task.starter,task.choices));persist();renderCase();status('当前任务已重置。');};
$('next-task').onclick=()=>{const index=allTasks.findIndex(t=>t.id===task.id),next=allTasks[index+1];if(next)location.hash=next.caseId+'/'+next.index;};
$('save-progress').onchange=e=>{keepProgress=e.target.checked;if(keepProgress)persist();else{try{localStorage.removeItem(storageKey);$('storage-status').textContent='已关闭保存并清除本机记录。';}catch{$('storage-status').textContent='无法清除本机记录，请检查浏览器存储设置。';}}};
$('clear-progress').onclick=()=>{if(!window.confirm('清除本项目保存在本机的完成标记？当前页面的查询不会丢失。'))return;try{localStorage.removeItem(storageKey);keepProgress=false;$('save-progress').checked=false;$('storage-status').textContent='已清除本机保存，当前会话记录仍保留。';}catch{$('storage-status').textContent='清除失败，请检查浏览器存储设置。';}};
$('export-button').onclick=exportRecap;$('about-button').onclick=()=>$('about-dialog').showModal();$('close-about').onclick=()=>$('about-dialog').close();$('start-button').onclick=()=>$('about-dialog').close();
document.querySelector('.skip-link').onclick=e=>{e.preventDefault();$('workspace').focus();$('workspace').scrollIntoView({block:'start'});};
window.addEventListener('hashchange',()=>{if(pending)startEngine(true);renderCase();});
loadProgress();renderCase();startEngine();
