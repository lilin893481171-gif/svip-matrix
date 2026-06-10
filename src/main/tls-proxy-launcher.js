/**
 * @file tls-proxy-launcher.js
 * Matrix TLS 代理 — 纯 Node.js CONNECT 隧道代理
 *
 * 架构:
 *   BrowserView → CONNECT → 本代理(127.0.0.1:7891) → 目标服务器
 *   透明 TCP 中继，不修改任何字节。
 *
 * 未来扩展: 接入 uTLS Node 绑定实现 JA3 指纹伪装
 */
import { join } from 'path';
import { execSync } from 'child_process';
import { app } from 'electron';
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
    _certsDir = join(app.getPath('userData'), 'tls-proxy-certs');
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

// ── 纯 Node.js CONNECT 代理 ──

function relay(a, b) {
  a.pipe(b);
  b.pipe(a);
  a.on('error', () => { try { b.destroy(); } catch {} });
  b.on('error', () => { try { a.destroy(); } catch {} });
}

function startNodeProxy() {
  const server = createServer();

  // CONNECT 隧道 (HTTPS)
  server.on('connect', (req, clientSocket, head) => {
    const [hostname, port] = req.url.split(':');
    const targetPort = parseInt(port, 10) || 443;

    console.log(`[TLS Proxy] CONNECT ${hostname}:${targetPort}`);

    const upstream = tcpConnect(targetPort, hostname, () => {
      // 必须先写响应，再 relay
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      // head 可能包含 TLS ClientHello 的前几个字节
      if (head.length > 0) upstream.write(head);
      relay(clientSocket, upstream);
    });

    upstream.on('error', (err) => {
      console.warn(`[TLS Proxy] CONNECT 拨号失败 ${hostname}:${targetPort}: ${err.message}`);
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      clientSocket.destroy();
    });

    clientSocket.on('error', () => upstream.destroy());
  });

  // 普通 HTTP 请求 (非 HTTPS)
  server.on('request', (req, res) => {
    console.log(`[TLS Proxy] HTTP ${req.method} ${req.url}`);
    // 简单转发 — 极少用到 (BrowserView 几乎全走 HTTPS)
    res.writeHead(501, { 'Content-Type': 'text/plain' });
    res.end('HTTP proxy not implemented — use CONNECT');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[TLS Proxy] 端口 ${PROXY_PORT} 已被占用 — 代理未启动 (可能有残留进程)`);
    } else {
      console.warn(`[TLS Proxy] 服务器错误: ${err.message}`);
    }
    proxyServer = null;
  });

  server.listen(PROXY_PORT, PROXY_HOST, () => {
    console.log(`[TLS Proxy] Node.js CONNECT 代理启动 → ${PROXY_URL}`);
  });

  server.on('close', () => {
    console.log('[TLS Proxy] 代理已关闭');
    proxyServer = null;
  });

  proxyServer = server;
}

// ── CA 管理 (保留给未来 MITM 模式) ──

function checkCAInstalled() {
  if (process.platform === 'win32') {
    try {
      const result = execSync('certutil -verifystore Root "Matrix TLS CA"', {
        encoding: 'utf8', timeout: 3000
      });
      return result.includes('Matrix TLS CA') && !result.includes('does not exist');
    } catch { return false; }
  }
  if (process.platform === 'darwin') {
    try {
      const result = execSync('security find-certificate -c "Matrix TLS CA" /Library/Keychains/System.keychain 2>/dev/null', {
        encoding: 'utf8', timeout: 5000
      });
      return result.includes('Matrix TLS CA');
    } catch { return false; }
  }
  return false;
}

// ── 启动 / 停止 ──

export function startTLSProxy() {
  if (_started) return;
  _started = true;

  startNodeProxy();

  // 延迟检查 CA 状态
  setTimeout(() => {
    const certPath = join(getCertsDir(), 'ca-cert.pem');
    if (existsSync(certPath) && checkCAInstalled()) {
      _caInstalled = true;
      console.log('[TLS Proxy] ✓ 根 CA 已在系统信任存储中');
    }
  }, 2000);
}

export function stopTLSProxy() {
  if (proxyServer) {
    console.log('[TLS Proxy] 正在关闭...');
    try { proxyServer.close(); } catch {}
    proxyServer = null;
  }
}
