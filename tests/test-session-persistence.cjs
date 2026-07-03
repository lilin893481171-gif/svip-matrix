/**
 * @file test-session-persistence.cjs
 * 测试会话持久化功能
 */

const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

console.log('🧪 测试会话持久化功能...');

try {
  // 检查关键文件是否存在
  const filesToCheck = [
    'src/main/session-store.js',
    'src/main/xhs-session-keeper.mjs',
    'src/main/account-browser-manager.js'
  ];

  for (const file of filesToCheck) {
    const fullPath = join(__dirname, file);
    if (existsSync(fullPath)) {
      console.log(`✅ ${file} 存在`);
    } else {
      console.log(`❌ ${file} 不存在`);
    }
  }

  // 检查会话保持相关代码
  const sessionStorePath = join(__dirname, 'src/main/session-store.js');
  const sessionStoreContent = readFileSync(sessionStorePath, 'utf8');

  const hasXHSSessionKeeper = sessionStoreContent.includes('startXHSSessionKeeper');
  const hasSessionValidityCheck = sessionStoreContent.includes('checkXHSSessionValidity');
  const hasSessionRefresh = sessionStoreContent.includes('refreshXHSSession');

  console.log('\n📋 会话保持功能检查:');
  console.log(`  - 启动会话保持器: ${hasXHSSessionKeeper ? '✅' : '❌'}`);
  console.log(`  - 会话有效性检查: ${hasSessionValidityCheck ? '✅' : '❌'}`);
  console.log(`  - 会话刷新功能: ${hasSessionRefresh ? '✅' : '❌'}`);

  // 检查 BrowserController
  const browserControllerPath = join(__dirname, 'src/main/rpa/browser-controller.js');
  const browserControllerContent = readFileSync(browserControllerPath, 'utf8');

  const hasPartitionKey = browserControllerContent.includes('partitionKey');
  const hasSharedPartition = browserControllerContent.includes('persist:${this.partitionKey}');

  console.log('\n📋 BrowserController 检查:');
  console.log(`  - 分区键设置: ${hasPartitionKey ? '✅' : '❌'}`);
  console.log(`  - 共享分区模式: ${hasSharedPartition ? '✅' : '❌'}`);

  console.log('\n💡 建议:');
  console.log('1. 确保在小红书任务执行前启动会话保持器');
  console.log('2. 在任务执行过程中定期检查会话有效性');
  console.log('3. 如果会话失效，尝试刷新会话而不是重新登录');

} catch (error) {
  console.error('❌ 测试失败:', error.message);
}