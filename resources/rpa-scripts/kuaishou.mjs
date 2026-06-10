/**
 * @file rpa-scripts/kuaishou.mjs
 * 快手发布脚本 — 独立可更新模块
 */
export const meta = {
  platform: '快手',
  version: 1,
  minAppVersion: '2.0.0'
};

export async function execute(api) {
  const { interactions: i, task, wc, broadcast, sleep, statusManager } = api;
  const sm = statusManager || { broadcast: (msg) => broadcast(msg) };

  sm.broadcast('导航至快手...', 'navigating');
  await i.gentleCloseOverlays();
  await i.clickElement('div.publish-button span');
  await sleep(1000);
  await i.clickElement('div.publish-button__menu > div:nth-of-type(1)');

  if (task.videoPath) {
    sm.broadcast('准备注入媒体文件...', 'preparing_upload');
    await i.safeUpload(task.videoPath, ['上传视频']);
  }

  sm.broadcast('探测新手引导...', 'scanning_ui');
  for (let n = 0; n < 5; n++) {
    const clicked = await i.flexibleClick(['下一步', '立刻体验'], 2000);
    if (!clicked) break;
    await sleep(500);
  }

  const descSelector = '#work-description-edit';
  await i.waitForSelector(descSelector, 45000);

  sm.broadcast('📝 填写发布信息...', 'filling_form');
  const fullText = (task.title ? `【${task.title}】\n` : '') + (task.desc || '');
  await i.humanType(descSelector, fullText);

  if (task.tags) {
    sm.broadcast('🏷️ 添加标签...', 'filling_tags');
    await i.clickElement(descSelector);
    await i.pressKey('End');
    for (const tag of task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 6)) {
      await i.typeText(`#${tag}`, { delay: 90 });
      await sleep(1200);
      await i.pressKey('Enter');
    }
  }

  if (task.coverPath) {
    sm.broadcast('🖼️ 设置封面...', 'setting_cover');
    try {
      await i.clickElement('div._cropper_1i0wh_12 button, button:has-text("编辑封面")');
      await sleep(1000);
      await i.flexibleClick(['上传封面', '本地上传']);
      await i.setFileInput(task.coverPath);
      await sleep(2500);
      await i.flexibleClick(['确认', '确定']);
    } catch (e) {}
  }

  if (task.poi || task.productLink) {
    sm.broadcast('📍 添加关联...', 'adding_poi');
    try {
      const payload = task.poi || task.productLink;
      await i.clickElement('#rc_select_5, text=关联');
      await sleep(1000);
      await i.typeText(payload);
      await sleep(1500);
      await i.pressKey('Enter');
    } catch (e) {}
  }

  if (task.dryRun) { sm.broadcast('🛑 预览模式完成', 'completed'); return; }

  sm.broadcast('发布...', 'publishing');
  await i.clickElement('div._button-primary_3a3lq_60 > div, button:has-text("发布")');
  await sleep(8000);
  sm.broadcast('✅ 快手发布完成', 'completed');
}
