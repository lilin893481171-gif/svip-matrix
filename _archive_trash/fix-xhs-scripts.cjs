const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 修复小红书脚本加载问题...');

// 检查并创建用户缓存目录
const userDataDir = path.join(__dirname, 'userData', 'rpa-scripts');
if (!fs.existsSync(userDataDir)) {
  console.log('📂 创建用户缓存目录...');
  fs.mkdirSync(userDataDir, { recursive: true });
}

// 复制最新的小红书脚本到用户缓存目录
const bundledDir = path.join(__dirname, 'resources', 'rpa-scripts');
const xhsScript = path.join(bundledDir, 'xiaohongshu.mjs');

if (fs.existsSync(xhsScript)) {
  const cacheScript = path.join(userDataDir, 'xiaohongshu.mjs');
  console.log('📋 复制小红书脚本到缓存目录...');
  fs.copyFileSync(xhsScript, cacheScript);
  
  const stats = fs.statSync(cacheScript);
  console.log(`  ✅ 脚本已复制 (${stats.size} 字节)`);
} else {
  console.log('❌ 源脚本不存在');
}

// 更新manifest文件
const manifestPath = path.join(userDataDir, 'manifest.json');
const bundledManifest = path.join(bundledDir, 'manifest.json');

if (fs.existsSync(bundledManifest)) {
  console.log('📋 更新manifest文件...');
  fs.copyFileSync(bundledManifest, manifestPath);
  console.log('  ✅ Manifest文件已更新');
}

// 检查脚本管理器初始化
console.log('\n🔍 检查脚本管理器状态...');
try {
  // 模拟脚本管理器初始化
  const scriptManagerPath = path.join(__dirname, 'out', 'main', 'index.js');
  if (fs.existsSync(scriptManagerPath)) {
    console.log('  ✅ 脚本管理器文件存在');
    
    // 检查是否包含ScriptManager初始化代码
    const content = fs.readFileSync(scriptManagerPath, 'utf8');
    if (content.includes('ScriptManager.init()')) {
      console.log('  ✅ 脚本管理器初始化代码存在');
    } else {
      console.log('  ⚠️ 脚本管理器初始化代码未找到');
    }
  } else {
    console.log('  ❌ 脚本管理器文件不存在');
  }
} catch (e) {
  console.log('  ⚠️ 检查脚本管理器时出错:', e.message);
}

console.log('\n✅ 脚本修复完成');
console.log('\n💡 建议重启应用以使更改生效');
