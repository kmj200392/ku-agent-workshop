'use client';

import {Download, LoaderCircle, Play, Square, Terminal} from 'lucide-react';

export const demoMeta = [
  ['D01', 'LLM과 Agent', '같은 질문, 모델 단독과 조회 도구 비교'],
  ['D02', 'Agent Loop', '행사 비서의 실행 기록'],
  ['D03', '학교 API', '학교 API 최소 호출'],
  ['D04', '프롬프트', '지시문 변경 전후 비교'],
  ['D05', 'Tool Calling', '도구 요청과 실제 함수 실행'],
  ['D06', '연속 도구 호출', '목록 조회 다음 상세 조회'],
  ['D07', '종료 조건', '결과 없음과 단계 제한'],
  ['D08', 'MCP 발견', 'MCP 메시지와 도구 목록'],
  ['D09', 'MCP 실행', 'MCP 메시지를 통한 도구 실행'],
  ['D10', 'RAG 검색', '규정 문단 검색'],
  ['D11', 'RAG 생성', '검색 문단을 넣어 답변 생성'],
  ['D12', '대화 기억', '대화 기록을 비우기'],
  ['D13', '지속 기억', '프로필 저장과 새 대화'],
  ['D14', '통합 Agent', '선호와 규정의 통합'],
];

type DemoResult = {events: {seq: number; kind: string; label: string; data: unknown}[]};
type Props = {
  compact?: boolean;
  demo: string;
  mode: string;
  result: DemoResult | null;
  busy: boolean;
  runDisabled: boolean;
  status: string;
  onSelect: (id: string) => void;
  onModeChange: (mode: string) => void;
  onRun: () => void;
  onStop: () => void;
  onDownload: () => void;
};

export default function DemoPanel({compact = false, demo, mode, result, busy, runDisabled, status, onSelect, onModeChange, onRun, onStop, onDownload}: Props) {
  const selected = demoMeta.find(item => item[0] === demo) || demoMeta[0];
  return <div className={'demo-main' + (compact ? ' demo-compact' : '')}>
    <section className="panel demo-controls">
      {compact && <label className="demo-picker">강의 시연<select aria-label="함께 볼 시연" value={demo} disabled={busy} onChange={event => onSelect(event.target.value)}>{demoMeta.map(([id, title]) => <option key={id} value={id}>{id} · {title}</option>)}</select></label>}
      <div className="eyebrow">{demo} · {selected[1]}</div><h2>{selected[2]}</h2>
      <div className="demo-toolbar">
        <div className="segmented"><button disabled={busy} aria-pressed={mode === 'live'} className={mode === 'live' ? 'selected' : ''} onClick={() => onModeChange('live')}>실제 실행</button><button disabled={busy} aria-pressed={mode === 'record'} className={mode === 'record' ? 'selected' : ''} onClick={() => onModeChange('record')}>기존 모의 기록</button></div>
        <button className="button primary" disabled={runDisabled} onClick={onRun}>{busy ? <LoaderCircle size={14} className="spin"/> : <Play size={14}/>} {mode === 'record' ? '기록 불러오기' : result ? '다시 실행' : '시연 실행'}</button>
        {busy && mode === 'live' && <button className="icon-button" aria-label="시연 중단" onClick={onStop}><Square size={16}/></button>}
      </div>
      <p className="demo-disclosure">{mode === 'record' ? '사전에 생성한 규칙 기반 모의 기록입니다. 새로 실행하거나 실제 LLM을 호출하지 않습니다.' : ['D08', 'D09'].includes(demo) ? 'MCP 메시지를 브라우저 내 전송으로 시연합니다. 원본 SDK stdio 시연은 다운로드한 Python 코드에서 실행합니다.' : demo === 'D10' ? '브라우저에서 실제 문서 검색을 실행합니다. 이 시연은 LLM 호출이 없습니다.' : '이 브라우저에서 도구를 실행하고 개인 키로 학교 LLM API를 직접 호출합니다.'}</p>
      {status && <div className="demo-status" role="status">{status}</div>}
    </section>
    <div className="panel trace-panel">
      <div className="panel-header"><div><Terminal size={17}/><b>실행 기록</b><span className="count-badge">{result?.events?.length || 0}</span></div>{result && <button className="text-button" onClick={onDownload}><Download size={14}/>JSON</button>}</div>
      {result ? <div className="trace-events"><p className="cached-note">저장된 결과 · 다시 실행하기 전까지 유지됩니다.</p>{result.events.map(event => <details key={`${demo}-${mode}-${event.seq}`} open={['answer', 'error', 'intro', 'notice'].includes(event.kind)}><summary><span className="trace-number">{String(event.seq).padStart(2, '0')}</span><span className={'trace-kind ' + event.kind}>{event.kind}</span><b>{event.label}</b></summary><pre>{typeof event.data === 'string' ? event.data : JSON.stringify(event.data, null, 2)}</pre></details>)}</div> : <div className="empty"><div className="empty-icon"><Play size={26}/></div><h3>설명 다음에는 실행.</h3><p>시연을 실행하면 모델 입력, 도구 요청,<br/>실행 결과를 순서대로 확인할 수 있어요.</p></div>}
    </div>
  </div>;
}
