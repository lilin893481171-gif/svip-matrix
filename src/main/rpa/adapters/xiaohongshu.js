/**
 * @file rpa/adapters/xiaohongshu.js
 * 小红书发布适配器
 */
import { VisionAgent } from '../../vision-agent.js';

const sleep = (ms, wc = null) => {
  const jitter = ms * 0.1;
  const finalMs = ms + (Math.random() * jitter * 2 - jitter);
  return Promise.race([
    new Promise(resolve => setTimeout(resolve, finalMs)),
    ...(wc ? [new Promise((_, reject) => {
      if (wc.isDestroyed()) reject(new Error('浏览器强制中断'));
      else wc.once('destroyed', () => reject(new Error('浏览器强制中断')));
    })] : [])
  ]);
};

export class XiaohongshuAdapter {
  constructor(interactions, task, wc, broadcast) {
    this.i = interactions; this.task = task; this.wc = wc; this.broadcast = broadcast;
  }

  async execute() {
    this.broadcast('导航至小红书...');
    await this.i.gentleCloseOverlays();

    this.broadcast('强行突破，直达发布台...');
    await this.i.navigate('https://creator.xiaohongshu.com/publish/publish').catch(() => {});
    await sleep(3000);

    await this.i.flexibleClick(['视频'], 2000);
    await sleep(1500);

    this.broadcast('准备注入媒体文件...');

    let uploadSuccess = false;
    try {
      await this.i.safeUpload(this.task.videoPath, ['点击上传', '拖拽', '拖拽视频', '上传文件']);
      uploadSuccess = true;
    } catch (e) {
      this.broadcast('⚠️ DOM 节点失效！启动 VLM 视觉大模型介入...');
      const visionAgent = new VisionAgent(this.wc, this.i);
      const visionRes = await visionAgent.executeIntent("寻找并点击画面中央的'上传视频'或'点击上传'的虚线框区域");
      if (visionRes) {
        await sleep(1000);
        uploadSuccess = await this.i.setFileInput(this.task.videoPath);
        if (uploadSuccess) this.broadcast('🎯 视觉介入成功！视频已塞入容器...');
      }
    }

    if (!uploadSuccess) {
      throw new Error("视觉入口破拆失败，请点击【手动控制】手工处理！");
    }

    this.broadcast('等待小红书解析...');
    const titleSelector = 'div.publish-page-content-base input, input[placeholder*="标题"], input.title-input';
    const found = await this.i.waitForSelector(titleSelector, 45000);
    if (!found) throw new Error("等待标题输入框超时。可能遇到滑块验证码或页面异动，请手动控制！");

    await this.i.humanType(titleSelector, this.task.title);
    const descSelector = 'div.editor-content > div > div, .ql-editor, [contenteditable="true"]';
    await this.i.humanType(descSelector, this.task.desc || '');

    if (this.task.tags) {
      await this.i.clickElement(descSelector);
      await this.i.pressKey('End');
      for (const tag of this.task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 6)) {
        await this.i.typeText(`#${tag}`, { delay: 90 });
        await sleep(1500);
        const capsuleBox = await this.i.getBoundingBox(`div.is-selected > span.name, .tag-item`);
        if (capsuleBox) {
          await this.i.mouseClick(capsuleBox.x + capsuleBox.width / 2, capsuleBox.y + capsuleBox.height / 2);
        } else {
          await this.i.pressKey('Enter');
        }
        await sleep(500);
      }
    }

    if (this.task.coverPath) {
      try {
        if (await this.i.flexibleClick(['修改封面', '设置封面'])) {
          await sleep(1000);
          await this.i.flexibleClick(['上传封面']);
          await this.i.setFileInput(this.task.coverPath);
          await sleep(2500);
          await this.i.flexibleClick(['确定', '完成', '确认']);
        }
      } catch (e) {}
    }

    if (this.task.poi) {
      try {
        if (await this.i.flexibleClick(['添加地点', '添加位置'])) {
          await sleep(1000);
          await this.i.humanType('input[placeholder*="地点"], input[placeholder*="位置"]', this.task.poi);
          await sleep(2000);
          await this.i.clickElement('.poi-suggest li, .dropdown-item, .poi-item');
        }
      } catch (e) {}
    }

    if (this.task.isOriginal) {
      try {
        if (await this.i.flexibleClick(['声明原创'])) {
          await sleep(1000);
          await this.i.flexibleClick(['确定', '确认', '知道了']);
        }
      } catch (e) {}
    }

    if (this.task.dryRun) { this.broadcast('🛑 预览模式完成'); return; }

    this.broadcast('执行最终发布...');
    await this.i.clickElement('button.bg-red span, button.bg-red, button:has-text("发布")');
    await sleep(8000);
  }
}
