/**
 * @file rpa/adapters/baijiahao.js
 * 百家号发布适配器
 */
const sleep = (ms) => {
  const jitter = ms * 0.1;
  return new Promise(resolve => setTimeout(resolve, ms + (Math.random() * jitter * 2 - jitter)));
};

export class BaijiahaoAdapter {
  constructor(interactions, task, wc, broadcast) {
    this.i = interactions; this.task = task; this.wc = wc; this.broadcast = broadcast;
  }

  async execute() {
    this.broadcast('导航至百家号...');
    await this.i.gentleCloseOverlays();
    await this.i.flexibleClick(['发布作品', '发动态']);
    await sleep(1500);
    await this.i.flexibleClick(['我知道了', '关闭']);

    const videoTabBox = await this.i.getBoundingBox('div.header-list-content > div:nth-of-type(2)');
    if (videoTabBox || await this.i.flexibleClick(['上传视频'], 2000)) {
      // 已切换或已在上传页
    }

    await this.i.safeUpload(this.task.videoPath, ['点击上传', '上传视频']);

    const editorSelector = 'div._872ce91b1b159b92-editorArea, .editorArea';
    await this.i.waitForSelector(editorSelector, 45000);

    const titleSelector = 'input.ant-input, input[placeholder*="标题"]';
    if (await this.i.isElementVisible(titleSelector)) {
      await this.i.humanType(titleSelector, this.task.title);
      await this.i.humanType(editorSelector, this.task.desc || '');
    } else {
      const full = (this.task.title ? `【${this.task.title}】\n` : '') + (this.task.desc || '');
      await this.i.humanType(editorSelector, full);
    }

    if (this.task.tags) {
      await this.i.clickElement(editorSelector);
      await this.i.pressKey('End');
      for (const tag of this.task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 6)) {
        await this.i.typeText(`#${tag}`, { delay: 90 });
        await sleep(1500);
        const capBox = await this.i.getBoundingBox('div._7f4b1b4997b77e51-topicName');
        if (capBox) {
          await this.i.mouseClick(capBox.x + capBox.width / 2, capBox.y + capBox.height / 2);
        } else {
          await this.i.pressKey('Enter');
        }
      }
    }

    if (this.task.coverPath) {
      try {
        await this.i.clickElement('[data-testid="cover-preview"], button:has-text("设置封面")');
        await sleep(1000);
        await this.i.flexibleClick(['本地上传']);
        await this.i.setFileInput(this.task.coverPath);
        await sleep(2500);
        await this.i.flexibleClick(['确定', '裁剪确认', '完成']);
      } catch (e) {}
    }

    try {
      await this.i.flexibleClick(['展开更多高级设置', '高级设置']);
      await sleep(500);
      if (this.task.isOriginal) await this.i.flexibleClick(['声明原创', '原创声明']);
      if (this.task.syncToutiao) await this.i.flexibleClick(['同步', '分发']);
    } catch (e) {}

    if (this.task.dryRun) { this.broadcast('🛑 预览模式完成'); return; }

    await this.i.clickElement('[data-testid="publish-btn"], button:has-text("发布")');
    await sleep(8000);
  }
}
