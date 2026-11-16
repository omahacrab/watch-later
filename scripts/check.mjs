import {readFile,readdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
const manifest=JSON.parse(await readFile('manifest.json','utf8'));
assert.equal(manifest.manifest_version,3);assert.equal(manifest.name,'Watch Later: YouTube Playlists & Feeds');
assert.deepEqual(manifest.permissions,['scripting','storage']);assert.deepEqual(manifest.host_permissions,['https://www.youtube.com/*']);assert.deepEqual(manifest.optional_host_permissions,['https://web.archive.org/*']);
assert.match(manifest.content_security_policy.extension_pages,/script-src 'self'/);
for(const file of (await readdir('.')).filter(f=>f.endsWith('.js')))execFileSync(process.execPath,['--check',file]);
const {document}=parseHTML(await readFile('app.html','utf8'));const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);assert.equal(ids.length,new Set(ids).size,'Duplicate HTML IDs');
for(const el of document.querySelectorAll('*'))for(const attr of [...el.attributes])assert.ok(!/^on/i.test(attr.name),'Inline event handler');
for(const script of document.querySelectorAll('script')){assert.ok(script.src&&!script.textContent.trim(),'Inline script');assert.ok(!/^https?:/.test(script.src),'Remote code');await stat(script.src);}
for(const link of document.querySelectorAll('link[rel=stylesheet]'))await stat(link.getAttribute('href'));
for(const icon of Object.values(manifest.icons))await stat(icon);
for(const file of ['app.js','workspace.js']){const code=await readFile(file,'utf8');for(const m of code.matchAll(/\$\('([a-z][a-z0-9-]+)'\)/g)){if(!ids.includes(m[1]))assert.ok((await readFile('workspace.js','utf8')).includes(`id="${m[1]}"`),`Missing HTML ID ${m[1]}`);}}
console.log('Syntax, manifest permissions, HTML IDs, CSP and local assets checked.');
