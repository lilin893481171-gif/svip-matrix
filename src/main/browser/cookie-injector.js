/**
 * @file cookie-injector.js
 * Cookie 注入器 - 将 Cookie 注入到真实浏览器
 */

/**
 * 将 Cookie 注入到 Puppeteer 页面
 * @param {Object} page - Puppeteer 页面实例
 * @param {Array} cookies - Cookie 数组
 * @param {string} domain - 域名
 * @returns {Promise<void>}
 */
export async function injectCookiesToPage(page, cookies, domain) {
  console.log(`[CookieInjector] 开始注入 ${cookies.length} 个 Cookie 到页面`);

  try {
    // 转换 Cookie 格式以适应 Puppeteer
    const puppeteerCookies = cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || domain,
      path: cookie.path || '/',
      secure: cookie.secure || false,
      httpOnly: cookie.httpOnly || false,
      sameSite: cookie.sameSite || 'Lax',
      expires: cookie.expirationDate || -1
    }));

    // 注入 Cookie
    await page.setCookie(...puppeteerCookies);

    console.log(`[CookieInjector] Cookie 注入完成: ${cookies.length} 个`);
  } catch (error) {
    console.error(`[CookieInjector] Cookie 注入失败: ${error.message}`);
    throw error;
  }
}

/**
 * 在页面导航前注入 Cookie
 * @param {Object} page - Puppeteer 页面实例
 * @param {Array} cookies - Cookie 数组
 * @param {string} url - 目标 URL
 * @returns {Promise<void>}
 */
export async function injectCookiesBeforeNavigation(page, cookies, url) {
  try {
    // 设置 Cookie 前需要先访问目标域名
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    console.log(`[CookieInjector] 准备注入 Cookie 到域名: ${domain}`);

    // 注入 Cookie
    await injectCookiesToPage(page, cookies, domain);

    // 导航到目标页面
    console.log(`[CookieInjector] 导航到页面: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log(`[CookieInjector] 页面加载完成`);
  } catch (error) {
    console.error(`[CookieInjector] 导航前注入 Cookie 失败: ${error.message}`);
    throw error;
  }
}

/**
 * 验证登录态
 * @param {Object} page - Puppeteer 页面实例
 * @returns {Promise<boolean>} 是否已登录
 */
export async function verifyLoginStatus(page) {
  try {
    // 检查页面是否包含登录标识
    const isLoggedIn = await page.evaluate(() => {
      // 检查是否存在用户头像、用户名等登录标识
      const loginIndicators = [
        '.user-avatar',
        '.user-name',
        '.profile-link',
        '[class*="user"]',
        '[class*="avatar"]',
        '[data-testid*="user"]',
        '[aria-label*="user"]'
      ];

      // 检查是否存在登录按钮（未登录时显示）
      const loginButtons = [
        '.login-btn',
        '.signin-btn',
        '[data-testid*="login"]',
        '[aria-label*="login"]'
      ];

      // 检查是否有登录标识元素
      const hasLoginIndicator = loginIndicators.some(selector =>
        document.querySelector(selector)
      );

      // 检查是否有登录按钮（未登录时显示）
      const hasLoginButton = loginButtons.some(selector =>
        document.querySelector(selector)
      );

      // 如果有登录标识且没有登录按钮，则认为已登录
      return hasLoginIndicator && !hasLoginButton;
    });

    console.log(`[CookieInjector] 登录态验证结果: ${isLoggedIn ? '已登录' : '未登录'}`);
    return isLoggedIn;
  } catch (error) {
    console.error(`[CookieInjector] 登录态验证失败: ${error.message}`);
    return false;
  }
}

/**
 * 刷新页面并验证登录态
 * @param {Object} page - Puppeteer 页面实例
 * @returns {Promise<boolean>} 是否已登录
 */
export async function refreshAndVerifyLogin(page) {
  try {
    console.log(`[CookieInjector] 刷新页面并验证登录态`);

    // 刷新页面
    await page.reload({
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // 等待页面加载完成
    await page.waitForTimeout(2000);

    // 验证登录态
    const isLoggedIn = await verifyLoginStatus(page);

    return isLoggedIn;
  } catch (error) {
    console.error(`[CookieInjector] 刷新并验证登录态失败: ${error.message}`);
    return false;
  }
}

export default {
  injectCookiesToPage,
  injectCookiesBeforeNavigation,
  verifyLoginStatus,
  refreshAndVerifyLogin
};