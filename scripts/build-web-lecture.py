import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
slides = json.loads((root.parent / 'day1/materials/slides.json').read_text())
groups = [(1,), (2,3), (4,5), (6,7), (8,9), (10,11), (12,13), (14,15), (16,), (17,18), (19,20), (21,22), (23,24), (25,26), (27,28), (29,30), (31,), (32,), (33,34,35,36)]
lessons = []
for nums in groups:
    parts = [slides[n-1] for n in nums]
    concept = {k:v for k,v in parts[0].items() if k not in ['notes','cue','sources','start','end','minutes','number']}
    example = next((p for p in parts if p.get('demo')), None)
    lesson = dict(concept=concept, start=parts[0]['start'], end=parts[-1]['end'], minutes=sum(p['minutes'] for p in parts), sourcePages=nums, sources=list(dict.fromkeys(u for p in parts for u in p['sources'])))
    if example:
        lesson['example'] = {k:example[k] for k in ['demo','question','observe','codefile']}
    if nums[0] == 33:
        lesson['appendix'] = [{k:v for k,v in p.items() if k in ['title','layout','code','points','headers','rows','bottom','items']} for p in parts]
    lessons.append(lesson)
(root / 'lib/day1-lessons.json').write_text(json.dumps(lessons, ensure_ascii=False, indent=2) + '\n')
