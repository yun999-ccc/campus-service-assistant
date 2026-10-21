import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {cases,seed} from '../cases.js';
import '../guard.js';
const vendor=fileURLToPath(new URL('../vendor/',import.meta.url));
const context={module:{exports:{}},exports:{},require:createRequire(import.meta.url),__dirname:vendor,process,console,WebAssembly,Uint8Array,ArrayBuffer,TextDecoder,TextEncoder,setTimeout,clearTimeout};
vm.runInNewContext(await readFile(new URL('../vendor/sql-wasm.js',import.meta.url),'utf8'),context);
const SQL=await context.module.exports({locateFile:name=>vendor+name});
const {compareRows}=globalThis.SQLDetectiveGuard;
function query(sql,extra=''){
  const db=new SQL.Database();try{db.run(seed);if(extra)db.run(extra);db.run('PRAGMA query_only=ON');return JSON.parse(JSON.stringify(db.exec(sql)));}finally{db.close();}
}
for(const c of cases)test(c.title+'：参考解法在真实 WASM 引擎中返回目标结果',()=>{
  const results=query(c.answer);assert.equal(results.length,1);assert.equal(compareRows(results[0].values,c.expected),true);
});
test('无流水商品也参与库存核查',()=>{
  const rows=query(cases[0].answer,"INSERT INTO products VALUES(5,'测试商品',10,8)")[0].values;
  assert.equal(compareRows(rows,[...cases[0].expected,[5,'测试商品',2]]),true);
});
test('缺失退款流水的已退款订单按0核查',()=>{
  const rows=query(cases[1].answer,"INSERT INTO orders VALUES(1005,'测试客户',60,'已退款')")[0].values;
  assert.equal(compareRows(rows,[...cases[1].expected,[1005,60,0]]),true);
});
test('失败退款不能用于凑齐到账金额',()=>{
  const wrong=cases[1].answer.replace("CASE WHEN r.state = '成功' THEN r.amount ELSE 0 END",'r.amount');
  assert.equal(compareRows(query(wrong)[0]?.values||[],cases[1].expected),false);
});
test('授权核对不能只比较角色',()=>{
  const wrong='SELECT g.role_name,g.table_name,g.privilege FROM role_grants g WHERE NOT EXISTS (SELECT 1 FROM allowed_grants a WHERE a.role_name=g.role_name)';
  assert.equal(compareRows(query(wrong)[0]?.values||[],cases[2].expected),false);
});
test('数据库只读防线拒绝写入',()=>assert.throws(()=>query('DELETE FROM orders'),/readonly/));
test('无效字段产生真实SQL错误',()=>assert.throws(()=>query('SELECT missing_field FROM orders'),/no such column/));
