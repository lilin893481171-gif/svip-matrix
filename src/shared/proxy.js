/**
 * @file utils/proxy.js
 * @description 代理解析 — 统一 ip:port:user:pass 格式转换
 */

/**
 * 解析代理字符串 → Playwright 格式 { server, username?, password? }
 */
export function toPlaywright(proxyStr) {
  if (!proxyStr) return undefined;
  const parts = proxyStr.trim().split(':');
  if (parts.length === 4) {
    return { server: `http://${parts[0]}:${parts[1]}`, username: parts[2], password: parts[3] };
  } else if (parts.length === 2) {
    return { server: `http://${parts[0]}:${parts[1]}` };
  }
  return { server: proxyStr };
}

/**
 * 解析代理字符串 → socks5:// URL（Electron session.setProxy 用）
 */
export function toSocks5(proxyStr) {
  if (!proxyStr) return undefined;
  const parts = proxyStr.trim().split(':');
  if (parts.length === 4) {
    return `socks5://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
  } else if (parts.length === 2) {
    return `socks5://${parts[0]}:${parts[1]}`;
  }
  return proxyStr;
}
