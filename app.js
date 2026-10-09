'use strict';

const icons = {
  card: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8" cy="11" r="2"/><path d="M5 16h6m4-6h3m-3 4h3"/>',
  grant: '<path d="m3 8 9-5 9 5-9 5-9-5Zm4 3v6c3 2 7 2 10 0v-6m4-3v8"/>',
  account: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 11-5"/><rect x="14" y="15" width="8" height="7" rx="2"/><path d="M16 15v-2a2 2 0 0 1 4 0v2"/>',
  network: '<path d="M2 7a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 5a6 6 0 0 1 8 0"/><circle cx="12" cy="21" r="1"/>'
};

const services = [
  { id:'card', title:'学生证补办', category:'affairs', label:'证件与日常办事', color:'blue', description:'证件不见了？先理清补办步骤与材料。', aliases:['学生证','证件补办','挂失'], keys:/学生证/,
    intro:'先核对补办要求，再准备材料，减少来回跑。下面是准备流程示例，并非学校正式规定。',
    items:['向辅导员确认是否需要先挂失','核对身份核验方式与照片要求','确认申请表及是否需要电子版','确认受理地点、费用与领取方式'],
    steps:['联系辅导员或学校公布的办事渠道，获取现行补办说明。','按照正式说明准备材料；照片规格、费用及申请表以学校要求为准。','核对受理时间与地点后提交申请，记录领取方式。'],
    question:'你现在需要先了解哪一步？', choices:['我还没有挂失','我想确认需要哪些材料','我想知道去哪里办理'] },
  { id:'grant', title:'奖助申请导航', category:'affairs', label:'奖助与申请事项', color:'green', description:'了解申请入口，整理需要核对的条件。', aliases:['奖学金','助学金','资助','奖助申请'], keys:/奖学金|助学金|奖助|资助|助学|奖学/,
    intro:'申请类别不同，资格与材料也不同。先找到本学年的正式通知，再确认你需要准备什么。',
    items:['确认申请类别与本学年通知','核对申请条件及是否需要认定','确认材料清单、模板与提交方式','核实截止日期和咨询渠道'],
    steps:['通过学校正式渠道或辅导员获取本学年申请通知。','逐条核对资格条件；未提供正式通知时，无法判断你是否符合申请条件。','按通知整理材料，并向辅导员确认不清楚的条目。','在核实的截止日期前提交，保留提交记录。'],
    question:'你想了解哪类申请？', choices:['助学金','奖学金','还不确定，先了解区别'] },
  { id:'account', title:'校园账号求助', category:'technical', label:'账号与信息安全', color:'coral', description:'忘记密码、登录失败，找到安全的处理方式。', aliases:['密码','登录','登陆','教务','认证','账户'], keys:/账号|账户|登录|登陆|密码|验证码|认证失败/,
    intro:'先确认是哪一个系统以及具体报错。不要向他人提供密码或验证码，也不要在不明链接中尝试登录。',
    items:['记录系统名称与完整报错（隐去个人信息）','通过学校正式入口核对账号状态','确认是否有官方自助找回入口','整理已尝试步骤，向受理人员说明'],
    steps:['确认访问的是学校公布的正式系统入口。','核对输入格式、大小写、网络状态及报错提示。','如需重置密码，只使用正式系统的找回入口；无法验证入口时先询问辅导员或学校受理人员。','仍无法登录时，整理报错与已尝试步骤，联系官方受理渠道。'],
    question:'主要遇到了哪种情况？', choices:['忘记密码','账号或密码提示错误','登录页打不开'] },
  { id:'network', title:'校园网故障排查', category:'technical', label:'校园网络与设备', color:'yellow', description:'连不上、打不开网页？跟着步骤逐项排查。', aliases:['wifi','wi-fi','无线网','校园网','宿舍网','断网','上网','网速'], keys:/校园网|wifi|wi-fi|无线网|上网|断网|网速|宿舍网|网络.*(?:连|断|慢)|(?:连|断).*网络/i,
    intro:'从连接状态开始，一次检查一项。未解决的问题可以整理成摘要，方便向学校网络受理人员求助。', items:[], steps:[] }
];

const $ = (selector) => document.querySelector(selector);
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const STORAGE_KEY = 'campus-service-checklists-v1';
let saved = [];
let drafts = {};
let selectedService = null;
let currentFilter = 'all';
let diagnostic = { stage:0, answers:[], device:'未填写', location:'未填写' };
let toastTimer;
let removedRecord;
let storageWarningShown=false;

