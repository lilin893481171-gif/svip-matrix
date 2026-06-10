/**
 * @file account-onboarding.js
 * @description 入网嗅探引擎 — 在 BrowserView 中通过 session.webRequest + CDP Network 拦截
 *   profile API 响应，自动提取用户昵称/头像/UID/粉丝数并入库。
 *   支持六大门派：小红书 / B站 / 抖音 / 快手 / 微信视频号 / 百家号
 */
import { getDB } from './database.js';
import { BrowserWindow } from 'electron';

// ── 活跃嗅探会话 ──
const activeSniffers = new Map();

// ── 平台配置：登录检测 + API 嗅探目标 + DOM 兜底脚本 ──
const PLATFORM = {
  '小红书': {
    isLoggedIn(url) {
      return !url.includes('/login') && !url.includes('passport');
    },
    // 撒网兜底：万一精准 API 没命中，拦截所有 XHR/fetch JSON 自动匹配
    wildcardApi: true,
    apis: [
      {
        pattern: '/api/sns/web/v1/user/selfinfo',
        parse(json) {
          const basic = json?.data?.basic_info;
          if (!basic) return null;
          const r = { real_name: basic.nickname || '', avatar: basic.images || basic.imageb || '', user_id: basic.red_id || '' };
          const fans = (json?.data?.interactions || []).find(i => i.type === 'fans');
          if (fans) r.followers = parseInt(fans.count) || 0;
          const likes = (json?.data?.interactions || []).find(i => i.type === 'interaction');
          if (likes) r.total_views = parseInt(likes.count) || 0;
          return r;
        }
      },
      {
        pattern: '/api/creator/user/info',
        parse(json) {
          const d = json?.data;
          if (!d) return null;
          return { real_name: d.nickname || '', avatar: d.image || '', user_id: d.red_id || '', followers: d.fans || d.fans_count || 0 };
        }
      },
      {
        // 小红书通用 profile 格式: { success:true, data: { name, avatar, red_num, fans_count, ... } }
        pattern: '/api/sns/',
        parse(json) {
          const d = json?.data;
          if (!d || !d.name) return null;
          return {
            real_name: d.name || '',
            avatar: d.avatar || '',
            user_id: d.red_num || d.red_id || '',
            followers: d.fans_count || d.fans || 0,
            total_views: d.faved_count || d.liked_count || 0
          };
        }
      }
    ],
    domScript: `(function(){
      try {
        var n = document.querySelector('.user-name,.nickname,.name,[class*=user-name],[class*=nickname],.creator-name');
        var a = document.querySelector('.user-info img,.avatar img,.user-avatar img,[class*=avatar] img');
        var fid = document.querySelector('[class*=red-id],.red-id,.user-id');
        var f = document.querySelector('[class*=fans],[class*=follower]');
        return {
          real_name: n ? n.textContent.trim() : '',
          avatar: a ? a.src : '',
          user_id: fid ? fid.textContent.trim().replace(/[^\\d]/g,'') : '',
          followers: f ? parseInt((f.textContent.match(/[\\d,.]+[万wW]?/)||['0'])[0].replace(/,/g,'')) || 0 : 0
        };
      } catch(e) { return null; }
    })()`
  },

  'B站': {
    isLoggedIn(url) {
      return !url.includes('passport.bilibili.com') && !url.includes('/login');
    },
    apis: [
      {
        pattern: '/x/web-interface/nav',
        parse(json) {
          const d = json?.data;
          if (!d || !d.isLogin) return null;
          return { real_name: d.uname || '', avatar: d.face || '', user_id: String(d.mid || '') };
        }
      },
      {
        pattern: '/x/relation/stat',
        parse(json) {
          const d = json?.data;
          if (!d) return null;
          return { followers: d.follower || 0 };
        }
      }
    ],
    domScript: `(function(){
      try {
        var n = document.querySelector('.user-name,.nickname,#h-name,.creator-name,h1');
        var a = document.querySelector('.user-avatar img,#h-avatar,.avatar img');
        var f = document.querySelector('.stat-item.fans .stat-num,.fans-count,.follower-count');
        return {
          real_name: n ? n.textContent.trim() : '',
          avatar: a ? a.src : '',
          user_id: '',
          followers: f ? parseInt(f.textContent.replace(/[^\\d]/g,'')) || 0 : 0
        };
      } catch(e) { return null; }
    })()`
  },

  '抖音': {
    isLoggedIn(url) {
      return !url.includes('/login') && !url.includes('passport');
    },
    apis: [
      {
        pattern: '/web/api/media/creator_info',
        parse(json) {
          const d = json?.data || json?.user_info || json;
          if (!d || !d.nickname) return null;
          return { real_name: d.nickname || d.name || '', avatar: d.avatar || d.avatar_url || d.avatar_thumb || '', user_id: String(d.uid || d.user_id || ''), followers: d.follower_count || d.fans_count || 0 };
        }
      },
      {
        pattern: '/aweme/v1/web/user/profile/self',
        parse(json) {
          const d = json?.user || json?.data?.user;
          if (!d) return null;
          return { real_name: d.nickname || d.unique_id || '', avatar: d.avatar_medium?.url_list?.[0] || d.avatar_thumb?.url_list?.[0] || '', user_id: String(d.uid || d.id || ''), followers: d.follower_count || 0 };
        }
      }
    ],
    domScript: `(function(){
      try {
        var el = document.querySelector('#root,[class*=creator]');
        var text = el ? el.innerText : document.body.innerText;
        var n = document.querySelector('[class*=nickname],[class*=username],[class*=name]');
        var a = document.querySelector('img[class*=avatar],img[src*=avatar]');
        return {
          real_name: n ? n.textContent.trim() : '',
          avatar: a ? a.src : '',
          user_id: '',
          followers: 0
        };
      } catch(e) { return null; }
    })()`
  },

  '快手': {
    isLoggedIn(url) {
      return !url.includes('passport.kuaishou.com') && !url.includes('/login');
    },
    apis: [],
    domScript: `(function(){
      try {
        var n = document.querySelector('.user-name,.nickname,.profile-name,[class*=user-name]');
        var a = document.querySelector('.user-avatar img,.avatar img,[class*=avatar] img');
        var stats = document.querySelectorAll('.stat-item .num,.stat-num,[class*=count]');
        var f = 0, v = 0;
        for (var i = 0; i < stats.length; i++) {
          var t = stats[i].textContent.trim();
          var num = parseInt(t.replace(/[^\\d]/g,'')) || 0;
          if (t.includes('万')) num = Math.round(num * 10000);
          if (i === 0) f = num;
          if (i === 1) v = num;
        }
        return {
          real_name: n ? n.textContent.trim() : '',
          avatar: a ? a.src : '',
          user_id: '',
          followers: f,
          total_views: v
        };
      } catch(e) { return null; }
    })()`
  },

  '微信视频号': {
    isLoggedIn(url) {
      return !url.includes('/login');
    },
    useDomPolling: true,
    loginPageSelector: '.login-page,.login-container,.qrcode-container,.qrcode-wrap,[class*=login],[class*=qrcode]',
    apis: [
      {
        pattern: '/cgi-bin/mmfinderassistant-bin/',
        parse(json) {
          const finder = json?.data?.finder_info || json?.data?.acct || json?.finder_info || json?.data;
          if (!finder) return null;
          const name = finder.nickname || finder.finder_username || finder.name || '';
          const avatar = finder.head_img_url || finder.avatar || '';
          const uid = finder.finder_username || finder.uniq_id || '';
          const followers = finder.fans_count || finder.follower_count || 0;
          if (!name && !uid) return null;
          return { real_name: name, avatar, user_id: uid, followers };
        }
      }
    ],
    domScript: `(function(){
      try {
        var name='', avatar='', uid='', followers=0;

        // 精确命中 channels.weixin.qq.com 的 DOM 结构
        var n=document.querySelector('.finder-nickname');
        if(n) name=n.textContent.trim();

        var a=document.querySelector('.finder-card .avatar,.finder-info-container .avatar');
        if(a) avatar=a.src||'';

        var idEl=document.querySelector('.finder-uniq-id');
        if(idEl) uid=idEl.textContent.trim();

        // .finder-content-info 下有两个 .finder-info-num: 第一个是视频数, 第二个是关注者
        var nums=document.querySelectorAll('.finder-content-info .finder-info-num');
        if(nums.length>=2) followers=parseInt(nums[1].textContent.replace(/[^\\d]/g,''))||0;

        if(name||uid) return {real_name:name,avatar:avatar,user_id:uid,followers:followers};
        return null;
      }catch(e){return null;}
    })()`
  },

  '百家号': {
    isLoggedIn(url) {
      return !url.includes('/login') && !url.includes('pass.baidu.com');
    },
    // 撒网模式：拦截所有 XHR/fetch JSON，自动识别 profile 数据
    wildcardApi: true,
    apis: [],
    domScript: `(function(){
      try {
        var result={real_name:'',avatar:'',user_id:'',followers:0,total_views:0};

        // ——— 头像：全局搜 portrait/avatar/head/img 关键词的 <img> ———
        var imgs=document.querySelectorAll('img[src]');
        for(var i=0;i<imgs.length;i++){
          var s=imgs[i].src||'';
          var w=imgs[i].width||imgs[i].naturalWidth||0;
          var h=imgs[i].height||imgs[i].naturalHeight||0;
          // 头像特征：src含portrait/avatar/head，且尺寸≥30x30，不包含logo/icon/svg
          if((s.indexOf('portrait')>-1||s.indexOf('avatar')>-1||s.indexOf('/head')>-1) && !s.includes('logo') && !s.includes('icon') && !s.includes('svg') && w>=30 && h>=30){
            result.avatar=s; break;
          }
        }

        // ——— 全局文本扫描 ———
        var bodyText=document.body.innerText||'';
        var lines=bodyText.split(/\\n+/);

        // 百家号ID：匹配 "百家号ID" 或 "ID：" 后面跟的数字
        var idMatch=bodyText.match(/百家号ID[：:]\\s*(\\d{10,})/);
        if(!idMatch) idMatch=bodyText.match(/ID[：:]\\s*(\\d{10,})/);
        if(idMatch) result.user_id=idMatch[1];

        // 粉丝/播放：扫描行级文本
        for(var j=0;j<lines.length;j++){
          var line=lines[j].trim();
          if(!line) continue;

          // 粉丝："粉丝 566" 或 "粉丝数 1.2万" 或 "关注者 566"
          if(!result.followers){
            var fm=line.match(/(?:粉丝|关注者|fans)[^\\d]*([\\d,.]+)\\s*(万|w)?/i);
            if(fm){
              var n=parseFloat(fm[1].replace(/,/g,''));
              if(fm[2]) n=n*10000;
              if(n>0) result.followers=Math.round(n);
            }
          }

          // 播放/阅读
          if(!result.total_views){
            var vm=line.match(/(?:播放|阅读|view)[^\\d]*([\\d,.]+)\\s*(万|w)?/i);
            if(vm){
              var n2=parseFloat(vm[1].replace(/,/g,''));
              if(vm[2]) n2=n2*10000;
              if(n2>0) result.total_views=Math.round(n2);
            }
          }
        }

        // ——— 昵称：找在"账号信息"附近的非问候语短文本 ———
        var allEls=document.querySelectorAll('span,div,h1,h2,h3');
        var nearAvatar=false;
        for(var k=0;k<allEls.length&&!result.real_name;k++){
          var el=allEls[k];
          var t=el.textContent.trim();
          if(!t||t.length>20||t.length<2) continue;
          if(/^(上午|下午|晚上|早上|中午|你好|欢迎|登录|注册|账号信息|退出)$/.test(t)) continue;
          if(/^[\\d,.，。、\\s]+$/.test(t)) continue;
          if(t.includes('ID')||t.includes('粉丝')||t.includes('播放')) continue;
          // 检查是否在头像附近（y位置差<200px）
          var rect=el.getBoundingClientRect();
          if(rect.width>0&&rect.height>0&&rect.top>0){
            // 百家号昵称通常大字、靠上、不含英文长串
            if(!result.real_name||(t.length>=2&&t.length<=16&&!/[a-z]{4,}/i.test(t))){
              result.real_name=t;
            }
          }
        }

        // title 兜底昵称
        if(!result.real_name){
          var tt=document.title||'';
          var pp=tt.split(/[-_|·—]/);
          var t0=pp[0].trim();
          if(t0.length>=2&&t0.length<=16&&t0!=='百度') result.real_name=t0;
        }

        return result;
      }catch(e){return null;}
    })()`
  },
};

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

