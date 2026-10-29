// Explain public practice results from the existing grader and recorded evidence.
// This never calls a model, changes scoring, or imports the final suite.
const reasons={
 'multi_turn:empty_turn_model_response':['필요한 도구 실행이 없어요','필수 정보가 모두 있는지 확인하고, 답변만 끝내지 말고 요청한 작업을 도구로 실행하세요.'],
 'multi_turn:irrelevance_error:decoder_success':['기다려야 하는 턴에 도구를 실행했어요','필수 정보나 도구가 부족하거나 실행 요청이 없는 턴입니다. 작업 전체의 실행 가능성을 먼저 확인하고, 필요한 정보를 묻거나 기다리세요.'],
 'multi_turn:instance_state_mismatch':['작업 후 상태가 기대와 달라요','예산·예약·취소 등의 인수, 대상 ID, 중복 실행을 확인하세요. 도구가 성공했다고 해도 요청과 다른 상태를 만들면 실패합니다.'],
 'multi_turn:execution_response_mismatch':['필요한 도구 결과를 얻지 못했어요','조회 대상과 인수를 확인하세요. 이전 턴의 결과를 재사용할 때도 요청한 예약·날짜·금액과 맞는지 확인하세요.'],
 'multi_turn:method_invoke_order_mismatch':['필요한 작업 흐름이 맞지 않아요','앞선 도구 결과를 다음 작업의 입력으로 연결했는지 확인하세요.'],
};

export function practiceFeedback(test,record){
 if(!test||test.id!==record?.id||!Array.isArray(test.ground_truth))return null;
 const trace=record.trace||[],groups=[[]];
 for(const event of trace){
  if(event.kind==='next-turn')groups.push([]);
  else if(event.kind==='tool')groups.at(-1).push(event);
 }
 const firstFailure=(record.checks||[]).findIndex(check=>check.pass===false);
 const truncated=trace.length>=150;
 const turns=test.ground_truth.map((expected,index)=>{
  const check=record.checks?.[index];
  const state=check?.pass===true?'pass':index===firstFailure?'first-failure':check?.pass===false?'affected':'ungraded';
  const [reason,hint]=reasons[check?.error]||['검사 조건을 충족하지 못했어요','참고 동작과 실제 도구의 입력·결과를 비교하세요.'];
  let questions=(test.entry.question[index]||[]).map(m=>m.content);
  if(!questions.length&&test.entry.missed_function?.[String(index)])questions=['사용 가능한 도구가 갱신되었습니다. 이제 이전 요청을 이어서 처리해주세요.'];
  const actual=groups[index]||[];
  const complete=Array.isArray(record.trace)&&index<groups.length&&(!truncated||index<groups.length-1);
  const toolErrors=actual.filter(e=>e.value&&typeof e.value==='object'&&(e.value.error||Object.entries(e.value).some(([key,value])=>key.endsWith('_status')&&value===false)));
  return {number:index+1,state,reason,hint,questions,expected,actual,complete,toolErrors,
   answer:Array.isArray(record.answer)?record.answer[index]:index===0?record.answer:undefined};
 });
 return {firstFailure:firstFailure<0?null:firstFailure+1,truncated,turns,
  summary:firstFailure>=0?`${firstFailure+1}턴에서 처음 실패했어요`:record.status==='pass'?'모든 턴의 검사를 통과했어요':'실행이 완료되지 않았어요',
 };
}
