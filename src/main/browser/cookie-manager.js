/**
 * @file cookie-manager.js
 * Cookie 管理器 - 处理内嵌浏览器和真实浏览器之间的 Cookie 同步
 */

import { session } from 'electron';
import { extractSessionIdentity } from './session-store.js';

/**
 * 从内嵌浏览器导出 Cookie
 * @param {string} accountId - 账户 ID
 * @param {string} platform - 平台名称
 * @returns {Promise<Array>} Cookie 数组
 */
export async function exportCookiesFromEmbeddedBrowser(accountId, platform) {
  console.log(`[CookieManager] 开始从内嵌浏览器导出 Cookie: ${accountId} (${platform})`);

  try {
    // 获取内嵌浏览器的 session
    // 这里需要根据实际的 session 管理方式来获取
    // 暂时使用默认 session，后续需要根据 accountId 获取对应的 session
    const ses = session.defaultSession;

    // 根据平台确定域名
    let domain = '';
    switch (platform.toLowerCase()) {
      case 'xiaohongshu':
      case '小红书':
        domain = '.xiaohongshu.com';
        break;
      case 'douyin':
      case '抖音':
        domain = '.douyin.com';
        break;
      case 'bilibili':
      case 'b站':
        domain = '.bilibili.com';
        break;
      default:
        throw new Error(`不支持的平台: ${platform}`);
    }

    // 获取所有 Cookie
    const allCookies = await ses.cookies.get({});

    // 过滤指定域名的 Cookie
    const platformCookies = allCookies.filter(cookie =>
      cookie.domain.includes(domain) || cookie.domain.includes(domain.replace('.', ''))
    );

    console.log(`[CookieManager] 导出 ${platformCookies.length} 个 Cookie: ${accountId} (${platform})`);

    return platformCookies;
  } catch (error) {
    console.error(`[CookieManager] 从内嵌浏览器导出 Cookie 失败: ${error.message}`);
    throw error;
  }
}

/**
 * 过滤关键 Cookie
 * @param {Array} cookies - Cookie 数组
 * @param {string} platform - 平台名称
 * @returns {Array} 关键 Cookie 数组
 */
export function filterCriticalCookies(cookies, platform) {
  // 根据平台定义关键 Cookie 名称
  const criticalCookieNames = {
    'xiaohongshu': ['web_session', 'xhsTrackerId', 'xhsuid', 'customerClientId'],
    'douyin': ['sessionid', 'sid_guard', 'sid_ticket'],
    'bilibili': ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5']
  };

  const platformKey = platform.toLowerCase();
  const names = criticalCookieNames[platformKey] || [];

  // 过滤关键 Cookie
  const criticalCookies = cookies.filter(cookie =>
    names.includes(cookie.name) ||
    cookie.name.includes('session') ||
    cookie.name.includes('login') ||
    cookie.name.includes('auth')
  );

  console.log(`[CookieManager] 过滤出 ${criticalCookies.length} 个关键 Cookie: ${platform}`);
  return criticalCookies;
}

/**
 * 序列化 Cookie 用于存储
 * @param {Array} cookies - Cookie 数组
 * @returns {string} 序列化的 Cookie 字符串
 */
export function serializeCookies(cookies) {
  try {
    const serialized = JSON.stringify(cookies);
    console.log(`[CookieManager] Cookie 序列化完成，大小: ${serialized.length} 字符`);
    return serialized;
  } catch (error) {
    console.error(`[CookieManager] Cookie 序列化失败: ${error.message}`);
    throw error;
  }
}

/**
 * 反序列化 Cookie
 * @param {string} serializedCookies - 序列化的 Cookie 字符串
 * @returns {Array} Cookie 数组
 */
export function deserializeCookies(serializedCookies) {
  try {
    const cookies = JSON.parse(serializedCookies);
    console.log(`[CookieManager] Cookie 反序列化完成，数量: ${cookies.length}`);
    return cookies;
  } catch (error) {
    console.error(`[CookieManager] Cookie 反序列化失败: ${error.message}`);
    throw error;
  }
}

/**
 * 从内嵌浏览器导出并序列化 Cookie
 * @param {string} accountId - 账户 ID
 * @param {string} platform - 平台名称
 * @returns {Promise<string>} 序列化的 Cookie 字符串
 */
export async function exportAndSerializeCookies(accountId, platform) {
  try {
    // 1. 从内嵌浏览器导出 Cookie
    const cookies = await exportCookiesFromEmbeddedBrowser(accountId, platform);

    // 2. 过滤关键 Cookie
    const criticalCookies = filterCriticalCookies(cookies, platform);

    // 3. 序列化存储
    const serializedCookies = serializeCookies(criticalCookies);

    return serializedCookies;
  } catch (error) {
    console.error(`[CookieManager] 导出并序列化 Cookie 失败: ${error.message}`);
    throw error;
  }
}

export default {
  exportCookiesFromEmbeddedBrowser,
  filterCriticalCookies,
  serializeCookies,
  deserializeCookies,
  exportAndSerializeCookies
};