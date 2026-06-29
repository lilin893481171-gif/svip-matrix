/**
 * @file xiaohongshu.mjs
 * 小红书发布适配器 v23 (混合CDP直注 + XHR借壳发包)
 */
export const meta = { platform: '小红书', version: 23, minAppVersion: '3.0.0' };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class SafetyDetector {
  constructor(wc) { this.wc = wc; }
  async check() {
    return await this.wc.executeJavaScript(`
      (() => {
        const box = document.querySelector('.sms-verify-box, .geetest_panel, .login-container');
        if (box && box.offsetParent !== null) return { type: 'risk', hint: '检测到风控或登录弹窗，请手动处理' };
        return null;
      })()
    `).catch(() => null);
  }
}

class UploadManager {
  constructor(i, task, wc, broadcast) {
    this.i = i; this.task = task; this.wc = wc; this.broadcast = broadcast;
    this.detector = new SafetyDetector(wc);
  }

  async injectVideo(videoPath) {
    this.broadcast('📤 开始静默注入视频...');
    await sleep(5000); // 等待 React 渲染 input

    let nodeId = null;
    try {
      const doc = await this.wc.debugger.sendCommand('DOM.getDocument', { depth: -1 });
      const findFileInput = (node) => {
        if (!node) return null;
        if (node.nodeName === 'INPUT' && node.attributes) {
          let isFile = false;
          for (let i = 0; i < node.attributes.length; i += 2) {
            if (node.attributes[i] === 'type' && node.attributes[i + 1] === 'file') isFile = true;
          }
          if (isFile) return node.nodeId;
        }
        if (node.children) {
          for (const child of node.children) {
            const found = findFileInput(child);
            if (found) return found;
          }
        }
        return null;
      };
      nodeId = findFileInput(doc.root);
      if (!nodeId) throw new Error('未在 DOM 树中找到视频 file input');
    } catch (e) {
      throw new Error('CDP 寻址失败: ' + e.message);
    }

    this.broadcast('⚡ 找到核心节点，执行底层灌入...');
    await this.wc.debugger.sendCommand('DOM.setFileInputFiles', { nodeId, files: [videoPath] });
    await sleep(1000);

    await this.wc.executeJavaScript(`
      (() => {
        const inputs = document.querySelectorAll('input[type="file"]');
        for (let el of inputs) {
          if (!el.accept || el.accept.includes('video')) {
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      })()
    `);
    this.broadcast('✅ 视频已灌入，等待云端处理...');
  }

  async pollVideoInfo(timeoutMs = 180_000, needsVerifyFn) {
    this.broadcast('🔍 轮询视频凭证 (video_file_id)...');
    const deadline = Date.now() + timeoutMs;

    const getInfo = async () => {
      return await this.wc.executeJavaScript(`
        (() => {
          const SPECTRUM = /^spectrum\\//;
          const deepFind = (obj, depth) => {
            if (!obj || typeof obj !== 'object' || depth > 12) return null;
            if (obj.video_file_id && SPECTRUM.test(String(obj.video_file_id))) return obj.video_file_id;
            if (obj.file_id && SPECTRUM.test(String(obj.file_id))) return obj.file_id;
            for (const k of Object.keys(obj)) {
              if (k === 'cover') continue;
              const r = deepFind(obj[k], depth + 1);
              if (r) return r;
            }
            return null;
          };

          for (let i = 0; i < localStorage.length; i++) {
            try { const v = JSON.parse(localStorage.getItem(localStorage.key(i))); const r = deepFind(v, 0); if (r) return r; } catch(_) {}
          }
          for (const gk of ['__UPLOAD_STATE__','__PUBLISH_STATE__','__VIDEO_INFO__']) {
            try { const r = deepFind(window[gk], 0); if (r) return r; } catch(_) {}
          }
          return null;
        })()
      `);
    };

    while (Date.now() < deadline) {
      const vid = await getInfo();
      if (vid) {
        this.broadcast('📊 成功获取 video_file_id: ' + vid);
        return { video_file_id: vid };
      }

      const danger = await this.detector.check();
      if (danger && needsVerifyFn) {
        this.broadcast('⚠️ ' + danger.hint);
        await needsVerifyFn(danger.type, danger.hint);
      }

      await sleep(3000);
    }
    throw new Error('视频上传超时');
  }
}

