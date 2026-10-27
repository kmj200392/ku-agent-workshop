"""Render the existing lecture archive for static, browser-only slide viewing.

Requires Poppler (pdftoppm) and Pillow; run only when the lecture archive changes.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/materials/day1'
OMIT = {'number', 'title', 'layout', 'minutes', 'start', 'end', 'cue', 'notes', 'sources'}


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(ROOT / 'public/day1-materials.zip') as archive:
        pdf = archive.read('day1/materials/AI_Agent_Day1.pdf')
        slides = json.loads(archive.read('day1/materials/slides.json'))
    (OUTPUT / 'AI_Agent_Day1.pdf').write_bytes(pdf)
    with tempfile.TemporaryDirectory(prefix='lecture-slides-') as temp:
        subprocess.run(['pdftoppm', '-png', '-scale-to', '1600',
                        str(OUTPUT / 'AI_Agent_Day1.pdf'), str(Path(temp) / 'page')], check=True)
        pages = sorted(Path(temp).glob('page-*.png'))
        if len(pages) != len(slides):
            raise ValueError('PDF page count and slide metadata differ')
        manifest = []
        for source, slide in zip(pages, slides):
            number = slide['number']
            filename = f'slide-{number:02}.webp'
            with Image.open(source) as image:
                image.convert('RGB').save(OUTPUT / filename, 'WEBP', quality=92, method=6)
                width, height = image.size
            content = list(dict.fromkeys(strings({k: v for k, v in slide.items() if k not in OMIT})))
            manifest.append({'number': number, 'title': slide['title'],
                             'image': f'/materials/day1/{filename}', 'width': width, 'height': height,
                             'demo': slide.get('demo'), 'text': content, 'sources': slide.get('sources', [])})
    data = {'title': 'AI Agent 개발의 기본 구조', 'pdf': '/materials/day1/AI_Agent_Day1.pdf',
            'sourceSha256': hashlib.sha256(pdf).hexdigest(), 'slides': manifest}
    (ROOT / 'lib/day1-materials.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'Rendered {len(manifest)} slides; PDF SHA-256 {data["sourceSha256"]}')


if __name__ == '__main__':
    main()
