"""Refresh embedded code/styles without requiring the original browser snapshots."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent
page = root / 'index.html'
html = page.read_text(encoding='utf-8')
start = html.index('let chosen=')
end = html.index('</script>', start)
scripts = '\n'.join((root / name).read_text(encoding='utf-8') for name in ['app.js', 'enhancements.js', 'mobile.js'])
html = html[:start] + scripts + '\n' + html[end:]
css = (root / 'enhancements.css').read_text(encoding='utf-8')
html, count = re.subn(r'<style id="enhanced-style">[\s\S]*?</style>', lambda _: '<style id="enhanced-style">'+css+'</style>', html)
assert count == 1, 'Expected one embedded stylesheet'
page.write_text(html, encoding='utf-8')
print('Updated scripts and styles; embedded program and images preserved.')
