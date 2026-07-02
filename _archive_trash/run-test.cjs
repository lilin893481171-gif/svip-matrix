
const { app, ipcMain } = require('electron');
const path = require('path');

// 确保能正确解析模块
const mainPath = path.join(__dirname, 'out', 'main');
process.env.NODE_PATH = [mainPath, path.join(__dirname, 'node_modules')].join(path.delimiter);
require('module').Module._initPaths();

console.log('▶️  [TEST RUNNER] 启动测试环境...');

// 延迟加载，确保路径设置生效
const { registerRPAEngineIPC, taskManager } = require('./out/main/rpa-engine.js');

// 模拟一个 app-ready 事件来注册 IPC 监听器
app.on('ready', () => {
  console.log('▶️  [TEST RUNNER] Electron App is ready, registering IPC...');
  registerRPAEngineIPC();

  const testTask = {
    platform: '小红书',
    accountId: 'test-account-001',
    historyId: `test-history-${Date.now()}`,
    taskId: `test-task-${Date.now()}`,
    videoId: 'test-video-id',
    videoPath: path.join(__dirname, 'test-video.mp4'), // 使用绝对路径
    coverPath: path.join(__dirname, 'test-cover.jpg'), // 使用绝对路径
    title: '【混合模式】这是一个测试标题',
    desc: '这是一个由自动化测试脚本发出的描述内容。',
    tags: '测试,混合模式,自动化',
    scheduleTime: null,
    isOriginal: true
  };

  console.log('\n--- [TEST RUNNER] 触发小红书发布任务 --- ');
  // 直接调用 taskManager，这是最核心的入口
  taskManager.addTask(testTask);

  // 设置一个定时器，在测试结束后自动退出
  setTimeout(() => {
    console.log('\n--- [TEST RUNNER] 测试结束，退出进程 --- ');
    app.quit();
  }, 60000); // 1分钟后自动退出
});

// 模拟 Electron app 的启动
try {
  app.emit('ready');
} catch (e) {
  console.error('❌ [TEST RUNNER] 启动失败:', e);
  process.exit(1);
}
