/**
 * @file rpa-scripts/douyin.mjs
 * 抖音发布脚本 — 独立可更新模块
 */
export const meta = {
  platform: '抖音',
  version: 1,
  minAppVersion: '2.0.0'
};

export async function execute(api) {
  const { interactions: i, task, wc, broadcast, sleep, statusManager } = api;
  const sm = statusManager || { broadcast: (msg) => broadcast(msg) };

  sm.broadcast('导航至抖音，开始模拟真人发布...', 'navigating');
  await i.gentleCloseOverlays();

  sm.broadcast('正在寻找发布入口...', 'scanning_ui');
  const btnClicked = await i.flexibleClick(['发布视频', '上传视频', '发图文', '发日常', '发布'], 15000);
  if (!btnClicked) throw new Error("主页找不到发布入口。若卡在验证码，请点击【手动控制】！");
  await sleep(1500);

  if (task.videoPath) {
    sm.broadcast('准备注入媒体文件...', 'preparing_upload');
    await i.safeUpload(task.videoPath, ['上传视频', '点击上传']);
  }

  sm.broadcast('等待抖音解析...', 'verifying_upload');
  const titleSelector = 'input[placeholder*="标题"], input.semi-input';
  let isReady = false;
  for (let j = 0; j < 15; j++) {
    if (await i.isElementVisible(titleSelector)) { isReady = true; break; }
    await i.randomWander();
  }
  if (!isReady) throw new Error("抖音编辑器未加载。请点击手动控制查看！");

  sm.broadcast('📝 填写标题...', 'filling_title');
  await i.humanType(titleSelector, task.title);
  sm.broadcast('📝 填写描述...', 'filling_desc');
  const descSelector = '.content-left-F3wKrk, .zone-container, [contenteditable="true"]';
  await i.humanType(descSelector, task.desc || '');

  if (task.tags) {
    sm.broadcast('🏷️ 添加标签...', 'filling_tags');
    await i.clickElement(descSelector);
    await i.pressKey('End');
    for (const tag of task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 6)) {
      await i.typeText(`#${tag}`, { delay: 90 });
      await sleep(1200);
      await i.pressKey('Space');
      await sleep(500);
    }
  }

  if (task.coverPath) {
    sm.broadcast('🖼️ 设置封面...', 'setting_cover');
    try {
      if (await i.flexibleClick(['设置封面'])) {
        await sleep(1000);
        await i.flexibleClick(['上传封面', '本地上传']);
        await i.setFileInput(task.coverPath);
        await sleep(3000);
        await i.flexibleClick(['确定', '完成', '保存']);
      }
    } catch (e) {}
  }

  if (task.poi) {
    sm.broadcast('📍 添加地点...', 'adding_poi');
    try {
      if (await i.flexibleClick(['添加地点', '位置'])) {
        await i.humanType('input[placeholder*="地点"], .search-input', task.poi);
        await sleep(1500);
        await i.clickElement('.suggest-list li, .dropdown-item');
      }
    } catch (e) {}
  }

  if (task.syncToutiao) await i.flexibleClick(['同步至今日头条']);
  if (task.isOriginal) {
    sm.broadcast('📋 声明原创...', 'declaring_original');
    await i.flexibleClick(['声明原创']);
  }

  if (task.dryRun) { sm.broadcast('🛑 预览模式完成！', 'completed'); return; }

  sm.broadcast('点火发布...', 'publishing');
  await i.clickElement('button:has-text("发布")');
  await Promise.race([
    i.waitForUrl(/creator-micro\/manage/, 30000),
    i.waitForSelector('text="发布成功"', 30000)
  ]).catch(() => {});
  sm.broadcast('✅ 抖音发布完成', 'completed');
}
