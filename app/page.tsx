import Link from 'next/link';
import {ArrowRight, CalendarDays, Clock3, Code2} from 'lucide-react';
import {lectures} from '../lib/lectures';

export default function LectureHome() {
  return <div className="lecture-home">
    <header className="lecture-header">
      <Link href="/" className="lecture-brand"><span className="brand-mark" aria-hidden="true">m.</span><span>Lectures<small>MINJAE KIM</small></span></Link>
      <a href="https://minjaek.im/" className="lecture-profile">강사 소개 <ArrowRight size={15}/></a>
    </header>
    <main className="lecture-main">
      <section className="lecture-intro">
        <p className="eyebrow">LEARN · BUILD · EXPLORE</p>
        <h1>배우고,<br/>직접 만들어보는 시간.</h1>
        <p>개념에서 코드까지, 강의의 모든 과정을 한곳에서.<br/>참여할 강의를 선택하고 자료와 시연, 실습을 만나보세요.</p>
      </section>
      <section aria-labelledby="lectures-heading">
        <div className="lecture-section-heading"><h2 id="lectures-heading">강의 목록</h2><span>{lectures.length}개의 강의</span></div>
        <div className="lecture-grid">
          {lectures.map(lecture => <Link key={lecture.slug} href={`/${lecture.slug}`} className="lecture-card" aria-label={`${lecture.title} 강의 열기`}>
            <div className="lecture-cover" aria-hidden="true"><div className="lecture-cover-top"><span>{lecture.organization}</span><Code2 size={22}/></div><div className="lecture-cover-title">{lecture.coverTitle}<span>{lecture.coverSubtitle}</span></div><div className="lecture-cover-bottom"><span>01 / CONCEPT</span><ArrowRight size={16}/><span>02 / BUILD</span></div></div>
            <div className="lecture-card-body"><div className="lecture-tags">{lecture.tags.map(tag => <span key={tag}>{tag}</span>)}</div><h3>{lecture.title}</h3><p>{lecture.description}</p><div className="lecture-details"><span><CalendarDays size={15}/>{lecture.dates}</span><span><Clock3 size={15}/>{lecture.time}</span></div><div className="lecture-enter"><span>강의 열기</span><ArrowRight size={19}/></div></div>
          </Link>)}
        </div>
      </section>
    </main>
    <footer className="lecture-footer"><span>Minjae Kim · Lectures</span><span>생각을 코드로, 배움을 경험으로.</span></footer>
  </div>;
}
