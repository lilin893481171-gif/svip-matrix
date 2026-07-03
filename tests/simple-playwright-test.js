/**
 * @file simple-playwright-test.js
 * 简单的 Playwright 执行器测试脚本
 */

import { PlaywrightExecutor } from './src/main/playwright/PlaywrightExecutor.js';

console.log('🚀 启动 Playwright 执行器简单测试...');

// 创建一个测试任务
const testTask = {
  taskId: "test_task_001",
  historyId: "test_hist_001",
  platform: "小红书",
  accountId: "test_account_001",
  accountAlias: "测试账号",
  title: "测试视频标题",
  desc: "这是一个测试视频的描述",
  videoPath: "D:/test_video.mp4"  // 这个路径在实际测试时需要存在
};

// 创建执行器
const executor = new PlaywrightExecutor({
  accountId: testTask.accountId,
  platform: testTask.platform,
  taskData: testTask,
  onProgress: (progress, message) => {
    console.log(`[进度 ${progress}%] ${message}`);
  },
  onLog: (message) => {
    console.log(`[日志] ${message}`);
  }
});

// 执行测试
async function runSimpleTest() {
  try {
    console.log('🔧 开始执行简单测试...');

    // 检查执行器状态
    console.log('状态检查:', executor.getStatus());

    // 尝试启动浏览器（这会需要一些时间）
    console.log('正在启动浏览器...');
    await executor._launchBrowser();

    // 检查状态
    console.log('启动后状态:', executor.getStatus());

    // 简单等待几秒
    console.log('等待 5 秒...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 清理资源
    console.log('正在清理资源...');
    await executor._cleanup();

    console.log('✅ 简单测试完成!');

  } catch (error) {
    console.error('💥 测试过程中发生异常:', error);
  }
}

// 运行测试
runSimpleTest().then(() => {
  console.log('🏁 测试脚本执行完毕');
  process.exit(0);
}).catch(error => {
  console.error('💥 测试脚本执行失败:', error);
  process.exit(1);
});