/**
 * @file rpa/adapters/bilibili.js
 * B站发布适配器
 */
const sleep = (ms) => {
  const jitter = ms * 0.1;
  return new Promise(resolve => setTimeout(resolve, ms + (Math.random() * jitter * 2 - jitter)));
};

export class BilibiliAdapter {
  constructor(interactions, task, wc, broadcast) {
    this.i = interactions; this.task = task; this.wc = wc; this.broadcast = broadcast;
  }

  async execute() {
    this.broadcast('导航至B站...');
    await this.i.gentleCloseOverlays();
    await this.i.clickElement('#nav_upload_btn, button:has-text("投稿")');
    await sleep(1000);

    await this.i.flexibleClick(['视频投稿'], 2000);

    await this.i.safeUpload(this.task.videoPath, ['点击上传或将视频拖拽到此区域']);
    await this.i.flexibleClick(['知道了', '关闭']);

    const titleSelector = 'input[placeholder*="请输入稿件标题"]';
    await this.i.waitForSelector(titleSelector, 45000);

    await this.i.humanType(titleSelector, this.task.title);
    await this.i.humanType('.ql-editor', this.task.desc || '');

    if (this.task.coverPath) {
      try {
        await this.i.flexibleClick(['封面设置']);
        await sleep(500);
        await this.i.flexibleClick(['上传封面']);
        await this.i.setFileInput(this.task.coverPath);
        await sleep(2000);
        await this.i.flexibleClick(['完成', '确认']);
      } catch (e) {}
    }

    if (this.task.tags) {
      try {
        const tagSelector = 'input[placeholder*="按回车键"], .tag-input';
        await this.i.clickElement(tagSelector);
        for (const tag of this.task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 8)) {
          await this.i.humanType(tagSelector, tag);
          await this.i.pressKey('Enter');
          await sleep(500);
        }
      } catch (e) {}
    }

    if (this.task.isOriginal) {
      try {
        await this.i.flexibleClick(['更多设置', '展开更多']);
        await sleep(500);
        await this.i.flexibleClick(['自制', '声明原创']);
      } catch (e) {}
    }

    if (this.task.dryRun) { this.broadcast('🛑 预览模式完成'); return; }

    await this.i.clickElement('button:has-text("立即投稿"), button:has-text("发布")');
    await sleep(8000);
  }
}
