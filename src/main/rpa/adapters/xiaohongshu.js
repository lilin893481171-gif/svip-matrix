/**
 * @file rpa/adapters/xiaohongshu.js
 * @title 小红书发布适配器 v4 (状态机高强版)
 */

const sleep = (ms, wc = null) => {
  const jitter = ms * 0.1;
  const finalMs = ms + (Math.random() * jitter * 2 - jitter);
  return Promise.race([
    new Promise(resolve => setTimeout(resolve, finalMs)),
    ...(wc ? [new Promise((_, reject) => {
      if (wc.isDestroyed()) reject(new Error('浏览器强制中断'));
      else wc.once('destroyed', () => reject(new Error('浏览器强制中断')));
    })] : [])
  ]);
};

export class XiaohongshuAdapter {
  constructor(interactions, task, wc, broadcast) {
    this.i = interactions;
    this.task = task;
    this.wc = wc;
    this.broadcast = broadcast;
  }

  // ==========================================
  // 核心业务流
  // ==========================================
  async execute() {
    this.broadcast('🚀 启动小红书智能发布流 (v4)...');

    // 1. 环境准备与导航
    await this.i.gentleCloseOverlays();
    console.log('[XHS] 直达发布台...');
    await this.i.navigate('https://creator.xiaohongshu.com/publish/publish');
    await sleep(3000);

    // ==========================================
    // 👑 终极绝杀：三重防线彻底瘫痪文件弹窗
    // ==========================================
    console.log('[XHS] 部署全局防弹窗结界...');
    await this.i.evaluate(`
      (() => {
        if (window.__dialog_sealed) return;
        window.__dialog_sealed = true;

        // 防线 1：CSS pointer-events — 挡物理鼠标点击
        const style = document.createElement('style');
        style.innerHTML = 'input[type="file"] { pointer-events: none !important; }';
        document.head.appendChild(style);

        // 防线 2：原型劫持 — 挡 JS 代码的 click() 调用（React 合成事件走这条路径！）
        const _origClick = HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click = function() {
          if (this.type === 'file') {
            console.log('🛡️ [Native] 已拦截 JS 代码隐式调用的文件筐!');
            return;
          }
          _origClick.call(this);
        };

        // 防线 3：事件级拦截 + MutationObserver — 挡漏网之鱼
        const disableClick = (el) => {
          el.addEventListener('click', (e) => {
            e.stopImmediatePropagation();
            e.preventDefault();
          }, true);
        };
        document.querySelectorAll('input[type="file"]').forEach(disableClick);
        new MutationObserver((mutations) => {
          mutations.forEach(m => {
            m.addedNodes.forEach(node => {
              if (node.tagName === 'INPUT' && node.type === 'file') disableClick(node);
              if (node.querySelectorAll) {
                node.querySelectorAll('input[type="file"]').forEach(disableClick);
              }
            });
          });
        }).observe(document.body, { childList: true, subtree: true });
      })();
    `);

    // 切换到视频面板
    await this.i.flexibleClick(['视频'], 2000);
    await sleep(1500);

    // 2. 视频注入
    const videoInjected = await this.i.injectFileDirect(this.task.videoPath, { pickLast: false });
    if (!videoInjected) {
      throw new Error('❌ 视频直注失败，未找到上传控件或序列化错误');
    }

    this.broadcast('✅ 视频直注成功，强制休眠 5 秒避开页面重绘期...');

    await sleep(5000);

    // 3. 状态机轮询
    console.log('[XHS] 进入状态机：等待后端解析与校验...');
    const isParsed = await this._pollVideoStatus(60000);
    if (!isParsed) {
      throw new Error('❌ 视频解析超时或触发安全风控，终止发布');
    }
    console.log('[XHS] 视频解析完成，底层 video_id 已挂载');

    // 4. 填写元数据 (标题与描述)
    console.log('[XHS] 注入视频元数据...');
    if (this.task.title) {
      await this._fillTitle(this.task.title);
    }

    if (this.task.desc) {
      await this.i.humanTypeByAX({ role: 'textbox' }, this.task.desc);
    }

    // 5. 填写标签
    if (this.task.tags) {
      console.log('[XHS] 注入话题标签...');
      const tags = this.task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 6);
      for (const tag of tags) {
        await this.i.insertTextViaCDP(`#${tag}`);
        await sleep(1200);
        await this.i.pressKey('Enter');
        await sleep(500);
      }
    }

