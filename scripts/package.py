"""Build a deterministic, installable ZIP with manifest.json inside one named folder."""
import hashlib,json,zipfile
from pathlib import Path
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'manifest.json').read_text())
files=['manifest.json','app.html','app.css','workspace.css','app.js','workspace.js','background.js','youtube.js','core.js','channels.js','counts.js','list-options.js','playlists.js','recovery.js','scroll-position.js','search-pills.js','selection.js','feeds-core.js','README.md','PRIVACY.md','LICENSE','icon-16.png','icon-32.png','icon-48.png','icon-128.png']
out=root/'dist';out.mkdir(exist_ok=True)
archive=out/f"watch-later-v{manifest['version']}.zip"
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name in sorted(files):
  info=zipfile.ZipInfo('watch-later/'+name,date_time=(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,(root/name).read_bytes())
with zipfile.ZipFile(archive) as z:
 assert json.loads(z.read('watch-later/manifest.json'))['version']==manifest['version']
 assert z.testzip() is None
checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(f'{checksum}  {archive.name}\n')
print(f'{archive.name}: {archive.stat().st_size:,} bytes; SHA-256 {checksum}')
