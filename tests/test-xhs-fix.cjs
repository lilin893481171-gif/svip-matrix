/**
 * @file test-xhs-fix.cjs
 * 测试小红书发布脚本修复
 */

const { app, BrowserWindow } = require('electron');
const { ScriptManager } = require('./src/main/rpa/script-manager.js');
const { BrowserController } = require('./src/main/rpa/browser-controller.js');
const { join } = require('path');
const { existsSync } = require('fs');

console.log('🧪 测试小红书发布脚本修复...');

// 检查测试文件
const testVideo = join(__dirname, 'test-video.mp4');
const testCover = join(__dirname, 'test-cover.jpg');

if (!existsSync(testVideo) || !existsSync(testCover)) {
  console.error('❌ 缺少测试文件，请确保 test-video.mp4 和 test-cover.jpg 存在');
  process.exit(1);
}

console.log('✅ 测试文件检查通过');

// 模拟任务数据
const mockTask = {
  taskId: 'test_task_123',
  historyId: 'hist_456',
  videoId: 'video_789',
  platform: '小红书',
  accountId: 'test_account',
  title: '测试视频标题',
  desc: '这是一个测试视频描述',
  tags: '测试,视频',
  videoPath: testVideo,
  coverPath: testCover,
  scheduled: false,
  scheduleTime: '',
  copyright: 1
};

// 模拟 API 对象
const mockApi = {
  interactions: {
    // 简化的交互方法
    navigate: async (url) => {
      console.log(`🧭 导航到: ${url}`);
    },
    evaluate: async (script) => {
      console.log(`🖥️ 执行脚本: ${script.substring(0, 100)}...`);
      return true;
    }
  },
  task: mockTask,
  broadcast: (message) => {
    console.log(`📢 ${message}`);
  },
  sleep: async (ms) => {
    console.log(`⏳ 等待 ${ms}ms`);
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  pauseForManualStep: null
};

async function runTest() {
  try {
    console.log('\n🚀 开始测试小红书脚本...');

    // 初始化脚本管理器
    ScriptManager.init();
    console.log('✅ 脚本管理器初始化完成');

    // 尝试加载小红书脚本
    const mod = await ScriptManager['#loadScript']('小红书');
    console.log('✅ 小红书脚本加载成功');
    console.log(`📋 脚本版本: v${mod.meta?.version || 'unknown'}`);

    // 检查 execute 方法
    if (typeof mod.execute === 'function') {
      console.log('✅ execute 方法存在');
    } else {
      console.error('❌ execute 方法不存在');
      return;
    }

    console.log('\n🎉 测试完成！');
    console.log('💡 请重启应用并重新测试小红书发布任务');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
runTest().catch(console.error);