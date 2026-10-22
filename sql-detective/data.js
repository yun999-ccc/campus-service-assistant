// Fictional, reproducible training records. Amounts are stored as integer cents.
export const DATA_VERSION='2026.10.22';
const literal=v=>typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
function insert(name,rows){return rows.length?'INSERT INTO '+name+' VALUES '+rows.map(r=>'('+r.map(literal).join(',')+')').join(',')+';':'';}
export function buildDataset(mode='guide',variant=0){
  const large=mode==='practice', offset=variant*1000;
  const tables={products:[],stock_moves:[],orders:[],refunds:[],role_grants:[],allowed_grants:[]};
  const names=['帆布袋','马克杯','贴纸套装','随行笔记本','便签本','徽章','钥匙扣','书签','明信片','文件袋'];
  for(let i=1;i<=(large?20:6);i++){
    const id=offset+i,opening=80+i*9+variant*4;
    let net=0;
    if(i%6!==0)for(let j=0;j<(large?10:2);j++){
      const qty=i%5===0?(j%2===0?4:-4):j%3===0?6+variant:-(2+i%4+variant);
      tables.stock_moves.push([tables.stock_moves.length+1,id,qty,qty>0?'补货入库':'领用出库']);net+=qty;
    }
    const difference=i%6===0?2+variant:i%4===1?5+variant:i%7===0?-3-variant:0;
    tables.products.push([id,names[(i-1)%names.length]+(i>10?'·补货批次':''),opening,opening+net-difference]);
  }
  for(let i=1;i<=(large?120:8);i++){
    const id=1000+offset+i,paid=(40+i*7+variant*3)*100;
    tables.orders.push([id,'模拟客户'+String(i).padStart(3,'0'),paid,i%3===0||i%5===0?'已退款':'已完成']);
    if(i%5===0)continue;
    const add=(amount,state)=>tables.refunds.push([tables.refunds.length+1,id,amount,state]);
    if(i%4===0){add(paid/2,'成功');add(paid/2,'成功');}
    else if(i%4===1){add(paid-1500,'成功');add(1500,'失败');}
    else if(i%4===2){add(paid,'处理中');add(paid,'失败');}
    else{add(paid,'成功');add(1000,'失败');}
  }
  const roles=['报表员','库存员','审核员','运营员','财务员','访客','客服员','采购员','分析员','值班员','核验员','归档员'];
  for(let i=0;i<(large?12:5);i++){
    const role=roles[i]+(variant?'·'+variant:''),allowed=[['orders','SELECT'],['products','SELECT'],['stock_moves',i%2===0?'SELECT':'INSERT'],['refunds','SELECT']];
    for(const [table,privilege]of allowed){tables.allowed_grants.push([role,table,privilege]);tables.role_grants.push([tables.role_grants.length+1,role,table,privilege]);}
    for(const [table,privilege]of [['orders','UPDATE'],['customers_private','SELECT']])tables.role_grants.push([tables.role_grants.length+1,role,table,privilege]);
    if(i%4===0)tables.role_grants.push([tables.role_grants.length+1,role,'orders','SELECT']);
  }
  // A role that has no approved entries at all, unlike a mere wrong operation.
  tables.role_grants.push([tables.role_grants.length+1,'临时角色'+variant,'orders','SELECT']);
  const ddl=`CREATE TABLE products(product_id INTEGER PRIMARY KEY,product_name TEXT,opening_stock INTEGER,book_stock INTEGER);
CREATE TABLE stock_moves(move_id INTEGER PRIMARY KEY,product_id INTEGER,change_qty INTEGER,reason TEXT);
CREATE TABLE orders(order_id INTEGER PRIMARY KEY,customer_name TEXT,paid_amount INTEGER,status TEXT);
CREATE TABLE refunds(refund_id INTEGER PRIMARY KEY,order_id INTEGER,amount INTEGER,state TEXT);
CREATE TABLE role_grants(grant_id INTEGER PRIMARY KEY,role_name TEXT,table_name TEXT,privilege TEXT);
CREATE TABLE allowed_grants(role_name TEXT,table_name TEXT,privilege TEXT);`;
  return {mode,variant,version:DATA_VERSION,tables,seed:ddl+Object.entries(tables).map(([name,rows])=>insert(name,rows)).join('\n')};
}
// Independent business oracles used by tests, rather than parsing reference SQL.
export function expectedFor(taskId,t){
  if(taskId==='inventory-read')return t.products.map(r=>r.slice());
  if(taskId==='inventory-locate')return t.products.map(([id,name,opening,book])=>[id,name,opening+t.stock_moves.filter(r=>r[1]===id).reduce((n,r)=>n+r[2],0)-book]).filter(r=>r[2]!==0);
  if(taskId==='inventory-verify')return t.products.filter(p=>!t.stock_moves.some(m=>m[1]===p[0])).map(p=>p.slice(0,2));
  if(taskId==='refund-read')return t.orders.filter(o=>o[3]==='已退款').map(o=>[o[0],o[2]]);
  if(taskId==='refund-locate')return t.orders.filter(o=>o[3]==='已退款').map(o=>[o[0],o[2],t.refunds.filter(r=>r[1]===o[0]&&r[3]==='成功').reduce((n,r)=>n+r[2],0)]).filter(r=>r[2]<r[1]);
  if(taskId==='refund-verify')return t.orders.filter(o=>o[3]==='已退款'&&!t.refunds.some(r=>r[1]===o[0])).map(o=>[o[0],o[2]]);
  if(taskId==='access-read'){const counts=new Map();for(const r of t.role_grants)counts.set(r[1],(counts.get(r[1])||0)+1);return [...counts];}
  if(taskId==='access-locate')return t.role_grants.filter(g=>!t.allowed_grants.some(a=>a[0]===g[1]&&a[1]===g[2]&&a[2]===g[3])).map(g=>g.slice(1));
  if(taskId==='access-verify')return t.role_grants.filter(g=>g[2]==='customers_private'&&g[3]==='SELECT').map(g=>[g[1],g[2]]);
  throw new Error('Unknown task: '+taskId);
}
