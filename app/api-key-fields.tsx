'use client';
import {ExternalLink,KeyRound} from 'lucide-react';
import {MODEL_PROVIDERS} from '../lib/model-providers.mjs';

type Provider=keyof typeof MODEL_PROVIDERS;
type Props={id?:string;provider:Provider;apiKey:string;disabled:boolean;onProviderChange:(provider:Provider)=>void;onKeyChange:(key:string)=>void};

export default function ApiKeyFields({id='api-key',provider,apiKey,disabled,onProviderChange,onKeyChange}:Props){
 const connection=MODEL_PROVIDERS[provider];
 return <div className="api-key-fields">
  <fieldset className="api-provider-field"><legend>사용할 API</legend><div className="segmented" aria-label="API 제공자">{(Object.keys(MODEL_PROVIDERS) as Provider[]).map(value=><button key={value} type="button" disabled={disabled} aria-pressed={provider===value} className={provider===value?'selected':''} onClick={()=>onProviderChange(value)}>{MODEL_PROVIDERS[value].label}</button>)}</div></fieldset>
  <div className="api-key-label"><label htmlFor={id}>{connection.label} 키 <KeyRound size={14}/></label><a href={provider==='school'?'https://llm.korea.ac.kr/dashboard/chat/40882':'https://platform.openai.com/api-keys'} target="_blank" rel="noreferrer">{provider==='school'?'학교 LLM 서비스':'API 키 발급'} <ExternalLink size={12}/></a></div>
  <input id={id} type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={e=>onKeyChange(e.target.value.trim())} placeholder={provider==='openai'?'OpenAI API 키 입력':'학교 개인 API 키 입력'} disabled={disabled} aria-describedby={id+'-status'}/>
  <p id={id+'-status'} className={'api-key-status '+(apiKey?'has-key':'')} role="status">{apiKey?'키 입력됨 · 실제 실행 시 확인':'둘 중 하나의 키만 입력하면 됩니다.'}</p>
  <div className="api-key-model"><span>사용 모델</span><code>{connection.model}</code></div>
  <p className="field-hint">{provider==='openai'?'OpenAI API 사용료는 본인 계정에 청구되며, ChatGPT 구독과 별도입니다.':'학교 개인 크레딧과 해당 모델의 사용 권한이 필요합니다.'}</p>
  <p className="field-hint">키는 현재 탭의 메모리에만 보관합니다. 실행할 때 선택한 API 제공자에게 직접 전송되며, 새로고침하면 지워집니다.</p>
 </div>;
}
