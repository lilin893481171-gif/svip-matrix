/**
 * @file rpa-scripts/wechat-channels.mjs
 * 微信视频号发布脚本 — 独立可更新模块
 */
export const meta = {
  platform: '微信视频号',
  version: 1,
  minAppVersion: '2.0.0'
};

export async function execute(api) {
  const { interactions: i, task, wc, broadcast, sleep, statusManager } = api;
  const sm = statusManager || { broadcast: (msg) => broadcast(msg) };

  sm.broadcast('🚀 导航至微信视频号...', 'navigating');
  await i.gentleCloseOverlays();

  sm.broadcast('寻找发布入口...', 'scanning_ui');
  await i.clickElement('button:has-text("发表视频"), [aria-label="发表视频"], .post-list-header button');
  await sleep(1500);

  if (task.videoPath) {
    sm.broadcast('准备注入媒体文件...', 'preparing_upload');
    await i.safeUpload(task.videoPath, ['上传视频', '点击上传']);
  }

  sm.broadcast('等待页面就绪...', 'verifying_upload');
  const descSelector = '.input-editor, [contenteditable="true"]';
  await i.waitForSelector(descSelector, 45000);

  sm.broadcast('📝 填写发布信息...', 'filling_form');
  const titleSelector = 'input[placeholder*="标题"]';
  if (await i.isElementVisible(titleSelector)) {
    await i.humanType(titleSelector, task.title);
    await i.humanType(descSelector, task.desc || '');
  } else {
    const fullText = (task.title ? `【${task.title}】\n` : '') + (task.desc || '');
    await i.humanType(descSelector, fullText);
  }

  if (task.tags) {
    sm.broadcast('🏷️ 添加标签...', 'filling_tags');
    await i.clickElement(descSelector);
    await i.pressKey('End');
    for (const tag of task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 5)) {
      await i.typeText(`#${tag}`, { delay: 95 });
      await sleep(1500);
      await i.pressKey('Space');
      await sleep(500);
    }
  }

  if (task.coverPath) {
    sm.broadcast('🖼️ 设置封面...', 'setting_cover');
    try {
      await i.clickElement('.vertical-cover-wrap img, button:has-text("更换封面")');
      await sleep(1000);
      await i.clickElement('div.img-wrap > div, button:has-text("上传")');
      await i.setFileInput(task.coverPath);
      await sleep(2500);
      await i.flexibleClick(['确认', '完成']);
    } catch (e) {}
  }

  if (task.isOriginal) { sm.broadcast('📋 声明原创...', 'declaring_original'); await i.flexibleClick(['声明原创']); }

  if (task.dryRun) { sm.broadcast('🛑 【预览模式】任务圆满结束', 'completed'); return; }

  sm.broadcast('发表视频...', 'publishing');
  await i.clickElement('button:has-text("发表"), button:has-text("发布")');

  await Promise.race([
    i.waitForUrl(/post-list|success/, 35000),
    i.waitForSelector('text="发表成功"', 35000)
  ]).catch(() => {});
  sm.broadcast('✅ 微信视频号发布完成', 'completed');
}
