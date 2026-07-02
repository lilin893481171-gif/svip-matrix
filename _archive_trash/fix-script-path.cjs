const fs = require('fs');
const path = require('path');

console.log('🔧 修复脚本路径加载问题...');

// 定位适配器文件
const adaptersPath = path.join(__dirname, 'out', 'main', 'index-Bfw6qQIc.js');

if (!fs.existsSync(adaptersPath)) {
  console.log('❌ 适配器文件不存在:', adaptersPath);
  process.exit(1);
}

console.log('📂 读取适配器文件...');
let adaptersContent = fs.readFileSync(adaptersPath, 'utf8');

console.log('🔍 查找getBundledScriptPath函数...');

// 查找函数实现
const functionMatch = adaptersContent.match(/(function getBundledScriptPath\(\)[\s\S]*?return[\s\S]*?join\([^}]*?\n\})/);
if (functionMatch) {
  console.log('  ✅ 找到getBundledScriptPath函数');
  console.log('  📋 原始函数:');
  console.log('    ' + functionMatch[1].split('\n').join('\n    '));
  
  // 修改函数实现，优先使用用户缓存目录
  const newFunction = `function getBundledScriptPath() {
  // 优先检查用户缓存目录
  const userScriptPath = join(app.getPath("userData"), "rpa-scripts", "xiaohongshu.mjs");
  if (existsSync(userScriptPath)) {
    console.log("[ScriptPath] 使用用户缓存脚本:", userScriptPath);
    return userScriptPath;
  }
  
  // 回退到内置资源目录
  if (app.isPackaged) {
    return join(process.resourcesPath, "rpa-scripts", "xiaohongshu.mjs");
  }
  return join(app.getAppPath(), "resources", "rpa-scripts", "xiaohongshu.mjs");
}`;
  
  console.log('  🛠️ 新函数实现:');
  console.log('    ' + newFunction.split('\n').join('\n    '));
  
  // 替换函数
  adaptersContent = adaptersContent.replace(functionMatch[1], newFunction);
  
  // 保存修改后的文件
  console.log('💾 保存修改后的适配器文件...');
  fs.writeFileSync(adaptersPath, adaptersContent, 'utf8');
  console.log('  ✅ 适配器文件已更新');
  
  // 验证修改
  const updatedContent = fs.readFileSync(adaptersPath, 'utf8');
  if (updatedContent.includes('getPath("userData")')) {
    console.log('  ✅ 验证通过：修改已生效');
  } else {
    console.log('  ❌ 验证失败：修改未生效');
  }
} else {
  console.log('  ❌ 未找到getBundledScriptPath函数');
  
  // 尝试另一种查找方式
  const altMatch = adaptersContent.match(/(getBundledScriptPath\(\)[\s\S]*?join\([^}]*?\n\})/);
  if (altMatch) {
    console.log('  📋 找到替代匹配:');
    console.log('    ' + altMatch[1].split('\n').join('\n    '));
  }
}

// 同时修改ScriptManager的加载逻辑，确保优先使用缓存脚本
console.log('\n🔧 增强ScriptManager加载逻辑...');
const indexPath = path.join(__dirname, 'out', 'main', 'index.js');

if (fs.existsSync(indexPath)) {
  let indexContent = fs.readFileSync(indexPath, 'utf8');
  
  // 查找ScriptManager的#loadScript方法
  const loadScriptMatch = indexContent.match(/(static async #loadScript\(platform\)[\s\S]*?return mod;[\s\S]*?\n\s*})/);
  if (loadScriptMatch) {
    console.log('  ✅ 找到ScriptManager的#loadScript方法');
    
    // 在方法开始处添加用户缓存目录优先检查
    const enhancedMethod = loadScriptMatch[1].replace(
      'static async #loadScript(platform)',
      `static async #loadScript(platform) {
    const key = this.#fileKey(platform);

    // Tier 1: 用户缓存（GitHub 下载的最新版）
    const cached = this.#registry.get(platform);
    if (cached?.module) return cached.module;

    const cachePath = join(this.#cacheDir, \`\${key}.mjs\`);
    if (existsSync(cachePath)) {
      try {
        const mod = await import(pathToFileURL(cachePath).href);
        this.#registry.set(platform, { version: mod.meta?.version || 0, filePath: cachePath, module: mod });
        console.log(\`[ScriptManager] \${platform} → 缓存脚本 v\${mod.meta?.version || '?'}\`);
        return mod;
      } catch (e) {
        console.warn(\`[ScriptManager] 缓存脚本损坏 (\${platform}), 回退内置...\`, e.message);
      }
    }`
    );
    
    indexContent = indexContent.replace(loadScriptMatch[1], enhancedMethod);
    
    // 保存修改
    fs.writeFileSync(indexPath, indexContent, 'utf8');
    console.log('  ✅ ScriptManager加载逻辑已增强');
  }
}

console.log('\n✅ 脚本路径修复完成');
console.log('\n💡 下一步操作:');
console.log('  1. 重启应用 (Ctrl+C 停止当前进程，然后重新运行 npm run dev)');
console.log('  2. 在应用中重新尝试小红书发布任务');
console.log('  3. 观察日志输出，应该会看到:');
console.log('     - [ScriptPath] 使用用户缓存脚本: /sessions/.../userData/rpa-scripts/xiaohongshu.mjs');
console.log('     - [ScriptManager] 小红书 → 缓存脚本 v19');
console.log('     - 成功找到发布按钮并完成发布流程');
