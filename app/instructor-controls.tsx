'use client';
import {useState} from 'react';
import {Play,ShieldCheck} from 'lucide-react';
export default function InstructorControls({phase,onStart}:{phase:string;onStart:()=>Promise<void>}){
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function start(){if(busy)return;setBusy(true);setError('');try{await onStart();setConfirm(false);}catch(e){setError(e instanceof Error?e.message:'시작하지 못했습니다.');}finally{setBusy(false);}}
 return <><section className="instructor-controls" aria-label="강사 진행 설정"><div><b><ShieldCheck size={16}/> 강사 진행</b><p>전체 참가자의 제출을 마감하고, 각자 브라우저에서 최종 30문항을 평가합니다.</p></div><button className="button primary" disabled={phase!=='practice'||busy} onClick={()=>{setConfirm(true);setError('');}}><Play size={14}/>{phase==='practice'?'전체 최종 평가 시작':phase==='final'?'최종 평가 진행 중':'최종 평가 종료'}</button></section>
 {confirm&&<div className="modal-backdrop"><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="start-final-title"><h2 id="start-final-title">전체 최종 평가를 시작할까요?</h2><p className="instructor-confirm-copy">지금 연습 제출을 마감합니다. 각 참가자가 전체 연습 평가를 완료한 제출 중 가장 최근 코드가 고정됩니다.</p><ul className="instructor-confirm-copy"><li>진행 중인 연습·빠른 테스트는 중단됩니다.</li><li>학생은 API 키를 입력하고 워크스페이스 탭을 열어두어야 합니다. 화면은 최대 30초 안에 갱신됩니다.</li><li>최종 결과 제출은 시작 후 20분 동안 가능합니다.</li><li>시작 후에는 코드 마감 시점을 되돌릴 수 없습니다.</li></ul>{error&&<p role="alert" className="auth-error">{error}</p>}<div className="modal-bottom"><button className="button secondary" disabled={busy} onClick={()=>setConfirm(false)}>취소</button><button className="button primary" disabled={busy} onClick={start}>{busy?'시작하는 중…':'제출 마감하고 전체 시작'}</button></div></section></div>}</>;
}
