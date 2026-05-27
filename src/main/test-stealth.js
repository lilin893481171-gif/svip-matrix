import { launchSandbox, closeSandbox } from './browser-manager.js';

(async () => {
    console.log("🛡️ [安全中心] Apify 量子装甲测试启动...");
    
    // 模拟启动一个测试账号的沙盒
    const { page } = await launchSandbox('Test_Account_001');

    console.log("🌐 正在空降 BrowserLeaks...");
    await page.goto('https://browserleaks.com/', { waitUntil: 'domcontentloaded' });
    
    console.log("✅ 抵达靶场！请检查 WebGL 和 Canvas！");
    
    // 保持页面开启供你检查
    await new Promise(() => {}); 
})();