const fs = require('fs');
const path = require('path');

console.log('🔧 强制更新小红书脚本...');

// 确定正确的脚本路径
const appDataPath = '/sessions/quirky-vibrant-cori/mnt/my-app'; // 在开发环境中使用项目目录
const userDataPath = path.join(appDataPath, 'userData');

console.log('📂 应用数据路径:', appDataPath);
console.log('📂 用户数据路径:', userDataPath);

// 1. 确保用户数据目录存在
if (!fs.existsSync(userDataPath)) {
  console.log('📂 创建用户数据目录...');
  fs.mkdirSync(userDataPath, { recursive: true });
}

const rpaScriptsPath = path.join(userDataPath, 'rpa-scripts');
if (!fs.existsSync(rpaScriptsPath)) {
  console.log('📂 创建rpa-scripts目录...');
  fs.mkdirSync(rpaScriptsPath, { recursive: true });
}

// 2. 从resources目录复制最新的小红书脚本
const sourceScript = path.join(appDataPath, 'resources', 'rpa-scripts', 'xiaohongshu.mjs');
const sourceApiScript = path.join(appDataPath, 'resources', 'rpa-scripts', 'xiaohongshu-api.mjs');
const sourceManifest = path.join(appDataPath, 'resources', 'rpa-scripts', 'manifest.json');

const targetScript = path.join(rpaScriptsPath, 'xiaohongshu.mjs');
const targetApiScript = path.join(rpaScriptsPath, 'xiaohongshu-api.mjs');
const targetManifest = path.join(rpaScriptsPath, 'manifest.json');

console.log('\n📋 复制脚本文件...');

// 复制主脚本
if (fs.existsSync(sourceScript)) {
  fs.copyFileSync(sourceScript, targetScript);
  const stats = fs.statSync(targetScript);
  console.log(`  ✅ 小红书主脚本已复制 (${stats.size} 字节)`);
  
  // 检查脚本内容
  const scriptContent = fs.readFileSync(targetScript, 'utf8');
  const versionMatch = scriptContent.match(/version:\s*(\d+)/);
  if (versionMatch) {
    console.log(`  📋 脚本版本: v${versionMatch[1]}`);
  }
} else {
  console.log('  ❌ 源主脚本不存在:', sourceScript);
}

// 复制API脚本
if (fs.existsSync(sourceApiScript)) {
  fs.copyFileSync(sourceApiScript, targetApiScript);
  const stats = fs.statSync(targetApiScript);
  console.log(`  ✅ 小红书API脚本已复制 (${stats.size} 字节)`);
} else {
  console.log('  ❌ 源API脚本不存在:', sourceApiScript);
}

// 复制manifest
if (fs.existsSync(sourceManifest)) {
  fs.copyFileSync(sourceManifest, targetManifest);
  console.log('  ✅ Manifest文件已复制');
  
  // 检查manifest内容
  try {
    const manifestContent = fs.readFileSync(targetManifest, 'utf8');
    const manifest = JSON.parse(manifestContent);
    console.log('  📋 Manifest版本信息:', JSON.stringify(manifest.scripts?.['小红书'], null, 2));
  } catch (e) {
    console.log('  ⚠️ Manifest解析失败:', e.message);
  }
} else {
  console.log('  ❌ 源Manifest不存在:', sourceManifest);
}

// 3. 创建或更新脚本管理器配置
console.log('\n⚙️ 更新脚本管理器配置...');

// 检查是否需要创建脚本管理器配置文件
const scriptManagerConfig = {
  "lastUpdate": new Date().toISOString(),
  "scripts": {
    "小红书": {
      "version": 19,
      "path": targetScript,
      "enabled": true
    }
  }
};

// 4. 验证修复结果
console.log('\n🔍 验证修复结果...');

const verificationChecks = [
  { name: '用户脚本目录', path: rpaScriptsPath, required: true },
  { name: '小红书主脚本', path: targetScript, required: true },
  { name: '小红书API脚本', path: targetApiScript, required: false },
  { name: 'Manifest文件', path: targetManifest, required: true }
];

let allRequiredExist = true;
verificationChecks.forEach(check => {
  const exists = fs.existsSync(check.path);
  console.log(`  ${exists ? '✅' : (check.required ? '❌' : '⚠️')} ${check.name}: ${exists ? '存在' : '不存在'}`);
  if (check.required && !exists) {
    allRequiredExist = false;
  }
});

if (allRequiredExist) {
  console.log('\n🎉 强制更新完成！');
  console.log('\n💡 下一步操作:');
  console.log('  1. 重启应用 (Ctrl+C 停止当前进程，然后重新运行 npm run dev)');
  console.log('  2. 在应用中重新尝试小红书发布任务');
  console.log('  3. 观察日志输出，应该会看到:');
  console.log('     - [ScriptManager] 小红书 → 缓存脚本 v19');
  console.log('     - 成功找到发布按钮并完成发布流程');
} else {
  console.log('\n⚠️ 更新未完全成功，请检查缺失的文件');
}

console.log('\n🔧 修复脚本执行完成');
