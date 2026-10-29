"""Summarize completed instructor runs without publishing traces or credentials."""
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
RUN=ROOT/'outputs/benchmark-v2-luna-2026-10-29'
SUITES=json.loads((ROOT/'lib/bfcl-suites.json').read_text())
META={c['id']:(split,c) for split,cases in SUITES.items() for c in cases}
manifest=json.loads((RUN/'manifest.json').read_text())
frozen=json.loads((ROOT/'outputs/benchmark-v2-2026-10-29/pilot-suite.json').read_text())['final']
assert {c['id'] for c in frozen}==set(META)
for item in frozen:
    case=dict(item);split=case.pop('workshopSplit')
    assert META[case['id']]==(split,case),case['id']
requests=[json.loads(line) for line in (RUN/'requests.jsonl').read_text().splitlines()]
assert requests and all(r['status']==200 and r['returnedModel']=='gpt-6-luna' for r in requests)
assert all(r.get('usage',{}).get('completion_tokens_details',{}).get('reasoning_tokens',0)==0 for r in requests)
summary={'date':'2026-10-29','model':manifest['protocol']['model'],'reasoningEffort':'none','protocolHash':manifest['protocolHash'],
 'suiteFileSha256':hashlib.sha256((ROOT/'lib/bfcl-suites.json').read_bytes()).hexdigest(),
 'protocol':manifest['protocol'],'requests':len(requests),'httpStatuses':dict(Counter(r['status'] for r in requests)),'agents':{},
 'limitations':['One completed run per agent, not repeated-run averages.','Instructor OpenAI endpoint only; school API latency and classroom concurrency not tested.','Original final20 informed instructor development; authored additions are not an independent blind holdout.']}
for agent in manifest['protocol']['agents']:
    name=agent['name'];result=json.loads((RUN/f'final-{name}.json').read_text())
    assert result['status']=='completed',f'{name} is incomplete'
    assert result['protocolHash']==manifest['protocolHash'] and result['agentSha256']==agent['sha256']
    assert hashlib.sha256((ROOT/f'tests/rehearsal/agents/{name}.py').read_bytes()).hexdigest()==agent['sha256']
    assert len(result['cases'])==len(META) and {c['id'] for c in result['cases']}==set(META)
    assert all(c['status'] in ['pass','fail'] for c in result['cases'])
    calls=[r for r in requests if r['agent']==name]
    assert len(calls)==sum(c['modelCalls'] for c in result['cases'])
    row={'sourceSha256':agent['sha256'],'splits':{},'usage':{key:sum(r['usage'].get(key,0) for r in calls) for key in ['prompt_tokens','completion_tokens','total_tokens']}}
    for split in SUITES:
        cases=[c for c in result['cases'] if META[c['id']][0]==split]
        totals={'passed':sum(c['status']=='pass' for c in cases),'total':len(cases),'elapsedMs':sum(c['elapsed'] for c in cases),
            'modelCalls':sum(c['modelCalls'] for c in cases),'toolCalls':sum(c['toolCalls'] for c in cases)}
        for field in ['category','provenance']:
            classify=lambda c:META[c['id']][1][field] if field=='category' else META[c['id']][1]['provenance']['kind']
            totals[field]={value:{'passed':sum(c['status']=='pass' for c in cases if classify(c)==value),'total':sum(classify(c)==value for c in cases)} for value in sorted({classify(c) for c in cases})}
        row['splits'][split]=totals
    summary['agents'][name]=row
dest=ROOT/'docs/benchmark-v2-results.json'
dest.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({name:row['splits'] for name,row in summary['agents'].items()},ensure_ascii=False,indent=2))
