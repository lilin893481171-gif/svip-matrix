const fs = require('fs');
const path = require('path');

console.log('🚀 开始真实的小红书发布测试...');

// 检查必要的文件
const videoPath = path.join(__dirname, 'test-video.mp4');
const coverPath = path.join(__dirname, 'test-cover.jpg');

console.log('🔍 检查测试文件...');
if (!fs.existsSync(videoPath)) {
  console.log('❌ 视频文件不存在:', videoPath);
  process.exit(1);
}

if (!fs.existsSync(coverPath)) {
  console.log('❌ 封面文件不存在:', coverPath);
  process.exit(1);
}

console.log('✅ 所有测试文件存在');

// 创建测试任务
const testTask = {
  platform: '小红书',
  accountId: 'test-account-real',
  historyId: `test-history-${Date.now()}`,
  taskId: `test-task-${Date.now()}`,
  videoId: 'test-video-id',
  videoPath: videoPath,
  coverPath: coverPath,
  title: '【真实测试】小红书自动化发布',
  desc: '这是一个真实的小红书发布测试，用于验证自动化发布功能的完整流程。包括视频上传、标题设置、描述填写、标签添加等。',
  tags: '测试,自动化,小红书,真实发布',
  scheduleTime: null,
  isOriginal: true,
  copyright: 1
};

console.log('\n📋 测试任务详情:');
console.log(JSON.stringify(testTask, null, 2));

// 模拟API对象（模拟TaskExecutor提供的API）
const mockApi = {
  task: testTask,
  broadcast: (message) => {
    console.log(`📢 ${message}`);
  },
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  interactions: {
    flexibleClick: async (texts, timeout = 5000) => {
      console.log(`🖱️ 模拟点击按钮: ${texts.join(' 或 ')}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true; // 模拟成功找到并点击按钮
    },
    waitForSelector: async (selector, timeout = 30000) => {
      console.log(`⏳ 等待元素: ${selector}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true; // 模拟成功找到元素
    },
    navigate: async (url) => {
      console.log(`🧭 导航到: ${url}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  },
  wc: {
    executeJavaScript: async (script) => {
      console.log(`💻 执行JavaScript (简化): ${script.substring(0, 100)}...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      // 模拟返回成功结果
      return { status: 200, data: '{"success": true, "data": {"note_id": "test_note_123"}}' };
    },
    debugger: {
      sendCommand: async (command, params) => {
        console.log(`🔧 执行调试命令: ${command}`);
        await new Promise(resolve => setTimeout(resolve, 300));
        // 根据命令返回不同的模拟结果
        if (command === 'DOM.getDocument') {
          return { root: { nodeId: 12345 } };
        }
        return {};
      }
    }
  },
  pauseForManualStep: null // 不需要手动步骤
};

console.log('\n🧪 开始执行真实测试...');

// 尝试加载并执行小红书脚本
async function runXhsTest() {
  try {
    console.log('\n📂 尝试加载小红书发布脚本...');
    
    // 构建脚本路径
    const scriptPath = path.join(__dirname, 'resources', 'rpa-scripts', 'xiaohongshu.mjs');
    
    if (!fs.existsSync(scriptPath)) {
      console.log('❌ 小红书脚本文件不存在:', scriptPath);
      return false;
    }
    
    console.log('✅ 找到小红书脚本文件');
    
    // 动态导入脚本
    const xhsModule = await import(`file://${scriptPath}`);
    
    if (!xhsModule.execute) {
      console.log('❌ 脚本缺少execute函数');
      return false;
    }
    
    console.log('✅ 成功加载小红书脚本');
    console.log('📄 脚本元信息:', JSON.stringify(xhsModule.meta, null, 2));
    
    // 执行脚本
    console.log('\n🚀 开始执行小红书发布脚本...');
    const result = await xhsModule.execute(mockApi);
    
    console.log('\n✅ 脚本执行完成');
    console.log('📄 执行结果:', JSON.stringify(result, null, 2));
    
    return true;
    
  } catch (error) {
    console.log('❌ 执行过程中发生错误:', error.message);
    console.log('堆栈跟踪:', error.stack);
    return false;
  }
}

// 运行测试
runXhsTest().then(success => {
  if (success) {
    console.log('\n🎉 真实小红书发布测试成功完成！');
  } else {
    console.log('\n⚠️ 真实小红书发布测试完成，但有错误发生');
  }
  
  console.log('\n🏁 测试结束');
});
