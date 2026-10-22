// This module owns attempt state; views never infer completion from old UI text.
export function createAttempt(starter,choices){
  const order=choices.map((_,i)=>i);
  for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  return {sql:starter,hints:0,reference:false,last:null,history:[],choice:null,order,completed:null};
}
export function isCurrent(s){return !!s.last&&s.last.sql===s.sql;}
export function editAttempt(s,sql){s.sql=sql;}
export function recordAttempt(s,sql,result,label,matched=false){
  s.last={sql,result,label,matched};s.choice=null;
  s.history.unshift({sql,label});s.history=s.history.slice(0,10);
}
export function chooseAnswer(s,index,correct,context){
  if(!isCurrent(s)||!s.last.matched)return false;
  s.choice=index;
  if(index===correct)s.completed={sql:s.last.sql,choice:index,...context};
  return index===correct;
}
export function currentPassed(s,correct){return isCurrent(s)&&s.last.matched&&s.choice===correct;}
export function readyStatus(previous){return previous==='retry'?'数据库引擎已恢复，可以重新运行查询。':'数据库引擎已就绪，可以运行查询。';}
