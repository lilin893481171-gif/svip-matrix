/**
 * @file platform-profiles.js
 * @description 平台配置统一中心 — 从 PlatformRegistry 动态获取
 */

import PlatformRegistry from './PlatformRegistry.js'

/**
 * 获取平台配置
 * @param {string} platformName - 平台名称
 * @returns {Object|null}
 */
export function getPlatformProfile(platformName) {
  const platform = PlatformRegistry.getAll().find(
    p => p.getDisplayName() === platformName
  )

  if (!platform) {
    console.warn(`[PlatformProfiles] 平台 "${platformName}" 未找到`)
    return null
  }

  return {
    creatorDashboardUrl: platform.getCreatorDashboardUrl?.() || '',
    cookieDomain: platform.getCookieDomains()?.[0] || '',
    isLoggedIn: platform.checkLoginStatus?.bind(platform) || (() => true),
    apis: platform.getApis?.() || [],
    domScript: platform.getDomScript?.() || null
  }
}

/**
 * 获取所有平台配置
 * @returns {Object}
 */
export function getAllPlatformProfiles() {
  const profiles = {}
  PlatformRegistry.getAll().forEach(platform => {
    const name = platform.getDisplayName()
    profiles[name] = getPlatformProfile(name)
  })
  return profiles
}

// 向后兼容：导出 PLATFORM_PROFILES（懒加载）
export const PLATFORM_PROFILES = new Proxy({}, {
  get(target, prop) {
    if (typeof prop === 'string') {
      return getPlatformProfile(prop)
    }
    return undefined
  }
})

// ── 数据有效性校验：阻止脏标题 / 空 profile 污染数据库 ──
const DIRTY_TITLES = [
  '创作服务平台', '创作中心', '创作者中心', '创作者服务平台',
  '百度', '百度一下', 'Baidu', 'baidu',
  '登录', 'Login', 'Sign in', 'Signin', '注册', 'Register',
  '首页', 'Home', '首页-', '-首页',
];

export function guardScrapedData(data, platform) {
  const name = String(data.real_name || '').trim();
  const uid = String(data.user_id || '').trim();
  const followers = parseInt(data.followers) || 0;

  // 1. 脏标题检测
  if (name && DIRTY_TITLES.some(t => t === name || t.toLowerCase() === name.toLowerCase())) {
    throw new Error(`[Guard] 嗅探数据无效(脏标题): "${name}" — 拒绝入库`);
  }

  // 2. user_id 为空 + 无粉丝 + 昵称过短 => 大概率页面未完全加载
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

// ── 撒网解析器：递归扫描 JSON 对象，找 profile 字段 ──
export function extractProfileFromJSON(obj, depth) {
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

  // 关键词包含匹配
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
