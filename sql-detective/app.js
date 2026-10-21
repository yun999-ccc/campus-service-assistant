import {cases,seed} from './cases.js';
import './guard.js';
const {validateSQL,compareRows}=globalThis.SQLDetectiveGuard;
const $=id=>document.getElementById(id);
const states=new Map(cases.map(c=>[c.id,{sql:c.starter,hints:0,reference:false,history:[],completed:false,last:null,choice:null}]));
let active=cases.find(c=>c.id===location.hash.slice(1))||cases[0], worker,ready=false,pending=null,engineTimer,queryTimer,sequence=0;
const current=()=>states.get(active.id);
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
function status(text,error=false){$('query-status').textContent=text;$('query-status').classList.toggle('error',error);}
function setControls(){
  $('run-button').disabled=!ready||!!pending;
  $('run-button').innerHTML=pending?'<span aria-hidden="true">◌</span> 查询中…':'<span aria-hidden="true">▶</span> 运行查询';
  document.querySelectorAll('.table-button').forEach(b=>b.disabled=!ready||!!pending);
}
function startEngine(){
  if(worker)worker.terminate();clearTimeout(engineTimer);clearTimeout(queryTimer);
  ready=false;pending=null;setControls();$('retry-button').hidden=true;$('engine-state').textContent='引擎加载中…';
  try{worker=new Worker(new URL('./worker.js',import.meta.url));}
  catch{engineFailure('浏览器未能启动查询引擎。请用最新版浏览器打开网站，不能直接双击 HTML 文件。');return;}
  engineTimer=setTimeout(()=>engineFailure('数据库引擎加载超时，请检查网络后重试。'),15000);
  worker.onerror=()=>engineFailure('查询引擎加载失败，请刷新页面或重新加载。');
  worker.onmessage=({data})=>{
    if(data.type==='ready'){clearTimeout(engineTimer);ready=true;$('engine-state').textContent='SQLite 已就绪';setControls();return;}
    if(data.type==='fatal'){engineFailure(data.error);return;}
    if(!pending||data.id!==pending.id)return;
    const request=pending;clearTimeout(queryTimer);pending=null;setControls();
    if(request.caseId!==active.id)return;
    if(data.type==='error'){
      status('SQL 未执行成功：'+data.error,true);
      if(request.purpose==='query'){saveAttempt(request.sql,null,'执行错误：'+data.error);hideGrade();renderEmpty('查询未完成','检查表名、字段和 SQL 语法后重试。');}
      return;
    }
    renderResult(data,request.purpose==='preview'?request.table:null);
    if(request.purpose==='preview'){status('已查看 '+request.table+' 的前 20 行。编辑器中的调查 SQL 保持不变。');return;}
    const matched=!data.truncated&&compareRows(data.values,active.expected);
    saveAttempt(request.sql,data,matched?'固定样本结果吻合':'结果尚未吻合',matched);
    status('查询完成。数据库耗时 '+data.elapsed+' ms（含本地数据初始化），返回 '+data.values.length+(data.truncated?'＋':'')+' 行。');
    showGrade(matched,data.truncated);
    if(request.sql!==current().sql){hideGrade();status('上一次提交的查询已执行，但编辑器内容已变化。请重新运行当前 SQL 后核对。');}
  };
}
function engineFailure(message){
  clearTimeout(engineTimer);clearTimeout(queryTimer);if(worker)worker.terminate();ready=false;
  const failed=pending;pending=null;
  if(failed?.purpose==='query'){saveAttempt(failed.sql,null,'引擎失败');hideGrade();}
  $('engine-state').textContent='引擎未就绪';$('retry-button').hidden=false;status(message,true);setControls();
}
function execute(sql,purpose='query',table=null){
  if(pending||!ready){status('请等待数据库引擎准备好。',true);return;}
  const validation=validateSQL(sql);
  if(!validation.ok){status(validation.error,true);if(purpose==='query'){saveAttempt(sql,null,'输入被拦截');hideGrade();renderEmpty('请调整查询','当前只运行一条 SELECT。数据不会被修改。');}return;}
  hideGrade();
  const id=++sequence;pending={id,sql,caseId:active.id,purpose,table};setControls();status(purpose==='preview'?'正在读取证据表…':'正在执行调查查询…');
  queryTimer=setTimeout(()=>{
    if(!pending||pending.id!==id)return;
    if(purpose==='query'){saveAttempt(sql,null,'查询超时');renderEmpty('查询已中止','请检查连接条件，缩小结果范围后重试。');}
    startEngine();status('查询超过 1.5 秒，已中止并重建演练环境。请简化 SQL 后重试。',true);
  },1500);
  worker.postMessage({id,sql:validation.sql,seed});
}
function saveAttempt(sql,result,label,matched=false){
  const s=current();s.last={sql,result,label,matched};s.choice=null;
  s.history.unshift({sql,label});s.history=s.history.slice(0,10);renderHistory();
}
function renderNavigation(){
  $('case-list').replaceChildren();
  for(const c of cases){
    const b=el('button','case-link');b.type='button';b.setAttribute('aria-label',`案件${c.number} ${c.title}${states.get(c.id).completed?'，已完成':''}`);
    if(c.id===active.id)b.setAttribute('aria-current','page');
    b.append(el('span','case-index',c.number));const label=el('span');label.append(el('span','case-name',c.title),el('small','',c.level));b.append(label);
    if(states.get(c.id).completed){const check=el('span','completion','✓');check.setAttribute('aria-hidden','true');b.append(check);}
    b.onclick=()=>{if(active.id!==c.id)location.hash=c.id;};$('case-list').append(b);
  }
  const count=[...states.values()].filter(s=>s.completed).length;$('progress-text').textContent=count+' / 3';$('progress').value=count;
}
function renderCase(){
  const s=current();document.title=active.title+' · SQL探案室';
  for(const [id,value] of Object.entries({'case-number':'案件 '+active.number,'case-level':active.level,'case-title':active.title,'case-subtitle':active.subtitle,'case-brief':active.brief,'case-task':active.task,'case-caution':active.caution,'reference-code':active.answer,'reason-question':active.question}))$(id).textContent=value;
  $('case-tags').replaceChildren(...active.tags.map(t=>el('span','',t)));
  $('schema-list').replaceChildren();
  for(const table of active.tables){
    const card=el('div','schema-card'),b=el('button','table-button');b.type='button';b.append(el('strong','',table.name),el('span','','↗'));b.setAttribute('aria-label','查看 '+table.name+' 示例数据');b.onclick=()=>execute('SELECT * FROM '+table.name+' LIMIT 20;','preview',table.name);
    const list=el('ul','fields');for(const [name,type]of table.fields){const li=el('li');li.append(el('code','',name),el('span','',type));list.append(li);}card.append(b,el('p','',table.label),list);$('schema-list').append(card);
  }
  $('sql-editor').value=s.sql;
  $('reason-choices').replaceChildren(el('legend','sr-only','选择符合证据边界的判断'));
  active.choices.forEach((choice,i)=>{
    const label=el('label','choice'),input=el('input');input.type='radio';input.name='reason';input.value=String(i);input.onchange=()=>chooseReason(i);label.append(input,el('span','',choice));$('reason-choices').append(label);
  });
  $('reference').open=false;
  if(s.last?.result){renderResult(s.last.result);showGrade(s.last.matched,s.last.result.truncated);if(s.last.sql!==s.sql)hideGrade();if(s.choice!==null&&s.last.sql===s.sql){const input=$('reason-choices').querySelector(`input[value="${s.choice}"]`);if(input)input.checked=true;renderReason();}}
  else {renderEmpty('证据等待被发现','可以先查看一张表，再尝试组合查询。');hideGrade();}
  status(s.last?s.last.label:'准备查询后，点击“运行查询”。');renderNavigation();renderHints();renderHistory();setControls();
}
function renderHints(){
  const s=current();$('hint-count').textContent=s.hints+' / 3';$('hint-list').replaceChildren(...active.hints.slice(0,s.hints).map(t=>el('li','',t)));
  $('hint-button').disabled=s.hints>=3;$('hint-button').textContent=s.hints>=3?'三条线索已全部展开':s.hints===0?'打开第一条线索 ＋':'再看一条线索 ＋';
}
function renderHistory(){
  const s=current();$('history-count').textContent=String(s.history.length);$('history-list').replaceChildren();
  if(!s.history.length){$('history-list').append(el('li','','还没有执行调查查询。表数据预览不计入查询记录。'));return;}
  for(const item of s.history){const li=el('li');li.append(el('span','',item.label),el('code','',item.sql));$('history-list').append(li);}
}
function renderEmpty(title,description){const box=el('div','empty-state');box.append(el('span','','▤'),el('strong','',title),el('p','',description));$('result-panel').replaceChildren(box);$('result-meta').textContent='';}
function renderResult(data,tableName=null){
  const scroll=el('div','table-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','可滚动的查询结果表');
  const table=el('table'),caption=el('caption','sr-only',tableName?tableName+' 的样本数据':'调查查询结果');table.append(caption);
  const head=el('thead'),tr=el('tr');for(const name of data.columns){const th=el('th','',name);th.scope='col';tr.append(th);}head.append(tr);table.append(head);
  const body=el('tbody');for(const row of data.values){const line=el('tr');for(const v of row)line.append(el('td',v===null?'null-value':'',v===null?'NULL':v instanceof Uint8Array?'[二进制]':String(v)));body.append(line);}table.append(body);scroll.append(table);
  $('result-panel').replaceChildren(scroll);
  if(!data.values.length)$('result-panel').append(el('p','result-foot','查询执行成功，返回 0 行。'));
  if(data.truncated)$('result-panel').append(el('p','result-foot','结果超过 200 行，仅显示前 200 行。本次不作通过核对。'));
  if(tableName)$('result-panel').append(el('p','result-foot','证据表预览 · 不计为任务核对；运行编辑器中的 SQL 后再判断。'));
  $('result-meta').textContent=(tableName?'表预览 · ':'')+data.values.length+(data.truncated?'＋':'')+' 行 / '+data.columns.length+' 列';
}
function hideGrade(){
  $('grade').hidden=true;$('interpretation').hidden=true;$('trail-query').className='';$('trail-conclude').className='';$('reason-feedback').textContent='';
}
function showGrade(matched,truncated){
  $('grade').hidden=false;$('grade').classList.toggle('success',matched);
  $('grade').textContent=matched?'✓ 固定样本的结果吻合。继续完成下方证据判断。':truncated?'返回行数超出上限，请收紧查询后再核对。':'还未得到目标结果。检查输出列的顺序、筛选条件和聚合口径；也可以打开一条线索。';
  $('interpretation').hidden=!matched;$('trail-query').className=matched?'trail-active':'';$('trail-conclude').className='';
  $('reason-feedback').textContent='';$('reason-choices').querySelectorAll('input').forEach(input=>input.checked=false);
}
function chooseReason(i){
  const s=current();if(!s.last?.matched)return;s.choice=i;
  if(i===active.correct){s.completed=true;renderNavigation();}
  renderReason();
}
function renderReason(){
  const s=current(),correct=s.choice===active.correct;
  $('reason-feedback').textContent=(correct?'✓ 本案调查完成。':'再想一想：')+active.explain;
  $('reason-feedback').classList.toggle('error',!correct);$('trail-conclude').className=correct?'trail-active':'';
}
function exportRecap(){
  const s=current(),last=s.last;
  const result=last?.result;
  const lines=['SQL探案室 · 本案复盘','案件：'+active.number+' '+active.title,'导出时间：'+new Date().toLocaleString('zh-CN'),'执行环境：sql.js 1.13.0 / SQLite（不是 MySQL）','辅导状态：本地规则；Coze 未接入','数据来源：项目内置虚构样本','', '调查目标',active.task,'','最近一次调查 SQL',last?.sql||'尚未执行调查查询','', '执行与核对状态',last?.label||'尚未执行','提示使用：'+s.hints+'/3；参考解法：'+(s.reference?'已查看':'未查看'),'结果核对仅适用于固定样本，不证明所有数据下都正确。','', '最近一次查询结果',result?JSON.stringify({columns:result.columns,rows:result.values,truncated:result.truncated},null,2):'无结果','', '与上述查询对应的证据判断',s.choice===null?'尚未完成':active.choices[s.choice]+'（'+(s.choice===active.correct?'符合证据边界':'需要调整')+'）','', '方法复盘',active.knowledge,'', '证据边界',active.caution,active.explain];
  const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\n')],{type:'text/plain;charset=utf-8'}));const a=el('a');a.href=url;a.download='SQL探案室-'+active.title+'-复盘.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status('已生成本案复盘文件，请在浏览器下载列表中查看。');
}
$('sql-editor').addEventListener('input',()=>{current().sql=$('sql-editor').value;if(!$('interpretation').hidden){hideGrade();status('编辑器内容已更改。请重新运行后核对；查询记录仍保留上一条已执行的 SQL。');}});
$('sql-editor').addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();execute($('sql-editor').value);}});
$('run-button').onclick=()=>execute($('sql-editor').value);
$('retry-button').onclick=startEngine;
$('hint-button').onclick=()=>{if(current().hints<3)current().hints++;renderHints();};
$('reference').addEventListener('toggle',()=>{if($('reference').open)current().reference=true;});
$('load-answer').onclick=()=>{current().reference=true;current().sql=active.answer;$('sql-editor').value=active.answer;hideGrade();$('sql-editor').focus();status('已放入参考解法。运行后可核对结果，复盘会记录已查看参考。');};
$('export-button').onclick=exportRecap;
$('reset-button').onclick=()=>{
  if(!window.confirm('重置本案的 SQL、提示和查询记录？其他案件不受影响。'))return;
  if(pending)startEngine();states.set(active.id,{sql:active.starter,hints:0,reference:false,history:[],completed:false,last:null,choice:null});renderCase();status('本案已重置。');
};
$('about-button').onclick=()=>$('about-dialog').showModal();
$('close-about').onclick=()=>$('about-dialog').close();$('start-button').onclick=()=>$('about-dialog').close();
window.addEventListener('hashchange',()=>{const next=cases.find(c=>c.id===location.hash.slice(1));if(!next||next.id===active.id)return;current().sql=$('sql-editor').value;if(pending)startEngine();active=next;renderCase();});
renderCase();startEngine();
