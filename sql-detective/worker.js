/* The database contains fictional exercise data only. No remote connection. */
importScripts('./guard.js','./query-core.js','./vendor/sql-wasm.js');
let SQL;
initSqlJs({locateFile:file=>new URL('./vendor/'+file,self.location.href).href})
  .then(engine=>{SQL=engine;postMessage({type:'ready'});})
  .catch(()=>postMessage({type:'fatal',error:'数据库引擎未能加载，请检查网络后重试。'}));
self.onmessage=({data})=>{
  const {id,sql,seeds,reference}=data;
  const validation=SQLDetectiveGuard.validateSQL(sql);
  if(!validation.ok){postMessage({type:'error',id,error:validation.error});return;}
  try {
    if(!SQL)throw new Error('数据库引擎尚未准备好。');
    const started=performance.now();
    const result=SQLDetectiveQuery.executeBatch(SQL,{sql:validation.sql,seeds,reference});
    postMessage({type:'result',id,...result,elapsed:Math.round(performance.now()-started)});
  } catch(error) {
    postMessage({type:'error',id,error:String(error.message||error).slice(0,500)});
  }
};
