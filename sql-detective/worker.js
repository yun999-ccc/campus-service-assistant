/* The database contains fictional exercise data only. No remote connection. */
importScripts('./guard.js', './vendor/sql-wasm.js');
let SQL;
initSqlJs({locateFile:file=>new URL('./vendor/'+file,self.location.href).href})
  .then(engine=>{SQL=engine;postMessage({type:'ready'});})
  .catch(()=>postMessage({type:'fatal',error:'数据库引擎未能加载，请检查网络后重试。'}));
self.onmessage=({data})=>{
  const {id,sql,seed}=data;
  const validation=SQLDetectiveGuard.validateSQL(sql);
  if(!validation.ok){postMessage({type:'error',id,error:validation.error});return;}
  let db,stmt;
  try {
    if(!SQL)throw new Error('数据库引擎尚未准备好。');
    const started=performance.now();
    db=new SQL.Database();db.run(seed);db.run('PRAGMA query_only=ON;');
    stmt=db.prepare(validation.sql);
    const columns=stmt.getColumnNames(),values=[];
    let truncated=false;
    while(stmt.step()) {if(values.length>=200){truncated=true;break;}values.push(stmt.get());}
    postMessage({type:'result',id,columns,values,truncated,elapsed:Math.round(performance.now()-started)});
  } catch(error) {
    postMessage({type:'error',id,error:String(error.message||error).slice(0,500)});
  } finally {if(stmt)stmt.free();if(db)db.close();}
};
