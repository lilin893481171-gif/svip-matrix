const fs = require('fs');
const path = require('path');

// 检查测试文件是否存在
const videoPath = path.join(__dirname, 'test-video.mp4');
const coverPath = path.join(__dirname, 'test-cover.jpg');

console.log('🔍 检查测试文件...');
if (!fs.existsSync(videoPath)) {
  console.log('❌ 视频文件不存在:', videoPath);
} else {
  const videoStats = fs.statSync(videoPath);
  console.log('✅ 视频文件存在，大小:', videoStats.size, '字节');
}

if (!fs.existsSync(coverPath)) {
  console.log('❌ 封面文件不存在:', coverPath);
} else {
  const coverStats = fs.statSync(coverPath);
  console.log('✅ 封面文件存在，大小:', coverStats.size, '字节');
}

// 创建一个测试任务对象
const testTask = {
  platform: '小红书',
  accountId: 'test-account-001',
  historyId: `test-history-${Date.now()}`,
  taskId: `test-task-${Date.now()}`,
  videoId: 'test-video-id',
  videoPath: videoPath,
  coverPath: coverPath,
  title: '【测试】小红书自动化发布测试',
  desc: '这是一个由自动化测试脚本发出的描述内容，用于测试小红书的发布功能。测试包括视频上传、标题设置、描述填写、标签添加等完整流程。',
  tags: '测试,自动化,小红书,发布功能',
  scheduleTime: null,
  isOriginal: true,
  copyright: 1 // 1表示原创
};

console.log('\n📋 测试任务详情:');
console.log(JSON.stringify(testTask, null, 2));

// 模拟taskManager类
class MockTaskManager {
  constructor() {
    this.queue = [];
    this.running = 0;
  }
  
  addTask(task) {
    console.log('\n🚀 添加任务到队列...');
    console.log('平台:', task.platform);
    console.log('账号ID:', task.accountId);
    console.log('任务ID:', task.taskId);
    console.log('历史ID:', task.historyId);
    console.log('标题:', task.title);
    
    // 验证必要文件
    if (!this.validateTaskFiles(task)) {
      return { success: false, error: '文件验证失败' };
    }
    
    // 添加到队列
    this.queue.push(task);
    console.log('✅ 任务已添加到队列，当前队列长度:', this.queue.length);
    
    // 模拟处理任务
    this.processTask(task);
    
    return { success: true, taskId: task.taskId, message: '任务已加入队列' };
  }
  
  validateTaskFiles(task) {
    console.log('\n🔍 验证任务文件...');
    
    // 检查视频文件
    if (!fs.existsSync(task.videoPath)) {
      console.log('❌ 错误: 视频文件不存在');
      return false;
    }
    
    // 检查封面文件
    if (!fs.existsSync(task.coverPath)) {
      console.log('❌ 错误: 封面文件不存在');
      return false;
    }
    
    // 检查文件大小
    const videoStats = fs.statSync(task.videoPath);
    const coverStats = fs.statSync(task.coverPath);
    
    console.log('📊 视频文件大小:', videoStats.size, '字节');
    console.log('📊 封面文件大小:', coverStats.size, '字节');
    
    if (videoStats.size === 0) {
      console.log('❌ 错误: 视频文件为空');
      return false;
    }
    
    if (coverStats.size === 0) {
      console.log('❌ 错误: 封面文件为空');
      return false;
    }
    
    console.log('✅ 文件验证通过');
    return true;
  }
  
  async processTask(task) {
    console.log('\n⚙️ 开始处理任务...');
    
    // 模拟任务处理步骤
    const steps = [
      '启动发布会话容器',
      '检查登录状态',
      '导航到发布页面',
      '上传视频文件',
      '等待视频处理完成',
      '填写标题',
      '填写描述',
      '添加标签',
      '设置封面',
      '提交发布请求',
      '等待发布结果'
    ];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`[${i+1}/${steps.length}] ${step}...`);
      
      // 模拟处理时间
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 模拟一些步骤的特殊处理
      switch(step) {
        case '上传视频文件':
          console.log('   📤 开始静默注入视频...');
          console.log('   ⚡ 找到核心节点，执行底层灌入...');
          console.log('   ✅ 视频已灌入，等待云端处理...');
          break;
        case '填写标题':
          console.log('   📝 标题:', task.title);
          break;
        case '填写描述':
          console.log('   📝 描述:', task.desc.substring(0, 50) + '...');
          break;
        case '添加标签':
          console.log('   🏷️ 标签:', task.tags);
          break;
        case '设置封面':
          console.log('   🖼️ 封面文件:', task.coverPath);
          break;
      }
    }
    
    console.log('\n🎉 任务处理完成！');
    console.log('✅ 小红书发布任务模拟成功完成');
  }
  
  getStats() {
    return {
      queueLength: this.queue.length,
      runningTasks: this.running,
      totalProcessed: this.queue.length
    };
  }
}

// 创建taskManager实例
const taskManager = new MockTaskManager();

console.log('\n🧪 开始测试...');

// 添加任务
const result = taskManager.addTask(testTask);

console.log('\n📊 任务管理器状态:');
console.log(JSON.stringify(taskManager.getStats(), null, 2));

if (result.success) {
  console.log('\n✅ 测试成功完成！');
  console.log('任务ID:', result.taskId);
} else {
  console.log('\n❌ 测试失败:', result.error);
}

console.log('\n🏁 测试结束');
