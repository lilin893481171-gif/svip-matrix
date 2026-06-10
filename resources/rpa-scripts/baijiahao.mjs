/**
 * @file rpa-scripts/baijiahao.mjs
 * 百家号发布脚本 — 独立可更新模块
 */
export const meta = {
  platform: '百家号',
  version: 1,
  minAppVersion: '2.0.0'
};

export async function execute(api) {
  const { interactions: i, task, wc, broadcast, sleep, statusManager } = api;
  const sm = statusManager || { broadcast: (msg) => broadcast(msg) };

  sm.broadcast('导航至百家号...', 'navigating');
  await i.gentleCloseOverlays();
  await i.flexibleClick(['发布作品', '发动态']);
  await sleep(1500);
  await i.flexibleClick(['我知道了', '关闭']);

  sm.broadcast('准备注入媒体文件...', 'preparing_upload');
  const videoTabBox = await i.getBoundingBox('div.header-list-content > div:nth-of-type(2)');
  if (videoTabBox || await i.flexibleClick(['上传视频'], 2000)) {
    // 已切换或已在上传页
  }

  if (task.videoPath) {
    await i.safeUpload(task.videoPath, ['点击上传', '上传视频']);
  }

  sm.broadcast('等待页面加载...', 'verifying_upload');
  const editorSelector = 'div._872ce91b1b159b92-editorArea, .editorArea';
  await i.waitForSelector(editorSelector, 45000);

  sm.broadcast('📝 填写发布信息...', 'filling_form');
  const titleSelector = 'input.ant-input, input[placeholder*="标题"]';
  if (await i.isElementVisible(titleSelector)) {
    await i.humanType(titleSelector, task.title);
    await i.humanType(editorSelector, task.desc || '');
  } else {
    const full = (task.title ? `【${task.title}】\n` : '') + (task.desc || '');
    await i.humanType(editorSelector, full);
  }

  if (task.tags) {
    sm.broadcast('🏷️ 添加标签...', 'filling_tags');
    await i.clickElement(editorSelector);
    await i.pressKey('End');
    for (const tag of task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 6)) {
      await i.typeText(`#${tag}`, { delay: 90 });
      await sleep(1500);
      const capBox = await i.getBoundingBox('div._7f4b1b4997b77e51-topicName');
      if (capBox) {
        await i.mouseClick(capBox.x + capBox.width / 2, capBox.y + capBox.height / 2);
      } else {
        await i.pressKey('Enter');
      }
    }
  }

  if (task.coverPath) {
    sm.broadcast('🖼️ 设置封面...', 'setting_cover');
    try {
      await i.clickElement('[data-testid="cover-preview"], button:has-text("设置封面")');
      await sleep(1000);
      await i.flexibleClick(['本地上传']);
      await i.setFileInput(task.coverPath);
      await sleep(2500);
      await i.flexibleClick(['确定', '裁剪确认', '完成']);
    } catch (e) {}
  }

  try {
    await i.flexibleClick(['展开更多高级设置', '高级设置']);
    await sleep(500);
    if (task.isOriginal) { sm.broadcast('📋 声明原创...', 'declaring_original'); await i.flexibleClick(['声明原创', '原创声明']); }
    if (task.syncToutiao) await i.flexibleClick(['同步', '分发']);
  } catch (e) {}

  if (task.dryRun) { sm.broadcast('🛑 预览模式完成', 'completed'); return; }

  sm.broadcast('发布作品...', 'publishing');
  await i.clickElement('[data-testid="publish-btn"], button:has-text("发布")');
  await sleep(8000);
  sm.broadcast('✅ 百家号发布完成', 'completed');
}
