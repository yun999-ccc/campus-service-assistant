/* Local observable evidence only. No network, storage or identity verification. */
function credentialRequest(text) {
  // Check individual requests; a safety warning elsewhere must not suppress them.
  for (const clause of text.split(/[，,。；;.!?！？\r\n]+/)) {
    const patterns = [
      /(?:提供|提交|输入|发送|回复|填写|告知|验证)[^，,。；;\r\n]{0,16}?(?:密码|验证码|口令|银行卡)/g,
      /\b(?:enter|type|send|share|provide|submit|reply(?:\s+with)?)[^,.;!?\r\n]{0,40}?\b(?:password|verification code|one[- ]time (?:code|password)|otp|pin)\b/gi
    ];
    for (const pattern of patterns) for (const match of clause.matchAll(pattern)) {
      const prefix = clause.slice(0, match.index);
      const warning = /(?:不要|切勿|请勿|不得|禁止|无需|不必|勿)[ \t]*(?:向.{0,10})?$/.test(prefix)
        || /(?:不(?:会)?要求|从不要求)[^，,。；;]{0,6}$/.test(prefix)
        || /\b(?:never(?: ever)?|do not|don't|don’t|must not|should not)\s+$/i.test(prefix);
      if (!warning) return match[0];
    }
  }
  return '';
}
export function analyzeMail(input, stage = 'unknown') {
  const text = String(input ?? '').trim();
  const unknown = ['未验证发件人身份、域名信誉、链接页面及附件安全。', '粘贴的认证结果与邮件头可能被伪造，不能据此认证邮件。'];
  if (!text) return {status:'empty', facts:[], signals:[], unknown:['尚未提供邮件内容。'], actions:['请粘贴脱敏邮件内容，不要包含密码、验证码或私人附件。'], urls:[], stage};
  if (text.length > 12000) return {status:'too_long',facts:[],signals:[],unknown:['输入超过12000字符，未分析。'],actions:['删去个人信息并缩短内容后重试。'],urls:[],stage};
  const facts = [], signals = [];
  const add = (code, title, evidence) => signals.push({code,title,evidence});
  const from = text.match(/^(?:From|发件人)[ \t]*[:：][ \t]*([^\r\n]*)/im)?.[1]?.trim() || '';
  if (from) facts.push({title:'提供的发件信息',value:from}); else unknown.push('未提供可核对的完整发件地址。');
  const allUrls = [...new Set(text.match(/https?:\/\/[^\s<>"'`]+/gi) || [])];
  if(allUrls.length>30)unknown.push('仅解析前30个去重链接，其余链接未逐项解析；不能据此推断整封邮件安全。');
  const urlStrings = allUrls.slice(0,30);
  const urls = urlStrings.map(raw => {
    const value = raw.replace(/[，。；、）)\]}>]+$/g,'');
    try {const u=new URL(value);return {raw:value,host:u.hostname.toLowerCase(),scheme:u.protocol,hasUserInfo:!!(u.username||u.password)};} catch{return {raw:value,host:'',scheme:'',hasUserInfo:false,parseError:true};}
  });
  if(urls.some(u=>u.parseError))unknown.push('部分网址无法解析，未提取到可信的主机名；请人工核对原文，不能视为安全。');
  for(const u of urls){
    if(u.parseError)continue;
    facts.push({title:'文本中的链接主机名',value:u.host});
    if(u.scheme==='http:')add('http','链接未使用HTTPS；这不单独证明恶意',u.raw);
    if(u.hasUserInfo)add('userinfo','链接含用户信息段，注意@之后才是主机名',u.raw);
    if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(u.host))add('ip','链接使用IP地址，需要另行核实',u.host);
    if(u.host.includes('xn--'))add('idn','链接含国际化域名编码，需要核对完整域名',u.host);
  }
  if(!urls.length) unknown.push('文本中没有可解析的HTTP(S)链接；不代表原邮件没有链接或风险。');
  for(const m of text.matchAll(/<a\b[^>]*href\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const shown=m[2].replace(/<[^>]*>/g,'').trim();
    if(/^https?:\/\//i.test(shown))try{if(new URL(shown).hostname.toLowerCase()!==new URL(m[1]).hostname.toLowerCase())add('mismatch','显示网址与实际链接主机不同',shown+' → '+m[1]);}catch{/* Keep malformed input as text. */}
  }
  const urgency=text.match(/立即|马上|紧急|即将停用|冻结|最后通牒|\b(?:urgent|immediately|suspend)\b/i);
  const credential=credentialRequest(text);
  if(urgency)add('urgency','存在催促或威胁措辞，单凭这一点不能认定钓鱼',urgency[0]);
  if(credential)add('credential','文本出现索要或输入敏感凭据的请求，需要优先核实',credential);
  const injection=text.match(/忽略.{0,12}(?:规则|指令|提示)|(?:system|developer)\s*:|ignore\s+(?:all\s+)?(?:previous|instructions)/i);
  if(injection)add('injection','邮件包含试图改变分析规则的指令；仅作为原文证据',injection[0]);
  if(/Authentication-Results|DKIM-Signature|Received-SPF/i.test(text))facts.push({title:'邮件头文本',value:'存在认证相关字段；本工具只读取其文字，没有验证来源或签名。'});
  const needsPriority=signals.some(s=>['credential','mismatch','userinfo'].includes(s.code));
  let status=needsPriority?'review_priority':signals.length?'review':'insufficient';
  const actions=['不要通过该邮件中的联系方式或链接核实；自行打开已知官方入口或使用此前保存的联系方式。'];
  if(stage==='unknown')actions.push('先确认是否已点击、输入凭据、下载或运行文件，再选择对应处置步骤。');
  if(stage==='not_clicked')actions.push('暂不点击、回复或下载；核实后通过组织的正式渠道反馈。');
  if(stage==='clicked')actions.push('关闭可疑页面，检查下载记录；若担心恶意下载，更新安全软件并扫描，按组织流程求助。');
  if(stage==='credentials')actions.push('从已知官方入口更改可能泄露的密码，检查复用密码及账号会话，开启或核对多因素认证，并联系账号服务方。');
  if(stage==='file_run')actions.push('停止继续操作可疑文件，尽快联系组织IT或安全人员，按其事件响应流程处理；本工具不能诊断是否中毒。');
  return {status,facts,signals,unknown,actions,urls,stage,limit:'风险线索提示，不是身份认证或安全保证。'};
}

export function redactMail(text){
  // Strip URL userinfo before email masking; userinfo can contain Unicode or escapes.
  return String(text).replace(/https?:\/\/[^\s<>"'`]+/gi,raw=>{
      try {
        const u=new URL(raw);const parameters=!!(u.search||u.hash);
        u.username='';u.password='';u.search='';u.hash='';
        return u.href+(parameters?'?[参数已隐藏]':'');
      } catch {return '[无法解析的网址已隐藏]';}
    }).replace(/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi,'[邮箱用户名]@$1')
    .replace(/\b1[3-9]\d{9}\b/g,'[手机号已隐藏]')
    .replace(/((?:密码|验证码|口令|password|otp)\s*[:：=]\s*)[^\s，。；;]+/gi,'$1[已隐藏]');
}
