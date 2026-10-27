export type Lecture = {
  slug: string;
  title: string;
  description: string;
  organization: string;
  dates: string;
  time: string;
  tags: readonly string[];
  coverTitle: string;
  coverSubtitle: string;
};

// Add a catalog entry and a matching app/<slug>/page.tsx for each new lecture.
export const lectures: readonly Lecture[] = [{
  slug: 'agents',
  title: 'AI Agent 개발 워크숍',
  description: 'LLM에서 에이전트까지. 도구와 기억을 연결하는 과정을 시연으로 배우고, 나만의 에이전트로 해커톤에 참여합니다.',
  organization: 'GDGoC KOREA UNIVERSITY',
  dates: '2026. 10. 28 – 29',
  time: '19:00 – 21:00 · 2일',
  tags: ['입문', '강의 · 시연', '개인 해커톤'],
  coverTitle: 'AI Agent',
  coverSubtitle: 'From concepts to working agents.',
}];
