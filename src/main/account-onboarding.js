/**
 * @file account-onboarding.js
 * @description 入网嗅探引擎 — 在 BrowserView 中通过 session.webRequest + CDP Network 拦截
 *   profile API 响应，自动提取用户昵称/头像/UID/粉丝数并入库。
 *   支持六大门派：小红书 / B站 / 抖音 / 快手 / 微信视频号 / 百家号
 */
import { getDB } from './database.js';
import { BrowserWindow } from 'electron';
import { PLATFORM_PROFILES as PLATFORM, extractProfileFromJSON } from './platform-profiles.js';
import { upsertAccountProfile } from './account-store.js';

// ── 活跃嗅探会话 ──
const activeSniffers = new Map();

// ── 对外入口：挂载嗅探到指定 BrowserView ──
export function attachOnboardingSniffer(webContents, accountId, platform) {
  const key = String(accountId);

  // 清理旧会话
  if (activeSniffers.has(key)) {
    teardownOnboardingSniffer(key);
  }

  const config = PLATFORM[platform];
  if (!config) {
    console.warn(`[Onboarding] 平台 ${platform} 无配置，跳过嗅探`);
    return;
  }

  updateStatus(accountId, '嗅探中');
  notifyRenderer(accountId, { _status: 'started' });

  const session = {
    accountId, platform, webContents, config,
    phase: 'waiting_login',    // waiting_login | sniffing | done
    collected: {},
    timers: [],
    cdpHandler: null,
    loggedOnce: false,
  };

  // ── CDP Network 拦截 ──
  if (webContents.debugger && webContents.debugger.isAttached()) {
    const pendingRequests = new Set();
    const requestTypes = new Map(); // requestId → type (XHR/Fetch/Document...)
    const hasApis = config.apis && config.apis.length > 0;
    const isWildcard = config.wildcardApi === true;

    session._cdpHandler = (_event, method, params) => {
      // 第一步: 记录请求类型 (type 字段只在 requestWillBeSent 里)
      if (method === 'Network.requestWillBeSent') {
        const rid = params?.requestId;
        if (!rid) return;
        requestTypes.set(rid, params?.type || '');
        // 限制缓存大小
        if (requestTypes.size > 500) {
          const keys = requestTypes.keys();
          for (let i = 0; i < 100; i++) requestTypes.delete(keys.next().value);
        }
      }

      // 第二步: 过滤 URL
      if (method === 'Network.responseReceived') {
        const resp = params?.response || {};
        const url = resp.url || '';
        const mimeType = resp.mimeType || '';
        const requestId = params?.requestId;
        if (!requestId) return;

        if (hasApis) {
          for (const api of config.apis) {
            if (url.includes(api.pattern) && !url.includes('.js') && !url.includes('.css')) {
              pendingRequests.add(requestId);
              return;
            }
          }
        }

        // 撒网模式: 拦截 XHR/Fetch (从 requestWillBeSent 取 type)
        // 排除安全墙/APM/上传相关端点，避免 CDP 网络拦截干扰上风控判定
        if (isWildcard) {
          const reqType = requestTypes.get(requestId) || '';
          const isSecUrl = url.includes('infra_sec') || url.includes('walify') ||
                           url.includes('apm-fe') || url.includes('apm') ||
                           url.includes('risk') || url.includes('shield') ||
                           url.includes('captcha') || url.includes('verify');
          if ((reqType === 'XHR' || reqType === 'Fetch') &&
              (mimeType.includes('json') || !mimeType) &&
              !url.includes('.js') && !url.includes('.css') && !url.includes('.png') && !url.includes('.jpg') &&
              !isSecUrl) {
            pendingRequests.add(requestId);
          }
        }
      }

      if (method === 'Network.loadingFinished') {
        const requestId = params?.requestId;
        if (!requestId || !pendingRequests.has(requestId)) return;
        pendingRequests.delete(requestId);
        requestTypes.delete(requestId);
        handleLoadingFinished(session, requestId);
      }
    };

    webContents.debugger.on('message', session._cdpHandler);
    webContents.debugger.sendCommand('Network.enable').catch(() => {});
  }

  // ── URL 导航监听 ──
  const onNavigate = (_event, url) => checkPhase(session, url);
  const onFinishLoad = () => checkPhase(session, webContents.getURL());
  webContents.on('did-navigate', onNavigate);
  webContents.on('did-finish-load', onFinishLoad);
  session._navHandler = onNavigate;
  session._loadHandler = onFinishLoad;

  // ── SPA 平台 DOM 轮询（微信视频号等扫码后 URL 不变）──
  let pollTimer = null;
  if (config.useDomPolling && config.loginPageSelector) {
    const POLL_INTERVAL = 3000;
    let pollCount = 0;
    const MAX_POLL = 40; // 最多轮询 2 分钟

    const poll = () => {
      if (session.phase !== 'waiting_login' || pollCount >= MAX_POLL) {
        return;
      }
      pollCount++;

      const checkScript = `(function(){
        var el = document.querySelector('${config.loginPageSelector}');
        return el ? (window.getComputedStyle(el).display !== 'none' && el.offsetParent !== null) : false;
      })()`;

      webContents.executeJavaScript(checkScript).then(loginPageVisible => {
        if (session.phase === 'waiting_login' && loginPageVisible === false) {
          // 登录框消失了 → 说明扫码成功，触发数据提取
          const url = webContents.getURL();
          checkPhase(session, url);
        }
        pollTimer = setTimeout(poll, POLL_INTERVAL);
      }).catch(() => {
        pollTimer = setTimeout(poll, POLL_INTERVAL);
      });
    };

    pollTimer = setTimeout(poll, 5000); // 5 秒后开始第一轮
    session.timers.push(pollTimer);
    session._clearPoll = () => clearTimeout(pollTimer);
  }

  // ── 首次加载后 2 秒检查（已登录用户）──
  const t0 = setTimeout(() => {
    try { checkPhase(session, webContents.getURL()); } catch (e) { /* ignore */ }
  }, 3000);
  session.timers.push(t0);

  // ── DOM 兜底（15 秒后如果还没数据）──
  const t1 = setTimeout(() => {
    if (session.phase !== 'done') tryDomFallback(session);
  }, 15000);
  session.timers.push(t1);

  // ── 总超时（120 秒后强制结束）──
  const t2 = setTimeout(() => {
    finalize(session);
  }, 120000);
  session.timers.push(t2);

  activeSniffers.set(key, session);
  console.log(`[Onboarding] 嗅探已挂载: ${platform} #${accountId}`);
}

