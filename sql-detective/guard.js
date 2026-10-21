(function (root) {
  'use strict';
  function validateSQL(input) {
    if (typeof input !== 'string' || !input.trim()) return {ok:false,error:'先写一条 SELECT 查询，再运行。'};
    if (input.length > 6000) return {ok:false,error:'查询最多 6000 个字符，请缩短后重试。'};
    let quote = '', block = false, line = false, ended = false, tokens = '';
    for (let i=0;i<input.length;i++) {
      const c=input[i], n=input[i+1];
      if (line) {if(c==='\n') {line=false; tokens+=' ';} continue;}
      if (block) {if(c==='*' && n==='/') {block=false;i++;tokens+=' ';} continue;}
      if (quote) {
        if(c===quote) {if(n===quote)i++;else quote='';}
        continue;
      }
      if(c==='-' && n==='-') {line=true;i++;continue;}
      if(c==='/' && n==='*') {block=true;i++;continue;}
      if(/\s/.test(c)) {tokens+=' ';continue;}
      if(c===';') {if(ended)return {ok:false,error:'每次只运行一条 SELECT，不能提交多条语句。'};ended=true;continue;}
      if(ended) return {ok:false,error:'每次只运行一条 SELECT，不能提交多条语句。'};
      if(c==="'" || c==='"' || c==='`') {quote=c;tokens+=' quoted ';continue;}
      if(c==='[') {quote=']';tokens+=' quoted ';continue;}
      tokens+=c;
    }
    if(quote || block) return {ok:false,error:'引号或块注释没有闭合，请检查查询。'};
    if(!/^\s*SELECT\b/i.test(tokens))return {ok:false,error:'演练环境仅支持以 SELECT 开始的单条只读查询；暂不支持 WITH、写入和管理语句。'};
    return {ok:true,sql:input.trim()};
  }
  function compareRows(actual, expected) {
    if(!Array.isArray(actual)||!Array.isArray(expected)||actual.length!==expected.length)return false;
    const normalize=rows=>rows.map(row=>JSON.stringify(row.map(v=>[typeof v,v]))).sort();
    const a=normalize(actual), b=normalize(expected);
    return a.every((v,i)=>v===b[i]);
  }
  root.SQLDetectiveGuard={validateSQL,compareRows};
})(globalThis);
