(function(root){
  function readQuery(db,sql){
    const stmt=db.prepare(sql),values=[];
    try{
      const columns=stmt.getColumnNames();let truncated=false;
      while(stmt.step()){if(values.length>=200){truncated=true;break;}values.push(stmt.get());}
      return {columns,values,truncated};
    }finally{stmt.free();}
  }
  const key=row=>JSON.stringify(row.map(v=>[typeof v,v]));
  function differenceCount(left,right){
    const counts=new Map();for(const row of right){const k=key(row);counts.set(k,(counts.get(k)||0)+1);}
    let extra=0;for(const row of left){const k=key(row),count=counts.get(k)||0;if(count)counts.set(k,count-1);else extra++;}return extra;
  }
  function executeBatch(SQL,{sql,seeds,reference}){
    const checks=[];let first;
    for(let i=0;i<seeds.length;i++){
      const db=new SQL.Database();
      try{
        db.run(seeds[i]);db.run('PRAGMA query_only=ON;');
        const result=readQuery(db,sql);if(i===0)first=result;
        if(reference){
          const target=readQuery(db,reference);
          const missing=differenceCount(target.values,result.values),extra=differenceCount(result.values,target.values);
          checks.push({group:i+1,matched:!result.truncated&&!target.truncated&&missing===0&&extra===0&&result.columns.length===target.columns.length,missing,extra,truncated:result.truncated});
        }
      }finally{db.close();}
    }
    return {...first,checks,matched:checks.length>0&&checks.every(c=>c.matched)};
  }
  root.SQLDetectiveQuery={readQuery,differenceCount,executeBatch};
})(globalThis);
