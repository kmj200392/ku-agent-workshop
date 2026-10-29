import {BENCHMARK} from './benchmark-config.mjs';
import {MODEL_PROVIDERS} from './model-providers.mjs';
export const CONFIG = {
  title: 'KU Agent Lab', model: MODEL_PROVIDERS.school.model,
  gateway: MODEL_PROVIDERS.school.gateway, providers: MODEL_PROVIDERS,
  practiceVersion: BENCHMARK.practiceVersion, finalVersion: BENCHMARK.finalVersion,
  practiceCount: BENCHMARK.practiceCount, finalCount: BENCHMARK.finalCount, benchmark: 'BFCL TravelAPI · 수업용 확장 v2',
  freezeAt: '2026-10-29T20:35:00+09:00', closeAt: '2026-10-29T20:55:00+09:00',
  limits: { codeBytes: 100*1024, resultBytes: 32*1024, modelCalls: 8, toolCalls: 16, caseModelCalls: 40, caseToolCalls: 80, caseMs: 180000, outputTokens: 2048 },
};
export function phase(now=Date.now()) { return now < Date.parse(CONFIG.freezeAt) ? 'practice' : now < Date.parse(CONFIG.closeAt) ? 'final' : 'closed'; }
