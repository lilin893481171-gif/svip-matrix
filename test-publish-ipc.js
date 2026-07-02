/**
 * @file test-publish-ipc.js
 * 通过 IPC 调用测试发布功能
 */

// 模拟 Electron 环境
const { spawn } = require('child_process');
const path = require('path');

// 创建一个简单的 Electron 应用来测试 IPC
const testScript = `
const { app, BrowserWindow, ipcMain } = require('electron');
const { EngineSelector } = require('./src/main/browser/engine-selector.js');

async function createTestWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 测试引擎选择
  ipcMain.handle('test-engine-selection', async () => {
    try {
      console.log('[Test] 开始测试引擎选择...');
      const engineSelector = new EngineSelector();
      const engine = await engineSelector.selectEngine();

      console.log('[Test] 引擎选择成功');
      console.log('[Test] 引擎类型:', engine.type);

      if (engine.type === 'puppeteer') {
        console.log('[Test] ✅ 正确使用真实浏览器');
        // 清理资源
        await engine.puppeteerConnector.disconnect();
        await engine.chromeLauncher.forceClose();
        return { success: true, message: '正确使用真实浏览器' };
      } else {
        console.log('[Test] ❌ 错误：使用了内嵌浏览器');
        return { success: false, message: '错误：使用了内嵌浏览器' };
      }
    } catch (error) {
      console.log('[Test] 引擎选择失败:', error.message);
      return { success: false, message: error.message };
    }
  });

  await win.loadFile('test.html');
}

app.whenReady().then(createTestWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
`;

// 创建测试 HTML 文件
const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
</head>
<body>
  <h1>测试发布功能</h1>
  <button id="testBtn">测试引擎选择</button>
  <div id="result"></div>

  <script>
    const { ipcRenderer } = require('electron');

    document.getElementById('testBtn').addEventListener('click', async () => {
      const result = await ipcRenderer.invoke('test-engine-selection');
      document.getElementById('result').innerHTML =
        '<h2>测试结果:</h2><p>' + (result.success ? '✅ ' : '❌ ') + result.message + '</p>';
    });
  </script>
</body>
</html>
`;

// 写入测试文件
const fs = require('fs');
fs.writeFileSync('test-main.js', testScript);
fs.writeFileSync('test.html', testHtml);

console.log('测试文件已创建');