"""Rebuild the standalone page from the user's LMS exports (no network)."""
import csv
import base64
import mimetypes
import hashlib
import json
import re
import sys
from io import BytesIO
from urllib.request import urlopen
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
rows = list(csv.DictReader((ROOT / 'program_6.csv').open(encoding='utf-8-sig', newline='')))
markdown = (ROOT / 'program_6.md').read_text(encoding='utf-8-sig')
descriptions = {}
for section in re.split(r'^# ', markdown, flags=re.M)[1:]:
    heading, _, body = section.partition('\n')
    date = re.search(r'\d{4}-\d{2}-\d{2}', heading).group()
    for block in re.split(r'^## ', body, flags=re.M)[1:]:
        title, _, content = block.partition('\n')
        def field(name, multiline=False):
            match = re.search(r'\*\*' + re.escape(name) + r':\*\*\s*(.*?)(?=\n\*\*|\Z)', content, re.S)
            return re.sub(r'\n---\s*$', '', match[1]).strip() if match else ''
        time = field('Время')
        key = (date, title.strip(), time.replace(' ', ''))
        assert key not in descriptions, key
        descriptions[key] = dict(speaker=field('Лектор'), summary=field('Краткое описание'), description=field('Полное описание'))

talks = []
used = set()
for row in rows:
    key = (row['Date'], row['Title'].strip(), row['Time Start'] + '-' + row['Time End'])
    assert key in descriptions, f'Missing description: {key}'
    assert key not in used, f'Duplicate: {key}'
    used.add(key)
    detail = descriptions[key]
    assert re.fullmatch(r'\d{2}:\d{2}', row['Time Start'])
    assert re.fullmatch(r'\d{2}:\d{2}', row['Time End'])
    assert row['Time Start'] < row['Time End'], key
    talks.append(dict(id='lms-' + hashlib.sha256('|'.join(key).encode()).hexdigest()[:14],
                      date=row['Date'], day=str(int(row['Date'][-2:])), start=row['Time Start'],
                      end=row['Time End'], room=row['Hall'].strip(), name=row['Title'].strip(),
                      speaker=detail['speaker'] or row['Lector'].strip() or None,
                      company=None, track='', summary=detail['summary'],
                      description=detail['description'] or detail['summary']))
assert used == set(descriptions), 'Unmatched Markdown entries'
assert len({t['id'] for t in talks}) == len(talks)
talks.sort(key=lambda t: (t['date'], t['start'], t['room'], t['name']))
enriched = 0
page_audit = []
verified_ids = set()
saved_pages = sorted(ROOT.glob('Матемаркетинг_??_11.html'))
if not saved_pages and (ROOT / 'Матемаркетинг.html').exists():
    saved_pages = [ROOT / 'Матемаркетинг.html']
portrait_cache = ROOT / 'speaker_photos'
def portrait_path(source):
    return portrait_cache / (hashlib.sha256(source.encode()).hexdigest() + '.webp')

def portrait_thumbnail(asset):
    from PIL import Image, ImageOps
    with Image.open(asset) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        image.thumbnail((160, 160), Image.Resampling.LANCZOS)
        output = BytesIO()
        image.save(output, format='WEBP', quality=85)
        return 'data:image/webp;base64,' + base64.b64encode(output.getvalue()).decode()

if '--download-portraits' in sys.argv:
    from bs4 import BeautifulSoup
    sources = set()
    for saved_page in saved_pages:
        soup = BeautifulSoup(saved_page.read_text(encoding='utf-8'), 'html.parser')
        sources.update(img['src'] for img in soup.select('.talk-card__speaker-photo[src]')
                       if img['src'].startswith('https://storage.yandexcloud.net/'))
    portrait_cache.mkdir(exist_ok=True)
    def download_portrait(source):
        target = portrait_path(source)
        if not target.exists():
            with urlopen(source, timeout=30) as response:
                data = response.read()
                assert data[:4] == b'RIFF' and data[8:12] == b'WEBP', f'Expected WebP portrait: {source}'
            target.write_bytes(data)
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(download_portrait, sorted(sources)))
    print(f'Cached {len(sources)} speaker portraits.')
