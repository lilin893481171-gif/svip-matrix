/**
 * @file login-status-checker.js
 * 登录态检测器 - 检查平台登录状态
 */

/**
 * 检查小红书登录状态
 * @param {Object} page - Puppeteer 页面实例
 * @returns {Promise<{isLoggedIn: boolean, reason: string}>}
 */
export async function checkXHSLoginStatus(page) {
  try {
    console.log('[LoginStatusChecker] 检查小红书登录状态');

    // 检查 Cookie 中是否有登录相关字段
    const cookies = await page.cookies();
    const hasWebSession = cookies.some(cookie => cookie.name === 'web_session');
    const hasLoginCookie = cookies.some(cookie =>
      cookie.name.includes('login') ||
      cookie.name.includes('session') ||
      cookie.name.includes('lgin')
    );

    if (!hasWebSession && !hasLoginCookie) {
      return {
        isLoggedIn: false,
        reason: '缺少登录 Cookie'
      };
    }

    // 检查页面元素
    const result = await page.evaluate(() => {
      // 检查是否存在登录标识元素
      const loginIndicators = [
        '.user-avatar',
        '.user-name',
        '.profile-link',
        '[class*="user"]',
        '[data-testid*="user"]'
      ];

      // 检查是否存在登录按钮（未登录时显示）
      const loginButtons = [
        '.login-btn',
        '.signin-btn',
        '[data-testid*="login"]',
        '[aria-label*="login"]'
      ];

      // 检查页面文本中是否包含登录相关提示
      const pageText = document.body.innerText;
      const hasLogoutText = pageText.includes('退出登录') || pageText.includes('注销');

      // 检查是否有登录标识元素
      const hasLoginIndicator = loginIndicators.some(selector =>
        document.querySelector(selector)
      );

      // 检查是否有登录按钮（未登录时显示）
      const hasLoginButton = loginButtons.some(selector =>
        document.querySelector(selector)
      );

      return {
        hasLoginIndicator,
        hasLoginButton,
        hasLogoutText
      };
    });

    // 判断登录状态
    if (result.hasLoginIndicator || result.hasLogoutText) {
      // 有登录标识或退出登录按钮，认为已登录
      return {
        isLoggedIn: true,
        reason: '检测到登录标识'
      };
    } else if (result.hasLoginButton) {
      // 有登录按钮，认为未登录
      return {
        isLoggedIn: false,
        reason: '检测到登录按钮'
      };
    } else {
      // 其他情况，根据 Cookie 判断
      const isLoggedIn = hasWebSession || hasLoginCookie;
      return {
        isLoggedIn,
        reason: isLoggedIn ? '检测到登录 Cookie' : '未检测到登录标识'
      };
    }
  } catch (error) {
    console.error(`[LoginStatusChecker] 小红书登录状态检查失败: ${error.message}`);
    return {
      isLoggedIn: false,
      reason: `检查异常: ${error.message}`
    };
  }
}

/**
 * 检查抖音登录状态
 * @param {Object} page - Puppeteer 页面实例
 * @returns {Promise<{isLoggedIn: boolean, reason: string}>}
 */
export async function checkDouyinLoginStatus(page) {
  try {
    console.log('[LoginStatusChecker] 检查抖音登录状态');

    // 检查 Cookie
    const cookies = await page.cookies();
    const hasSessionId = cookies.some(cookie => cookie.name === 'sessionid');
    const hasSidGuard = cookies.some(cookie => cookie.name === 'sid_guard');

    if (!hasSessionId && !hasSidGuard) {
      return {
        isLoggedIn: false,
        reason: '缺少登录 Cookie'
      };
    }

    // 检查页面元素
    const result = await page.evaluate(() => {
      // 检查用户头像或用户名
      const userElements = [
        '.avatar',
        '.user-name',
        '.user-info',
        '[class*="avatar"]',
        '[data-e2e*="user"]'
      ];

      // 检查登录按钮
      const loginElements = [
        '.login-btn',
        '[data-e2e*="login"]',
        '.login-guide'
      ];

      const hasUserElement = userElements.some(selector =>
        document.querySelector(selector)
      );

      const hasLoginElement = loginElements.some(selector =>
        document.querySelector(selector)
      );

      return {
        hasUserElement,
        hasLoginElement
      };
    });

    // 判断登录状态
    if (result.hasUserElement) {
      return {
        isLoggedIn: true,
        reason: '检测到用户信息'
      };
    } else if (result.hasLoginElement) {
      return {
        isLoggedIn: false,
        reason: '检测到登录引导'
      };
    } else {
      // 根据 Cookie 判断
      const isLoggedIn = hasSessionId || hasSidGuard;
      return {
        isLoggedIn,
        reason: isLoggedIn ? '检测到登录 Cookie' : '未检测到登录标识'
      };
    }
  } catch (error) {
    console.error(`[LoginStatusChecker] 抖音登录状态检查失败: ${error.message}`);
    return {
      isLoggedIn: false,
      reason: `检查异常: ${error.message}`
    };
  }
}

