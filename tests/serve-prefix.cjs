/* Temporary QA server: serve the real output under the GitHub Pages path. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const prefix = '/hxh-succession/';
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.xml':'application/xml; charset=utf-8'};
const server = http.createServer((req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (!pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
    let relative = pathname.slice(prefix.length);
    if (relative.split('/').some(part=>part.startsWith('.')) || relative.includes('\\')) { res.writeHead(403).end(); return; }
    if (!relative || relative.endsWith('/')) relative += 'index.html';
    const target = path.resolve(root,relative);
    if (!target.startsWith(root+path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404).end(); return; }
    // Research/intake material is not needed for this static-output check.
    if (relative.startsWith('data/intake/') || relative.includes('AUDIT') || relative.includes('research_backlog')) { res.writeHead(403).end(); return; }
    res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});
    fs.createReadStream(target).pipe(res);
  } catch (_) { res.writeHead(400).end(); }
});
server.listen(8766,'127.0.0.1',()=>console.log('Temporary QA: http://127.0.0.1:8766/hxh-succession/ (Ctrl+C to stop)'));
