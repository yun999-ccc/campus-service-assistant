// Authored vector illustrations and charts share the same evidence vocabulary.
export function illustration(caseId){
  const inside={
    inventory:'<path d="M22 38h132v91H22z" fill="#c5eeed"/><path d="M14 71h150M14 113h150" stroke="#087e8b" stroke-width="5"/><path d="M35 39h39v30H35zM88 30h47v39H88zM39 84h27v26H39zM92 81h49v29H92z" fill="#ffda76" stroke="#977018" stroke-width="2"/><path d="M112 45h12M118 39v12" stroke="#977018" stroke-width="2"/>',
    refund:'<path d="M35 23h100v116l-10-7-10 7-10-7-10 7-10-7-10 7-10-7-10 7-10-7-10 7z" fill="#fff" stroke="#df854b" stroke-width="3"/><path d="M55 49h57M55 66h42M55 84h57" stroke="#f2c5a3" stroke-width="5"/><path d="M74 109h40m-9-9 10 9-10 9" fill="none" stroke="#d97432" stroke-width="4"/>',
    access:'<rect x="22" y="36" width="133" height="91" rx="10" fill="#e9dffc" stroke="#8963bc" stroke-width="3"/><circle cx="58" cy="72" r="13" fill="#b297dc"/><path d="M38 107q1-24 20-24t20 24" fill="#b297dc"/><path d="M97 66h40M97 82h27M97 98h35" stroke="#8963bc" stroke-width="5"/><rect x="72" y="23" width="33" height="23" rx="5" fill="#ffda76" stroke="#a68230" stroke-width="2"/>'
  };
  return '<svg viewBox="0 0 180 160" width="180" height="160" focusable="false"><circle cx="92" cy="82" r="71" fill="currentColor" opacity=".07"/>'+inside[caseId]+'<circle cx="148" cy="119" r="19" fill="white" stroke="currentColor" stroke-width="3"/><path d="m160 134 12 14" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>';
}
export function chartSpec(taskId,result){
  if(!result||result.truncated)return null;
  const rows=result.values;
  if(taskId==='access-locate'||taskId==='access-verify'){
    const roles=[...new Set(rows.map(r=>String(r[0])))],objects=[...new Set(rows.map(r=>String(r[1])))];
    return {kind:'matrix',title:taskId.endsWith('locate')?'待复核授权 · 角色与对象':'敏感表只读访问 · 需要授权',roles,objects,rows};
  }
  const money=taskId.startsWith('refund');
  const valueCols=taskId==='inventory-read'?[2,3]:taskId==='inventory-locate'?[2]:taskId==='access-read'?[1]:taskId==='refund-locate'?[1,2]:money?[1]:[];
  if(!valueCols.length)return {kind:'note',title:'没有流水 ≠ 净变动为零',text:'本次结果列出没有关联记录的对象。可在证据表中核对，不能仅靠金额或数量求和判断是否有记录。'};
  const labels=taskId==='inventory-read'?['期初','账面']:taskId==='inventory-locate'?['库存差异']:taskId==='access-read'?['台账条数']:taskId==='refund-locate'?['实付','成功退款']:['实付'];
  return {kind:'bars',title:taskId==='refund-locate'?'实付与成功退款 · 核对时点快照':taskId==='inventory-locate'?'库存差异 · 正值为重算高于账面':'查询结果对照',unit:money?'元':taskId.startsWith('inventory')?'件':'条',labels,items:rows.map(r=>({name:String(r[taskId.startsWith('inventory')?1:0]),values:valueCols.map(col=>Number(r[col])/(money?100:1))}))};
}
