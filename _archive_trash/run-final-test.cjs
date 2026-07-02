
const { app } = require('electron');
const path = require('path');

// This script is the main entry point for the test run.
// It will be started by the electron executable.

// We must wait for the app to be ready before doing anything.
app.on('ready', () => {
    console.log('▶️  [Correct Runner] App is ready. All Electron APIs are now available.');

    const mainBundlePath = path.join(__dirname, 'out', 'main', 'index.js');
    console.log(`▶️  [Correct Runner] Loading main bundle from: ${mainBundlePath}`);

    try {
        // By requiring the main bundle *inside* the ready event,
        // we ensure that any code within it that also needs the app to be ready will execute correctly.
        const { taskManager } = require(mainBundlePath);

        if (!taskManager) {
            console.error('❌ [Correct Runner] CRITICAL: Failed to import taskManager from the main bundle.');
            app.quit();
            return;
        }

        console.log('▶️  [Correct Runner] taskManager imported successfully.');

        const testTask = {
            platform: '小红书',
            accountId: 'final-test-account',
            historyId: `final-history-${Date.now()}`,
            taskId: `final-task-${Date.now()}`,
            videoPath: path.join(__dirname, 'test-video.mp4'),
            coverPath: path.join(__dirname, 'test-cover.jpg'),
            title: '【最终正确测试】',
            desc: '这是一个在完全正确的 Electron 环境中运行的测试。',
            tags: '成功,修复,测试',
            scheduleTime: null,
            isOriginal: true
        };

        console.log('\n--- [Correct Runner] Submitting task to taskManager ---');
        taskManager.addTask(testTask);

        setTimeout(() => {
            console.log('\n--- [Correct Runner] Test finished. Quitting. ---');
            app.quit();
        }, 60000);

    } catch (e) {
        console.error('❌ [Correct Runner] A critical error occurred:', e);
        app.quit();
    }
});
