import source from './day1-lessons.json';

export type Concept = {
 title:string; layout:string; code?:string; points?:string[]; bottom?:string;
 left_title?:string; left?:string[]; right_title?:string; right?:string[];
 nodes?:string[]; examples?:string[]; headers?:string[]; rows?:string[][]; items?:string[][];
};
export type Lesson = {
 id:string; short:string; summary:string; concept:Concept; start:string; end:string; minutes:number;
 sourcePages:number[]; sources:string[];
 example?:{demo:string;question:string;observe:string[];codefile:string}; appendix?:Concept[];
};

const chapters = [
 ['start','시작하기','하나의 행사 비서에 도구, 검색, 기억을 더하며 에이전트의 구조를 읽어봅니다.'],
 ['llm-agent','LLM과 Agent','“조회했습니다”라는 답변과 실제 조회는 어떻게 다를까요? 같은 질문의 처리 과정을 비교합니다.'],
 ['agent-flow','행동과 관찰','모델이 다음 행동을 고르고, 프로그램이 실행합니다. 결과가 다음 판단의 입력이 됩니다.'],
 ['model-api','모델과 API','모델이 실행되는 위치와 API를 호출하는 방법을 구분합니다. 이번 수업의 추론은 학교 API가 담당합니다.'],
 ['prompt','프롬프트','같은 사용자 요청에서 지시문만 바꿔봅니다. 답변 형식이 달라져도 없던 정보가 생기지는 않습니다.'],
 ['tool-calling','Tool Calling','모델은 함수의 이름과 인자를 요청합니다. 검증하고 실제로 실행하는 주체는 우리 프로그램입니다.'],
 ['agent-loop','Agent Loop','목록 조회로 얻은 ID가 다음 상세 조회의 입력이 됩니다. 그 연결을 실행 기록에서 따라가 봅니다.'],
 ['stop','종료와 오류','결과 없음, 잘못된 인자, 반복 한도에서도 상태와 종료 이유를 정확히 전달해야 합니다.'],
 ['break','잠깐 쉬어가기','20:05에 이어서 시작합니다. 다음에는 도구를 연결하고, 근거를 찾고, 정보를 기억합니다.'],
 ['mcp-discovery','MCP로 도구 발견','도구를 제공하는 프로그램과 에이전트 앱이 공통 규약으로 연결됩니다. 먼저 어떤 도구가 있는지 확인합니다.'],
 ['mcp-call','MCP로 도구 호출','발견한 명세를 모델에 전달하고, 모델의 호출 요청을 MCP Client가 서버에 전달합니다.'],
 ['retrieval','필요한 문단 찾기','행사 목록에는 없는 신청 조건을 문서에서 찾습니다. 검색 결과와 출처를 먼저 살펴봅니다.'],
 ['rag','근거를 넣어 답하기','찾은 문단을 입력에 더합니다. 검색이 잘됐는지와 답변이 근거에 맞는지는 따로 확인합니다.'],
 ['conversation','대화의 기억','모델에 전달한 대화가 달라지면 사용할 수 있는 정보도 달라집니다. 기록을 비우고 입력을 비교합니다.'],
 ['memory','세션을 넘는 기억','선호를 별도 저장소에 보관하고 새 대화에서 다시 읽습니다. 이번 요청은 저장된 선호보다 우선합니다.'],
 ['together','하나의 에이전트로','프로필, 행사 정보, 규정 문서가 하나의 요청에 모입니다. 어떤 정보가 답변의 근거인지 확인합니다.'],
 ['your-agent','내 아이디어로 바꾸기','지시문, 도구, 지식, 프로필을 바꾸면 다른 목적의 에이전트를 만들 수 있습니다.'],
 ['day2','다음은 직접 만들 차례','2일차에는 같은 여행 예약 문제를 해결합니다. 구현하고, 제출하고, 실행 기록으로 개선합니다.'],
 ['reference','다시 꺼내 보는 참고서','Agent Loop의 구조, API 오류 확인 순서, 용어와 원본 코드를 모았습니다.'],
];

export const lessons:Lesson[] = source.map((s,i)=>({...s,id:chapters[i][0],short:chapters[i][1],summary:chapters[i][2]}));
const chapter = (id:string)=>lessons.find(l=>l.id===id)!;
chapter('start').concept.title='AI Agent,\n작동하는 구조를 배우다.';
chapter('mcp-discovery').concept.bottom='웹에서는 MessageChannel로 JSON-RPC를 교환합니다. Python SDK의 stdio 예제는 원본 코드에 있습니다.';
chapter('mcp-discovery').example!.observe=['initialize → tools/list 요청 순서','반환된 도구 이름과 입력 schema','도구 발견과 실제 호출의 차이'];
chapter('retrieval').example!.observe=['원문과 검색된 문단의 관련성','문단과 함께 반환되는 출처 ID','모델 호출 없이 끝나는 검색 단계'];
chapter('retrieval').concept.examples=['웹 예제: 규정을 문단으로 나누고 키워드로 검색','검색 점수는 키워드 겹침이며 정확도 확률이 아닙니다.'];
chapter('memory').concept.nodes=['명시적 선호 저장','브라우저 저장소','새 대화에서 조회','입력에 다시 포함'];
chapter('memory').example!.observe=['저장소에서 읽은 프로필 값','새 대화 입력에 포함된 프로필','일회성 요청 후에도 유지된 장기 선호'];
Object.assign(chapter('day2').concept,{
 left_title:'BFCL 여행 예약 에이전트',left:['여러 턴의 항공료 조회·예약·취소 요청','같은 케이스 안에서 대화와 상태 유지','정보나 도구가 부족하면 호출 보류'],
 right_title:'실제 처리 결과로 비교',right:['모든 턴을 통과한 케이스당 1점','연습 6개 · 최종 20개 · 동점은 공동 순위','호출 수와 시간은 개선을 위한 참고 정보'],
 bottom:'개인 학교 API 키 사용 · 브라우저에서 실행·채점 · 서버에는 결과 요약 저장',
});
chapter('reference').appendix![1].bottom='웹에서는 참가 · API 설정을 확인하세요. 예시 기록은 API 호출 없이 볼 수 있습니다.';
chapter('reference').appendix![2].bottom='이 웹 강의는 브라우저에서 실행합니다. 원본 Python 예제는 별도 실행 환경이 필요합니다.';
chapter('reference').appendix![3].bottom='원본 Python 코드와 진행 노트는 다운로드 자료에 포함되어 있습니다.';

export const lessonStorageKey='ku-agent:day1-lesson-v1';
export function lessonIndex(hash:string, fallback:string|null=null) {
 const id=hash.startsWith('#lesson/')?hash.slice(8):fallback;
 const index=lessons.findIndex(l=>l.id===id);
 return index<0?0:index;
}
export function workshopView(hash:string) {
 const id=hash.replace(/^#/, '').split('/')[0];
 return ['materials','demos','lesson',''].includes(id)?'lesson':id;
}
