/**
 * @file rpa-scripts/bilibili.mjs
 * B站发布脚本 — 独立可更新模块
 */
export const meta = {
  platform: 'B站',
  version: 1,
  minAppVersion: '2.0.0'
};

export async function execute(api) {
  const { interactions: i, task, wc, broadcast, sleep, statusManager } = api;
  const sm = statusManager || { broadcast: (msg) => broadcast(msg) };

  sm.broadcast('导航至B站...', 'navigating');
  await i.gentleCloseOverlays();
  await i.clickElement('#nav_upload_btn, button:has-text("投稿")');
  await sleep(1000);

  sm.broadcast('选择视频投稿...', 'scanning_ui');
  await i.flexibleClick(['视频投稿'], 2000);

  if (task.videoPath) {
    sm.broadcast('准备注入媒体文件...', 'preparing_upload');
    await i.safeUpload(task.videoPath, ['点击上传或将视频拖拽到此区域']);
  }
  await i.flexibleClick(['知道了', '关闭']);

  sm.broadcast('等待B站解析...', 'verifying_upload');
  const titleSelector = 'input[placeholder*="请输入稿件标题"]';
  await i.waitForSelector(titleSelector, 45000);

  sm.broadcast('📝 填写标题...', 'filling_title');
  await i.humanType(titleSelector, task.title);
  sm.broadcast('📝 填写描述...', 'filling_desc');
  await i.humanType('.ql-editor', task.desc || '');

  if (task.coverPath) {
    sm.broadcast('🖼️ 设置封面...', 'setting_cover');
    try {
      await i.flexibleClick(['封面设置']);
      await sleep(500);
      await i.flexibleClick(['上传封面']);
      await i.setFileInput(task.coverPath);
      await sleep(2000);
      await i.flexibleClick(['完成', '确认']);
    } catch (e) {}
  }

  if (task.tags) {
    sm.broadcast('🏷️ 添加标签...', 'filling_tags');
    try {
      const tagSelector = 'input[placeholder*="按回车键"], .tag-input';
      await i.clickElement(tagSelector);
      for (const tag of task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 8)) {
        await i.humanType(tagSelector, tag);
        await i.pressKey('Enter');
        await sleep(500);
      }
    } catch (e) {}
  }

  if (task.isOriginal) {
    sm.broadcast('📋 声明原创...', 'declaring_original');
    try {
      await i.flexibleClick(['更多设置', '展开更多']);
      await sleep(500);
      await i.flexibleClick(['自制', '声明原创']);
    } catch (e) {}
  }

  if (task.dryRun) { sm.broadcast('🛑 预览模式完成', 'completed'); return; }

  sm.broadcast('立即投稿...', 'publishing');
  await i.clickElement('button:has-text("立即投稿"), button:has-text("发布")');
  await sleep(8000);
  sm.broadcast('✅ B站发布完成', 'completed');
}