// ═══════════════════════════════════════════
// Payload 强类型组装器
// ═══════════════════════════════════════════
function assemblePayload(task, videoInfo) {
  const videoFileId = String(videoInfo.video_file_id || '');

  // 稳健正则：只替换纯文本话题，防止匹配到标点符号
  const transformTags = (text) => {
    return (text || '').replace(/#([^\s#，。！？\.\?!]+)/g, (full, tag) => {
      if (tag.endsWith('[话题]')) return full;
      return '#' + tag + '[话题]#';
    });
  };

  const desc = transformTags(task.desc);
  const tagText = task.tags ? String(task.tags).split(/[\s,，]+/).filter(Boolean).map(t => '#' + t.replace(/^#/, '') + '[话题]#').join(' ') : '';
  const fullDesc = [desc, tagText].filter(Boolean).join('\n');

  const binds = {};
  const dtimeTs = task.scheduleTime ? Math.floor(new Date(task.scheduleTime).getTime() / 1000) : (task.dtime || 0);
  if (dtimeTs > 0) binds.notePostTiming = { postTime: dtimeTs * 1000 };
  if (Number(task.copyright) === 1) binds.optionRelationList = [{ type: 'original_declaration', value: 1 }];

  return {
    common: {
      type: 'video',
      note_id: '',
      title: String(task.title || ''),
      desc: fullDesc,
      hash_tag: [],
      capa_trace_info: {},
      business_binds: JSON.stringify(binds),
    },
    video_info: {
      fileid: videoFileId,
      file_id: videoFileId,
      cover: { fileid: '', file_id: '' }, // 置空，服务器自动抽帧
      composite_metadata: { format: 'mp4', width: 1080, height: 1920 }
    }
  };
}

// ═══════════════════════════════════════════
// 主执行函数 (纯粹的 4 步走)
// ═══════════════════════════════════════════
export async function execute(api) {
  const { interactions, task, wc, broadcast, pauseForManualStep } = api;
  broadcast('🚀 小红书 v23 (混合CDP直注 + XHR借壳发包)...');

  // Phase 0: 路由空降与清理
  broadcast('🧭 导航至发布中心并清理缓存...');
  await wc.loadURL('https://creator.xiaohongshu.com/publish/publish');
  await sleep(5000);
  await wc.executeJavaScript(`(() => { localStorage.clear(); sessionStorage.clear(); })()`).catch(() => {});

  const upload = new UploadManager(interactions, task, wc, broadcast);

  // Phase 1 & 2: 静默上传视频并获取 ID
  await upload.injectVideo(task.videoPath);
  const needsVerifyFn = pauseForManualStep ? (type, hint) => pauseForManualStep('验证', hint) : null;
  const videoInfo = await upload.pollVideoInfo(180_000, needsVerifyFn);

  // Phase 3: 组装 JSON Payload
  const payload = assemblePayload(task, videoInfo);
  broadcast(`📋 组装完毕: 标题 [${task.title}], 定时 [${task.scheduleTime || '无'}]`);

  // Phase 4: 原生 XHR 借壳点火发射
  broadcast('🔥 正在借壳发送底层协议...');
  const result = await wc.executeJavaScript(`
    (async () => {
      const body = ${JSON.stringify(JSON.stringify(payload))};
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://edith.xiaohongshu.com/web_api/sns/v2/note', true);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
        xhr.onload = () => resolve({ status: xhr.status, data: xhr.responseText });
        xhr.onerror = () => resolve({ status: -1, data: 'Network Error' });
        xhr.send(body);
      });
    })()
  `);

  try {
    const dataObj = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
    if (result.status === 200 && dataObj.success !== false) {
      broadcast('✅ 小红书协议发布成功！');
      return { success: true, data: dataObj };
    }
    throw new Error(`[Status ${result.status}] ${JSON.stringify(dataObj)}`);
  } catch (e) {
    throw new Error(`发布接口被拒: ${e.message}`);
  }
}