try {
  const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  saved = CampusLogic.sanitizeSaved(records,services);
} catch { saved=[]; }

function notify(message, undo=false) {
  const toast=$('#toast');
  toast.textContent=message;
  if(undo) {
    const button=document.createElement('button'); button.textContent='撤销'; button.dataset.action='undo-remove'; button.className='secondary-button'; button.style.marginLeft='12px'; toast.append(button);
  }
  toast.hidden=false;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>{toast.hidden=true;},undo?10000:3500);
}

function persist(refreshList=true) {
  let stored=false;
  try { stored=CampusLogic.writeSaved(localStorage,STORAGE_KEY,saved); } catch { stored=false; }
  updateCount(); if(refreshList)renderSaved();
  return stored;
}

function updateCount() { const count=$('#saved-count'); count.textContent=saved.length; count.hidden=saved.length===0; }
function cardHTML(s) { return `<button class="service-card" data-service="${s.id}" data-color="${s.color}"><span class="service-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[s.id]}</svg></span><span class="card-arrow" aria-hidden="true">↗</span><h3>${s.title}</h3><p>${s.description}</p><span class="card-category">${s.label}</span></button>`; }

function renderDirectory() {
  const query=$('#service-search').value.trim();
  const matches=CampusLogic.searchServices(services,query,currentFilter);
  $('#directory-services').innerHTML=matches.map(cardHTML).join(''); $('#no-services').hidden=matches.length>0;
  document.querySelectorAll('[data-filter]').forEach(button=>{ const on=button.dataset.filter===currentFilter; button.classList.toggle('selected',on);button.setAttribute('aria-pressed',String(on)); });
}

