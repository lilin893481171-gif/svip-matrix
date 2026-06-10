/**
 * @file rpa/adapters/kuaishou.js
 * 快手发布适配器
 */
const sleep = (ms) => {
  const jitter = ms * 0.1;
  return new Promise(resolve => setTimeout(resolve, ms + (Math.random() * jitter * 2 - jitter)));
};

export class KuaishouAdapter {
  constructor(interactions, task, wc, broadcast) {
    this.i = interactions; this.task = task; this.wc = wc; this.broadcast = broadcast;
  }

  async execute() {
    this.broadcast('导航至快手...');
    await this.i.gentleCloseOverlays();
    await this.i.clickElement('div.publish-button span');
    await sleep(1000);
    await this.i.clickElement('div.publish-button__menu > div:nth-of-type(1)');

    await this.i.safeUpload(this.task.videoPath, ['上传视频']);

    this.broadcast('探测新手引导...');
    for (let i = 0; i < 5; i++) {
      const clicked = await this.i.flexibleClick(['下一步', '立刻体验'], 2000);
      if (!clicked) break;
      await sleep(500);
    }

    const descSelector = '#work-description-edit';
    await this.i.waitForSelector(descSelector, 45000);

    const fullText = (this.task.title ? `【${this.task.title}】\n` : '') + (this.task.desc || '');
    await this.i.humanType(descSelector, fullText);

    if (this.task.tags) {
      await this.i.clickElement(descSelector);
      await this.i.pressKey('End');
      for (const tag of this.task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 6)) {
        await this.i.typeText(`#${tag}`, { delay: 90 });
        await sleep(1200);
        await this.i.pressKey('Enter');
      }
    }

    if (this.task.coverPath) {
      try {
        await this.i.clickElement('div._cropper_1i0wh_12 button, button:has-text("编辑封面")');
        await sleep(1000);
        await this.i.flexibleClick(['上传封面', '本地上传']);
        await this.i.setFileInput(this.task.coverPath);
        await sleep(2500);
        await this.i.flexibleClick(['确认', '确定']);
      } catch (e) {}
    }

    if (this.task.poi || this.task.productLink) {
      try {
        const payload = this.task.poi || this.task.productLink;
        await this.i.clickElement('#rc_select_5, text=关联');
        await sleep(1000);
        await this.i.typeText(payload);
        await sleep(1500);
        await this.i.pressKey('Enter');
      } catch (e) {}
    }

    this.broadcast('发布...');
    await this.i.clickElement('div._button-primary_3a3lq_60 > div, button:has-text("发布")');
    await sleep(8000);
  }
}
