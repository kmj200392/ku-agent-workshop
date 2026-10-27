'use client';

import {useEffect, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, Download, ExternalLink, Maximize, Minimize, Play} from 'lucide-react';
import materials from '../lib/day1-materials.json';

const PAGE_KEY = `ku-agent:day1-slides:${materials.sourceSha256.slice(0, 12)}`;

export default function LectureMaterials({onOpenDemo}: {onOpenDemo: (id: string) => void}) {
  const [page, setPage] = useState(0);
  const [restored, setRestored] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [screenError, setScreenError] = useState('');
  const [imageError, setImageError] = useState(false);
  const viewer = useRef<HTMLDivElement>(null);
  const slide = materials.slides[page];
  const count = materials.slides.length;

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(PAGE_KEY));
      if (Number.isInteger(saved) && saved >= 0 && saved < count) setPage(saved);
    } catch { /* Reading remains available when storage is blocked. */ }
    setRestored(true);
    const onFullScreen = () => setFullScreen(document.fullscreenElement === viewer.current);
    document.addEventListener('fullscreenchange', onFullScreen);
    return () => document.removeEventListener('fullscreenchange', onFullScreen);
  }, [count]);

  useEffect(() => {
    if (restored) {
      try { localStorage.setItem(PAGE_KEY, String(page)); } catch { /* Optional page resume. */ }
    }
    setImageError(false);
  }, [page, restored]);

  function goTo(next: number) { setPage(Math.min(count - 1, Math.max(0, next))); }

  async function toggleFullScreen() {
    try {
      setScreenError('');
      if (document.fullscreenElement === viewer.current) await document.exitFullscreen();
      else if (viewer.current?.requestFullscreen) await viewer.current.requestFullscreen();
      else setScreenError('이 브라우저에서는 전체화면을 지원하지 않아요. PDF 원본을 새 탭에서 열어주세요.');
    } catch { setScreenError('전체화면을 열지 못했어요. PDF 원본을 새 탭에서 볼 수 있어요.'); }
  }

  return <>
    <div className="page-heading materials-heading">
      <div><div className="eyebrow">DAY 01 · LECTURE MATERIALS</div><h1>강의자료</h1><p>개념 설명부터 단계별 시연까지, 수업 슬라이드를 바로 확인하세요.</p></div>
      <div className="materials-downloads"><a className="button secondary" href={materials.pdf} download><Download size={15}/>PDF 다운로드</a><a className="button secondary" href="/day1-materials.zip" download><Download size={15}/>전체 자료 · 코드</a></div>
    </div>
    <div className="materials-layout">
      <aside className="panel slide-outline" aria-label="강의자료 목차">
        <div className="panel-header"><b>1일차 · AI Agent 개발</b><span className="subtle">{count}장</span></div>
        <nav aria-label="슬라이드 목차">{materials.slides.map((item, index) => <button key={item.number} className={page === index ? 'selected' : ''} aria-current={page === index ? 'page' : undefined} onClick={() => goTo(index)}><span>{String(item.number).padStart(2, '0')}</span><span>{item.title}</span>{item.demo && <small>{item.demo}</small>}</button>)}</nav>
      </aside>
      <div className="materials-reader">
        <div className="panel slide-viewer" ref={viewer} role="region" aria-label="슬라이드 뷰어" tabIndex={0} onKeyDown={event => {
          if ((event.target as HTMLElement).closest('input, select, textarea') || event.altKey || event.ctrlKey || event.metaKey) return;
          const targets: Record<string, number> = {ArrowLeft: page - 1, ArrowRight: page + 1, Home: 0, End: count - 1};
          const target = targets[event.key];
          if (target !== undefined) { event.preventDefault(); goTo(target); }
        }}>
          <div className="slide-toolbar"><div className="slide-page-controls">
            <button className="icon-button" aria-label="이전 슬라이드" disabled={page === 0} onClick={() => goTo(page - 1)}><ChevronLeft size={19}/></button>
            <label className="slide-page-picker"><span className="sr-only">슬라이드 페이지</span><select aria-label="슬라이드 페이지" value={page} onChange={event => goTo(Number(event.target.value))}>{materials.slides.map((item, index) => <option key={item.number} value={index}>{item.number} / {count}</option>)}</select></label>
            <button className="icon-button" aria-label="다음 슬라이드" disabled={page === count - 1} onClick={() => goTo(page + 1)}><ChevronRight size={19}/></button>
          </div><div className="slide-toolbar-actions"><a className="icon-button" href={materials.pdf} target="_blank" rel="noreferrer" aria-label="PDF 원본 새 탭에서 열기"><ExternalLink size={17}/></a><button className="icon-button" aria-label={fullScreen ? '전체화면 종료' : '전체화면'} onClick={toggleFullScreen}>{fullScreen ? <Minimize size={18}/> : <Maximize size={18}/>}</button></div></div>
          <div className="slide-image-frame">{imageError ? <p role="alert">슬라이드를 불러오지 못했어요. <a href={materials.pdf} target="_blank" rel="noreferrer">PDF 원본 열기</a></p> : <img key={slide.image} src={slide.image} width={slide.width} height={slide.height} alt={`${slide.number}페이지: ${slide.title}`} onError={() => setImageError(true)}/>}</div>
          <div className="slide-caption" aria-live="polite"><span>{slide.number > 32 ? '부록' : '1일차'} · {slide.title}</span><span>{slide.number} / {count}</span></div>
          {screenError && <p className="slide-message" role="status">{screenError}</p>}
        </div>
        <div className="slide-reader-help"><span>← → 키로 이동 · 보던 페이지는 자동 저장됩니다.</span>{slide.demo && <button className="button secondary" onClick={() => onOpenDemo(slide.demo!)}><Play size={14}/>{slide.demo} 시연 열기</button>}</div>
        <details className="panel slide-transcript" key={slide.number}><summary>슬라이드 텍스트 보기</summary><div><h2>{slide.title}</h2>{slide.text.map((text, index) => <p key={index}>{text}</p>)}{slide.sources.length > 0 && <div className="slide-sources"><b>참고 자료</b>{slide.sources.map(source => <a key={source} href={source} target="_blank" rel="noreferrer">{source}<ExternalLink size={12}/></a>)}</div>}</div></details>
      </div>
    </div>
  </>;
}