for saved_page in saved_pages:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(saved_page.read_text(encoding='utf-8'), 'html.parser')
    date_match = re.search(r'_(\d{2})_11', saved_page.stem)
    day = str(int(date_match[1])) if date_match else '26'
    audit = dict(file=saved_page.name, day=day, cards=len(soup.select('.talk-card')), matched=0, differences=[], unmatched=[])
    for card in soup.select('.talk-card'):
        banner = card.select_one('.talk-card__banner-img')
        title = card.select_one('.talk-card__topic-title')
        name = banner.get('alt', '').strip() if banner else title.get_text(' ', strip=True) if title else ''
        time = card.select_one('.talk-card__time')
        matched = [t for t in talks if t['name'] == name and t['day'] == day]
        if len(matched) == 1:
            talk = matched[0]
            talk['portraits'] = []
            for speaker in card.select('.talk-card__speaker'):
                photo = speaker.select_one('.talk-card__speaker-photo[src]')
                speaker_name = speaker.select_one('.talk-card__speaker-name')
                if photo and speaker_name:
                    source = photo['src']
                    asset = portrait_path(source) if source.startswith('https://') else (ROOT / source).resolve()
                    if asset.is_relative_to(ROOT) and asset.is_file():
                        talk['portraits'].append(dict(name=speaker_name.get_text(' ', strip=True),
                            src=portrait_thumbnail(asset)))
            if banner:
                source = banner.get('src', '')
                if source.startswith('./'):
                    asset = (ROOT / source[2:]).resolve()
                    if asset.is_relative_to(ROOT) and asset.is_file():
                        mime = mimetypes.guess_type(asset.name)[0] or 'image/webp'
                        talk['poster'] = 'data:' + mime + ';base64,' + base64.b64encode(asset.read_bytes()).decode()
            verified_ids.add(talk['id'])
            audit['matched'] += 1
            time_match = re.search(r'(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})', time.get_text()) if time else None
            cell = card.find_parent(class_='program-grid__talk-cell')
            container = card.find_parent(class_='program-grid__container')
            halls = container.select('.program-grid__hall-name') if container else []
            grid = re.search(r'grid-area:\s*\d+\s*/\s*(\d+)', cell.get('style', '')) if cell else None
            web_values = {}
            if time_match:
                web_values.update(start=time_match[1], end=time_match[2])
            if grid and 0 <= int(grid[1])-2 < len(halls):
                web_values['room'] = halls[int(grid[1])-2].get_text(' ', strip=True)
            for field, value in web_values.items():
                if talk[field] != value:
                    audit['differences'].append(dict(title=name, field=field, csv=talk[field], html=value))
                    talk[field] = value
            roles = [s.get_text(' ', strip=True) for s in card.select('.talk-card__speaker-desc')]
            talk['speakerInfo'] = '; '.join(roles)
            company_aliases = {
                'Авито': ['авито', 'avito'], 'Яндекс': ['яндекс', 'yandex'],
                'Сбер': ['сбер'], 'Т-Банк': ['т-банк', 't-банк'], 'VK': ['vk'],
                'Магнит': ['магнит', 'magnit'], 'X5': ['x5', 'х5'],
                'Райффайзен': ['raiffeisenbank'], 'Nebius': ['nebius'],
                'МФТИ': ['мфти'], 'НИУ ВШЭ': ['ниу вшэ'], 'МГУ': ['мгу'],
                'Альфа-Банк': ['альфа-банк'], 'Точка': ['точка банк'],
                'Ecom Tech': ['ecom tech'], 'Циан': ['циан'], 'RWB': ['rwb'],
                'Мамба': ['мамба', 'mamba'], 'Веборама': ['веборама'],
                'Т1': ['ит-холдинг-т1'], 'ВкусВилл': ['вкусвилл'], 'ТехВилл': ['техвилл'],
                'Uzum': ['uzum'], 'Контур': ['контур'], 'МТС': ['мтс'],
                'М2': ['м2'], 'UIS': ['uis'], 'РСХБ': ['рсхб'],
                'Careem': ['careem'], 'TraceHub': ['tracehub'], 'hh.ru': ['hh.ru'],
                'Лига Ставок': ['лига ставок'], 'IT-Agency': ['it-agency'],
                'Positive Technologies': ['positive technologies'], 'Plevako.ai': ['plevako.ai'],
                'VERA Systems': ['vera systems'], 'JetStyle': ['jetstyle'],
                'Cordison': ['cordison'], 'Artenecy': ['artenecy'], 'Nochurn': ['nochurn'],
                'Thinking Bell': ['thinking bell'], 'Discover labs': ['discover labs'],
                'CUBE': ['cube'], 'za-ai.ru': ['za-ai.ru'], 'По Пути': ['по пути'],
                'Вероятностные решения': ['вероятностные решения'], 'KillBot': ['killbot'],
                'Tengri Data': ['tengri data']}
            role_text = re.sub(r'ex-[\w-]+', '', talk['speakerInfo'].lower())
            talk['companies'] = [name for name, aliases in company_aliases.items() if any(alias in role_text for alias in aliases)]
            speakers = [s.get_text(' ', strip=True) for s in card.select('.talk-card__speaker-name')]
            if speakers:
                talk['speaker'] = ', '.join(speakers)
            if any(roles):
                enriched += 1
        else:
            audit['unmatched'].append(name)
    audit['export_entries_without_card'] = [t['name'] for t in talks if t['day'] == day and t['id'] not in verified_ids]
    page_audit.append(audit)
