'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowRight,BookOpen,Check,ChevronDown,ChevronLeft,ChevronRight,Code2,Database,Download,ExternalLink,List,LoaderCircle,Maximize2,MessageSquare,Play,RotateCcw,Square,Terminal,Workflow} from 'lucide-react';
import {lessons,lessonIndex,lessonStorageKey,type Concept,type Lesson} from '../lib/web-lecture';

export type TraceEvent={seq:number;kind:string;label:string;data:unknown};
type Result={events:TraceEvent[];model?:string};
type Props={apiLabel?:string;demo:string;mode:string;result:Result|null;busy:boolean;runDisabled:boolean;status:string;
 onSelect:(id:string)=>void;onModeChange:(mode:string)=>void;onRun:()=>void;onStop:()=>void;onDownload:()=>void;onHackathon:()=>void};
const two=(n:number)=>String(n).padStart(2,'0');
const kindName:Record<string,string>={intro:'시작',model_input:'입력',model_output:'모델',answer:'답변',tool:'도구',tool_request:'요청',tool_result:'결과',direct_tool:'함수',stop:'종료',retrieval:'검색',notice:'안내',validation:'검증',mcp_request:'요청',mcp_response:'응답',tools:'도구 목록',memory_write:'기억 저장',memory_read:'기억 조회',memory_request:'저장 요청'};

