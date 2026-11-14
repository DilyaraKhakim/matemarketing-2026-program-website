"""Track membership from organizer workbook; never imports timing or halls."""
import json
import re
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent
def normalize(text):
    return re.sub(r'[^\w]+', '', text.lower().replace('ё', 'е'))

def enrich_tracks(talks):
    paths = list(ROOT.glob('Программа*.xlsx'))
    if not paths:
        return
    assert len(paths) == 1, 'Select one program workbook'
    workbook = openpyxl.load_workbook(paths[0], data_only=True)
    sheet = workbook.worksheets[0]
    # The header bands were inspected in this workbook. Online day has no track header.
    bands = [(26, 5, 7, 18), (26, 21, 23, 33), (27, 38, 40, 53), (27, 56, 58, 65)]
    cells = []
    for day, header, start, end in bands:
        for column in [3, 5, 7, 9, 11]:
            track = str(sheet.cell(header, column).value).strip().upper()
            if track == 'KEYNOTE':
                track = 'KEYNOTES'
            for row in range(start, end + 1):
                cell = sheet.cell(row, column)
                if not cell.value:
                    continue
                content = str(cell.value).strip()
                title = content.split('\n')[0].strip()
                if title.startswith('Активностей нет') or title in ['ПЕРЕРЫВ', 'Закрытие']:
                    continue
                cells.append(dict(day=str(day), cell=cell.coordinate, title=title, content=content, track=track))
    # Same presentation confirmed by changed title + matching speaker/content.
    reviewed = {
        'Как с помощью одного SQL-запроса понять, что ваша атрибуция вам врет': 'G7',
        'Рынок аналитиков перегрет или кандидаты просто не умеют продавать себя?': 'G23',
        'Архитектура данных аналитики для AI-продукта: как избавиться от лагов на миллиардах событий': 'E23',
        'Как оценить эффект продуктовых изменений без A/B-теста?': 'I44',
        'Оцениваем эффективность "флайтовой" офлайн-рекламы': 'E42',
        'Когда PSM уже не работает: идем в имитационные модели системной динамики': 'I42',
        'Как взять под контроль темную сторону ИИ: безопасность, приватность и AI-firewalls при работе с LLM': 'C46',
        'Можно ли отправить это в LLM? Правовые нормы работы по 152-ФЗ с зарубежными моделями': 'C44',
        'Mutation testing для AI-агентов в A/B-тестах': 'G42',
        'Эксперимент по обмену качества сервиса на деньги': 'I40',
    }
    report = dict(source=paths[0].name, sheet=sheet.title, matched=[], unmatched=[])
    for talk in talks:
        candidates = [c for c in cells if c['day'] == talk['day'] and normalize(c['title']) == normalize(talk['name'])]
        method = 'normalized exact title'
        if not candidates and talk['name'] in reviewed:
            candidates = [c for c in cells if c['day'] == talk['day'] and c['cell'] == reviewed[talk['name']]]
            method = 'reviewed renamed presentation'
        assert len(candidates) <= 1, talk['name']
        talk['track'] = candidates[0]['track'] if candidates else ''
        if candidates:
            c = candidates[0]
            talk['trackSource'] = f"{paths[0].name} / {sheet.title}!{c['cell']}"
            report['matched'].append(dict(id=talk['id'], title=talk['name'], excel_title=c['title'], track=c['track'], cell=c['cell'], method=method))
        else:
            report['unmatched'].append(dict(title=talk['name'], day=talk['day']))
    report['matched_count'] = len(report['matched'])
    report['unmatched_count'] = len(report['unmatched'])
    (ROOT / 'TRACK_IMPORT_REPORT.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Tracks: {report['matched_count']} matched, {report['unmatched_count']} without verified membership.")
