#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || path.join(__dirname, '..', 'dist');
const port = parseInt(process.env.PORT || '0', 10);

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function send404(res) {
  res.statusCode = 404;
  res.end('Not found');
}

const server = http.createServer((req, res) => {
  try {
    let reqPath = decodeURIComponent(new URL(req.url, 'http://example.com').pathname);
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(root, reqPath);
    if (!filePath.startsWith(path.resolve(root))) {
      return send404(res);
    }
    fs.stat(filePath, (err, stat) => {
      if (err) {
        // SPA fallback
        const indexPath = path.join(root, 'index.html');
        return fs.readFile(indexPath, (ie, data) => {
          if (ie) return send404(res);
          res.setHeader('Content-Type', 'text/html');
          res.end(data);
        });
      }
      if (stat.isDirectory()) {
        const indexPath = path.join(filePath, 'index.html');
        return fs.readFile(indexPath, (ie, data) => {
          if (ie) return send404(res);
          res.setHeader('Content-Type', 'text/html');
          res.end(data);
        });
      }
      const ext = path.extname(filePath).toLowerCase();
      const type = mime[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', type);
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (e) {
    send404(res);
  }
});

server.listen(port, '0.0.0.0', () => {
  const addr = server.address();
  console.log(`SERVING_PORT=${addr.port}`);
  console.log(`Serving ${root}`);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