function Code({code}:{code:string}) {
 return <div className="lesson-code"><div><Code2 size={14}/><span>구조를 읽는 Python 예시</span><small>축약 코드</small></div><pre><code>{code.split('\n').map((line,i)=><span className="code-line" key={i}><i aria-hidden="true">{i+1}</i><span>{line.split(/("[^"]*"|'[^']*'|\b(?:def|return|for|in|if|not|await|async)\b|#.*)/g).map((part,j)=><span key={j} className={/^["']/.test(part)?'syntax-string':/^(def|return|for|in|if|not|await|async)$/.test(part)?'syntax-keyword':part.startsWith('#')?'syntax-comment':undefined}>{part}</span>)}</span></span>)}</code></pre></div>;
}
function Architecture({mcp=false}:{mcp?:boolean}) {
 return <div className={'lesson-architecture '+(mcp?'mcp-architecture':'')} aria-label={mcp?'앱 안의 Client와 MCP Server의 연결':'모델, 도구, 검색, 기억의 연결'}>
  <div className="architecture-request"><MessageSquare size={17}/>{mcp?'에이전트 앱 · Host':'나에게 맞는 Python 행사를 알려줘'}</div>
  <ArrowDown className="architecture-arrow" size={20}/>
  <div className="architecture-core"><Workflow size={25}/><div><b>{mcp?'MCP Client':'Agent Loop'}</b><span>{mcp?'도구를 발견하고 호출을 전달':'모델의 선택 → 실행 → 관찰'}</span></div></div>
  <div className="architecture-branches">{(mcp?[['initialize','연결 초기화'],['tools/list','도구 목록'],['tools/call','도구 실행']]:[['Tools','행사 조회'],['RAG','규정 검색'],['Memory','사용자 선호']]).map(([name,detail])=><div key={name}><span/><b>{name}</b><small>{detail}</small></div>)}</div>
  {mcp&&<div className="architecture-server"><Database size={16}/><b>MCP Server</b><span>도구와 데이터를 제공</span></div>}
 </div>;
}
function ConceptBody({concept:c}:{concept:Concept}) {
 return <>
  {c.left&&<div className="lesson-comparison">{[[c.left_title,c.left],[c.right_title,c.right]].map(([title,items],i)=><section key={String(title)}><span className="concept-index">{two(i+1)}</span><h3>{title as string}</h3><ul>{(items as string[])?.map(item=><li key={item}>{item}</li>)}</ul></section>)}</div>}
  {c.code&&<Code code={c.code}/>}
  {c.points&&<ul className="lesson-points">{c.points.map((p,i)=><li key={p}><span>{two(i+1)}</span>{p}</li>)}</ul>}
  {c.nodes&&<ol className="lesson-flow">{c.nodes.map((n,i)=><li key={n}><span>{two(i+1)}</span><b>{n}</b>{i<c.nodes!.length-1&&<ArrowDown size={14}/>}</li>)}</ol>}
  {c.examples&&<div className="lesson-examples">{c.examples.map(e=><p key={e}>{e}</p>)}</div>}
  {c.layout==='mcp'&&<Architecture mcp/>}
  {c.layout==='architecture'&&<Architecture/>}
  {c.rows&&<div className="lesson-table-wrap"><table className="lesson-table"><thead><tr>{c.headers?.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{c.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>}
  {c.items&&<dl className="lesson-resources">{c.items.map(([title,body])=><div key={title}><dt>{title}</dt><dd>{body}</dd></div>)}</dl>}
  {c.bottom&&<p className="lesson-takeaway"><span>기억할 것</span>{c.bottom}</p>}
 </>;
}
function EventData({event}:{event:TraceEvent}) {
 const data=event.data as any;
 if(typeof data==='string')return <p className="event-prose">{data}</p>;
 const messages=event.kind==='model_input'?(Array.isArray(data)?data:data?.messages):null;
 if(messages)return <div className="event-messages">{messages.map((m:any,i:number)=><div key={i}><span>{m.role}</span><p>{typeof m.content==='string'?m.content:JSON.stringify(m.tool_calls||m.content,null,2)}</p></div>)}{data?.tools&&<details><summary>모델에 전달한 도구 명세</summary><pre>{JSON.stringify(data.tools,null,2)}</pre></details>}</div>;
 const docs=event.kind==='retrieval'?(Array.isArray(data)?data:data?.chunks):null;
 if(Array.isArray(docs)&&docs.length)return <div className="event-documents">{docs.map((d:any,i:number)=><article key={i}><span><BookOpen size={13}/>{d.source||d.id||`문단 ${i+1}`}</span><p>{d.text||d.content||JSON.stringify(d,null,2)}</p></article>)}</div>;
 return <pre>{JSON.stringify(data,null,2)}</pre>;
}
function Execution({lesson,controls:p}:{lesson:Lesson;controls:Props}) {
 const [expanded,setExpanded]=useState<number|null>(null),[outputView,setOutputView]=useState('result');
 const example=lesson.example!;
 const result=p.demo===example.demo?p.result:null;
 const events=result?.events||[];
 const answers=events.filter(e=>e.kind==='answer');
 const observations=events.filter(e=>['retrieval','tools','validation','memory_read'].includes(e.kind));
 const meaningful=events.filter(e=>e.kind!=='intro');
 const showTrace=p.busy||outputView==='trace';
 const active=events.find(e=>e.seq===expanded);
 const noApi=['D08','D10'].includes(example.demo);
 return <section className="lesson-execution" aria-label={`${lesson.short} 실행`}>
  <div className="execution-heading"><span><span className={'execution-dot '+(p.busy?'running':'')}/>{p.busy?'실행 중':result?'실행 기록 있음':'직접 확인하기'}</span><small>{example.demo} · {result?.model||'행사 비서'}</small></div>
  <div className="lesson-question"><MessageSquare size={18}/><p>{example.question}</p></div>
  <div className="execution-actions"><div className="execution-modes" aria-label="실행 방식">{[['live','실제 실행'],['record','예시 기록']].map(([id,label])=><button key={id} disabled={p.busy} aria-pressed={p.mode===id} className={p.mode===id?'selected':''} onClick={()=>{setExpanded(null);p.onModeChange(id);}}>{label}</button>)}</div>{p.busy?<button className="button danger" onClick={p.onStop}><Square size={13}/>중단</button>:<button className="button primary" disabled={p.runDisabled||p.demo!==example.demo} onClick={()=>{setExpanded(null);p.onRun();}}>{p.mode==='record'?<BookOpen size={14}/>:result?<RotateCcw size={14}/>:<Play size={14}/>} {p.mode==='record'?'기록 불러오기':result?'다시 실행':'실행하기'}</button>}</div>
  <p className="execution-disclosure">{p.mode==='record'?'규칙으로 미리 만든 모의 기록입니다. 실제 LLM 추론이나 새 코드 실행은 하지 않습니다.':noApi?'이 단계는 API 키 없이 브라우저에서 실제로 실행됩니다.':`내 브라우저가 도구를 실행하고, ${p.apiLabel||'선택한 API'}가 모델 추론을 수행합니다. 개인 API 키와 크레딧이 필요합니다.`}{['D08','D09'].includes(example.demo)&&' MCP는 브라우저 MessageChannel을 쓰는 교육용 구현입니다.'}</p>
  {p.status&&<div className="execution-status" role="status">{p.busy&&<LoaderCircle size={13} className="spin"/>}{p.status}</div>}
  {!events.length&&!p.busy?<div className="execution-empty"><div className="empty-orbit"><Terminal size={25}/><span/></div><b>이 질문이 처리되는 과정을 확인하세요</b><p>실행하면 모델 입력, 도구 호출, 결과가 이곳에 나타납니다.</p></div>:<div className="execution-output">
   <div className="execution-result-tabs"><button aria-pressed={!showTrace} onClick={()=>setOutputView('result')}>결과</button><button aria-pressed={showTrace} onClick={()=>setOutputView('trace')}>단계별 기록 <span>{events.length}</span></button><button className="text-button" onClick={p.onDownload} disabled={p.busy||!result} aria-label="실행 기록 다운로드"><Download size={14}/></button></div>
   {!showTrace&&<div className="execution-result-body">{answers.length>0&&<div className="lesson-answers">{answers.map(e=><article key={e.seq}><span><Check size={13}/>{e.label}</span><EventData event={e}/></article>)}</div>}
   {!answers.length&&observations.slice(-2).map(e=><article className="observation-result" key={e.seq}><h4>{e.label}</h4><EventData event={e}/></article>)}
   </div>}
   {showTrace&&<div className="lesson-trace" aria-label="단계별 실행 기록">{meaningful.map(e=><div className={'lesson-trace-step '+(active?.seq===e.seq?'expanded':'')} key={e.seq}><button onClick={()=>setExpanded(active?.seq===e.seq?null:e.seq)} aria-expanded={active?.seq===e.seq}><span className="event-order">{two(e.seq)}</span><span className={'event-kind kind-'+e.kind}>{kindName[e.kind]||e.kind}</span><b>{e.label}</b><ChevronDown size={14}/></button>{active?.seq===e.seq&&<div className="lesson-event-detail"><EventData event={e}/></div>}</div>)}</div>}
   {!p.busy&&<p className="execution-saved">이 기록은 페이지를 이동해도 남습니다. 같은 예제를 다시 실행하면 갱신됩니다.</p>}
  </div>}
  <div className="execution-observe"><span>기록에서 찾아보기</span><ol>{example.observe.map((o,i)=><li key={o}><span>{i+1}</span>{o}</li>)}</ol></div>
 </section>;
}
export default function WebLecture(props:Props) {
 const [page,setPage]=useState(0),[restored,setRestored]=useState(false),[outline,setOutline]=useState(false),[focus,setFocus]=useState(false);
 const stage=useRef<HTMLElement>(null);
 const lesson=lessons[page];
 useEffect(()=>{
  let saved=null;try{saved=localStorage.getItem(lessonStorageKey);}catch{}
  setPage(lessonIndex(location.hash,saved));setRestored(true);
  const change=()=>{if(location.hash.startsWith('#lesson/'))setPage(lessonIndex(location.hash));};
  window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);
 },[]);
 useEffect(()=>{
  if(!restored)return;
  try{localStorage.setItem(lessonStorageKey,lesson.id);}catch{}
  if(lesson.example&&props.demo!==lesson.example.demo&&!props.busy)props.onSelect(lesson.example.demo);
 },[lesson,restored,props.demo,props.busy,props.onSelect]);
 useEffect(()=>{
  const onFull=()=>setFocus(document.fullscreenElement===stage.current);
  document.addEventListener('fullscreenchange',onFull);return()=>document.removeEventListener('fullscreenchange',onFull);
 },[]);
 useEffect(()=>{
  if(!focus)return;
  const previous=document.body.style.overflow;
  document.body.style.overflow='hidden';
  return()=>{document.body.style.overflow=previous;};
 },[focus]);
 function go(index:number){if(props.busy)return;const next=Math.max(0,Math.min(lessons.length-1,index));setPage(next);setOutline(false);stage.current?.focus({preventScroll:true});location.hash='lesson/'+lessons[next].id;if(document.fullscreenElement)stage.current?.scrollTo({top:0});else stage.current?.scrollIntoView({block:'start'});}
 async function present(){
  if(focus){setFocus(false);if(document.fullscreenElement)await document.exitFullscreen();return;}
  setFocus(true);
  try{await stage.current?.requestFullscreen();}catch{/* Embedded browsers still get the full-viewport presentation layout. */}
  stage.current?.focus({preventScroll:true});
 }
 function keyboard(e:React.KeyboardEvent){if(e.key==='Escape'&&!document.fullscreenElement){setFocus(false);return;}if(props.busy||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!(e.target instanceof HTMLElement)||e.target.closest('input,textarea,select,button,a,summary,[contenteditable="true"]'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(page+(e.key==='ArrowRight'?1:-1));}}
 return <section ref={stage} className={'web-lecture '+(focus?'is-presenting':'')} onKeyDown={keyboard} tabIndex={0} aria-label="1일차 웹 강의">
  <header className="lesson-toolbar"><div className="lesson-location"><span>DAY 01</span><i>/</i><b>AI Agent의 구조</b></div><div className="lesson-toolbar-actions"><a href="/day1-materials.zip" download className="lesson-tool" title="원본 Python 코드와 자료 다운로드"><Download size={15}/><span>원본 코드</span></a><button className="lesson-tool" onClick={present} aria-label={focus?'전체 화면 닫기':'전체화면'}><Maximize2 size={15}/><span>{focus?'전체 화면 닫기':'전체화면'}</span></button></div></header>
  <div className="lesson-progress" aria-label={`${lessons.length}개 주제 중 ${page+1}번째`}><span style={{width:`${(page+1)/lessons.length*100}%`}}/></div>
  <div className="lesson-navigation"><button className={'lesson-outline-toggle '+(outline?'selected':'')} onClick={()=>setOutline(!outline)} aria-expanded={outline}><List size={16}/><b>목차</b><span>{two(page+1)} / {lessons.length}</span><ChevronDown size={13}/></button><div className="lesson-breadcrumb"><span>{page<8?'01 · 모델에서 도구까지':page<15?'02 · 연결, 검색, 기억':page<17?'03 · 직접 만드는 에이전트':'REFERENCE'}</span></div><div className="lesson-quick-nav"><button aria-label="이전 주제" disabled={page===0||props.busy} onClick={()=>go(page-1)}><ChevronLeft size={18}/></button><button aria-label="다음 주제" disabled={page===lessons.length-1||props.busy} onClick={()=>go(page+1)}><ChevronRight size={18}/></button></div></div>
  {outline&&<nav className="lesson-outline" aria-label="강의 목차">{lessons.map((l,i)=><button key={l.id} aria-current={page===i?'step':undefined} className={page===i?'current':''} disabled={props.busy} onClick={()=>go(i)}><span>{two(i+1)}</span><b>{l.short}</b><small>{l.minutes?`${l.minutes}분`:'참고'}</small></button>)}</nav>}
  <article key={lesson.id} className={'lesson-page lesson-'+lesson.id}>
   <div className="lesson-heading"><div className="lesson-kicker"><span>{two(page+1)}</span><i/>{lesson.short}</div><h1>{lesson.concept.title}</h1><p>{lesson.summary}</p></div>
   {lesson.id==='start'?<div className="lesson-welcome"><div><Architecture/><p className="welcome-caption">오늘 함께 발전시킬 에이전트 · 가상 동아리 행사 비서</p></div><div className="welcome-path"><span className="lesson-label">오늘의 흐름</span>{[['01','모델에게 묻고','LLM · API · 프롬프트'],['02','도구로 행동하고','Tool Calling · Agent Loop · MCP'],['03','근거와 기억을 더합니다','RAG · Conversation · Memory']].map(([num,title,sub])=><div key={num}><span>{num}</span><section><h3>{title}</h3><p>{sub}</p></section></div>)}<button className="button primary welcome-start" onClick={()=>go(1)}>강의 시작하기 <ArrowRight size={15}/></button><p className="welcome-meta">Minjae Kim · GDGoC Korea University</p></div></div>
   :lesson.id==='reference'?<div className="lesson-appendix">{lesson.appendix?.map((c,i)=><details key={c.title} open={i===0}><summary><span>{two(i+1)}</span>{c.title.replace(/부록 A\d · /,'')}<ChevronDown size={16}/></summary><div><ConceptBody concept={c}/></div></details>)}</div>
   :<div className={lesson.example?'lesson-body with-execution':'lesson-body'}><div className="lesson-concept"><ConceptBody concept={lesson.concept}/>{lesson.example&&<p className="lesson-source-file"><Code2 size={14}/><span>원본 코드 <code>{lesson.example.codefile}</code></span></p>}{lesson.id==='day2'&&<div className="lesson-handoff"><p>19:00 환경 확인 → 19:10 구현·개선 → 20:35 코드 고정 → 20:55 결과 공유</p><button className="button primary" onClick={props.onHackathon}>해커톤 워크스페이스 열기 <ArrowRight size={15}/></button><small>수업용 점수이며 공식 BFCL 전체 점수와 다릅니다. 클라이언트가 보고한 결과를 사용하는 학습용 리더보드입니다.</small></div>}</div>{lesson.example&&<Execution key={`${lesson.example.demo}-${props.mode}`} lesson={lesson} controls={props}/>}</div>}
   {lesson.sources.length>0&&<details className="lesson-citations"><summary>더 읽어보기 <ExternalLink size={12}/></summary><ul>{lesson.sources.map(url=><li key={url}><a href={url} target="_blank" rel="noreferrer">{new URL(url).hostname} <span>{url.split('/').filter(Boolean).slice(-1)[0]}</span><ExternalLink size={12}/></a></li>)}</ul></details>}
  </article>
  <footer className="lesson-footer"><button disabled={page===0||props.busy} onClick={()=>go(page-1)}><ChevronLeft size={17}/><span><small>이전</small>{lessons[Math.max(0,page-1)].short}</span></button><span className="lesson-key-hint">← → 주제 이동 <i>·</i> {two(page+1)} / {lessons.length}</span>{page<lessons.length-1?<button className="next-lesson" disabled={props.busy} onClick={()=>go(page+1)}><span><small>다음</small>{lessons[page+1].short}</span><ArrowRight size={18}/></button>:<button className="next-lesson" onClick={props.onHackathon}><span><small>DAY 02</small>해커톤 시작하기</span><ArrowRight size={18}/></button>}</footer>
 </section>;
}
