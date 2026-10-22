import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {cases,allTasks} from '../tasks.js';
import {buildDataset,expectedFor} from '../data.js';
import '../guard.js';
import '../query-core.js';
const vendor=fileURLToPath(new URL('../vendor/',import.meta.url));
const context={module:{exports:{}},exports:{},require:createRequire(import.meta.url),__dirname:vendor,process,console,WebAssembly,Uint8Array,ArrayBuffer,TextDecoder,TextEncoder,setTimeout,clearTimeout};
vm.runInNewContext(await readFile(new URL('../vendor/sql-wasm.js',import.meta.url),'utf8'),context);
const SQL=await context.module.exports({locateFile:name=>vendor+name});
const {compareRows}=globalThis.SQLDetectiveGuard;
const {executeBatch,readQuery}=globalThis.SQLDetectiveQuery;
for(const mode of ['guide','practice'])for(const task of allTasks)test(`${mode} / ${task.id}: 三组真实SQL与独立业务规则一致`,()=>{
  for(let v=0;v<3;v++){
    const data=buildDataset(mode,v),db=new SQL.Database();
    try{db.run(data.seed);db.run('PRAGMA query_only=ON');const result=readQuery(db,task.answer);assert.equal(result.truncated,false);assert.equal(compareRows(result.values,expectedFor(task.id,data.tables)),true,task.id+' variant '+v);}finally{db.close();}
  }
});
const seeds=[0,1,2].map(v=>buildDataset('guide',v).seed);
test('硬编码当前答案不能通过三组验证',()=>{
  const rows=expectedFor('inventory-locate',buildDataset().tables);
  const sql=rows.map(row=>'SELECT '+row.map(v=>typeof v==='string'?"'"+v+"'":v).join(',')).join(' UNION ALL ');
  const result=executeBatch(SQL,{sql,seeds,reference:cases[0].answer});
  assert.equal(result.checks[0].matched,true);assert.equal(result.matched,false);
});
test('INNER JOIN漏掉无流水商品不能通过',()=>assert.equal(executeBatch(SQL,{sql:cases[0].answer.replace('LEFT JOIN','INNER JOIN'),seeds,reference:cases[0].answer}).matched,false));
test('失败退款不可当作成功',()=>assert.equal(executeBatch(SQL,{sql:cases[1].answer.replace("CASE WHEN r.state = '成功' THEN r.amount ELSE 0 END",'r.amount'),seeds,reference:cases[1].answer}).matched,false));
test('只比角色无法通过权限核对',()=>assert.equal(executeBatch(SQL,{sql:'SELECT g.role_name,g.table_name,g.privilege FROM role_grants g WHERE NOT EXISTS (SELECT 1 FROM allowed_grants a WHERE a.role_name=g.role_name)',seeds,reference:cases[2].answer}).matched,false));
test('真实SQLite只读限制',()=>assert.throws(()=>executeBatch(SQL,{sql:'DELETE FROM orders',seeds:[seeds[0]]}),/readonly/));
test('真实SQL错误',()=>assert.throws(()=>executeBatch(SQL,{sql:'SELECT missing FROM orders',seeds:[seeds[0]]}),/no such column/));
test('超出200行明确标记截断',()=>{const r=executeBatch(SQL,{sql:'SELECT a.product_id FROM products a CROSS JOIN products b CROSS JOIN products c',seeds:[seeds[0]],reference:'SELECT product_id FROM products'});assert.equal(r.values.length,200);assert.equal(r.truncated,true);assert.equal(r.matched,false);});
test('相同数据种子可复现，变体确有不同',()=>{assert.equal(buildDataset().seed,buildDataset().seed);assert.notEqual(buildDataset().seed,buildDataset('guide',1).seed);});
test('金额为最小货币单位整数',()=>{const t=buildDataset('practice',2).tables;assert.equal(t.orders.every(r=>Number.isInteger(r[2])),true);assert.equal(t.refunds.every(r=>Number.isInteger(r[2])),true);});