// ── 状态机：检测登录态 → 进入嗅探阶段 ──
function checkPhase(session, url) {
  if (session.phase === 'done') return;
  if (!url || url === 'about:blank') return;

  const loggedIn = session.config.isLoggedIn(url);

  if (session.phase === 'waiting_login' && loggedIn) {
    session.phase = 'sniffing';
    session.loggedOnce = true;
    updateStatus(session.accountId, '嗅探中');
    notifyRenderer(session.accountId, { _status: 'login_detected' });
    console.log(`[Onboarding] 检测到登录态: ${session.platform} #${session.accountId} → ${url}`);

    // 登录后 6 秒追加 DOM 兜底
    const t = setTimeout(() => {
      if (session.phase !== 'done') tryDomFallback(session);
    }, 6000);
    session.timers.push(t);

    // 主动导航：3 秒后跳转创作者后台（CDP 拦截器会自动捕获 API 响应）
    const profileUrl = session.config.creatorDashboardUrl;
    if (profileUrl && !url.includes(new URL(profileUrl).hostname)) {
      const navTimer = setTimeout(() => {
        if (session.phase !== 'done' && !session.userNavigated && !session.collected.real_name) {
          console.log(`[Onboarding] 主动导航至创作者后台: ${profileUrl}`);
          try { session.webContents.loadURL(profileUrl); } catch (e) { /* ignore */ }
        }
      }, 3000);
      session.timers.push(navTimer);

      // 用户 3 秒内手动导航则取消主动导航
      const onUserNav = () => { session.userNavigated = true; };
      session.webContents.once('did-navigate', onUserNav);
      session.timers.push({ _clear: () => { try { session.webContents.removeListener('did-navigate', onUserNav); } catch (e) {} } });
    }
  }

  // 如果已登录但切换到登录页 → 掉线
  if (session.loggedOnce && !loggedIn) {
    console.log(`[Onboarding] 警告: ${session.platform} #${session.accountId} 可能掉线`);
  }
}

// ── CDP: 处理特定 requestId 的响应体 ──
async function handleLoadingFinished(session, requestId) {
  if (session.phase === 'done') return;
  const config = session.config;

  try {
    const respInfo = await session.webContents.debugger.sendCommand(
      'Network.getResponseBody', { requestId }
    );
    if (!respInfo || !respInfo.body) return;

    let json;
    try { json = JSON.parse(respInfo.body); } catch (e) { return; }

    // 精准 API 匹配
    if (config.apis && config.apis.length > 0) {
      for (const api of config.apis) {
        if (session.phase === 'done') return;
        const data = api.parse(json);
        if (data) {
          console.log(`[Onboarding] API 命中: ${session.platform} #${session.accountId} →`, Object.keys(data).join(','));
          mergeData(session, data);
          return;
        }
      }
    }

    // 撒网模式：自动检测 JSON 中是否包含 profile 数据
    if (config.wildcardApi) {
      const data = extractProfileFromJSON(json);
      if (data && (data.real_name || data.user_id)) {
        console.log(`[Onboarding] 撒网命中: ${session.platform} #${session.accountId} →`, JSON.stringify(data).slice(0, 120));
        mergeData(session, data);
        return;
      }
    }
  } catch (e) {
    // getResponseBody 失败
  }
}


