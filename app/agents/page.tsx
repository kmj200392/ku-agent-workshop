import type {Metadata} from 'next';
import Workshop from '../workshop';

export const metadata: Metadata = {
  title: 'AI Agent 개발 워크숍 | Minjae Kim Lectures',
  description: 'AI Agent 강의 시연과 브라우저 로컬 해커톤. 도구와 기억을 연결하고 에이전트 성능을 비교하세요.',
};

export default function AgentLecture() { return <Workshop/>; }
