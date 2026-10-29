import {practiceFeedback} from '../lib/practice-feedback.mjs';
type FeedbackTurn={number:number;state:string;reason:string;hint:string;questions:string[];expected:string[];actual:{name:string;args:unknown;value:unknown}[];complete:boolean;toolErrors:unknown[];answer?:unknown};
const labels:Record<string,string>={pass:'여기까지 통과','first-failure':'첫 실패',affected:'이전 실패 포함',ungraded:'미채점'};
export default function PracticeFeedback({test,record}:{test:any;record:any}){
 const feedback=practiceFeedback(test,record);if(!feedback)return null;
 return <section className="practice-feedback" aria-label="연습 문제 피드백">
  <div className="feedback-heading"><b>{feedback.summary}</b><p>각 검사는 이전 턴을 포함합니다. 먼저 실패한 턴부터 수정해보세요.</p></div>
  {record.error&&<p className="feedback-warning">실행 중단: {record.error} · 실행 오류는 정답 판정과 별도로 확인하세요.</p>}
  {feedback.truncated&&<p className="feedback-warning">보관된 실행 기록이 최대치인 150개에 도달했습니다. 뒷부분이 생략됐을 수 있으므로 기록이 없는 구간은 실행하지 않았다고 판단할 수 없습니다.</p>}
  {feedback.turns.map((turn:FeedbackTurn)=><details className={'feedback-turn '+turn.state} key={turn.number} open={turn.state==='first-failure'||(feedback.firstFailure===null&&turn.number===1)}>
   <summary><b>{turn.number}턴</b><span>{labels[turn.state]}</span></summary>
   <div className="feedback-turn-body">
    <div className="feedback-request"><small>사용자 요청</small>{turn.questions.map((q,i)=><p key={i}>{q}</p>)}</div>
    {turn.state==='first-failure'&&<div className="feedback-advice"><b>{turn.reason}</b><p>{turn.hint}</p></div>}
    {turn.state==='affected'&&<p className="feedback-warning">앞선 실패가 누적된 검사입니다. 이 턴만의 새 오류로 단정하지 않습니다.</p>}
    <div className="feedback-comparison">
     <div><h4>기대하는 동작</h4>{turn.expected.length?<><p>공개된 참고 실행입니다. ID·금액은 사용자 입력과 앞선 도구 결과에서 가져오세요. 다른 호출 흐름도 상태·결과 검사를 만족하면 통과할 수 있습니다.</p><ol>{turn.expected.map((call,i)=><li key={i}><pre>{call}</pre></li>)}</ol></>:<p className="feedback-hold">도구를 호출하지 않고 필요한 정보를 묻거나 기다립니다.</p>}</div>
     <div><h4>실제 실행</h4>{!turn.actual.length?<p>{turn.complete?'이 턴에 실행한 도구가 없습니다.':'이 턴의 도구 기록이 남아 있지 않습니다.'}</p>:<ol>{turn.actual.map((event,i)=><li key={i}><code>{event.name}</code><pre>{JSON.stringify(event.args,null,2)}</pre><details><summary>도구가 반환한 결과</summary><pre>{JSON.stringify(event.value,null,2)}</pre></details></li>)}</ol>}
      {!!turn.toolErrors.length&&<p className="feedback-warning">도구가 오류 또는 실패 상태를 반환했습니다. 위의 반환 결과를 확인하세요.</p>}
     </div>
    </div>
    {turn.answer!=null&&<details className="feedback-answer"><summary>이 턴의 에이전트 답변</summary><pre>{typeof turn.answer==='string'?turn.answer:JSON.stringify(turn.answer,null,2)}</pre></details>}
   </div>
  </details>)}
 </section>;
}