function route() {
  const [page,query='']=(location.hash.slice(1)||'home').split('?');
  const name=['home','services','saved'].includes(page)?page:'home';
  ['home','services','saved'].forEach(id=>{$(`#${id}-view`).hidden=id!==name;});
  document.querySelectorAll('[data-nav]').forEach(link=>{const active=link.dataset.nav===name;link.classList.toggle('active',active); if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  if(name==='services') {const params=new URLSearchParams(query);currentFilter=['all','affairs','technical'].includes(params.get('filter'))?params.get('filter'):'all';$('#service-search').value=params.get('q')||'';renderDirectory();}
  if(name==='saved') renderSaved();
}

function routeDirectory() {
  const params=new URLSearchParams();if(currentFilter!=='all')params.set('filter',currentFilter);const q=$('#service-search').value.trim();if(q)params.set('q',q);
  history.replaceState(null,'',`#services${params.size?'?'+params.toString():''}`);renderDirectory();
}

function setJourney(step) {
  document.querySelectorAll('[data-step]').forEach(li=>{const n=Number(li.dataset.step);li.classList.toggle('current',n===step);li.classList.toggle('done',n<step);li.querySelector('.step-number').textContent=n<step?'✓':n;});
}

function checkedFor(id) {return drafts[id] || saved.find(r=>r.id===id)?.checked || [];}
function checklistHTML(s,scope) {const checked=checkedFor(s.id);return `<div class="checklist">${s.items.map((item,i)=>`<label class="check-item"><input type="checkbox" data-check="${s.id}" data-index="${i}" data-scope="${scope}" ${checked.includes(i)?'checked':''}><span>${item}</span></label>`).join('')}</div>`;}

function openService(id) {
  const service=services.find(s=>s.id===id);if(!service)return;
  selectedService=service;$('#dialog-category').textContent=service.label;
  if(id==='network'){diagnostic={stage:0,answers:[],device:'未填写',location:'未填写'};renderDiagnostic();}
  else renderService();
  setJourney(3);if(!$('#service-dialog').open)$('#service-dialog').showModal();
}

function renderService() {
  const s=selectedService;const n=checkedFor(s.id).filter(i=>i>=0&&i<s.items.length).length;
  $('#dialog-content').innerHTML=`<h2 id="dialog-title">${s.title}</h2><p>${s.intro}</p><div class="demo-banner"><span aria-hidden="true">ⓘ</span><span>演示指引：下列内容为准备示例。学校正式材料、费用、时间、地点与受理渠道尚未核实，请向辅导员或学校公布的渠道确认。</span></div><section class="detail-section"><div class="progress-top"><h3>出发前，先核对这几件事</h3><span class="progress-count">${n} / ${s.items.length} 已确认</span></div><progress value="${n}" max="${s.items.length}" aria-label="清单确认进度"></progress><div style="height:14px"></div>${checklistHTML(s,'dialog')}</section><section class="detail-section"><h3>建议行动顺序</h3><ol class="detail-steps">${s.steps.map(step=>`<li>${step}</li>`).join('')}</ol></section><div class="source-note">资料状态：网页演示示例，非学校正式文件。正式来源待补充。</div><div class="detail-actions"><button class="primary-button" data-action="save" data-id="${s.id}">保存到我的清单 <span aria-hidden="true">＋</span></button><button class="secondary-button" data-action="copy-checklist" data-id="${s.id}">复制行动清单</button></div>`;
}

function renderSaved() {
  if(!saved.length){$('#saved-list').innerHTML='<div class="empty-saved"><span class="empty-symbol" aria-hidden="true">☑</span><h2>给下一次办事，留一张清单</h2><p>打开服务详情，点击“保存到我的清单”，就能在这里继续准备。</p><a href="#services" class="primary-button">去看看服务</a></div>';return;}
  $('#saved-list').innerHTML=saved.map(record=>{const s=services.find(s=>s.id===record.id);const count=checkedFor(s.id).filter(i=>i>=0&&i<s.items.length).length;return `<article class="saved-card" data-saved-id="${s.id}"><div class="saved-card-head"><div><h2>${s.title}</h2><p>${count}/${s.items.length} 已确认 · 演示清单，校内要求待核实</p></div><div class="saved-actions"><button class="secondary-button" data-service="${s.id}">查看步骤</button><button class="secondary-button danger-button" data-action="remove" data-id="${s.id}">移除</button></div></div>${checklistHTML(s,'saved')}</article>`;}).join('');
}

function checklistText(s) {const checked=checkedFor(s.id);return `${s.title}\n【演示清单，学校正式要求待核实】\n\n${s.items.map((item,i)=>`${checked.includes(i)?'☑':'☐'} ${item}`).join('\n')}\n\n建议行动顺序\n${s.steps.map((step,i)=>`${i+1}. ${step}`).join('\n')}\n\n资料来源：网页演示示例，非学校正式文件。`;}
async function copyText(text) {try {await navigator.clipboard.writeText(text);notify('已复制，可以粘贴到备忘录或消息中。');}catch {const existing=$('#copy-fallback');if(existing)existing.remove();const field=document.createElement('textarea');field.id='copy-fallback';field.value=text;field.readOnly=true;field.setAttribute('aria-label','复制受限，请手动选择并复制');field.rows=7;field.style.border='1px solid #dbe2ef';field.style.padding='12px';const target=$('#service-dialog').open?$('#dialog-content'):$('#saved-list');target.append(field);field.focus();field.select();notify('浏览器限制了自动复制，请手动复制选中的内容。');}}

function answerHTML(s,choice) {
  const detail=s.id==='grant'&&choice==='助学金'?'助学金通常用于资助有需要的学生，但具体资格、认定程序及材料必须以本学年学校通知为准。':s.id==='grant'&&choice==='奖学金'?'奖学金的具体评选条件因项目而异。没有本学年正式通知时，不能判断你是否符合条件。':s.id==='card'&&choice==='我想知道去哪里办理'?'当前还没有核实学校受理地点和时间，请先通过辅导员或学校正式渠道确认。这里不会编造办公室地址。':s.id==='account'&&choice==='忘记密码'?'只通过学校正式系统的自助找回功能处理。不要把密码或验证码发给任何人。':s.intro;
  return `<div class="answer-block"><div class="answer-heading"><span aria-hidden="true">✦</span> 已找到：${s.title}</div><p>${detail}</p><button class="answer-service-link" data-service="${s.id}">${s.id==='network'?'开始逐步排查':'查看步骤与准备清单'} <span aria-hidden="true">↗</span></button><p class="selection-hint" style="margin-top:10px;margin-bottom:0">按本地演示规则匹配。校内信息待核实。</p></div>`;
}

function showQuestion(raw) {
  const question=raw.trim();const error=$('#question-error');
  if(!question){error.textContent='先描述你想办的事，或选择一个示例问题。';error.hidden=false;$('#question').focus();return;}
  error.hidden=true;$('#assistant-empty').hidden=true;
  const sensitive=CampusLogic.hasSensitiveInput(question);
  if(sensitive){$('#conversation').innerHTML='<div class="answer-block"><div class="answer-heading">先保护好你的个人信息</div><p class="sensitive-hint">内容中可能包含密码、验证码或个人号码。请删除这些信息，只保留问题描述和报错提示，再试一次。</p></div>';setJourney(1);return;}
  const user=`<div class="user-message"><p>${escapeHTML(question)}</p></div>`;
  const matches=services.filter(s=>s.keys.test(question));
  $('#conversation').innerHTML=user;
  if(matches.length===0){$('#conversation').innerHTML+='<div class="answer-block"><div class="answer-heading"><span aria-hidden="true">✦</span> 这件事，还需要换个方式确认</div><p>目前只支持学生证、奖助申请、校园账号和校园网四类演示服务。可以选择一个相关入口；其他事项暂时没有可靠指引。</p><div class="choices">'+services.map(s=>`<button data-service="${s.id}">${s.title}</button>`).join('')+'</div></div>';setJourney(1);return;}
  if(matches.length>1){$('#conversation').innerHTML+=`<div class="answer-block"><div class="answer-heading">你提到了几件事，先选一件处理</div><div class="choices">${matches.map(s=>`<button data-pick="${s.id}">${s.title}</button>`).join('')}</div></div>`;setJourney(2);return;}
  offerService(matches[0],user);
}

function offerService(s,userHTML) {
  if(s.id==='network'){$('#conversation').innerHTML=userHTML+answerHTML(s);setJourney(2);return;}
  $('#conversation').innerHTML=userHTML+`<div class="answer-block"><div class="answer-heading"><span aria-hidden="true">✦</span> ${s.title}</div><p>${s.question}</p><div class="choices">${s.choices.map(choice=>`<button data-answer="${s.id}" data-choice="${escapeHTML(choice)}">${choice}</button>`).join('')}</div></div>`;setJourney(2);
}

const diagnosticStages=[
  {title:'设备已经连上校园网络了吗？',description:'先查看设备的网络连接状态。网络名称需要按学校公布的信息核实。',options:[['已连接，但打不开网页',1],['还没有连接上',2],['不清楚连接状态',2]]},
  {title:'是否看到了学校的认证页面？',description:'仅使用学校公布的正式认证入口，不要在陌生链接中输入账号或密码。',options:[['认证成功，仍然无法上网',3],['认证提示账号或密码错误',4],['没有认证页面，或无法确认入口',5]]},
  {title:'先检查连接，再试一次',description:'确认飞行模式已关闭、无线功能已开启，并选择学校公布的网络。不要改动不熟悉的系统设置。',options:[['现在连上了，但还是不能上网',1],['现在可以正常上网了','success'],['仍无法连接，准备求助','report']]},
  {title:'同一位置，其他同学也有这个问题吗？',description:'这个信息可以帮助受理人员判断是单台设备还是较大范围的问题，不能单凭它确定故障原因。',options:[['其他同学也无法上网','report'],['其他同学正常，只有我有问题',6],['暂时不清楚','report']]},
  {title:'先按账号问题处理',description:'核对大小写与输入格式。需要重置时，只使用正式找回入口；仍失败则记录报错。不要在这里填写密码。',options:[['核对后已经可以上网','success'],['仍认证失败，整理报修摘要','report']]},
  {title:'先确认正式入口',description:'请向辅导员、学校公布的网络说明或受理人员核实认证入口。没有校内资料时，这里无法提供准确地址。',options:[['获取正式入口后已恢复','success'],['需要人工帮助，整理摘要','report']]},
  {title:'重新连接后，再测试一次',description:'在不影响正在进行的工作时，断开并重新连接网络，再打开常用网页。若仍失败，请保留报错截图并隐去个人信息。',options:[['现在可以正常上网了','success'],['仍无法上网，整理报修摘要','report']]}
];

function renderDiagnostic() {
  const steps=diagnosticStages[diagnostic.stage];
  $('#dialog-content').innerHTML=`<h2 id="dialog-title">校园网故障排查</h2><p>先检查基础连接，再确认认证状态。一步一步缩小问题范围。</p><div class="diagnostic-progress" aria-label="已完成${diagnostic.answers.length}项检查">${Array.from({length:4},(_,i)=>`<span class="${i<Math.min(diagnostic.answers.length,4)?'done':''}"></span>`).join('')}<b>已记录 ${diagnostic.answers.length} 项检查</b></div><section class="diagnostic-question"><h3>${steps.title}</h3><p>${steps.description}</p><div class="diagnostic-options">${steps.options.map(([label,next])=>`<button data-diagnostic-next="${next}" data-label="${escapeHTML(label)}">${label}</button>`).join('')}</div></section><div class="source-note">基础排查示例。学校网络名称、认证入口与受理渠道待核实。</div><div class="detail-actions">${diagnostic.answers.length?'<button class="secondary-button" data-action="diagnostic-back">返回上一步</button>':''}<button class="secondary-button" data-action="diagnostic-restart">重新排查</button></div>`;
  focusDialogContent('.diagnostic-question h3');
}

function focusDialogContent(selector='#dialog-title') {
  if(!$('#service-dialog').open)return;
  const target=$('#dialog-content').querySelector(selector);
  if(target){target.tabIndex=-1;target.focus();}
}

function reportText() {
  return `校园网问题求助摘要\n设备：${diagnostic.device}\n位置（可选）：${diagnostic.location}\n\n已检查的情况：\n${diagnostic.answers.map((a,i)=>`${i+1}. ${diagnosticStages[a.stage].title}\n   ${a.label}`).join('\n')}\n\n当前状态：问题未解决，需要人工协助。\n受理渠道：请使用学校公布的正式渠道；本页面尚未核实具体联系方式。\n请勿附上密码、验证码或完整个人证件信息。`;
}

function renderReport() {
  $('#dialog-content').innerHTML=`<h2 id="dialog-title">把问题说清楚，求助更方便</h2><p>排查还没有解决问题。补充设备信息，生成可复制的求助摘要；此页面不会自动报修。</p><form id="report-form" class="diagnostic-form"><label for="device">使用的设备</label><select id="device" name="device"><option>未填写</option><option>Windows 电脑</option><option>Mac 电脑</option><option>Android 手机</option><option>iPhone / iPad</option><option>其他设备</option></select><label for="location">大致位置（可选，不填写房间号或个人信息）</label><input id="location" name="location" maxlength="40" autocomplete="off" placeholder="例如：宿舍区、图书馆…"><div class="detail-actions"><button class="primary-button" type="submit">生成求助摘要 <span aria-hidden="true">↗</span></button><button class="secondary-button" type="button" data-action="diagnostic-back">返回排查</button></div></form>`;
  focusDialogContent();
}

document.addEventListener('click',event=>{
  const element=event.target.closest('button,[data-service]');if(!element)return;
  if(element.dataset.service){openService(element.dataset.service);return;}
  if(element.dataset.question){$('#question').value=element.dataset.question;showQuestion(element.dataset.question);return;}
  if(element.dataset.pick){const s=services.find(s=>s.id===element.dataset.pick);offerService(s,$('#conversation .user-message').outerHTML);return;}
  if(element.dataset.answer){const s=services.find(s=>s.id===element.dataset.answer);$('#conversation').innerHTML=$('#conversation .user-message').outerHTML+`<div class="user-message"><p>${escapeHTML(element.dataset.choice)}</p></div>`+answerHTML(s,element.dataset.choice);setJourney(3);return;}
  if(element.dataset.filter){currentFilter=element.dataset.filter;routeDirectory();return;}
  if(element.dataset.diagnosticNext){const next=element.dataset.diagnosticNext;diagnostic.answers.push({stage:diagnostic.stage,label:element.dataset.label});if(next==='success'){$('#dialog-content').innerHTML='<h2 id="dialog-title">网络恢复了，太好了！</h2><section class="diagnostic-success"><h3>这次问题已解决</h3><p>可以再打开一个常用网页确认。若问题反复发生，保留时间与报错记录，方便后续排查。</p></section><div class="detail-actions"><button class="primary-button" data-action="close-dialog">完成排查</button><button class="secondary-button" data-action="diagnostic-restart">重新排查</button></div>';focusDialogContent();}else if(next==='report')renderReport();else{diagnostic.stage=Number(next);renderDiagnostic();}return;}
  const action=element.dataset.action;
  if(action==='about')$('#about-dialog').showModal();
  if(action==='close-about')$('#about-dialog').close();
  if(action==='close-dialog')$('#service-dialog').close();
  if(action==='save'){const id=element.dataset.id;const existing=saved.find(r=>r.id===id);const checked=[...checkedFor(id)];if(existing)existing.checked=checked;else saved.push({id,checked,savedAt:new Date().toISOString()});const stored=persist();notify(stored?'已保存到“我的清单”，可以随时继续准备。':'浏览器未允许本地保存，清单仅在本次页面会话中保留，刷新后会丢失。');}
  if(action==='copy-checklist')copyText(checklistText(services.find(s=>s.id===element.dataset.id)));
  if(action==='remove'){const index=saved.findIndex(s=>s.id===element.dataset.id);if(index<0)return;removedRecord={record:saved[index],index};saved.splice(index,1);delete drafts[element.dataset.id];const stored=persist();notify(stored?'清单已移除。':'本次会话已移除；浏览器保存受限，刷新后可能恢复。',true);}
  if(action==='undo-remove'&&removedRecord){if(!saved.some(r=>r.id===removedRecord.record.id))saved.splice(removedRecord.index,0,removedRecord.record);removedRecord=null;const stored=persist();notify(stored?'清单已恢复。':'清单仅在本次会话恢复，浏览器保存受限。');}
  if(action==='diagnostic-back'){const last=diagnostic.answers.pop();diagnostic.stage=last?last.stage:0;renderDiagnostic();}
  if(action==='diagnostic-restart'){diagnostic={stage:0,answers:[],device:'未填写',location:'未填写'};renderDiagnostic();}
  if(action==='copy-report')copyText(reportText());
});

document.addEventListener('change',event=>{
  if(!event.target.matches('[data-check]'))return;
  const id=event.target.dataset.check;const index=Number(event.target.dataset.index);const checked=new Set(checkedFor(id));if(event.target.checked)checked.add(index);else checked.delete(index);drafts[id]=[...checked];
  const record=saved.find(r=>r.id===id);if(record){record.checked=[...checked];if(!persist(false)&&!storageWarningShown){storageWarningShown=true;notify('浏览器保存受限，本次进度在刷新后可能丢失。');}const s=services.find(s=>s.id===id);const count=$(`[data-saved-id="${id}"] .saved-card-head p`);if(count)count.textContent=`${checked.size}/${s.items.length} 已确认 · 演示清单，校内要求待核实`;document.querySelectorAll(`[data-saved-id="${id}"] [data-check]`).forEach(box=>box.checked=checked.has(Number(box.dataset.index)));}
  if($('#service-dialog').open&&selectedService?.id===id){const s=selectedService;$('#dialog-content .progress-count').textContent=`${checked.size} / ${s.items.length} 已确认`;$('#dialog-content progress').value=checked.size;document.querySelectorAll(`#dialog-content [data-check="${id}"]`).forEach(box=>box.checked=checked.has(Number(box.dataset.index)));}
});

document.addEventListener('submit',event=>{
  if(event.target.id==='ask-form'){event.preventDefault();showQuestion($('#question').value);}
  if(event.target.id==='report-form'){event.preventDefault();diagnostic.device=$('#device').value;const raw=$('#location').value.trim();diagnostic.location=raw.replace(/\b1[3-9]\d{9}\b/g,'[手机号已隐藏]').replace(/\b\d{17}[\dXx]\b/g,'[证件号已隐藏]')||'未填写';$('#dialog-content').innerHTML=`<h2 id="dialog-title">求助摘要已整理</h2><p>复制后发送给学校正式受理渠道。请先核对内容，确认没有个人敏感信息。</p><pre class="summary-text">${escapeHTML(reportText())}</pre><div class="detail-actions"><button class="primary-button" data-action="copy-report">复制求助摘要 <span aria-hidden="true">↗</span></button><button class="secondary-button" data-action="diagnostic-restart">重新排查</button></div>`;focusDialogContent();}
});

$('#service-search').addEventListener('input',routeDirectory);
$('#question').addEventListener('input',()=>{$('#question-error').hidden=true;});
$('#question').addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();showQuestion(event.target.value);}});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}}));
window.addEventListener('hashchange',route);
$('.skip-link').addEventListener('click',event=>{event.preventDefault();$('#main').focus();});
$('#home-services').innerHTML=services.map(cardHTML).join('');updateCount();route();
