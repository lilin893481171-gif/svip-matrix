/**
 * @file test-playwright-executor.js
 * Playwright 执行器测试脚本
 */
import { PlaywrightExecutor } from './src/main/playwright/PlaywrightExecutor.js';
import fs from 'fs';
import path from 'path';

// 创建调试日志文件
const debugLogPath = path.join(process.cwd(), 'test-debug.log');
const debugLogStream = fs.createWriteStream(debugLogPath, { flags: 'a' });

// 写入调试日志的函数
function writeDebugLog(message) {
  const timestamp = new Date().toISOString();
  debugLogStream.write(`[${timestamp}] ${message}\n`);
}

// 读取测试任务配置
const testTaskPath = path.join(process.cwd(), 'test-playwright-task.json');
const testTask = JSON.parse(fs.readFileSync(testTaskPath, 'utf-8'));

console.log('🚀 启动 Playwright 执行器测试...');

// 创建一个简单的测试执行器
const executor = new PlaywrightExecutor({
  accountId: testTask.accountId,
  platform: testTask.platform,
  taskData: testTask,
  onProgress: (progress, message) => {
    // 只在终端打印关键进度信息
    console.log(`[进度 ${progress}%] ${message}`);
  },
  onLog: (message) => {
    // 关键状态信息打印到终端
    if (message.startsWith('🚀') || message.startsWith('✅') || message.startsWith('❌') ||
        message.startsWith('🔧') || message.startsWith('🧭') || message.startsWith('📤') ||
        message.startsWith('📝') || message.startsWith('🎯') || message.startsWith('⏳')) {
      console.log(`[日志] ${message}`);
    }
    // 所有日志都写入调试文件
    writeDebugLog(message);
  }
});

// 执行测试任务
async function runTest() {
  try {
    console.log('🔧 开始执行测试任务...');
    const result = await executor.execute();

    if (result.success) {
      console.log('✅ 测试任务执行成功!');
      // 避免打印完整的数据对象，只打印关键信息
      if (result.data && typeof result.data === 'object') {
        console.log('结果: 任务执行成功，详细信息请查看调试日志文件');
        writeDebugLog(`结果数据: ${JSON.stringify(result.data, null, 2)}`);
      } else {
        console.log('结果:', result.data);
      }
    } else {
      console.log('❌ 测试任务执行失败!');
      console.log('错误:', result.error);
      writeDebugLog(`错误详情: ${result.error}`);
    }
  } catch (error) {
    console.error('💥 测试过程中发生异常:', error.message);
    writeDebugLog(`异常详情: ${error.stack}`);
  } finally {
    // 关闭调试日志文件流
    debugLogStream.end();
    console.log(`📝 详细日志已写入: ${debugLogPath}`);
  }
}

// 直接运行测试
runTest();