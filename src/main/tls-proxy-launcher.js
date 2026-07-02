import { join } from 'path';
import { execSync } from 'child_process';
import electron from 'electron';
const { app } = electron;
import { existsSync } from 'fs';
import { createServer } from 'http';
import { connect as tcpConnect } from 'net';

const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = 7891;
const PROXY_URL = `http://${PROXY_HOST}:${PROXY_PORT}`;

let proxyServer = null;
let _started = false;
let _caInstalled = false;
let _certsDir = '';

function getCertsDir() {
  if (_certsDir) return _certsDir;
  try {
    if (typeof app !== 'undefined' && typeof app.getPath === 'function') {
        _certsDir = join(app.getPath('userData'), 'tls-proxy-certs');
    } else {
        throw new Error('app.getPath is not available');
    }
  } catch {
    const appData = process.env.APPDATA || process.env.HOME || '';
    _certsDir = join(appData, 'yumatrix-studio', 'tls-proxy-certs');
  }
  return _certsDir;
}

export function getTLSProxyUrl() { return PROXY_URL; }
export function getTLSProxyRules() { return PROXY_URL; }
export function isTLSProxyRunning() { return proxyServer !== null; }
export function isCAInstalled() { return _caInstalled; }

function relay(a, b) {
  a.pipe(b);
  b.pipe(a);
  a.on('error', () => { try { b.destroy(); } catch {} });
  b.on('error', () => { try { a.destroy(); } catch {} });
}

function startNodeProxy() {
  const server = createServer();

  server.on('connect', (req, clientSocket, head) => {
    const [hostname, port] = req.url.split(':');
    const targetPort = parseInt(port, 10) || 443;
    let isConnected = false;

    clientSocket.setNoDelay(true);
    clientSocket.setKeepAlive(true, 5000);

    const upstream = tcpConnect(targetPort, hostname, () => {
      isConnected = true;
      upstream.setNoDelay(true);
      upstream.setKeepAlive(true, 5000);
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length > 0) upstream.write(head);
      clientSocket.pipe(upstream);
      upstream.pipe(clientSocket);
    });

    upstream.on('error', (err) => {
      if (!isConnected) {
        if (clientSocket.writable) {
          clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        }
      }
      clientSocket.destroy();
    });

    clientSocket.on('error', () => upstream.destroy());
    clientSocket.on('close', () => upstream.destroy());
    upstream.on('close', () => clientSocket.destroy());
  });

  server.on('request', (req, res) => {
    res.writeHead(501, { 'Content-Type': 'text/plain' });
    res.end('HTTP proxy not implemented — use CONNECT');
  });

  server.on('error', (err) => {
    proxyServer = null;
  });

  server.listen(PROXY_PORT, PROXY_HOST, () => {});

  server.on('close', () => {
    proxyServer = null;
  });

  proxyServer = server;
}

function checkCAInstalled() {
  if (process.platform === 'win32') {
    try {
      const result = execSync('certutil -verifystore Root "Matrix TLS CA"', { encoding: 'utf8', timeout: 3000 });
      return result.includes('Matrix TLS CA') && !result.includes('does not exist');
    } catch { return false; }
  }
  if (process.platform === 'darwin') {
    try {
      const result = execSync('security find-certificate -c "Matrix TLS CA" /Library/Keychains/System.keychain 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
      return result.includes('Matrix TLS CA');
    } catch { return false; }
  }
  return false;
}

export function startTLSProxy() {
  if (_started) return;
  _started = true;
  startNodeProxy();
  setTimeout(() => {
    const certPath = join(getCertsDir(), 'ca-cert.pem');
    if (existsSync(certPath) && checkCAInstalled()) {
      _caInstalled = true;
    }
  }, 2000);
}

export function stopTLSProxy() {
  if (proxyServer) {
    try { proxyServer.close(); } catch {}
    proxyServer = null;
  }
}
