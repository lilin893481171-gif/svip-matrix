/**
 * @file platform-profiles.js
 * @description 平台配置统一中心 — 合并 account-onboarding / data-engine / browser-manager 三处平台知识
 *   - isLoggedIn(): 登录状态检测
 *   - apis[]:        API 嗅探模式 + 解析器
 *   - domScript:     DOM 兜底提取脚本
 *   - creatorDashboardUrl: 创作者后台 URL（数据引擎用）
 *   - cookieDomain:  Cookie 注入域名（browser-manager 用）
 */

export const PLATFORM_PROFILES = {

  '小红书': {
    creatorDashboardUrl: 'https://creator.xiaohongshu.com/new/home',
    cookieDomain: '.xiaohongshu.com',
    isLoggedIn(url) {
      return !url.includes('/login') && !url.includes('passport');
    },
    wildcardApi: true,
    apis: [
      {
        pattern: '/api/sns/',
        parse(json) {
          const root = json?.data;
          if (!root) return null;
          // basic_info 子结构（selfinfo 等端点）
          const basic = root.basic_info || root;
          const name = basic.name || basic.nickname || basic.screen_name || '';
          if (!name) return null;
          const uid = basic.red_num || basic.red_id || basic.user_id || basic.userid ||
                      basic.uid || basic.mid || basic.account_id || basic.redId ||
                      root.red_num || root.red_id || root.user_id || '';
          return {
            real_name: name,
            avatar: basic.avatar || basic.images || basic.imageb || basic.head_img_url || '',
            user_id: String(uid),
            followers: basic.fans_count || root.fans_count || basic.fans || 0,
            total_views: basic.faved_count || root.faved_count || basic.liked_count || 0
          };
        }
      }
    ],
    domScript: `(function(){
      try {
        var n = document.querySelector('.user-name,.nickname,.name,[class*=user-name],[class*=nickname],.creator-name');
        var a = document.querySelector('.user-info img,.avatar img,.user-avatar img,[class*=avatar] img');
        // 多策略提取小红书号
        var uid = '';
        var fid = document.querySelector('[class*=red-id],[class*=redId],.red-id,.user-id,[class*=user-id]');
        if(fid) uid = fid.textContent.trim().replace(/[^\\d]/g,'');
        if(!uid){
          var bodyText = document.body.innerText || '';
          var m = bodyText.match(/(?:小红书号|红书号|Red\\s*ID)[：:]*\\s*([\\w\\d]+)/i);
          if(m) uid = m[1];
        }
        if(!uid){
          var allSpans = document.querySelectorAll('span,div,p');
          for(var i=0;i<allSpans.length;i++){
            var t = allSpans[i].textContent.trim();
            if(/^小红书号/.test(t)){
              var nm = t.match(/[\\d]{5,}/);
              if(nm){ uid = nm[0]; break; }
            }
          }
        }
        var f = document.querySelector('[class*=fans],[class*=follower]');
        return {
          real_name: n ? n.textContent.trim() : '',
          avatar: a ? a.src : '',
          user_id: uid,
          followers: f ? parseInt((f.textContent.match(/[\\d,.]+[万wW]?/)||['0'])[0].replace(/,/g,'')) || 0 : 0
        };
      } catch(e) { return null; }
    })()`
  },

  'B站': {
    creatorDashboardUrl: 'https://member.bilibili.com/platform/home',
    cookieDomain: '.bilibili.com',
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
    creatorDashboardUrl: 'https://creator.douyin.com/creator-micro/home',
    cookieDomain: '.douyin.com',
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
    creatorDashboardUrl: 'https://cp.kuaishou.com/profile',
    cookieDomain: '.kuaishou.com',
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
    creatorDashboardUrl: 'https://channels.weixin.qq.com/platform',
    cookieDomain: '.qq.com',
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
        var n=document.querySelector('.finder-nickname');
        if(n) name=n.textContent.trim();
        var a=document.querySelector('.finder-card .avatar,.finder-info-container .avatar');
        if(a) avatar=a.src||'';
        var idEl=document.querySelector('.finder-uniq-id');
        if(idEl) uid=idEl.textContent.trim();
        var nums=document.querySelectorAll('.finder-content-info .finder-info-num');
        if(nums.length>=2) followers=parseInt(nums[1].textContent.replace(/[^\\d]/g,''))||0;
        if(name||uid) return {real_name:name,avatar:avatar,user_id:uid,followers:followers};
        return null;
      }catch(e){return null;}
    })()`
  },

  '百家号': {
    creatorDashboardUrl: 'https://baijiahao.baidu.com/builder/rc/home',
    cookieDomain: '.baidu.com',
    isLoggedIn(url) {
      return !url.includes('/login') && !url.includes('pass.baidu.com');
    },
    wildcardApi: true,
    apis: [],
    domScript: `(function(){
      try {
        var result={real_name:'',avatar:'',user_id:'',followers:0,total_views:0};
        var imgs=document.querySelectorAll('img[src]');
        for(var i=0;i<imgs.length;i++){
          var s=imgs[i].src||'';
          var w=imgs[i].width||imgs[i].naturalWidth||0;
          var h=imgs[i].height||imgs[i].naturalHeight||0;
          if((s.indexOf('portrait')>-1||s.indexOf('avatar')>-1||s.indexOf('/head')>-1) && !s.includes('logo') && !s.includes('icon') && !s.includes('svg') && w>=30 && h>=30){
            result.avatar=s; break;
          }
        }
        var bodyText=document.body.innerText||'';
        var lines=bodyText.split(/\\n+/);
        var idMatch=bodyText.match(/百家号ID[：:]\\s*(\\d{10,})/);
        if(!idMatch) idMatch=bodyText.match(/ID[：:]\\s*(\\d{10,})/);
        if(idMatch) result.user_id=idMatch[1];
        for(var j=0;j<lines.length;j++){
          var line=lines[j].trim();
          if(!line) continue;
          if(!result.followers){
            var fm=line.match(/(?:粉丝|关注者|fans)[^\\d]*([\\d,.]+)\\s*(万|w)?/i);
            if(fm){
              var num=parseFloat(fm[1].replace(/,/g,''));
              if(fm[2]) num=num*10000;
              result.followers=Math.round(num);
            }
          }
          if(!result.total_views){
            var vm=line.match(/(?:播放|阅读|views|reads)[^\\d]*([\\d,.]+)\\s*(万|w)?/i);
            if(vm){
              var vnum=parseFloat(vm[1].replace(/,/g,''));
              if(vm[2]) vnum=vnum*10000;
              result.total_views=Math.round(vnum);
            }
          }
        }
        if(result.real_name||result.user_id||result.followers>0) return result;
        return null;
      }catch(e){return null;}
    })()`
  }
};

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
