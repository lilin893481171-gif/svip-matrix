/**
 * @file fix-page-state-reset.cjs
 * 修复页面状态重置问题
 */

const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

console.log('🔧 修复页面状态重置问题...');

try {
  // 读取 App.jsx 文件
  const appPath = join(__dirname, 'src/renderer/src/App.jsx');
  let appContent = readFileSync(appPath, 'utf8');

  console.log('✅ App.jsx 文件读取成功');

  // 检查是否已经有相关的修复
  const hasTaskRestoreLogic = appContent.includes('restoreRunningTasks') ||
                             appContent.includes('sync.*task') ||
                             appContent.includes('恢复运行中任务');

  console.log('\n📋 当前状态检查:');
  console.log(`  - 任务恢复逻辑: ${hasTaskRestoreLogic ? '✅ 已存在' : '❌ 不存在'}`);

  if (!hasTaskRestoreLogic) {
    console.log('\n💡 建议修复方案:');
    console.log('1. 在 App 组件初始化时检查 localStorage 中的运行中任务');
    console.log('2. 对于仍在运行的任务，重新订阅其状态更新');
    console.log('3. 在 PublishTask 组件中检查是否有运行中的任务并恢复状态');

    console.log('\n📝 需要添加的代码示例:');
    console.log(`
// 在 App.jsx 的 useEffect 中添加任务恢复逻辑:
useEffect(() => {
  // 恢复运行中的任务状态
  const restoreRunningTasks = () => {
    try {
      const raw = localStorage.getItem('publish_history_v1');
      if (raw) {
        const data = JSON.parse(raw);
        const runningTasks = (data.records || []).filter(r =>
          !['任务圆满成功', '任务成功', '任务失败', '已取消', '任务已取消', '用户终止'].includes(r.status)
        );

        // 对于每个运行中的任务，重新订阅状态更新
        runningTasks.forEach(task => {
          // 可以发送 IPC 消息到主进程，请求重新连接到该任务
          electron.ipcRenderer.send('reconnect-task-monitor', task.historyId);
        });
      }
    } catch (e) {
      console.warn('任务恢复失败:', e.message);
    }
  };

  restoreRunningTasks();
}, []);

// 在 PublishTask.jsx 中添加状态恢复逻辑:
useEffect(() => {
  // 检查是否有运行中的任务并恢复 RPA 视图状态
  const activeRunningTask = syncTasks.find(t =>
    t.status === '开始执行' || (t.status && t.status.includes('中') && t.status !== '排队中')
  );

  if (activeRunningTask && !rpaViewActive) {
    setRpaViewActive(true);
    setRpaActiveTaskId(activeRunningTask.historyId);
  }
}, [syncTasks]);
`);
  } else {
    console.log('\n✅ 任务恢复逻辑已存在');
  }

  console.log('\n🔧 建议的完整修复步骤:');
  console.log('1. 在主进程中添加 reconnect-task-monitor IPC 处理程序');
  console.log('2. 在 RPA 引擎中添加任务重新连接功能');
  console.log('3. 在前端组件中添加状态恢复逻辑');
  console.log('4. 确保页面切换时不会丢失任务状态');

} catch (error) {
  console.error('❌ 修复分析失败:', error.message);
}