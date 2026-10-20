import {analyzeMail,redactMail} from './engine.js';
const $=s=>document.querySelector(s);
const config={cozeUrl:''};
const samples={suspicious:'From: 账号服务 <service@example.com>\nSubject: 账号即将停用\n请立即输入密码完成身份验证，否则暂停使用。\n<a href="https://verify.example.org/login">https://account.example.com</a>\n（人工构造演示样例，网址使用保留示例域名。）',normal:'From: 会议助理 <meeting@example.com>\nSubject: 明天的项目讨论\n请大家于明天上午十点参加项目讨论，地点与上周相同。如有疑问请使用之前保存的联系方式联系会议组织者。\n（人工构造演示样例，不能据此认证邮件真实。）',unknown:'请核对你的账号。\n（人工构造样例：缺少发件地址、链接和上下文。）'};
let current=null;
function notice(text){$('#notice').textContent=text;}
function counter(){$('#count').textContent=`${$('#mail').value.length} / 12000`;}
$('#mail').addEventListener('input',()=>{counter();current=null;$('#report').hidden=true;$('#empty').hidden=false;});
for(const b of document.querySelectorAll('[data-sample]'))b.onclick=()=>{$('#mail').value=samples[b.dataset.sample];counter();current=null;$('#report').hidden=true;$('#empty').hidden=false;notice('已填入人工构造样例，请选择操作阶段后分析。');};
function list(id,items){const el=$(id);el.replaceChildren(...items.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));}
function evidence(id,items,empty){const el=$(id);el.replaceChildren();if(!items.length){const p=document.createElement('p');p.textContent=empty;el.append(p);return;}for(const item of items){const p=document.createElement('p');const title=document.createElement('strong');title.textContent=item.title;const content=document.createElement('code');content.textContent=item.value||item.evidence||'';p.append(title,content);el.append(p);}}
$('#analysis-form').onsubmit=e=>{e.preventDefault();try{const stage=new FormData(e.target).get('stage');current=analyzeMail($('#mail').value,stage);if(['empty','too_long'].includes(current.status)){notice(current.actions[0]);$('#mail').focus();return;}$('#empty').hidden=true;$('#report').hidden=false;$('#status-label').textContent={review_priority:'优先核实关键请求',review:'发现需要核实的线索',insufficient:'证据不足，保留判断'}[current.status];evidence('#facts',current.facts,'没有足够的可观察字段。');evidence('#signals',current.signals,'未命中当前规则；这不能证明安全。');list('#unknown',current.unknown);list('#next',current.actions);notice('本地线索已提取。邮件内容与其中的网址均未被发送或访问。');}catch{notice('分析未完成，请缩短输入后重试。本站未发送邮件。');}};
$('#redact').onclick=()=>{$('#mail').value=redactMail($('#mail').value);counter();current=null;$('#report').hidden=true;$('#empty').hidden=false;notice('已辅助隐藏常见邮箱用户名、手机号、凭据字段和网址参数；仍需你手动检查。');};
$('#clear').onclick=()=>{$('#mail').value='';$('#prepared').value='';$('input[name="stage"][value="unknown"]').checked=true;for(const id of ['#facts','#signals','#unknown','#next'])$(id).replaceChildren();counter();current=null;$('#report').hidden=true;$('#empty').hidden=false;notice('已清空本次邮件与本地报告。');};
for(const radio of document.querySelectorAll('input[name="stage"]'))radio.addEventListener('change',()=>{if(current)$('#analysis-form').requestSubmit();});
function reportText(){return ['鉴信 · 本地规则报告','这不是Coze模型回答，也不是安全认证。','\n原文事实',...current.facts.map(x=>x.title+'：'+x.value),'\n风险线索',...current.signals.map(x=>x.title+'：'+x.evidence),'\n未知',...current.unknown,'\n建议',...current.actions].join('\n');}
$('#download').onclick=()=>{if(!current)return;const url=URL.createObjectURL(new Blob([reportText()],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='鉴信_本地规则报告.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#prepare').onclick=()=>{if(!current)return;$('#prepared').value=JSON.stringify({mail:redactMail($('#mail').value),stage:current.stage},null,2);$('#copy-status').textContent='请检查内容；网址中的参数已被隐藏，可能影响后续判断。';$('#handoff').showModal();};
$('#copy-prepared').onclick=async()=>{try{await navigator.clipboard.writeText($('#prepared').value);$('#copy-status').textContent='已复制。打开Coze后请自行粘贴发送。';}catch{$('#prepared').select();$('#copy-status').textContent='自动复制不可用，请手动复制已选中的文字。';}};
function openCoze(){if(config.cozeUrl)window.open(config.cozeUrl,'_blank','noopener,noreferrer');}
$('#open-coze').onclick=openCoze;$('#handoff-open').onclick=openCoze;
fetch('./coze-config.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(c=>{if(typeof c.publicUrl==='string'&&/^https:\/\/(?:www\.)?coze\.cn\//.test(c.publicUrl)){config.cozeUrl=c.publicUrl;$('#coze-status').textContent='Coze公开智能体 · 可能需要登录';$('#open-coze').disabled=false;$('#handoff-open').disabled=false;}}).catch(()=>{});
