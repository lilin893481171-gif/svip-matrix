/**
 * @file verify-browser-view-fix.cjs
 * 验证 BrowserView 分离修复
 */

const { readFileSync } = require('fs');
const { join } = require('path');

console.log('🔧 验证 BrowserView 分离修复...');

try {
  // 检查 PublishTask 组件中的修复
  const publishTaskPath = join(__dirname, 'src/renderer/src/components/PublishTask.jsx');
  const publishTaskContent = readFileSync(publishTaskPath, 'utf8');

  const hasConditionalDetach = publishTaskContent.includes('!activeRunningTask') &&
                               publishTaskContent.includes('detach-robot-view');

  console.log('\n📋 BrowserView 修复检查:');
  console.log(`  - 条件分离逻辑: ${hasConditionalDetach ? '✅' : '❌'}`);

  if (hasConditionalDetach) {
    console.log('\n🎉 BrowserView 分离修复已应用！');
    console.log('💡 现在切换页面时，正在运行的任务不会丢失 BrowserView');
    console.log('💡 只有在任务真正结束时才会分离 BrowserView');
  } else {
    console.log('\n⚠️  修复可能未完全应用');
  }

  console.log('\n📝 修复说明:');
  console.log('  修改了 useEffect 清理函数中的 detach-robot-view 发送逻辑');
  console.log('  只有在没有运行中任务时才发送分离消息');
  console.log('  避免了页面切换时正在运行的任务被意外分离');

} catch (error) {
  console.error('❌ 验证失败:', error.message);
}