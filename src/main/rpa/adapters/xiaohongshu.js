/**
 * @file rpa/adapters/xiaohongshu.js
 * @title 小红书 Tier 3 保底适配器
 *
 * 直接加载并执行 resources/rpa-scripts/xiaohongshu.mjs 脚本。
 * 作为 ScriptManager 三级回退的最后一道保底。
 */

const { app } = require('electron');
const { join } = require('path');
const { existsSync } = require('fs');
const { pathToFileURL } = require('url');

function getBundledScriptPath() {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'rpa-scripts', 'xiaohongshu.mjs');
  }
  return join(app.getAppPath(), 'resources', 'rpa-scripts', 'xiaohongshu.mjs');
}

export class XiaohongshuAdapter {
  constructor(interactions, task, wc, broadcast) {
    this.i = interactions;
    this.task = task;
    this.wc = wc;
    this.broadcast = broadcast;
  }

  async execute() {
    const scriptPath = getBundledScriptPath();
    if (!existsSync(scriptPath)) {
      this.broadcast('❌ 内置小红书脚本文件缺失');
      throw new Error('内置脚本缺失: ' + scriptPath);
    }
    const fileUrl = pathToFileURL(scriptPath).href;
    const mod = await import(fileUrl);
    await mod.execute({
      interactions: this.i,
      task: this.task,
      wc: this.wc,
      broadcast: this.broadcast,
    });
  }
}