    // 6. 封面注入 — containerSelector 精准定位 .cover-container 内的 file input
    if (this.task.coverPath) {
      console.log('[XHS] 设置自定义封面...');
      try {
        // 1. 确保封面区域可见
        const scrolled = await this.i.evaluate(`
          (() => {
            var el = document.querySelector('.cover-container');
            if (el && el.offsetParent) {
              el.scrollIntoView({ block: 'center', behavior: 'instant' });
              return true;
            }
            return false;
          })()
        `).catch(() => false);

        // 如果封面区域不在 DOM，尝试点击入口展开
        if (!scrolled) {
          const clicked = await this.i.flexibleClick(['设置封面', '修改封面', '编辑封面'], 2000);
          if (!clicked) { console.warn('[XHS] ⚠️ 未找到封面入口'); return; }
          await sleep(2000);
        }

        // 2. 确认 cover-container 内有 file input
        const hasInput = await this.i.evaluate(`
          (() => {
            var cover = document.querySelector('.cover-container');
            if (!cover || !cover.offsetParent) return false;
            return cover.querySelector('input[type="file"]') !== null;
          })()
        `).catch(() => false);

        if (!hasInput) {
          console.warn('[XHS] ⚠️ 封面区域无 file input');
          return;
        }

        // 3. 精准注入 — 只注 .cover-container 内的 file input
        const injOk = await this.i.injectFileDirect(this.task.coverPath, {
          pickLast: false,
          containerSelector: '.cover-container'
        });

        if (!injOk) {
          console.warn('[XHS] ⚠️ 封面注入失败');
        } else {
          // 等封面预览加载（与 v7 对齐 — 不盲目点确定）
          const preview = await this._pollCoverPreview(10000);
          if (preview) {
            await sleep(600);
            await this.i.flexibleClick(['确定', '完成', '确认'], 2000);
            await sleep(1200);
          }
          this.broadcast('✅ 封面设置完成');
        }
      } catch (e) {
        this.broadcast('⚠️ 封面设置异常: ' + e.message);
      }
    }

    // 7. 附加选项 (地点 / 原创)
    if (this.task.poi) {
      const clickedPoi = await this.i.flexibleClick(['添加地点', '添加位置']);
      if (clickedPoi) {
        await sleep(1000);
        await this.i.insertTextViaCDP(this.task.poi);
        await sleep(2000);
        await this.i.clickElement('.poi-suggest li, .dropdown-item, .poi-item');
      }
    }

