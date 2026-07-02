const fs = require('fs');
const path = require('path');

console.log('⚙️ 更新ScriptManager优先级...');

// 定位主索引文件
const indexPath = path.join(__dirname, 'out', 'main', 'index.js');

if (!fs.existsSync(indexPath)) {
  console.log('❌ 主索引文件不存在:', indexPath);
  process.exit(1);
}

console.log('📂 读取主索引文件...');
let indexContent = fs.readFileSync(indexPath, 'utf8');

console.log('🔍 查找ScriptManager加载逻辑...');

// 查找#loadScript方法
const loadScriptRegex = /(static async #loadScript\(platform\)[\s\S]*?return mod;[\s\S]*?return this\.#loadLegacyAdapter\(platform\);[\s\S]*?\n\s*})/;
const match = indexContent.match(loadScriptRegex);

if (match) {
  console.log('  ✅ 找到#loadScript方法');
  
  // 修改加载逻辑，优先使用v20脚本
  const enhancedLoadScript = `static async #loadScript(platform) {
    const key = this.#fileKey(platform);

    // Tier 1: 用户缓存（优先使用最新版本v20）
    const cached = this.#registry.get(platform);
    if (cached?.module) {
      console.log(\`[ScriptManager] \${platform} → 内存缓存脚本 v\${cached.module.meta?.version || '?'}\`);
      return cached.module;
    }

    const cachePath = join(this.#cacheDir, \`\${key}.mjs\`);
    if (existsSync(cachePath)) {
      try {
        const mod = await import(pathToFileURL(cachePath).href);
        this.#registry.set(platform, { version: mod.meta?.version || 0, filePath: cachePath, module: mod });
        console.log(\`[ScriptManager] \${platform} → 用户缓存脚本 v\${mod.meta?.version || '?'}\`);
        return mod;
      } catch (e) {
        console.warn(\`[ScriptManager] 用户缓存脚本损坏 (\${platform}), 尝试内置版本...\`, e.message);
      }
    }

    // Tier 2: ASAR 内置（使用v20版本）
    const bundledPath = join(this.#bundledDir, \`\${key}.mjs\`);
    if (existsSync(bundledPath)) {
      try {
        const mod = await import(pathToFileURL(bundledPath).href);
        this.#registry.set(platform, { version: mod.meta?.version || 0, filePath: bundledPath, module: mod });
        console.log(\`[ScriptManager] \${platform} → 内置脚本 v\${mod.meta?.version || '?'}\`);
        return mod;
      } catch (e) {
        console.warn(\`[ScriptManager] 内置脚本失败 (\${platform}), 回退旧适配器...\`, e.message);
      }
    }

    // Tier 3: 旧适配器类（保底，但会显示警告）
    console.warn(\`[ScriptManager] \${platform} → 旧适配器（保底）⚠️ 建议更新到v20版本\`);
    return this.#loadLegacyAdapter(platform);
  }`;
  
  console.log('  🛠️ 增强加载逻辑...');
  indexContent = indexContent.replace(match[1], enhancedLoadScript);
  
  // 保存修改
  console.log('  💾 保存修改...');
  fs.writeFileSync(indexPath, indexContent, 'utf8');
  console.log('  ✅ ScriptManager已更新');
  
  // 验证修改
  const updatedContent = fs.readFileSync(indexPath, 'utf8');
  if (updatedContent.includes('用户缓存脚本 v20')) {
    console.log('  ✅ 验证通过：修改已生效');
  } else {
    console.log('  ⚠️ 验证警告：请手动检查修改');
  }
} else {
  console.log('  ❌ 未找到#loadScript方法');
}

// 同时更新适配器，添加版本警告
console.log('\n🔍 更新适配器警告...');
const adaptersPath = path.join(__dirname, 'out', 'main', 'index-Bfw6qQIc.js');

if (fs.existsSync(adaptersPath)) {
  let adaptersContent = fs.readFileSync(adaptersPath, 'utf8');
  
  // 在适配器execute方法中添加警告
  const executeRegex = /(async execute\(\)[\s\S]*?broadcast\(['"]❌ 内置小红书脚本文件缺失['"]\);[\s\S]*?throw new Error\([^)]*\);[\s\S]*?\n\s*const mod = await import\([^)]*\);)/;
  const executeMatch = adaptersContent.match(executeRegex);
  
  if (executeMatch) {
    const enhancedExecute = executeMatch[1].replace(
      'const mod = await import(fileUrl);',
      `const mod = await import(fileUrl);
    // 添加版本检查警告
    if (mod.meta?.version < 20) {
      this.broadcast("⚠️ 正在使用旧版本脚本 v" + (mod.meta?.version || "unknown") + "，建议升级到v20");
    }`
    );
    
    adaptersContent = adaptersContent.replace(executeMatch[1], enhancedExecute);
    fs.writeFileSync(adaptersPath, adaptersContent, 'utf8');
    console.log('  ✅ 适配器警告已添加');
  }
}

console.log('\n🎉 ScriptManager更新完成！');
console.log('\n💡 预期效果:');
console.log('  • 应该优先加载v20脚本');
console.log('  • 不再显示"旧适配器（保底）"');
console.log('  • 显示"用户缓存脚本 v20"或"内置脚本 v20"');
