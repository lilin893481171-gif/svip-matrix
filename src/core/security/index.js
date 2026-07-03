/**
 * @file src/core/security/index.js
 * @description 安全能力中心 - 加密、指纹、防检测
 */

import crypto from 'crypto';
import fs from 'fs';

// ==========================================
// 1. AES-256-CBC 加密工具
// ==========================================

/**
 * 原子写入加密文件
 */
export function secureAtomicWriteFileSync(filePath, data, accountId) {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  try {
    const key = crypto.createHash('sha256').update(String(accountId)).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    fs.writeFileSync(tempPath, JSON.stringify({
      data: encrypted,
      iv: iv.toString('hex'),
      timestamp: Date.now()
    }), 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw error;
  }
}

/**
 * 读取并解密文件
 */
export function secureReadFileSync(filePath, accountId) {
  const content = fs.readFileSync(filePath, 'utf8');
  const payload = JSON.parse(content);
  const key = crypto.createHash('sha256').update(String(accountId)).digest();
  const iv = Buffer.from(payload.iv, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(payload.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

// ==========================================
// 2. 确定性随机数生成器 (用于指纹生成)
// ==========================================

/**
 * 基于 accountId 的确定性哈希种子
 */
export function getStableSeed(accountId) {
  let hash = 0;
  const str = String(accountId);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 12345;
}

/**
 * 确定性随机数 (Mulberry32)
 */
export function detRandom(seed) {
  seed |= 0;
  seed = seed + 0x6D2B79F5 | 0;
  var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

/**
 * 状态无哈希 (防漂移)
 */
export function getStatelessNoise(seed, index) {
  var h = Math.imul(seed + index | 0, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h;
}

// ==========================================
// 3. 敏感数据清理
// ==========================================

/**
 * 清理敏感信息
 */
export function sanitizeObject(obj, keysToClean = []) {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'cookie', 'auth'];
  const result = { ...obj };

  function cleanValue(value) {
    if (typeof value === 'string') {
      return '*'.repeat(Math.min(value.length, 8));
    }
    if (typeof value === 'object' && value !== null) {
      return sanitizeObject(value, keysToClean);
    }
    return value;
  }

  Object.keys(result).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(k => lowerKey.includes(k)) || keysToClean.includes(key)) {
      result[key] = cleanValue(result[key]);
    }
  });

  return result;
}

/**
 * 敏感信息掩码
 */
export function maskString(str, showChars = 4) {
  if (!str || str.length < showChars) return '*'.repeat(Math.max(str?.length || 0, showChars));
  const start = str.substring(0, showChars);
  const end = str.substring(str.length - showChars);
  return `${start}***${end}`;
}

// ==========================================
// 4. 浏览器指纹清洗工具
// ==========================================

/**
 * 清理 Playwright storageState 中的自动化特征
 */
export function cleanAutomationState(state) {
  if (!state || !state.origins) return state;

  const cleanedOrigins = (state.origins || []).map(origin => ({
    ...origin,
    localStorage: (origin.localStorage || []).map(item => ({
      ...item,
      name: item.name.replace(/cdc_|webdriver|automation/gi, 'user_'),
      value: item.value.replace(/cdc_|webdriver|automation/gi, 'user_data')
    }))
  }));

  return {
    ...state,
    origins: cleanedOrigins
  };
}

// ==========================================
// 5. WebRTC 防泄漏
// ==========================================

/**
 * IP 地址掩码
 */
export function maskIP(ip) {
  if (!ip || typeof ip !== 'string') return '0.0.0.0';
  return ip.replace(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/, function(m, a, b, c, d) {
    if (m === '0.0.0.0' || a === '127') return m;
    const hash = [a, b, c, d].reduce((acc, part) => ((acc << 5) - acc) + part.charCodeAt(0) | 0, 0);
    return `10.${((hash & 0xFE00) >> 8) | 1}.${(hash & 0xFE) | 1}.${((hash & 0xFE0000) >> 16) | 1}`;
  });
}

// ==========================================
// 6. 安全配置
// ==========================================

export const SECURITY_CONFIG = {
  // AES 配置
  AES: {
    algorithm: 'aes-256-cbc',
    keyLength: 32,
    ivLength: 16
  },

  // 最大文件大小 (200KB)
  MAX_AVATAR_SIZE: 200 * 1024,

  // Cookie 过期检查
  COOKIE_EXPIRY_CHECK: true,

  // 自动化特征清理
  CLEAN_AUTOMATION_FLAGS: true
};
