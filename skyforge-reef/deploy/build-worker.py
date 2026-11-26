#!/usr/bin/env python3
"""Packs this whole site into ONE Cloudflare Worker script (every file embedded), written to the path you give.
Usage:  python3 deploy/build-worker.py /tmp/worker.js
Then upload it as the Worker 'skyforge-reef' (module worker). Used because Cloudflare's normal static-assets upload
needs a short-lived token that some environments overwrite. Skips the deploy/ folder and dotfiles."""
import os, sys, json, base64
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else 'worker.js'
text = {'.html', '.js', '.css', '.txt', '.md', '.json', '.webmanifest'}
mt = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
      '.md': 'text/plain; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'}
files = {}
for d, dirs, names in os.walk(root):
    dirs[:] = [x for x in dirs if x != 'deploy' and not x.startswith('.')]
    for n in names:
        if n.startswith('.'): continue
        full = os.path.join(d, n); p = os.path.relpath(full, root).replace(os.sep, '/'); ext = os.path.splitext(n)[1].lower()
        data = open(full, 'rb').read()
        files[p] = [mt[ext], 0, data.decode('utf-8')] if ext in text else [mt[ext], 1, base64.b64encode(data).decode()]
code = '''// Skyforge Reef: serves the whole static site from inside this Worker (files are embedded below).
const FILES = %s;
const cache = new Map();
export default {
  async fetch(request) {
    const url = new URL(request.url);
    let p = decodeURIComponent(url.pathname).replace(/^\\/+/, '');
    if (p === '' || p.endsWith('/')) p += 'index.html';
    const f = FILES[p];
    if (!f) return new Response('Not found', { status: 404 });
    let body = cache.get(p);
    if (!body) { body = f[1] ? Uint8Array.from(atob(f[2]), c => c.charCodeAt(0)) : f[2]; cache.set(p, body); }
    return new Response(body, { headers: { 'content-type': f[0], 'cache-control': p === 'index.html' || p === 'sw.js' ? 'no-cache' : 'public, max-age=3600', 'access-control-allow-origin': '*' } });
  },
};
''' % json.dumps(files, separators=(',', ':'))
open(out, 'w').write(code)
print('files', len(files), 'worker bytes', len(code))