talks.sort(key=lambda t: (t['date'], t['start'], t['room'], t['name']))
page = ROOT / 'index.html'
from import_tracks import enrich_tracks
enrich_tracks(talks)
html = page.read_text(encoding='utf-8')
html = html.replace('<input class="search" id="search" type="search"', '<input class="search" id="search" name="mm26-program-search" autocomplete="off" spellcheck="false" type="search"')
if 'id="toolbar"' not in html:
    html = html.replace('<div class="count">', '<div id="personal" hidden></div><div id="toolbar"></div><div class="count">')
    html = html.replace('<div id="list"></div>', '<div id="list"></div><div id="comparebar" hidden></div>')
if 'id="trackbar"' not in html:
    html = html.replace('<div id="toolbar">', '<div id="trackbar"></div><div id="toolbar">')
style = ROOT / 'enhancements.css'
if style.exists():
    html = re.sub(r'<style id="enhanced-style">[\s\S]*?</style>', '', html)
    html = html.replace('<header>', '<style id="enhanced-style">'+style.read_text(encoding='utf-8')+'</style>\n<header>', 1)
html = html.replace('О прототипе', 'О программе').replace('// Пробный набор: время из пользовательских скриншотов LMS от 14.11.2026.', '// Данные из предоставленных пользователем экспортов LMS; см. IMPORT_REPORT.json.')
start = html.index('const talks=')
end = html.index('let chosen=', start)
html = html[:start] + 'const talks=' + json.dumps(talks, ensure_ascii=False).replace('<', '\\u003c') + ';\n' + html[end:]
app = ROOT / 'app.js'
if app.exists():
    start = html.index('let chosen=')
    end = html.index('</script>', start)
    extras = ROOT / 'enhancements.js'
    mobile = ROOT / 'mobile.js'
    html = html[:start] + app.read_text(encoding='utf-8') + '\n' + (extras.read_text(encoding='utf-8') if extras.exists() else '') + '\n' + (mobile.read_text(encoding='utf-8') if mobile.exists() else '') + '\n' + html[end:]
page.write_text(html, encoding='utf-8')
report = {'source': ['program_6.csv', 'program_6.md'], 'csv_records': len(rows),
          'markdown_records': len(descriptions), 'imported_records': len(talks),
          'by_date': dict(Counter(t['date'] for t in talks)),
          'halls': sorted({t['room'] for t in talks}),
          'missing_speakers': [t['name'] for t in talks if not t['speaker']],
          'missing_descriptions': [t['name'] for t in talks if not t['description']],
          'missing_halls': [t['name'] for t in talks if not t['room']],
          'saved_page_cards_matched': len(verified_ids),
          'talks_with_speaker_details_from_html': enriched,
          'talks_with_portraits': sum(bool(t.get('portraits')) for t in talks),
          'speaker_portraits': sum(len(t.get('portraits', [])) for t in talks),
          'html_audit': page_audit}
(ROOT / 'IMPORT_REPORT.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Imported {len(talks)} records; all CSV and Markdown entries matched.')