    if (this.task.isOriginal) {
      console.log('[XHS] 原创声明...');

      // ── 1. 点击原创声明开关 ──
      const box = await this.i.evaluate(`
        (() => {
          var all = [...document.querySelectorAll('*')];
          var label = all.find(el => {
            if (!el.offsetParent) return false;
            return (el.textContent || '').trim() === '原创声明';
          });
          if (!label) return null;
          label.scrollIntoView({ block: 'center', behavior: 'instant' });

          var container = label.closest('[class*="setting"], [class*="row"], [class*="item"], [class*="option"], [class*="set"], [class*="field"], [class*="form"]') || label.parentElement;
          var sw = container.querySelector('[class*="switch"], [class*="toggle"], input[type="checkbox"], [role="switch"]');
          if (sw && sw.offsetParent) {
            var r = sw.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
          }
          var r = label.getBoundingClientRect();
          return { x: r.x + r.width, y: r.y, w: 44, h: r.height };
        })()
      `).catch(() => null);

      if (!box || box.w <= 0) {
        console.warn('[XHS] ⚠️ 未找到原创声明开关');
      } else {
        await this.i.humanClickAtCoordinates(box.x + box.w * 0.5, box.y + box.h * 0.5);
        await sleep(800);

        // ── 2. 等弹窗出现（含"原创声明须知"文案） ──
        const modalOk = await this._pollDom(`document.body.innerText.indexOf('原创声明须知') > -1`, 3000);

        if (!modalOk) {
          console.log('[XHS] ⚠️ 原创声明弹窗未出现，可能已直接生效');
        } else {
          console.log('[XHS] 处理原创声明弹窗...');

          // ── 3. 勾选"我已阅读并同意" ──
          const agreed = await this.i.flexibleClick(['我已阅读并同意'], 2000);
          if (!agreed) {
            await this.i.evaluate(`
              (() => {
                var cb = document.querySelector('.d-modal-mask input[type="checkbox"], [class*="modal"] input[type="checkbox"], [class*="dialog"] input[type="checkbox"]');
                if (cb) cb.click();
              })()
            `);
          }
          await sleep(400);

          // ── 4. 点"声明原创"确认按钮 ──
          const confirmed = await this.i.flexibleClick(['声明原创'], 2000);
          if (!confirmed) {
            await this.i.flexibleClick(['确定', '确认'], 1000);
          }

          // ── 5. 等弹窗消失 ──
          await this._pollDom(`document.body.innerText.indexOf('原创声明须知') === -1`, 4000);

          await sleep(500);
          console.log('[XHS] ✅ 原创声明完成');
        }
      }
    }

    if (this.task.dryRun) {
      this.broadcast('🛑 预览模式已完成，不执行最终发布');
      return;
    }

    // 8. 终极安全校验：发布按钮状态验证
    console.log('[XHS] 执行最终硬校验：发布按钮状态...');
    const canPublish = await this._canPublish();
    if (!canPublish) {
      throw new Error('❌ 发布按钮当前被锁定 (Disabled)。原因可能是：1. 必填项为空 2. 视频未解析完 3. WAF 阻止了表单提交');
    }

    // 9. 执行发布
    this.broadcast('🔥 发送最终发布指令...');
    await this.i.humanClickByText('发布');

