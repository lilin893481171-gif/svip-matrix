const fs = require('fs');
const path = require('path');

console.log('🔍 调试脚本加载机制...');

// 检查ScriptManager的加载逻辑
const userDataPath = '/sessions/quirky-vibrant-cori/mnt/my-app/userData';
const bundledPath = '/sessions/quirky-vibrant-cori/mnt/my-app/resources/rpa-scripts';
const outMainPath = '/sessions/quirky-vibrant-cori/mnt/my-app/out/main';

console.log('📂 检查各目录状态...');

const directories = [
  { name: '用户数据目录', path: userDataPath },
  { name: '内置资源目录', path: bundledPath },
  { name: '编译输出目录', path: outMainPath }
];

directories.forEach(dir => {
  const exists = fs.existsSync(dir.path);
  console.log(`  ${exists ? '✅' : '❌'} ${dir.name}: ${exists ? '存在' : '不存在'}`);
  if (exists) {
    try {
      const files = fs.readdirSync(dir.path);
      console.log(`     包含文件数: ${files.length}`);
    } catch (e) {
      console.log(`     读取失败: ${e.message}`);
    }
  }
});

// 检查用户缓存中的脚本
console.log('\n📂 检查用户缓存脚本...');
const userRpaPath = path.join(userDataPath, 'rpa-scripts');
if (fs.existsSync(userRpaPath)) {
  const files = fs.readdirSync(userRpaPath);
  console.log(`  用户缓存脚本文件: ${files.join(', ')}`);
  
  files.forEach(file => {
    if (file.endsWith('.mjs')) {
      const filePath = path.join(userRpaPath, file);
      const stats = fs.statSync(filePath);
      console.log(`    ${file}: ${stats.size} 字节`);
    }
  });
}

// 检查内置资源中的脚本
console.log('\n📂 检查内置资源脚本...');
if (fs.existsSync(bundledPath)) {
  const files = fs.readdirSync(bundledPath);
  console.log(`  内置资源脚本文件: ${files.join(', ')}`);
  
  files.forEach(file => {
    if (file.endsWith('.mjs')) {
      const filePath = path.join(bundledPath, file);
      const stats = fs.statSync(filePath);
      console.log(`    ${file}: ${stats.size} 字节`);
    }
  });
}

// 分析ScriptManager的加载逻辑
console.log('\n🔍 分析ScriptManager加载逻辑...');
const indexPath = path.join(outMainPath, 'index.js');
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  // 查找ScriptManager相关代码
  const scriptManagerPatterns = [
    /ScriptManager.*loadScript/,
    /tier.*fallback/i,
    /cache.*bundled/i,
    /adapter/i
  ];
  
  console.log('  ScriptManager相关代码片段:');
  scriptManagerPatterns.forEach(pattern => {
    const matches = indexContent.match(new RegExp(pattern.source, 'gi'));
    if (matches) {
      console.log(`    ${pattern}: ${matches.length} 个匹配`);
    }
  });
  
  // 查找小红书相关的加载逻辑
  const xhsLines = indexContent.split('\n').filter(line => 
    line.includes('小红书') || line.includes('Xiaohongshu') || line.includes('xhs')
  );
  
  console.log(`  小红书相关代码行数: ${xhsLines.length}`);
  xhsLines.slice(0, 5).forEach(line => {
    console.log(`    ${line.trim()}`);
  });
}

// 检查适配器文件
console.log('\n📂 检查适配器文件...');
const adaptersPath = path.join(outMainPath, 'index-Bfw6qQIc.js');
if (fs.existsSync(adaptersPath)) {
  const adaptersContent = fs.readFileSync(adaptersPath, 'utf8');
  
  // 查找小红书适配器
  if (adaptersContent.includes('XiaohongshuAdapter')) {
    console.log('  ✅ 找到小红书适配器');
    
    // 查找适配器的execute方法
    const executeMatch = adaptersContent.match(/execute\s*\([^)]*\)\s*{/);
    if (executeMatch) {
      console.log('  ✅ 适配器包含execute方法');
      
      // 查找脚本路径
      const scriptPathMatch = adaptersContent.match(/getBundledScriptPath\(\)/);
      if (scriptPathMatch) {
        console.log('  📋 适配器使用getBundledScriptPath()加载脚本');
      }
    }
  } else {
    console.log('  ❌ 未找到小红书适配器');
  }
}

// 检查脚本路径函数
console.log('\n🔍 检查脚本路径函数...');
const rpaEnginePath = path.join(outMainPath, 'index.js');
if (fs.existsSync(rpaEnginePath)) {
  const rpaContent = fs.readFileSync(rpaEnginePath, 'utf8');
  
  // 查找getBundledScriptPath函数
  const getBundledScriptPathMatch = rpaContent.match(/function getBundledScriptPath\(\)/);
  if (getBundledScriptPathMatch) {
    console.log('  ✅ 找到getBundledScriptPath函数');
    
    // 查找函数实现
    const functionStart = rpaContent.indexOf('function getBundledScriptPath');
    if (functionStart > -1) {
      const functionEnd = rpaContent.indexOf('\n}', functionStart) + 2;
      const functionCode = rpaContent.substring(functionStart, functionEnd);
      console.log('  📋 函数实现:');
      console.log('    ' + functionCode.split('\n').join('\n    '));
    }
  }
}

console.log('\n✅ 调试分析完成');
console.log('\n💡 可能的解决方案:');
console.log('  1. 确保用户缓存目录优先级高于内置资源目录');
console.log('  2. 检查ScriptManager的缓存清除机制');
console.log('  3. 验证文件权限和路径正确性');
