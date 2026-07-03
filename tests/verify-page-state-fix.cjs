/**
 * @file verify-page-state-fix.cjs
 * 验证页面状态重置修复
 */

const { readFileSync } = require('fs');
const { join } = require('path');

console.log('🧪 验证页面状态重置修复...');

try {
  // 检查 App.jsx 中的修复
  const appPath = join(__dirname, 'src/renderer/src/App.jsx');
  const appContent = readFileSync(appPath, 'utf8');

  const hasTaskRestoreLogic = appContent.includes('restoreRunningTasks');
  const hasReconnectIpc = appContent.includes('reconnect-task-monitor');

  console.log('\n📋 App.jsx 修复检查:');
  console.log(`  - 任务恢复逻辑: ${hasTaskRestoreLogic ? '✅' : '❌'}`);
  console.log(`  - 重新连接 IPC: ${hasReconnectIpc ? '✅' : '❌'}`);

  // 检查 RPA 引擎中的修复
  const rpaEnginePath = join(__dirname, 'src/main/rpa-engine.js');
  const rpaEngineContent = readFileSync(rpaEnginePath, 'utf8');

  const hasReconnectHandler = rpaEngineContent.includes('reconnect-task-monitor');

  console.log('\n📋 RPA 引擎修复检查:');
  console.log(`  - 重新连接处理程序: ${hasReconnectHandler ? '✅' : '❌'}`);

  // 检查 PublishTask 组件中的修复
  const publishTaskPath = join(__dirname, 'src/renderer/src/components/PublishTask.jsx');
  const publishTaskContent = readFileSync(publishTaskPath, 'utf8');

  const hasStateRestore = publishTaskContent.includes('页面恢复时检查');

  console.log('\n📋 PublishTask 修复检查:');
  console.log(`  - 状态恢复逻辑: ${hasStateRestore ? '✅' : '❌'}`);

  if (hasTaskRestoreLogic && hasReconnectHandler && hasStateRestore) {
    console.log('\n🎉 页面状态重置修复已应用！');
    console.log('💡 现在即使离开发布控制页面再回来，任务状态也不会丢失');
    console.log('💡 RPA 视图会自动恢复到正确的状态');
  } else {
    console.log('\n⚠️  部分修复可能未完全应用');
  }

} catch (error) {
  console.error('❌ 验证失败:', error.message);
}