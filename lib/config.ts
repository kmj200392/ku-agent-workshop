export const CONFIG = {
  title: 'KU Agent Lab', model: 'claude-haiku-5-5',
  gateway: 'https://api.baze.co/v1/gateway/chat/completions/',
  practiceVersion: 'bfcl-travel-practice-v1', finalVersion: 'bfcl-travel-final-v1',
  practiceCount: 6, finalCount: 20, benchmark: 'BFCL V4 Multi-turn · TravelAPI',
  freezeAt: '2026-10-29T20:35:00+09:00', closeAt: '2026-10-29T20:55:00+09:00',
  limits: { codeBytes: 100*1024, resultBytes: 32*1024, modelCalls: 8, toolCalls: 16, caseModelCalls: 40, caseToolCalls: 80, caseMs: 180000, outputTokens: 2048 },
};
export function phase(now=Date.now()) { return now < Date.parse(CONFIG.freezeAt) ? 'practice' : now < Date.parse(CONFIG.closeAt) ? 'final' : 'closed'; }
