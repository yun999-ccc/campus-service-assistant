const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const logic=require('../logic.js');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const serviceSource=source.slice(source.indexOf('const services ='),source.indexOf('const $ ='));
const services=vm.runInNewContext(serviceSource+'; services;');
const ids=list=>Array.from(list,s=>s.id);
const matches=question=>ids(services.filter(s=>s.keys.test(question)));

test('遗失手机或银行卡不会误判为学生证补办',()=>{
  assert.deepEqual(matches('手机丢了怎么办'),[]);
  assert.deepEqual(matches('银行卡丢了怎么办'),[]);
  assert.deepEqual(matches('学生证丢了怎么办'),['card']);
});
test('泛泛的证件补办不猜测证件类型',()=>assert.deepEqual(matches('证件丢失，需要补办'),[]));
test('网络安全课程不误判为上网故障',()=>assert.deepEqual(matches('网络安全课程资料在哪里'),[]));
test('明确校园网和多事项仍正确分流',()=>{
  assert.deepEqual(matches('宿舍校园网连不上'),['network']);
  assert.deepEqual(matches('学生证丢失且校园网连不上'),['card','network']);
});
test('服务搜索识别大小写不同的 WiFi 和常用别名',()=>{
  assert.deepEqual(ids(logic.searchServices(services,' WiFi ')),['network']);
  assert.deepEqual(ids(logic.searchServices(services,'助学金')),['grant']);
  assert.deepEqual(ids(logic.searchServices(services,'教务')),['account']);
});
test('搜索别名与类型筛选一起生效',()=>assert.deepEqual(ids(logic.searchServices(services,'wifi','affairs')),[]));
test('未知搜索返回空列表',()=>assert.deepEqual(ids(logic.searchServices(services,'火星探测器')),[]));
test('存储清理剔除越界索引和重复索引',()=>{
  const result=logic.sanitizeSaved([{id:'card',checked:[0,0,-1,99,'1',1.5,2]}],services);
  assert.deepEqual(result,[{id:'card',checked:[0,2],savedAt:''}]);
});
test('存储清理剔除未知服务、错误结构和网络排查记录',()=>{
  assert.deepEqual(logic.sanitizeSaved([null,{id:'unknown',checked:[]},{id:'network',checked:[]},{id:'card',checked:null}],services),[]);
  assert.deepEqual(logic.sanitizeSaved({id:'card'},services),[]);
});
test('重复保存记录合并为每个服务一条',()=>{
  const result=logic.sanitizeSaved([{id:'card',checked:[0]},{id:'card',checked:[1]}],services);
  assert.deepEqual(result,[{id:'card',checked:[1],savedAt:''}]);
});
test('明确填写密码和验证码时给出敏感输入提示',()=>{
  assert.equal(logic.hasSensitiveInput('密码：EXAMPLE_ONLY_123'),true);
  assert.equal(logic.hasSensitiveInput('验证码是123456'),true);
  assert.equal(logic.hasSensitiveInput('我的密码是EXAMPLE_ONLY_123'),true);
});
test('正常的密码求助不被敏感格式误拦截',()=>{
  assert.equal(logic.hasSensitiveInput('我忘记密码了'),false);
  assert.equal(logic.hasSensitiveInput('密码怎么找回'),false);
});
test('存储失败明确返回失败而非抛异常',()=>{
  const storage={setItem(){throw new Error('QuotaExceededError');}};
  assert.equal(logic.writeSaved(storage,'test',[]),false);
});
test('成功写入可还原的 JSON',()=>{
  let value;
  assert.equal(logic.writeSaved({setItem(key,text){value=text;}},'test',[{id:'card',checked:[0]}]),true);
  assert.deepEqual(JSON.parse(value),[{id:'card',checked:[0]}]);
});

function bootApp(storage) {
  const nodes=new Map();const handlers={};
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,textContent:'',innerHTML:'',dataset:{},classList:{toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},querySelector(){return node(id+'/child');}});
    return nodes.get(id);
  };
  const document={querySelector:node,querySelectorAll(){return [];},addEventListener(name,fn){handlers[name]=fn;},createElement(){return node('created');}};
  const sandbox={document,localStorage:storage,CampusLogic:logic,window:{addEventListener(){}},location:{hash:'#home'},history:{replaceState(){}},URLSearchParams,setTimeout(){return 1;},clearTimeout(){}};
  vm.runInNewContext(source,sandbox);
  return {nodes,handlers,sandbox};
}
test('浏览器保存被拒绝时界面不宣称永久保存成功',()=>{
  const app=bootApp({getItem(){return null;},setItem(){throw new Error('blocked');}});
  app.handlers.click({target:{closest(){return {dataset:{action:'save',id:'card'}};}}});
  assert.match(app.nodes.get('#toast').textContent,/仅在本次页面会话/);
  assert.doesNotMatch(app.nodes.get('#toast').textContent,/已保存到/);
});
test('本地记录损坏时仍能初始化页面',()=>{
  const app=bootApp({getItem(){return '{broken';},setItem(){}});
  assert.ok(app.nodes.get('#home-services').innerHTML.includes('学生证补办'));
  assert.equal(app.nodes.get('#saved-count').textContent,0);
});
