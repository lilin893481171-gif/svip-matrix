/**
 * @file rpa-scripts/xiaohongshu.mjs
 * @title 小红书发布适配器 v7 (多策略降级版)
 *
 * 核心原则：录制是状态机文档，不是代码模板。
 *   每一步定位 — 结构 > 角色 > 文案，永不绑死单一选择器。
 *   每一步执行 — 验证反馈 > 盲信成功。
 *
 * 录制揭示的页面状态机：
 *   1. URL ?target=video 预选 Tab（不需要再点"视频"）
 *   2. 上传区需先激活再注入文件
 *   3. 标题是独立 input，描述是 ProseMirror contenteditable
 *   4. 话题标签在描述编辑器内用 #tag + Enter 输入
 *   5. 封面是弹窗流：入口 → modal → upload-btn → 文件 → 确定
 *   6. 发布按钮是 <xhs-publish-btn> 自定义元素
 */
export const meta = { platform: '小红书', version: 7, minAppVersion: '2.0.0' };

const sleep = (ms, wc = null) => {
  const jitter = ms * 0.3; // ±30% 随机偏移，模拟真人节奏
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

  // ════════════════════════════════════════════════════════
  // 核心业务流
  // ════════════════════════════════════════════════════════

  async execute() {
    this.broadcast('🚀 小红书发布 v7...');

    // ── 1. 导航 ──
    await this.i.gentleCloseOverlays();
    await this.i.navigate('https://creator.xiaohongshu.com/publish/publish?from=menu&target=video');
    await sleep(3000);

    // ── 2. 防弹窗结界 ──
    await this._sealFileDialogs();

    // ── 3. 激活上传区 → 注入视频 ──
    //     录制揭示：页面需要点击上传区域后才挂载上传管线
    //     不是点"上传视频"这个词，而是点那个可交互区域让 React 挂载 <input>
    this.broadcast('📦 激活上传区域...');
    await this._activateUploadZone();
    await sleep(1200);

    if (!await this.i.injectFileDirect(this.task.videoPath, { pickLast: false })) {
      throw new Error('视频注入失败');
    }
    this.broadcast('✅ 视频注入成功，等待解析...');
    await sleep(5000);

    // ── 4. 等待视频解析 ──
    if (!await this._pollVideoStatus(60000)) {
      throw new Error('视频解析超时或触发风控');
    }
    this.broadcast('✅ 视频解析完成');

    // ── 5. 标题 ──
    if (this.task.title) {
      await this._fillTitle(this.task.title);
    }

    // ── 6. 描述 + 话题标签（同一编辑器内联） ──
    if (this.task.desc || this.task.tags) {
      await this._fillEditor(this.task.desc, this.task.tags);
    }

    // ── 7. 封面 ──
    if (this.task.coverPath) {
      await this._setCover(this.task.coverPath);
    }

    // ── 8. 附加选项 ──
    if (this.task.poi) await this._setPoi(this.task.poi);
    if (this.task.isOriginal) await this._toggleOriginal();

    if (this.task.dryRun) {
      this.broadcast('🛑 预览模式，不发布');
      return;
    }

    // ── 9. 发布前校验 ──
    if (!await this._waitUntilPublishable()) {
      const err = await this._collectPageErrors();
      throw new Error('发布按钮被锁定' + (err ? ' — ' + err : ''));
    }

    // ── 10. 发布 ──
    this.broadcast('🔥 发布...');
    const clicked = await this._clickPublishButton();
    if (!clicked) throw new Error('无法点击发布按钮');

    // 等跳转
    try { await this.i.waitForUrl(/creator\.xiaohongshu\.com\/(?!publish\/publish)/, 15000); }
    catch (_) { this.broadcast('⚠️ 未检测到发布后跳转，可能仍在处理中'); }

    await sleep(3000);
    this.broadcast('🎉 流程结束');
  }

  // ════════════════════════════════════════════════════════
  // 各步骤实现（多策略降级）
  // ════════════════════════════════════════════════════════

  async _sealFileDialogs() {
    await this.i.evaluate(`
      (() => {
        if (window.__dialog_sealed) return;
        window.__dialog_sealed = true;
        const s = document.createElement('style');
        s.innerHTML = 'input[type="file"] { pointer-events: none !important; }';
        document.head.appendChild(s);
        const orig = HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click = function() {
          if (this.type !== 'file') return orig.call(this);
        };
        const guard = el => el.addEventListener('click', e => { e.stopImmediatePropagation(); e.preventDefault(); }, true);
        document.querySelectorAll('input[type="file"]').forEach(guard);
        new MutationObserver(muts => {
          for (const m of muts) for (const n of m.addedNodes) {
            if (n.tagName === 'INPUT' && n.type === 'file') guard(n);
            if (n.querySelectorAll) n.querySelectorAll('input[type="file"]').forEach(guard);
          }
        }).observe(document.body, { childList: true, subtree: true });
      })();
    `);
  }

  /**
   * 激活上传区域。
   * 策略：点 upload-wrapper（结构） > 点有"上传"文案的区域（语义） > 点发布容器内首个空白区（回退）
   */
  async _activateUploadZone() {
    // 策略1：文案定位 — 真实坐标点击（React 能感知）
    const clicked = await this.i.flexibleClick(['上传视频', '点击上传'], 2000);
    if (clicked) return;

    // 策略2：结构定位 — upload-wrapper CSS 类
    const ok = await this.i.evaluate(`
      (function() {
        var el = document.querySelector('.upload-wrapper, .upload-content, [class*="upload-wrapper"]');
        if (el) { el.click(); return true; }
        return false;
      })();
    `);
    if (ok) return;

    // 策略3：发布容器内首个空白区坐标点击
    await this.i.evaluate(`(function() {
      var c = document.querySelector('#publish-container, .publish-page, [class*="publish-container"]');
      if (c) { var box = c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent('click', { clientX: box.x + 200, clientY: box.y + 150, bubbles: true })); }
    })()`);
  }

  /**
   * 填写标题。DOM 定位第一个可见输入框 → scrollIntoView → 坐标点击 → CDP 插文本。
   * 不依赖 AX 树（childIds/children 格式不稳定），不绑死 placeholder 文案。
   */
  async _fillTitle(text) {
    this.broadcast('✍️ 标题...');

    // DOM 路径：发布容器内第一个可见非隐藏非 file 的 input = 标题
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
      await this.i.humanTypeText(text);
      return;
    }

    // 回退：AX 路径（修好后可用）
    const placeholder = await this.i.evaluate(`
      (() => {
        var inp = document.querySelector('input:not([type="hidden"]):not([type="file"])');
        return inp && inp.offsetParent ? (inp.placeholder || '').trim() : '';
      })();
    `).catch(() => '');
    if (placeholder) await this.i.humanTypeByAX({ placeholder }, text);
  }

  /**
   * 填写描述编辑器 + 话题标签（同一 contenteditable 区域）。
   * 录制揭示：XHS 的描述和标签在同一个 ProseMirror 编辑器里，#tag + Enter = 话题。
   */
  async _fillEditor(desc, tagsStr) {
    this.broadcast('✍️ 描述与标签...');

    // 找编辑器并点击聚焦（坐标点击，不是 JS .focus())
    const clicked = await this._clickEditor();
    if (!clicked) {
      this.broadcast('⚠️ 未找到编辑器，跳过');
      return;
    }

    // 写描述
    if (desc) {
      await this.i.humanTypeText(desc);
      await sleep(500);
    }

    // 写标签
    if (tagsStr) {
      const tags = tagsStr.split(/[\s,，]+/).filter(Boolean).slice(0, 6);
      for (const tag of tags) {
        await this.i.humanTypeText(desc ? ' #' + tag : '#' + tag);
        await sleep(1200);
        await this.i.pressKey('Enter');
        await sleep(800);

        // 验证标签被接受
        const ok = await this._detectTagInEditor(tag, 3000);
        if (!ok) {
          await this.i.pressKey('Enter');
          await sleep(800);
        }
      }
    }
    this.broadcast('✅ 编辑完成');
  }

  /**
   * 点击编辑器获取焦点。DOM 找 contenteditable → scrollIntoView → 坐标点击。
   * 不走 AX role=textbox（标题 input 也是 textbox role，无法区分）。
   */
  async _clickEditor() {
    const box = await this.i.evaluate(`
      (function() {
        var el = document.querySelector('[contenteditable="true"]');
        if (!el || !el.offsetParent) return null;
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        var r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      })();
    `).catch(() => null);

    if (box && box.w > 0 && box.h > 0) {
      await this.i.humanClickAtCoordinates(box.x + box.w * 0.3, box.y + box.h * 0.2);
      await sleep(500);
      return true;
    }
    return false;
  }

  /** 检测标签是否在编辑器中被接受为话题 */
  async _detectTagInEditor(tag, timeout) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const ok = await this.i.evaluate(`
        (function() {
          var ed = document.querySelector('[contenteditable="true"], .ProseMirror');
          if (!ed) return false;
          var t = ed.innerText || ed.textContent || '';
          return t.indexOf('#${tag}') > -1
              || ed.querySelector('a[href*="topic"], [data-topic-id], [class*="topic"]') !== null;
        })();
      `);
      if (ok) return true;
      await sleep(500);
    }
    return false;
  }

  /**
   * 封面设置 — 等封面区域就绪，点"修改封面"打开编辑器弹窗，再注入图片。
   *
   * 实际流程：视频处理完 → XHS 自动截取第一帧作封面 → "修改封面"按钮变可点击 →
   * 用户点"修改封面" → 弹出封面编辑器弹窗(.cover-modal) → 弹窗内有 image file input。
   */
  async _setCover(coverPath) {
    this.broadcast('🖼️ 封面...');

    // 1. 等封面区域就绪：等 ".loading" 的"封面上传中"文本消失
    //    或 ".operator" 变为可见（含"修改封面"按钮）
    this.broadcast('⏳ 等待封面处理完成...');
    let coverReady = false;
    for (let i = 0; i < 20; i++) {
      coverReady = await this.i.evaluate(`
        (function() {
          // 策略A：.operator 容器的 offsetParent 非 null = 可见
          var op = document.querySelector('.cover .operator, .cover-container .operator, [class*="operator"]');
          if (op && op.offsetParent) return true;

          // 策略B：检查 cover 区域内是否有 thumbnail img（封面预览）
          var cover = document.querySelector('.cover-container, .cover');
          if (cover) {
            var imgs = cover.querySelectorAll('img');
            for (var i = 0; i < imgs.length; i++) {
              if (imgs[i].naturalWidth > 20 && imgs[i].clientWidth > 20) return true;
            }
          }

          // 策略C：loading 文字不在 DOM 文本中（"封面上传中"消失）
          var bodyText = document.body.innerText || '';
          if (bodyText.indexOf('封面上传中') === -1 && bodyText.indexOf('设置封面') > -1) return true;

          return false;
        })()
      `).catch(() => false);
      if (coverReady) break;
      await sleep(2000);
    }

    if (!coverReady) {
      this.broadcast('⚠️ 封面处理超时，跳过');
      return;
    }

    // 2. 滚进视口
    this.broadcast('🖱️ 激活封面操作区...');
    await this.i.evaluate(`
      (() => {
        var c = document.querySelector('.cover-container, .cover');
        if (c) c.scrollIntoView({ block: 'center', behavior: 'instant' });
      })()
    `).catch(() => {});
    await sleep(500);

    // 3. 强制让"修改封面"overlay 可见（覆盖层可能依赖 JS 组件状态，不只是 CSS :hover）
    let btnClicked = false;
    try {
      // 注入 CSS 强制显示所有 cover 区域内的 overlay 元素
      await this.i.evaluate(`
        (() => {
          if (window.__cover_overlay_injected) return;
          window.__cover_overlay_injected = true;
          var s = document.createElement('style');
          s.id = 'mx-cover-override';
          s.textContent = [
            '.cover-container .operator { display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; }',
            '.cover-container .operator .text { display: block !important; visibility: visible !important; opacity: 1 !important; }',
            '.cover .operator { display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; }',
            '.cover .operator .text { display: block !important; visibility: visible !important; opacity: 1 !important; }',
            '[class*="operator"][class*="pointer"] { display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; }',
            '[class*="operator"][class*="pointer"] .text { display: block !important; visibility: visible !important; opacity: 1 !important; }'
          ].join('\\n');
          document.head.appendChild(s);
        })()
      `).catch(() => {});
      await sleep(400);

      // 找"修改封面"文字并点击
      const btnRect = await this.i.evaluate(`
        (() => {
          var all = document.querySelectorAll('*');
          for (var i = 0; i < all.length; i++) {
            var el = all[i];
            if ((el.textContent || '').trim() !== '修改封面') continue;
            var r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.5 };
            }
          }
          return null;
        })()
      `).catch(() => null);

      if (btnRect) {
        this.broadcast('📍 点击"修改封面"按钮...');
        await this.i.humanClickAtCoordinates(btnRect.x + btnRect.w * 0.5, btnRect.y + btnRect.h * 0.5);
        btnClicked = true;
      }

      // 移除临时 CSS
      await this.i.evaluate(`
        (() => {
          var s = document.getElementById('mx-cover-override');
          if (s) s.remove();
          window.__cover_overlay_injected = false;
        })()
      `).catch(() => {});

    } catch (err) {
      this.broadcast('⚠️ 封面 overlay 注入失败: ' + err.message);
    }

    // 回退：如果 CDP hover 没找到按钮，尝试直接点击 cover 区域
    if (!btnClicked) {
      this.broadcast('⚠️ 未找到"修改封面"，尝试直接点击封面区域');
      const coverRect = await this.i.evaluate(`
        (() => {
          var c = document.querySelector('.cover-container .default.column, .cover');
          if (!c) return null;
          var r = c.getBoundingClientRect();
          return r.width > 0 ? { x: r.x + r.width * 0.5, y: r.y + r.height * 0.5 } : null;
        })()
      `).catch(() => null);
      if (coverRect) {
        await this.i.humanClickAtCoordinates(coverRect.x, coverRect.y);
      }
    }

    // 4. 等封面编辑器弹窗 (.cover-modal) 出现
    this.broadcast('⏳ 等待封面编辑器弹窗...');
    let modalReady = false;
    for (let i = 0; i < 10; i++) {
      modalReady = await this.i.evaluate(`
        !!document.querySelector('.cover-modal, [class*="cover-modal"], [class*="modal"][class*="cover"]')
      `).catch(() => false);
      if (modalReady) break;
      await sleep(1200);
    }

    if (!modalReady) {
      this.broadcast('⚠️ 封面编辑器弹窗未出现');
      return;
    }
    this.broadcast('✅ 封面编辑器弹窗已出现');

    // 5. 在弹窗内找 image file input 并注入
    let injOk = false;
    for (let i = 0; i < 10; i++) {
      const hasImageInput = await this.i.evaluate(`
        (() => {
          var inputs = document.querySelectorAll('input[type="file"]');
          for (var i = 0; i < inputs.length; i++) {
            var accept = (inputs[i].accept || '');
            if (accept.indexOf('image') >= 0) return true;
          }
          return false;
        })()
      `).catch(() => false);

      if (hasImageInput) {
        // 优先 OS 级注入（isTrusted=true），失败降级 CDP
        injOk = await this.i.injectFileDirect(coverPath, { pickLast: true, containerSelector: '.cover-modal' });
        if (injOk) break;
        // 容器限制也失败，不限容器再试
        injOk = await this.i.injectFileDirect(coverPath, { pickLast: true });
        if (injOk) break;
      }
      await sleep(1500);
    }

    if (!injOk) {
      this.broadcast('⚠️ 封面注入失败 — 弹窗内未找到图片 file input');
      return;
    }

    this.broadcast('✅ 封面图片注入成功');

    // 6. 等预览加载，点确认按钮
    const preview = await this._pollCoverPreview(10000);
    if (preview) {
      await sleep(600);
      const confirmed = await this.i.flexibleClick(['完成', '确定', '确认'], 2000);
      if (!confirmed) {
        // 回退：在弹窗内找按钮
        await this.i.evaluate(`
          (() => {
            var modal = document.querySelector('.cover-modal, [class*="cover-modal"], [class*="modal"][class*="cover"]');
            if (!modal) modal = document.querySelector('[class*="modal"]');
            if (!modal) return;
            var btns = modal.querySelectorAll('button');
            for (var i = 0; i < btns.length; i++) {
              var t = (btns[i].innerText || '').trim();
              if (t === '完成' || t === '确定' || t === '确认') { btns[i].click(); return; }
            }
          })()
        `).catch(() => {});
      }
      await sleep(1200);
    }
    this.broadcast('✅ 封面完成');
  }

  /**
   * 开启原创声明。
   * 采用"文字标签 + 最近 .d-switch-box"定位策略（不依赖内部 checkbox querySelector）。
   * 点击使用 sendInputEvent 绕过一切 click 劫持。
   */
  async _toggleOriginal() {
    this.broadcast('🔘 原创声明...');

    // ── 1. 多策略找开关坐标 ──
    const box = await this.i.evaluate(`
      (() => {
        // 策略A：找 "原创声明" 文字 → 同级找 .d-switch-box（最可靠）
        var allEls = document.querySelectorAll('span, div, label, p');
        var label = null;
        for (var i = 0; i < allEls.length; i++) {
          var el = allEls[i];
          if (!el.offsetParent) continue;
          var t = (el.textContent || '').trim();
          if (t === '原创声明') { label = el; break; }
        }

        if (label) {
          label.scrollIntoView({ block: 'center', behavior: 'instant' });
          var labelR = label.getBoundingClientRect();

          // 在 label 上下几层 DOM 里找 .d-switch-box
          var searchEl = label;
          for (var d = 0; d < 6; d++) {
            if (!searchEl) break;
            var swBox = searchEl.querySelector('.d-switch-box');
            if (swBox && swBox.getBoundingClientRect().width > 0) {
              var r = swBox.getBoundingClientRect();
              return { found: true, x: r.x + r.width * 0.5, y: r.y + r.height * 0.5, via: 'label+switch-box' };
            }
            searchEl = searchEl.parentElement;
          }

          // 没找到 .d-switch-box，扫描页面上所有 .d-switch-box 找距离最近的
          var allSw = document.querySelectorAll('.d-switch-box');
          var bestDist = 1e9, bestRect = null;
          for (var j = 0; j < allSw.length; j++) {
            var sr = allSw[j].getBoundingClientRect();
            if (sr.width <= 0) continue;
            var dy = Math.abs(sr.y - labelR.y);
            var dx = sr.x - (labelR.x + labelR.width);
            // 只找 label 右侧或同行的 switch
            if (dy < 80 && dx > -30 && dy < bestDist) { bestDist = dy; bestRect = sr; }
          }
          if (bestRect) {
            return { found: true, x: bestRect.x + bestRect.width * 0.5, y: bestRect.y + bestRect.height * 0.5, via: 'nearest-switch' };
          }

          // 最后手段：label 右侧 50px
          return { found: true, x: labelR.x + labelR.width + 50, y: labelR.y + labelR.height * 0.5, via: 'label-offset' };
        }

        // 策略B：直接找 .custom-switch-switch .d-switch-box（原创开关特有父类）
        var swBox2 = document.querySelector('.custom-switch-switch .d-switch-box');
        if (swBox2 && swBox2.getBoundingClientRect().width > 0) {
          var r2 = swBox2.getBoundingClientRect();
          return { found: true, x: r2.x + r2.width * 0.5, y: r2.y + r2.height * 0.5, via: 'custom-switch' };
        }

        return { found: false, why: 'not_found' };
      })()
    `).catch(() => ({ found: false, why: 'evaluate_error' }));

    if (!box || !box.found) {
      this.broadcast('⚠️ 未找到原创声明开关 (' + (box?.why || 'unknown') + ')');
      return;
    }

    this.broadcast('📍 点击原创开关 (' + box.via + ')...');
    await this.i.humanClickAtCoordinates(box.x, box.y);
    await sleep(800);

    // ── 3. 等弹窗出现（含"原创声明须知"文案） ──
    const modalOk = await this._pollDom(`
      document.body.innerText.indexOf('原创声明须知') > -1
    `, 3000);
    if (!modalOk) {
      this.broadcast('⚠️ 原创声明弹窗未出现，可能已直接生效');
      return;
    }

    this.broadcast('📋 处理原创声明弹窗...');

    // ── 4. 勾选"我已阅读并同意" ──
    // 直接找 .d-checkbox-box 元素，用 sendInputEvent 坐标点击（flexibleClick 点文字不触发勾选）
    await sleep(500);
    const cbClicked = await this.i.evaluate(`
      (() => {
        var boxes = document.querySelectorAll('.d-checkbox-box, .d-checkbox, [class*="checkbox"]');
        for (var i = 0; i < boxes.length; i++) {
          var r = boxes[i].getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.5 };
          }
        }
        return null;
      })()
    `).catch(() => null);

    if (cbClicked) {
      await this.i.humanClickAtCoordinates(cbClicked.x, cbClicked.y);
    } else {
      // 回退：用 flexibleClick
      await this.i.flexibleClick(['我已阅读并同意'], 1500);
    }
    await sleep(500);

    // ── 5. 点"声明原创"确认按钮 ──
    // 不能用 flexibleClick（可能匹配弹窗标题文字），直接找 modal 内 button
    const confirmed = await this.i.evaluate(`
      (() => {
        var btns = document.querySelectorAll('.d-modal--modal-legacy button, .d-modal button, button');
        for (var i = 0; i < btns.length; i++) {
          var t = (btns[i].innerText || '').trim();
          if (t === '声明原创' && btns[i].offsetParent) {
            btns[i].scrollIntoView({ block: 'center', behavior: 'instant' });
            var r = btns[i].getBoundingClientRect();
            return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.5 };
          }
        }
        return null;
      })()
    `).catch(() => null);

    if (confirmed) {
      await this.i.humanClickAtCoordinates(confirmed.x, confirmed.y);
    } else {
      this.broadcast('⚠️ 未找到"声明原创"按钮，尝试回退...');
      await this.i.flexibleClick(['确定', '确认'], 1000);
    }

    // ── 6. 等弹窗消失 ──
    await this._pollDom(`
      document.body.innerText.indexOf('原创声明须知') === -1
    `, 4000);

    await sleep(500);
    this.broadcast('✅ 原创声明完成');
  }

  async _setPoi(poi) {
    const ok = await this.i.flexibleClick(['添加地点', '添加位置']);
    if (!ok) return;
    await sleep(800);
    await this.i.insertTextViaCDP(poi);
    await sleep(2000);
    await this.i.evaluate(`(function() {
      var items = document.querySelectorAll('.poi-suggest li, .dropdown-item, .poi-item, [class*="suggest"] li');
      if (items[0]) items[0].click();
    })()`);
  }

  // ════════════════════════════════════════════════════════
  // 发布按钮
  // ════════════════════════════════════════════════════════

  async _waitUntilPublishable() {
    await this.i.gentleCloseOverlays();
    await sleep(500);

    for (let i = 0; i < 3; i++) {
      if (await this._canPublish()) return true;
      await sleep(3000);
    }
    return false;
  }

  async _canPublish() {
    return this.i.evaluate(`
      (function() {
        var btn = document.querySelector('xhs-publish-btn');
        if (btn) return !(btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true' || btn.classList.contains('disabled'));
        var btns = document.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
          if (btns[i].innerText && btns[i].innerText.indexOf('发布') > -1)
            return !(btns[i].disabled || btns[i].className.indexOf('disabled') > -1);
        }
        return false;
      })();
    `).catch(() => false);
  }

  async _clickPublishButton() {
    // 策略1：自定义元素 boxModel 多点尝试
    const box = await this.i.findCustomElementBox('xhs-publish-btn');
    if (box && box.width > 0 && box.height > 0) {
      for (const rx of [0.85, 0.75, 0.6, 0.5]) {
        await this.i.humanClickAtCoordinates(box.x + box.width * rx, box.y + box.height * 0.5);
        try { await this.i.waitForUrl(/creator\.xiaohongshu\.com\/(?!publish\/publish)/, 3500); return true; }
        catch (_) { await sleep(400); }
      }
    }
    // 策略2：文字匹配兜底
    return this.i.humanClickByText('发布');
  }

  async _collectPageErrors() {
    return this.i.evaluate(`(function() {
      var msgs = [];
      document.querySelectorAll('.tip, .error, .toast, [class*="error"], [class*="warning"]').forEach(function(el) {
        var t = (el.innerText || '').trim();
        if (t && t.length < 200) msgs.push(t);
      });
      return msgs.join(' | ') || null;
    })()`).catch(() => null);
  }

  // ════════════════════════════════════════════════════════
  // 探针（状态机轮询 / 数据采集）
  // ════════════════════════════════════════════════════════

  async _pollVideoStatus(timeout = 60000) {
    const deadline = Date.now() + timeout;
    let last = 0;
    while (Date.now() < deadline) {
      const r = await this.i.evaluate(`
        (function() {
          var err = document.querySelector('.error-toast, .upload-fail, .video-error, .toast-content');
          if (err && err.innerText) return { s:'error', m:err.innerText };
          if (document.querySelector('.video-cover, .cover-img, img[src*="xhscdn"], .re-upload, [data-video-id]')) return { s:'success' };
          var p = document.querySelector('.upload-progress, .progress-bar, .loading, [class*="progress"]');
          if (p) return { s:'loading', m:p.innerText||'' };
          return { s:'waiting' };
        })();
      `).catch(() => null);
      if (!r) continue;
      if (r.s === 'success') return true;
      if (r.s === 'error') throw new Error('平台拦截: ' + r.m);
      if (Date.now() - last > 4000) {
        if (r.s === 'loading') this.broadcast('⏳ ' + r.m.replace(/\n/g, ' '));
        last = Date.now();
      }
      await sleep(2000);
    }
    return false;
  }

  async _pollCoverPreview(timeout = 8000) {
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

  /** 轮询直到 domCondition JS 表达式返回真 */
  async _pollDom(condition, timeout) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try { if (await this.i.evaluate(`(${condition})`)) return true; } catch (_) {}
      await sleep(500);
    }
    return false;
  }
}

export async function execute(api) {
  const { interactions, task, wc, broadcast } = api;
  await new XiaohongshuAdapter(interactions, task, wc, broadcast).execute();
}
