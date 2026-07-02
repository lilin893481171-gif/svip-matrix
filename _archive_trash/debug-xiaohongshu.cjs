/**
 * debug-xiaohongshu.cjs — 小红书发布流程调试脚本
 */
const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 小红书发布流程调试工具\n');

// 模拟小红书发布任务
const mockTask = {
  taskId: 'debug_task_001',
  historyId: 'debug_hist_001',
  videoId: 'debug_video_001',
  accountId: 'debug_account_001',
  platform: '小红书',
  title: '测试标题',
  desc: '测试描述',
  tags: '测试标签',
  videoPath: path.join(__dirname, 'test-video.mp4'),
  scheduled: false,
  scheduleTime: '',
  copyright: 0,
  dtime: 0
};

console.log('📋 模拟任务数据:');
console.log(JSON.stringify(mockTask, null, 2));

// 检查小红书脚本
const scriptPath = path.join(__dirname, 'resources', 'rpa-scripts', 'xiaohongshu.mjs');
console.log(`\n📁 脚本路径: ${scriptPath}`);

const fs = require('fs');
if (fs.existsSync(scriptPath)) {
  console.log('✅ 脚本文件存在');

  // 读取脚本内容
  const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
  console.log(`📄 脚本大小: ${scriptContent.length} 字节`);

  // 检查关键函数
  const functions = ['execute', 'injectVideo', 'pollVideoInfo', 'assemblePayload'];
  console.log('\n🔧 检查关键函数:');
  functions.forEach(func => {
    const hasFunc = scriptContent.includes(`function ${func}`) || scriptContent.includes(`${func}(`);
    console.log(`  ${hasFunc ? '✅' : '❌'} ${func}`);
  });

  // 检查关键步骤
  const steps = [
    '导航至发布中心',
    '注入视频',
    '轮询 video_file_id',
    '组装 Payload',
    '发送 XHR 请求'
  ];
  console.log('\n📝 检查关键步骤:');
  steps.forEach(step => {
    const hasStep = scriptContent.includes(step);
    console.log(`  ${hasStep ? '✅' : '❌'} ${step}`);
  });

} else {
  console.log('❌ 脚本文件不存在');
}

// 检查 RPA 引擎
const enginePath = path.join(__dirname, 'src', 'main', 'rpa-engine.js');
console.log(`\n📁 RPA 引擎路径: ${enginePath}`);

if (fs.existsSync(enginePath)) {
  console.log('✅ RPA 引擎文件存在');

  const engineContent = fs.readFileSync(enginePath, 'utf-8');

  // 检查关键功能
  const features = [
    'ScriptManager.executePlatform',
    'startXHSSessionKeeper',
    'broadcastProgress'
  ];
  console.log('\n🔧 检查关键功能:');
  features.forEach(feature => {
    const hasFeature = engineContent.includes(feature);
    console.log(`  ${hasFeature ? '✅' : '❌'} ${feature}`);
  });

} else {
  console.log('❌ RPA 引擎文件不存在');
}

// 检查 BrowserController
const controllerPath = path.join(__dirname, 'src', 'main', 'rpa', 'browser-controller.js');
console.log(`\n📁 BrowserController 路径: ${controllerPath}`);

if (fs.existsSync(controllerPath)) {
  console.log('✅ BrowserController 文件存在');

  const controllerContent = fs.readFileSync(controllerPath, 'utf-8');

  // 检查关键方法
  const methods = [
    'launch',
    'attachToWindow',
    'detachFromWindow',
    'close'
  ];
  console.log('\n🔧 检查关键方法:');
  methods.forEach(method => {
    const hasMethod = controllerContent.includes(method + '(');
    console.log(`  ${hasMethod ? '✅' : '❌'} ${method}`);
  });

  // 检查 detachFromWindow 实现
  const detachMatch = controllerContent.match(/detachFromWindow\(\)\s*\{([^}]*)\}/s);
  if (detachMatch) {
    console.log('\n📝 detachFromWindow 实现细节:');
    console.log(detachMatch[1].trim());
  }

} else {
  console.log('❌ BrowserController 文件不存在');
}

// 检查 visibility lock
const accountManagerPath = path.join(__dirname, 'src', 'main', 'account-browser-manager.js');
console.log(`\n📁 AccountManager 路径: ${accountManagerPath}`);

if (fs.existsSync(accountManagerPath)) {
  console.log('✅ AccountManager 文件存在');

  const accountManagerContent = fs.readFileSync(accountManagerPath, 'utf-8');

  // 检查 visibility lock
  const visibilityLock = accountManagerContent.includes('visibilityState') &&
                        accountManagerContent.includes('visibilitychange');
  console.log(`\n🔒 Visibility Lock: ${visibilityLock ? '✅ 已实现' : '❌ 未实现'}`);

  // 检查语法错误
  const hasBothValueAndGet = accountManagerContent.includes('value:') &&
                              accountManagerContent.includes('get:');
  console.log(`⚠️  语法错误风险: ${hasBothValueAndGet ? '❌ 存在风险' : '✅ 无风险'}`);

} else {
  console.log('❌ AccountManager 文件不存在');
}

console.log('\n🎯 调试建议:');
console.log('1. 检查浏览器视图是否在执行过程中被隐藏或移除');
console.log('2. 检查小红书页面状态是否保持正常');
console.log('3. 检查脚本执行日志，确认每一步都正常执行');
console.log('4. 检查网络连接和代理设置');
console.log('5. 检查是否有风控或验证弹窗');

console.log('\n✅ 调试完成！');