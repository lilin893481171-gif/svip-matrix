
const { app } = require('electron');
const path = require('path');

console.log('▶️  [FINAL TEST] 启动最终测试环境...');

// 直接引用构建后的主入口文件，它导出了所有需要的模块
const { registerRPAEngineIPC, taskManager } = require('./out/main/index.js');

// 模拟一个 app-ready 事件来注册 IPC 监听器
app.on('ready', () => {
  console.log('▶️  [FINAL TEST] Electron App is ready, registering IPC...');
  registerRPAEngineIPC();

  const testTask = {
    platform: '小红书',
    accountId: 'test-account-001',
    historyId: `test-history-${Date.now()}`,
    taskId: `test-task-${Date.now()}`,
    videoId: 'test-video-id',
    videoPath: path.join(__dirname, 'test-video.mp4'),
    coverPath: path.join(__dirname, 'test-cover.jpg'),
    title: '【最终测试】这是一个测试标题',
    desc: '这是一个由最终测试脚本发出的描述内容。',
    tags: '测试,最终,自动化',
    scheduleTime: null,
    isOriginal: true
  };

  console.log('\n--- [FINAL TEST] 触发小红书发布任务 --- ');
  taskManager.addTask(testTask);

  setTimeout(() => {
    console.log('\n--- [FINAL TEST] 测试结束，退出进程 --- ');
    app.quit();
  }, 60000);
});

// 模拟 Electron app 的启动
try {
  app.emit('ready');
} catch (e) {
  console.error('❌ [FINAL TEST] 启动失败:', e);
  process.exit(1);
}
