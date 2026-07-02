const fs = require('fs');
const path = require('path');

console.log('💪 强制覆盖脚本文件...');

// 直接覆盖所有相关文件，而不是删除
const resourcesDir = path.join(__dirname, 'resources', 'rpa-scripts');
const userDataDir = path.join(__dirname, 'userData', 'rpa-scripts');

// 确保目录存在
[resourcesDir, userDataDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 创建目录: ${dir}`);
  }
});

// 创建全新的v20小红书脚本
const newXhsScript = `export const meta = { platform: '小红书', version: 20, minAppVersion: '3.0.0' };

// 模拟睡眠函数
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function execute(api) {
  const { broadcast, interactions, task } = api;
  
  broadcast('🚀 启动全新v20小红书发布脚本...');
  broadcast('📋 任务信息: ' + task.title);
  
  try {
    // 模拟导航到创作者中心
    broadcast('🧭 导航到创作者中心...');
    await sleep(1000);
    
    // 模拟点击发布按钮 - 使用增强的选择器
    broadcast('🖱️ 寻找发布按钮...');
    const publishFound = await interactions.flexibleClick([
      '发布笔记', '发布视频', '发布内容', '新建笔记', '创作中心', '发布', 
      '.publish-btn', '.create-btn', '.publish-button', '[data-testid="publish-button"]'
    ], 15000);
    
    if (!publishFound) {
      throw new Error('❌ 无法找到发布按钮，请检查页面状态');
    }
    
    broadcast('✅ 成功点击发布按钮!');
    await sleep(2000);
    
    // 模拟等待发布页面加载
    broadcast('⏳ 等待发布页面加载...');
    const pageReady = await interactions.waitForSelector(
      '.title-wrap, .note-title, input[placeholder*="标题"], .title-input, [data-testid="title-input"]', 
      30000
    );
    
    if (!pageReady) {
      throw new Error('❌ 发布页面加载超时');
    }
    
    broadcast('✅ 发布页面已就绪!');
    
    // 模拟成功完成
    broadcast('🎉 全新v20脚本执行成功!');
    broadcast('💡 此为测试版本，验证脚本加载机制');
    
    return { 
      success: true, 
      message: '全新v20脚本执行成功',
      version: 20,
      test: true
    };
    
  } catch (error) {
    broadcast('❌ 执行出错: ' + error.message);
    throw error;
  }
}`;

// 创建manifest文件
const manifest = {
  scripts: {
    "小红书": {
      version: 20,
      file: "xiaohongshu.mjs",
      description: "全新v20版本，修复了旧适配器问题"
    }
  }
};

// 写入所有位置的文件
const targetPaths = [
  path.join(resourcesDir, 'xiaohongshu.mjs'),
  path.join(userDataDir, 'xiaohongshu.mjs'),
];

const manifestPaths = [
  path.join(resourcesDir, 'manifest.json'),
  path.join(userDataDir, 'manifest.json'),
];

console.log('\n📝 写入新脚本文件...');
targetPaths.forEach(filePath => {
  try {
    fs.writeFileSync(filePath, newXhsScript, 'utf8');
    const stats = fs.statSync(filePath);
    console.log(`  ✅ 已写入: ${filePath} (${stats.size} 字节)`);
  } catch (e) {
    console.log(`  ❌ 写入失败: ${filePath} (${e.message})`);
  }
});

console.log('\n📝 写入manifest文件...');
manifestPaths.forEach(filePath => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`  ✅ 已写入: ${filePath}`);
  } catch (e) {
    console.log(`  ❌ 写入失败: ${filePath} (${e.message})`);
  }
});

// 验证文件
console.log('\n🔍 验证文件...');
targetPaths.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasV20 = content.includes('version: 20');
    const hasExecute = content.includes('execute(api)');
    console.log(`  ${hasV20 && hasExecute ? '✅' : '❌'} ${filePath}: ${hasV20 ? 'v20' : '非v20'} ${hasExecute ? '有execute' : '无execute'}`);
  } else {
    console.log(`  ❌ ${filePath}: 不存在`);
  }
});

console.log('\n🎉 强制覆盖完成！');
console.log('\n💡 下一步:');
console.log('  1. 重启开发服务器: Ctrl+C 停止当前进程，然后 npm run dev');
console.log('  2. 测试小红书发布功能');
console.log('  3. 应该看到 [ScriptManager] 小红书 → 缓存脚本 v20');
console.log('  4. 不再看到 "旧适配器（保底）"');
