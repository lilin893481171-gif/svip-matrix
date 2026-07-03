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

// 创建一个简单的测试任务对象
const testTask = {
  platform: '小红书',
  accountId: 'test-account-001',
  historyId: `test-history-${Date.now()}`,
  taskId: `test-task-${Date.now()}`,
  videoId: 'test-video-id',
  videoPath: videoPath,
  coverPath: coverPath,
  title: '【测试】这是一个自动化测试标题',
  desc: '这是一个由自动化测试脚本发出的描述内容，用于测试小红书的发布功能。',
  tags: '测试,自动化,小红书',
  scheduleTime: null,
  isOriginal: true
};

console.log('\n📋 测试任务详情:');
console.log(JSON.stringify(testTask, null, 2));

// 模拟taskManager的addTask方法
function addTask(task) {
  console.log('\n🚀 模拟添加任务到队列...');
  console.log('平台:', task.platform);
  console.log('标题:', task.title);
  console.log('视频路径:', task.videoPath);
  console.log('封面路径:', task.coverPath);
  
  // 检查文件是否存在
  if (!fs.existsSync(task.videoPath)) {
    console.log('❌ 错误: 视频文件不存在');
    return;
  }
  
  if (!fs.existsSync(task.coverPath)) {
    console.log('❌ 错误: 封面文件不存在');
    return;
  }
  
  console.log('✅ 所有文件检查通过');
  console.log('🎉 任务已成功添加到队列中');
}

console.log('\n🧪 开始测试...');
addTask(testTask);

console.log('\n✅ 测试完成');
