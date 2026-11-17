"""Bundle the Web Store package and prepared listing assets, without private account data."""
import json,zipfile
from pathlib import Path
root=Path(__file__).resolve().parent.parent
version=json.loads((root/'manifest.json').read_text())['version']
archive=root/'downloads'/f'watch-later-store-submission-v{version}.zip'
files=[root/'downloads'/f'watch-later-webstore-v{version}.zip',root/'store/listing.json',root/'store/README.md',root/'PRIVACY.md',*sorted((root/'store/assets').glob('*'))]
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in files:
  name=f.name if f.parent.name=='downloads' else str(f.relative_to(root))
  info=zipfile.ZipInfo(name,date_time=(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,f.read_bytes())
print(archive)