// ── DOM 兜底 ──
async function tryDomFallback(session) {
  if (session.phase === 'done') return;
  const script = session.config.domScript;
  if (!script) return;

  try {
    const result = await session.webContents.executeJavaScript(script);
    if (result) {
      const hasData = result.real_name || result.user_id || result.followers > 0;
      console.log(`[Onboarding] DOM 探测: ${session.platform} #${session.accountId} →`, JSON.stringify(result).slice(0, 200));
      if (hasData) {
        console.log(`[Onboarding] DOM 兜底命中: ${session.platform} #${session.accountId}`);
        mergeData(session, result, 'dom');
      }
    } else {
      console.log(`[Onboarding] DOM 脚本返回空: ${session.platform} #${session.accountId}`);
    }
  } catch (e) {
    console.warn(`[Onboarding] DOM 提取失败: ${session.platform} #${session.accountId}`, e.message);
  }
}


// ── 合入数据 + 入库 ──
// API 拦截的数据优先级 > DOM 兜底。API 数据来源可信，DOM 只做查漏补缺。
function mergeData(session, data, source = 'api') {
  if (source === 'dom') {
    // DOM 兜底：只填充 API 没抓到的字段，禁止覆盖已有真数据
    const c = session.collected;
    if (c._apiCaptured) {
      console.log(`[Onboarding] DOM 跳过 — API 已捕获 ${session.platform} #${session.accountId} → ${c.real_name}`);
      return;
    }
    // 非覆盖式合并：仅填空白字段
    for (const key of Object.keys(data)) {
      if (c[key] === '' || c[key] === 0 || c[key] === undefined) {
        c[key] = data[key];
      }
    }
  } else {
    // API 数据：全量覆盖，标记为已捕获
    Object.assign(session.collected, data);
    session.collected._apiCaptured = true;
  }

  // URL 归一化 + guard + COALESCE SQL + 别名修正 + notify → 统一走 account-store
  const c = session.collected;
  if (!c.real_name && !c.user_id) return;

  const result = upsertAccountProfile(session.accountId, c, {
    platform: session.platform,
    notify: true,
    setStatus: true,
  });

  if (result.success) {
    console.log(`[Onboarding] 入库完成: ${session.platform} #${session.accountId} → ${c.real_name || c.user_id}`);
    session.phase = 'done';
    teardownOnboardingSniffer(session.accountId);
  }
}

// ── 最终结算 ──
function finalize(session) {
  if (session.phase === 'done') return;
  session.phase = 'done';

  if (session.collected.real_name || session.collected.user_id) {
    upsertAccountProfile(session.accountId, session.collected, {
      platform: session.platform,
      setStatus: true,
    });
  } else {
    updateStatus(session.accountId, '在线');
  }

  notifyRenderer(session.accountId, { ...session.collected, _status: 'finalized' });
  teardownOnboardingSniffer(session.accountId);
}

// ── 清理（可外部调用：closeEmbeddedAccountBrowser 时自动清理）──
export function teardownOnboardingSniffer(accountId) {
  const key = String(accountId);
  const session = activeSniffers.get(key);
  if (!session) return;

  // 清理 CDP
  if (session._cdpHandler && session.webContents.debugger) {
    try {
      session.webContents.debugger.removeListener('message', session._cdpHandler);
    } catch (e) { /* ignore */ }
  }

  // 清理 URL 监听
  if (session._navHandler) {
    try { session.webContents.removeListener('did-navigate', session._navHandler); } catch (e) { /* ignore */ }
  }
  if (session._loadHandler) {
    try { session.webContents.removeListener('did-finish-load', session._loadHandler); } catch (e) { /* ignore */ }
  }

  // 清理 DOM 轮询
  if (session._clearPoll) {
    try { session._clearPoll(); } catch (e) { /* ignore */ }
  }

  // 清理定时器
  session.timers.forEach(t => {
    if (t && t._clear) t._clear();
    else clearTimeout(t);
  });

  activeSniffers.delete(key);
}

// ── 工具 ──
function updateStatus(accountId, status) {
  try {
    getDB().prepare("UPDATE accounts SET status = ? WHERE id = ?").run(status, accountId);
  } catch (e) { /* ignore */ }
}

function notifyRenderer(accountId, data) {
  try {
    const wins = BrowserWindow.getAllWindows();
    const win = wins[0];
    if (win && !win.isDestroyed()) {
      win.webContents.send('account-onboarding-data', {
        accountId,
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  } catch (e) { /* ignore */ }
}

export function getActiveSnifferCount() {
  return activeSniffers.size;
}
