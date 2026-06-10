/**
 * @file rpa/adapters/douyin.js
 * 抖音发布适配器
 */
const sleep = (ms) => {
  const jitter = ms * 0.1;
  return new Promise(resolve => setTimeout(resolve, ms + (Math.random() * jitter * 2 - jitter)));
};

export class DouyinAdapter {
  constructor(interactions, task, wc, broadcast) {
    this.i = interactions; this.task = task; this.wc = wc; this.broadcast = broadcast;
  }

  async execute() {
    this.broadcast('导航至抖音，开始模拟真人发布...');
    await this.i.gentleCloseOverlays();

    this.broadcast('正在寻找发布入口...');
    const btnClicked = await this.i.flexibleClick(['发布视频', '上传视频', '发图文', '发日常', '发布'], 15000);
    if (!btnClicked) throw new Error("主页找不到发布入口。若卡在验证码，请点击【手动控制】！");
    await sleep(1500);

    await this.i.safeUpload(this.task.videoPath, ['上传视频', '点击上传']);

    this.broadcast('等待抖音解析...');
    const titleSelector = 'input[placeholder*="标题"], input.semi-input';
    let isReady = false;
    for (let i = 0; i < 15; i++) {
      if (await this.i.isElementVisible(titleSelector)) { isReady = true; break; }
      await this.i.randomWander();
    }
    if (!isReady) throw new Error("抖音编辑器未加载。请点击手动控制查看！");

    await this.i.humanType(titleSelector, this.task.title);
    const descSelector = '.content-left-F3wKrk, .zone-container, [contenteditable="true"]';
    await this.i.humanType(descSelector, this.task.desc || '');

    if (this.task.tags) {
      await this.i.clickElement(descSelector);
      await this.i.pressKey('End');
      for (const tag of this.task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 6)) {
        await this.i.typeText(`#${tag}`, { delay: 90 });
        await sleep(1200);
        await this.i.pressKey('Space');
        await sleep(500);
      }
    }

    if (this.task.coverPath) {
      try {
        if (await this.i.flexibleClick(['设置封面'])) {
          await sleep(1000);
          await this.i.flexibleClick(['上传封面', '本地上传']);
          await this.i.setFileInput(this.task.coverPath);
          await sleep(3000);
          await this.i.flexibleClick(['确定', '完成', '保存']);
        }
      } catch (e) {}
    }

    if (this.task.poi) {
      try {
        if (await this.i.flexibleClick(['添加地点', '位置'])) {
          await this.i.humanType('input[placeholder*="地点"], .search-input', this.task.poi);
          await sleep(1500);
          await this.i.clickElement('.suggest-list li, .dropdown-item');
        }
      } catch (e) {}
    }

    if (this.task.syncToutiao) await this.i.flexibleClick(['同步至今日头条']);
    if (this.task.isOriginal) await this.i.flexibleClick(['声明原创']);

    this.broadcast('点火发布...');
    await this.i.clickElement('button:has-text("发布")');
    await Promise.race([
      this.i.waitForUrl(/creator-micro\/manage/, 30000),
      this.i.waitForSelector('text="发布成功"', 30000)
    ]).catch(() => {});
  }
}
