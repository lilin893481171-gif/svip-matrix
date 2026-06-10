/**
 * @file rpa/adapters/wechat-channels.js
 * 微信视频号发布适配器
 */
const sleep = (ms) => {
  const jitter = ms * 0.1;
  return new Promise(resolve => setTimeout(resolve, ms + (Math.random() * jitter * 2 - jitter)));
};

export class WechatChannelsAdapter {
  constructor(interactions, task, wc, broadcast) {
    this.i = interactions; this.task = task; this.wc = wc; this.broadcast = broadcast;
  }

  async execute() {
    this.broadcast('🚀 导航至微信视频号...');
    await this.i.gentleCloseOverlays();

    await this.i.clickElement('button:has-text("发表视频"), [aria-label="发表视频"], .post-list-header button');
    await sleep(1500);

    await this.i.safeUpload(this.task.videoPath, ['上传视频', '点击上传']);

    const descSelector = '.input-editor, [contenteditable="true"]';
    await this.i.waitForSelector(descSelector, 45000);

    const titleSelector = 'input[placeholder*="标题"]';
    if (await this.i.isElementVisible(titleSelector)) {
      await this.i.humanType(titleSelector, this.task.title);
      await this.i.humanType(descSelector, this.task.desc || '');
    } else {
      const fullText = (this.task.title ? `【${this.task.title}】\n` : '') + (this.task.desc || '');
      await this.i.humanType(descSelector, fullText);
    }

    if (this.task.tags) {
      await this.i.clickElement(descSelector);
      await this.i.pressKey('End');
      for (const tag of this.task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 5)) {
        await this.i.typeText(`#${tag}`, { delay: 95 });
        await sleep(1500);
        await this.i.pressKey('Space');
        await sleep(500);
      }
    }

    if (this.task.coverPath) {
      try {
        await this.i.clickElement('.vertical-cover-wrap img, button:has-text("更换封面")');
        await sleep(1000);
        await this.i.clickElement('div.img-wrap > div, button:has-text("上传")');
        await this.i.setFileInput(this.task.coverPath);
        await sleep(2500);
        await this.i.flexibleClick(['确认', '完成']);
      } catch (e) {}
    }

    if (this.task.isOriginal) await this.i.flexibleClick(['声明原创']);

    await this.i.clickElement('button:has-text("发表"), button:has-text("发布")');

    await Promise.race([
      this.i.waitForUrl(/post-list|success/, 35000),
      this.i.waitForSelector('text="发表成功"', 35000)
    ]).catch(() => {});
  }
}
