const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2], 10) || 9793;
const PORT_FILE = path.join(__dirname, 'port.txt');

const server = http.createServer((req, res) => {
  // 设置 CORS 头，允许扩展访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 配置端点：/config
  if (req.url === '/config') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ port: PORT }));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const newPort = parseInt(data.port, 10);
          if (!newPort || newPort < 1024 || newPort > 65535) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid port range 1024-65535' }));
            return;
          }
          fs.writeFileSync(PORT_FILE, String(newPort), 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, port: newPort }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { url: targetUrl, method, headers, body: targetBody } = JSON.parse(body);

      if (!targetUrl) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing url' }));
        return;
      }

      const response = await fetch(targetUrl, {
        method: method || 'POST',
        headers: headers || {},
        body: targetBody || undefined,
      });

      const responseText = await response.text();
      res.writeHead(response.status, { 'Content-Type': 'application/json' });
      res.end(responseText);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`TeaPass proxy running on http://localhost:${PORT}`);
  console.log('按 Ctrl+C 停止');
});
