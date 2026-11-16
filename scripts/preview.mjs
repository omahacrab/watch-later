// Build an isolated browser QA workspace from the production files plus a fixture.
// This directory and its Chrome API double are never packaged as an extension.
import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),target=path.join(root,'.ui-preview');
await mkdir(path.join(target,'dist'),{recursive:true});await mkdir(path.join(target,'.openai'),{recursive:true});
for(const name of await readdir(root))if(/\.(?:js|css)$/.test(name))await copyFile(path.join(root,name),path.join(target,'dist',name));
const html=(await readFile(path.join(root,'app.html'),'utf8')).replace('<script type="module" src="app.js">','<script src="preview-api.js"></script><script type="module" src="app.js">').replace('<span class="build-version">','<span class="build-version" title="Fixture data for visual QA">QA · ');
await writeFile(path.join(target,'dist','index.html'),html);
await copyFile(path.join(root,'tests/fixtures/preview-api.js'),path.join(target,'dist','preview-api.js'));
await writeFile(path.join(target,'dist','fixture-thumb.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="210" height="120"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#567153"/><stop offset="1" stop-color="#263e30"/></linearGradient></defs><rect width="210" height="120" fill="url(#g)"/><circle cx="160" cy="35" r="32" fill="none" stroke="#aac392" opacity=".3"/><path d="M0 100 60 55 115 94 151 60 210 110V120H0Z" fill="#1b3027" opacity=".65"/><text x="12" y="20" fill="#e0e8ce" font-size="9" font-family="sans-serif" letter-spacing="2">VISUAL QA</text></svg>');
await writeFile(path.join(target,'.openai','hosting.json'),JSON.stringify({static:{directory:'dist'}},null,2));
console.log(target);