// ── 撒网解析器：递归扫描 JSON 对象，找 profile 字段 ──
function extractProfileFromJSON(obj, depth) {
  if (!obj || typeof obj !== 'object' || (depth || 0) > 5) return null;
  depth = (depth || 0) + 1;

  var result = {};
  var flat = {};

  // 展平一层
  function walk(o, d) {
    if (!o || typeof o !== 'object' || d > 4) return;
    for (var k in o) {
      if (!o.hasOwnProperty(k)) continue;
      var v = o[k];
      var lk = k.toLowerCase();
      if (typeof v === 'string' || typeof v === 'number') flat[lk] = v;
      if (v && typeof v === 'object' && !Array.isArray(v) && d <= 3) walk(v, d + 1);
    }
  }
  walk(obj, 0);

  // 关键词包含匹配（不再精确匹配字段名，子串命中即可）
  var nameFrags = ['nickname','nick_name','author_name','user_name','username','display_name','real_name','screen_name','creator_name','pen_name'];
  var avatarFrags = ['avatar','headimg','head_img','portrait','face','userimg','user_img'];
  var uidFrags = ['user_id','userid','uid','author_id','bjh_id','creator_id','account_id','red_id','redid','red_num'];
  var fansFrags = ['fans_count','follower_count','follower','fans','fans_num','subscriber','concern_count'];
  var viewFrags = ['total_views','total_plays','play_count','view_count','total_read','read_count','reads','faved_count','liked_count'];

  for (var key in flat) {
    var lk = key.toLowerCase().replace(/[_-]/g, '');
    if (!result.real_name && nameFrags.some(function(f){ return lk.indexOf(f.replace(/[_-]/g,'')) > -1; }) && typeof flat[key] === 'string' && flat[key].length >= 2) {
      result.real_name = flat[key];
    }
    if (!result.avatar && avatarFrags.some(function(f){ return lk.indexOf(f.replace(/[_-]/g,'')) > -1; }) && typeof flat[key] === 'string' && flat[key].length > 10 && flat[key].indexOf('http') > -1) {
      result.avatar = flat[key];
    }
    if (!result.user_id && uidFrags.some(function(f){ return lk.indexOf(f.replace(/[_-]/g,'')) > -1; })) {
      result.user_id = String(flat[key]);
    }
    if (!result.followers && fansFrags.some(function(f){ return lk.indexOf(f.replace(/[_-]/g,'')) > -1; }) && typeof flat[key] === 'number' && flat[key] > 0) {
      result.followers = flat[key];
    }
    if (!result.total_views && viewFrags.some(function(f){ return lk.indexOf(f.replace(/[_-]/g,'')) > -1; }) && typeof flat[key] === 'number' && flat[key] > 0) {
      result.total_views = flat[key];
    }
  }

  if (result.real_name || result.user_id) return result;
  return null;
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

// ──  数据有效性格栅：阻止页面全局 Title / 空 profile 污染数据库
const DIRTY_TITLES = [
  '创作服务平台', '创作中心', '创作者中心', '创作者服务平台',
  '百度', '百度一下', 'Baidu', 'baidu',
  '登录', 'Login', 'Sign in', 'Signin', '注册', 'Register',
  '首页', 'Home', '首页-', '-首页',
];

function guardScrapedData(data, platform) {
  const name = String(data.real_name || '').trim();
  const uid = String(data.user_id || '').trim();
  const followers = parseInt(data.followers) || 0;

  // 1. 脏标题检测
  if (name && DIRTY_TITLES.some(t => t === name || t.toLowerCase() === name.toLowerCase())) {
    throw new Error(`[Guard] 嗅探数据无效(脏标题): "${name}" — 拒绝入库`);
  }

  // 2. user_id 为空 + 无粉丝 => 大概率页面未完全加载
  if (!uid && followers === 0 && name.length <= 2) {
    throw new Error(`[Guard] 嗅探数据无效(user_id空+无粉丝+昵称过短): "${name}" — 拒绝入库`);
  }

  // 3. user_id 为空 + 昵称看起来像页面标题 (>30字)
  if (!uid && name.length > 30) {
    throw new Error(`[Guard] 嗅探数据无效(昵称过长疑似页面标题): "${name.slice(0, 40)}" — 拒绝入库`);
  }

  console.log(`[Guard] ✓ 数据核验通过: ${platform} → ${name || '(空昵称)'}/${uid || '(空UID)'}`);
  return true;
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

  // URL 归一化：协议相对 → https，去除微信头像 URL 参数
  if (session.collected.avatar) {
    let av = session.collected.avatar;
    if (av.startsWith('//')) av = 'https:' + av;
    if (av.startsWith('http://')) av = av.replace('http://', 'https://');
    session.collected.avatar = av;
  }

  const c = session.collected;
  const hasMinimum = c.real_name || c.user_id;

  if (!hasMinimum) return;

  try {
    guardScrapedData(c, session.platform);
  } catch (e) {
    console.warn(e.message);
    return;  // 阻断入库
  }

  try {
    const db = getDB();
    db.prepare(`
      UPDATE accounts
      SET real_name = COALESCE(NULLIF(?,''), real_name),
          avatar    = COALESCE(NULLIF(?,''), avatar),
          user_id   = COALESCE(NULLIF(?,''), user_id),
          followers = CASE WHEN ? > 0 THEN ? ELSE followers END,
          total_views = CASE WHEN ? > 0 THEN ? ELSE total_views END,
          status    = '在线'
      WHERE id = ?
    `).run(
      c.real_name || '', c.avatar || '', c.user_id || '',
      c.followers || 0, c.followers || 0,
      c.total_views || 0, c.total_views || 0,
      session.accountId
    );

    console.log(`[Onboarding] 入库完成: ${session.platform} #${session.accountId} → ${c.real_name || c.user_id}`);

    // 标记完成
    session.phase = 'done';

    // 加入别名修正
    if (c.real_name) {
      db.prepare("UPDATE accounts SET alias = ? WHERE id = ? AND alias LIKE '待绑定_%'")
        .run(c.real_name, session.accountId);
    }

    notifyRenderer(session.accountId, { ...c, _status: 'complete' });
    teardownOnboardingSniffer(session.accountId);
  } catch (e) {
    console.error(`[Onboarding] 入库失败:`, e.message);
  }
}

// ── 最终结算 ──
function finalize(session) {
  if (session.phase === 'done') return;
  session.phase = 'done';

  // 至少标记在线
  updateStatus(session.accountId, '在线');

  if (session.collected.real_name || session.collected.user_id) {
    try { guardScrapedData(session.collected, session.platform); } catch (e) {
      console.warn(e.message);
      teardownOnboardingSniffer(session.accountId);
      return;
    }
    try {
      const db = getDB();
      db.prepare(`
        UPDATE accounts
        SET real_name = COALESCE(NULLIF(?,''), real_name),
            avatar    = COALESCE(NULLIF(?,''), avatar),
            user_id   = COALESCE(NULLIF(?,''), user_id),
            followers = CASE WHEN ? > 0 THEN ? ELSE followers END,
            status    = '在线'
        WHERE id = ?
      `).run(
        session.collected.real_name || '', session.collected.avatar || '', session.collected.user_id || '',
        session.collected.followers || 0, session.collected.followers || 0,
        session.accountId
      );
    } catch (e) { /* ignore */ }
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
  session.timers.forEach(clearTimeout);

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
