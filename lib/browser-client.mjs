export async function modelChat(key,config,messages,tools,signal) {
 const openai=config.provider==='openai',label=openai?'OpenAI API':'학교 API';
 if(!key)throw Error(`${label} 키를 입력해주세요.`);
 const luna=config.model==='gpt-6-luna';
 const payload={model:config.model,messages,...(openai||luna?{max_completion_tokens:config.limits.outputTokens,reasoning_effort:'none',store:false}:{max_tokens:config.limits.outputTokens})};
 if(tools?.length){payload.tools=tools;payload.tool_choice='auto';}
 let res;
 try{res=await fetch(config.gateway,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal});}
 catch(e){if(signal?.aborted)throw e;throw Error(`${label} 연결에 실패했습니다. 네트워크 또는 브라우저의 연결 차단 여부를 확인해주세요.`);}
 if(!res.ok)throw Error(`${label} HTTP ${res.status}: ${res.status===401?'키를 확인해주세요.':res.status===403||res.status===404?'키의 모델 사용 권한을 확인해주세요.':res.status===429?'호출량 또는 크레딧을 확인해주세요.':'요청에 실패했습니다.'}`);
 const data=await res.json();const msg=data.choices?.[0]?.message;
 if(!msg || typeof msg!=='object')throw Error(`${label} 응답에 assistant message가 없습니다.`);
 return {role:'assistant',content:msg.content??null,...(msg.tool_calls?.length?{tool_calls:msg.tool_calls}:{})};
}
export function runEvaluation({code,cases,key,config,onEvent=(event)=>{}}) {
 const controller=new AbortController();let agent=null,grader=null,stopped=false,currentReject=null;const waiting=new Map();
 const abort=()=>{stopped=true;controller.abort();agent?.terminate();grader?.terminate();for(const p of waiting.values())p.reject(Error('실행을 중단했습니다.'));waiting.clear();currentReject?.(Error('실행을 중단했습니다.'));};
 const promise=(async()=>{
  const records=[];const started=performance.now();
  try {
   grader=new Worker('/runtime/evaluator.worker.mjs',{type:'module'});
   let seq=0;grader.onmessage=({data:d})=>{const p=waiting.get(d.id);if(p){waiting.delete(d.id);d.error?p.reject(Error(d.error)):p.resolve(d.result);}};
   grader.onerror=()=>{for(const p of waiting.values())p.reject(Error('평가 Worker를 시작하지 못했습니다.'));waiting.clear();};
   const evaluate=(action,data={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{waiting.delete(id);reject(Error('평가 런타임 응답 시간이 초과되었습니다.'));},60000);waiting.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});grader.postMessage({id,action,...data});});
   for(const test of cases) {
    if(stopped)break;
    const begin=performance.now();let modelCalls=0,toolCalls=0,trace=[],budgetViolation=null,apiFailure=null;
    const log=(event)=>{if(trace.length<150)trace.push(event);onEvent({caseId:test.id,...event});};
    onEvent({kind:'case-start',caseId:test.id,title:test.title});
    agent=new Worker('/runtime/python.worker.mjs',{type:'module'});
    let setup;try{setup=await evaluate('start',{test});}catch(e){records.push({id:test.id,label:test.label,title:test.title,status:'error',elapsed:Math.round(performance.now()-begin),modelCalls,toolCalls,error:String(e.message),trace});onEvent({kind:'case-end',record:records.at(-1)});break;}let answer,turn=0;
    const invoke=({task,tools})=>new Promise((resolve,reject)=>{
     const activeAgent=agent;let turnModels=0,turnTools=0;currentReject=reject;
     const timer=setTimeout(()=>{controller.abort();agent?.terminate();reject(Error('케이스 시간 제한을 초과했습니다.'));},Math.max(1,config.limits.caseMs-(performance.now()-begin)));
     const end=(fn,value)=>{clearTimeout(timer);currentReject=null;fn(value);};
     agent.onerror=()=>end(reject,Error('Python Worker를 시작하지 못했습니다. 네트워크와 브라우저를 확인해주세요.'));
     agent.onmessage=async({data:d})=>{
      if(d.type==='done'){end(resolve,d.answer);return;}
      if(d.type==='error'){end(reject,Error(d.error));return;}
      if(d.type==='status'){onEvent({kind:'status',caseId:test.id,message:d.message});return;}
      if(d.type==='print'){log({kind:'print',text:d.text});return;}
      if(d.type!=='rpc')return;
      try {let result;
       if(d.method==='chat') {
        if(++turnModels>config.limits.modelCalls || modelCalls>=config.limits.caseModelCalls){budgetViolation='모델 호출 횟수 제한';throw Error(budgetViolation);}
        if(!Array.isArray(d.messages)||JSON.stringify(d.messages).length>256000)throw Error('모델 입력 크기가 너무 큽니다.');
        modelCalls++;log({kind:'model-input',messages:d.messages});try{result=await modelChat(key,config,d.messages,d.tools,controller.signal);}catch(e){apiFailure=e;throw e;}log({kind:'model-output',message:result});
       } else if(d.method==='tool') {
        if(++turnTools>config.limits.toolCalls || toolCalls>=config.limits.caseToolCalls){budgetViolation='도구 호출 횟수 제한';throw Error(budgetViolation);}
        toolCalls++;result=await evaluate('tool',{name:d.name,args:d.arguments});log({kind:'tool',name:d.name,args:d.arguments,value:result});
       } else throw Error('지원하지 않는 실행 요청입니다.');
       activeAgent?.postMessage({type:'rpc-result',id:d.id,result});
      }catch(e){activeAgent?.postMessage({type:'rpc-result',id:d.id,error:String(e.message).split(key||'\0').join('[REDACTED]')});}
     };
     agent.postMessage({type:'run',code,task,tools,reset:turn===0});
    });
    try {
     answer=await invoke(setup);
     while(++turn<setup.turns){if(apiFailure||budgetViolation)break;log({kind:'next-turn',message:`${turn+1}턴 · 대화 기억과 도구 상태 유지`});answer=await invoke(await evaluate('next',{answer}));}
     if(apiFailure)throw apiFailure;
     if(budgetViolation)throw Error(budgetViolation);
     const grade=await evaluate('grade',{answer});
     records.push({id:test.id,label:test.label,title:test.title,status:grade.passed?'pass':'fail',elapsed:Math.round(performance.now()-begin),modelCalls,toolCalls,checks:grade.checks,answer:grade.answers??answer,trace});
    } catch(e){records.push({id:test.id,label:test.label,title:test.title,status:budgetViolation?'fail':'error',elapsed:Math.round(performance.now()-begin),modelCalls,toolCalls,error:String(e.message).split(key||'\0').join('[REDACTED]'),trace});}
    finally{agent?.terminate();agent=null;}
    onEvent({kind:'case-end',record:records.at(-1)});
    if(records.at(-1).status==='error')break; // API/runtime errors are incomplete runs, never ordinary zero scores.
   }
   return {status:stopped?'aborted':records.length===cases.length&&records.every(r=>r.status!=='error')?'completed':'error',cases:records,elapsed:Math.round(performance.now()-started)};
  }finally{agent?.terminate();grader?.terminate();}
 })();return {promise,abort};
}
export function summaryForUpload(runId,result) {return {runId,status:result.status,elapsed:result.elapsed,cases:result.cases.map(({id,status,elapsed,modelCalls,toolCalls})=>({id,status,elapsed,modelCalls,toolCalls}))};}
