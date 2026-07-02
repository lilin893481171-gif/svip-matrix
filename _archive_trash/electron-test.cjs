
const { app } = require('electron');
const path = require('path');

console.log('▶️  [Electron Runner] App is booting...');

// 1. Load the main application bundle FIRST.
// This allows it to register all necessary protocols before the app is ready.
const mainBundlePath = path.join(__dirname, 'out', 'main', 'index.js');
console.log(`▶️  [Electron Runner] Pre-loading main bundle from: ${mainBundlePath}`);
const { taskManager } = require(mainBundlePath);

if (!taskManager) {
    console.error('❌ [Electron Runner] CRITICAL: Failed to import taskManager from the main bundle.');
    app.quit();
    process.exit(1);
}

// 2. Now that the app code is loaded, we can safely emit the 'ready' event.
app.on('ready', () => {
    console.log('▶️  [Electron Runner] App is ready. The test can now proceed.');

    const testTask = {
        platform: '小红书',
        accountId: 'test-account-electron',
        historyId: `test-history-${Date.now()}`,
        taskId: `test-task-${Date.now()}`,
        videoPath: path.join(__dirname, 'test-video.mp4'),
        coverPath: path.join(__dirname, 'test-cover.jpg'),
        title: '【Electron Runner Test】',
        desc: 'This is a test from within the real Electron main process.',
        tags: 'Electron,Test,Success',
        scheduleTime: null,
        isOriginal: true
    };

    console.log('\n--- [Electron Runner] Submitting task to taskManager ---');
    taskManager.addTask(testTask);

    setTimeout(() => {
        console.log('\n--- [Electron Runner] Test finished. Quitting. ---');
        app.quit();
    }, 60000); // Quit after 1 minute.
});