/**
 * 检查 B站登录状态
 * @param {Object} page - Puppeteer 页面实例
 * @returns {Promise<{isLoggedIn: boolean, reason: string}>}
 */
export async function checkBilibiliLoginStatus(page) {
  try {
    console.log('[LoginStatusChecker] 检查 B站登录状态');

    // 检查 Cookie
    const cookies = await page.cookies();
    const hasSESSDATA = cookies.some(cookie => cookie.name === 'SESSDATA');
    const hasDedeUserID = cookies.some(cookie => cookie.name === 'DedeUserID');

    if (!hasSESSDATA && !hasDedeUserID) {
      return {
        isLoggedIn: false,
        reason: '缺少登录 Cookie'
      };
    }

    // 检查页面元素
    const result = await page.evaluate(() => {
      // 检查用户头像或用户名
      const userSelectors = [
        '.header-avatar',
        '.user-name',
        '.user-face',
        '[class*="avatar"]',
        '[data-v*="user"]'
      ];

      // 检查登录按钮
      const loginSelectors = [
        '.login-btn',
        '[data-v*="login"]',
        '.unlogin'
      ];

      const hasUserElement = userSelectors.some(selector =>
        document.querySelector(selector)
      );

      const hasLoginElement = loginSelectors.some(selector =>
        document.querySelector(selector)
      );

      return {
        hasUserElement,
        hasLoginElement
      };
    });

    // 判断登录状态
    if (result.hasUserElement) {
      return {
        isLoggedIn: true,
        reason: '检测到用户信息'
      };
    } else if (result.hasLoginElement) {
      return {
        isLoggedIn: false,
        reason: '检测到登录按钮'
      };
    } else {
      // 根据 Cookie 判断
      const isLoggedIn = hasSESSDATA || hasDedeUserID;
      return {
        isLoggedIn,
        reason: isLoggedIn ? '检测到登录 Cookie' : '未检测到登录标识'
      };
    }
  } catch (error) {
    console.error(`[LoginStatusChecker] B站登录状态检查失败: ${error.message}`);
    return {
      isLoggedIn: false,
      reason: `检查异常: ${error.message}`
    };
  }
}

/**
 * 通用登录状态检查
 * @param {Object} page - Puppeteer 页面实例
 * @param {string} platform - 平台名称
 * @returns {Promise<{isLoggedIn: boolean, reason: string}>}
 */
export async function checkLoginStatus(page, platform) {
  switch (platform.toLowerCase()) {
    case 'xiaohongshu':
    case '小红书':
      return await checkXHSLoginStatus(page);
    case 'douyin':
    case '抖音':
      return await checkDouyinLoginStatus(page);
    case 'bilibili':
    case 'b站':
      return await checkBilibiliLoginStatus(page);
    default:
      throw new Error(`不支持的平台: ${platform}`);
  }
}

/**
 * 发布前检查登录状态
 * @param {Object} page - Puppeteer 页面实例
 * @param {string} platform - 平台名称
 * @returns {Promise<{canPublish: boolean, message: string}>}
 */
export async function prePublishLoginCheck(page, platform) {
  try {
    console.log(`[LoginStatusChecker] 发布前检查登录状态: ${platform}`);

    const result = await checkLoginStatus(page, platform);

    if (result.isLoggedIn) {
      return {
        canPublish: true,
        message: '登录状态正常'
      };
    } else {
      return {
        canPublish: false,
        message: `请先在内嵌浏览器中登录${platform}，原因: ${result.reason}`
      };
    }
  } catch (error) {
    console.error(`[LoginStatusChecker] 发布前登录检查失败: ${error.message}`);
    return {
      canPublish: false,
      message: `登录状态检查异常: ${error.message}`
    };
  }
}

export default {
  checkXHSLoginStatus,
  checkDouyinLoginStatus,
  checkBilibiliLoginStatus,
  checkLoginStatus,
  prePublishLoginCheck
};