    await sleep(8000);
    this.broadcast('🎉 小红书自动化发布流程结束');
  }

  // ==========================================
  // 私有探针方法
  // ==========================================

  async _pollVideoStatus(timeout = 60000) {
    const deadline = Date.now() + timeout;
    let lastLogTime = 0;

    while (Date.now() < deadline) {
      try {
        const result = await this.i.evaluate(`
          (function() {
            try {
              var errEl = document.querySelector('.error-toast, .upload-fail, .video-error, .toast-content');
              if (errEl && errEl.innerText && errEl.innerText.length > 0) {
                return { s: 'error', msg: errEl.innerText };
              }

              var hasCover = document.querySelector('.video-cover, .cover-img, img[src*="xhscdn"]');
              var videoIdData = document.querySelector('[data-video-id]');
              var hasReuploadText = false;
              var btns = document.querySelectorAll('button');
              for (var i = 0; i < btns.length; i++) {
                if (btns[i].innerText && btns[i].innerText.indexOf('重新上传') > -1) {
                  hasReuploadText = true; break;
                }
              }

              if (hasCover || hasReuploadText || document.querySelector('.re-upload') || videoIdData) {
                return { s: 'success' };
              }

              var progressEl = document.querySelector('.upload-progress, .progress-bar, .loading, [class*="progress"]');
              if (progressEl) {
                return { s: 'loading', text: progressEl.innerText || 'UI显示上传中' };
              }

              return { s: 'waiting' };
            } catch (e) {
              return { s: 'dom_error' };
            }
          })();
        `);

        if (result) {
          if (result.s === 'success') return true;
          if (result.s === 'error') {
            throw new Error('小红书前端拦截: ' + (result.msg || '格式不支持或触发风控'));
          }

          if (Date.now() - lastLogTime > 4000) {
            if (result.s === 'loading') {
              console.log('[XHS] ⏳ 视频正在处理中... 实时状态: ' + result.text.replace(/\n/g, ' '));
            } else if (result.s === 'waiting') {
              console.log('👀 [状态机] 暂未检测到进度条或成功标志，等待页面响应...');
            }
            lastLogTime = Date.now();
          }
        }

      } catch (ipcError) {
        console.log('🛡️ [状态机护盾] 页面上下文波动，已拦截:', ipcError.message);
      }

      await sleep(2000);
    }
    return false;
  }

  async _canPublish() {
    try {
      return await this.i.evaluate(`
        (function() {
          try {
            var btns = document.querySelectorAll('button');
            var targetBtn = null;
            for (var i = btns.length - 1; i >= 0; i--) {
              if (btns[i].innerText && btns[i].innerText.indexOf('发布') > -1) {
                targetBtn = btns[i];
                break;
              }
            }

            if (!targetBtn) return false;

            var isDisabled = targetBtn.disabled
                          || targetBtn.hasAttribute('disabled')
                          || targetBtn.getAttribute('aria-disabled') === 'true'
                          || targetBtn.className.indexOf('disabled') > -1;

            return !isDisabled;
          } catch (e) {
            return false;
          }
        })();
      `);
    } catch (ipcError) {
      console.log('🛡️ [状态机护盾] 检查发布按钮时页面波动，返回 false 稍后再试:', ipcError.message);
      return false;
    }
  }

  /**
   * 填写标题 — DOM 定位第一个可见 input（与 v7 对齐，不走 AX 树）
   */
  async _fillTitle(text) {
    console.log('[XHS] ✍️ 标题...');

    const box = await this.i.evaluate(`
      (() => {
        var container = document.querySelector('#publish-container, [class*="publish-container"]');
        var inputs = (container || document).querySelectorAll('input:not([type="hidden"]):not([type="file"])');
        for (var i = 0; i < inputs.length; i++) {
          var el = inputs[i];
          if (!el.offsetParent) continue;
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
          var r = el.getBoundingClientRect();
          if (r.width > 80 && r.height > 15) return { x: r.x, y: r.y, w: r.width, h: r.height };
        }
        return null;
      })();
    `).catch(() => null);

    if (box && box.w > 0 && box.h > 0) {
      await this.i.humanClickAtCoordinates(box.x + box.w * 0.3, box.y + box.h * 0.5);
      await sleep(300);
      await this.i.insertTextViaCDP(text);
      return;
    }

    // 回退：AX placeholder
    const placeholder = await this.i.evaluate(`
      (() => {
        var inp = document.querySelector('input:not([type="hidden"]):not([type="file"])');
        return inp && inp.offsetParent ? (inp.placeholder || '').trim() : '';
      })();
    `).catch(() => '');
    if (placeholder) await this.i.humanTypeByAX({ placeholder }, text);
  }

  /**
   * 轮询直到 JS 条件为真（与 v7 _pollDom 对齐）
   */
  async _pollDom(condition, timeout = 5000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try { if (await this.i.evaluate(`(${condition})`)) return true; } catch (_) {}
      await sleep(500);
    }
    return false;
  }

  /**
   * 轮询封面预览加载（与 v7 _pollCoverPreview 对齐）
   */
  async _pollCoverPreview(timeout = 10000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const ok = await this.i.evaluate(`
        (function() {
          for (var imgs = document.querySelectorAll('img'), i = 0; i < imgs.length; i++)
            if (imgs[i].naturalWidth > 50 && imgs[i].clientWidth > 50) return true;
          for (var cs = document.querySelectorAll('canvas'), j = 0; j < cs.length; j++)
            if (cs[j].width > 50 && cs[j].clientWidth > 50) return true;
          if (document.body.innerText.indexOf('默认截取第一帧') === -1) return true;
          return false;
        })();
      `).catch(() => false);
      if (ok) return true;
      await sleep(800);
    }
    return false;
  }
}
