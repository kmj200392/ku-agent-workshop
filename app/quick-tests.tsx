'use client';
import {BENCHMARK} from '../lib/benchmark-config.mjs';
const categories:Record<string,string>={base:'기본 업무',miss_param:'정보 부족',miss_func:'도구 부족',long_context:'확장 데이터',memory:'대화 기억',conditional:'조건부 실행'};
export default function QuickTests({cases,selected,onSelect,disabled}:{cases:any[];selected:string[];onSelect:(ids:string[])=>void;disabled:boolean}){
 return <fieldset className="quick-tests" disabled={disabled}><legend>빠른 테스트 · {selected.length} / {BENCHMARK.quickLimit}개 선택</legend><p>확인할 연습 문제를 골라 실행하세요. 순위와 최종 제출 코드에는 반영되지 않습니다. 최종 평가 참여에는 전체 평가 완료가 필요합니다.</p><div className="quick-case-grid">{cases.map(c=><label key={c.id}><input type="checkbox" checked={selected.includes(c.id)} disabled={disabled||(!selected.includes(c.id)&&selected.length>=BENCHMARK.quickLimit)} onChange={e=>onSelect(e.target.checked?[...selected,c.id]:selected.filter(id=>id!==c.id))}/><span><b>{c.label} · {categories[c.category]||c.category}</b><small>{c.title}</small></span></label>)}</div></fieldset>;
}
