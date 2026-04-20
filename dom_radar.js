const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ==========================================
// 1. 平台 URL 字典 (Base64 解码防特征扫描)
// ==========================================
const getUrl = (b64) => Buffer.from(b64, 'base64').toString('utf-8');
const PLATFORM_URLS = {
  '1': { name: '抖音', url: getUrl('aHR0cHM6Ly9jcmVhdG9yLmRvdXlpbi5jb20vY3JlYXRvci1taWNyby9jb250ZW50L3VwbG9hZA==') },
  '2': { name: '小红书', url: getUrl('aHR0cHM6Ly9jcmVhdG9yLnhpYW9ob25nc2h1LmNvbS9wdWJsaXNoL3B1Ymxpc2g=') },
  '3': { name: 'B站', url: getUrl('aHR0cHM6Ly9tZW1iZXIuYmlsaWJpbGkuY29tL3BsYXRmb3JtL3VwbG9hZC92aWRlby9mcmFtZQ==') },
  '4': { name: '快手', url: getUrl('aHR0cHM6Ly9jcC5rdWFpc2hvdS5jb20vYXJ0aWNsZS9wdWJsaXNoL3ZpZGVv') },
  '5': { name: '微信视频号', url: getUrl('aHR0cHM6Ly9jaGFubmVscy53ZWl4aW4ucXEuY29tL3BsYXRmb3JtL3Bvc3QvY3JlYXRl') }
};

// 辅助函数：获取你电脑里保存账号 Cookie 的真实路径
function getMatrixProfilePath(accountId) {
  const appData = process.platform === 'win32' ? process.env.APPDATA : path.join(os.homedir(), 'Library', 'Application Support');
  let pkgName = 'my-app';
  try { pkgName = require(path.join(process.cwd(), 'package.json')).name; } catch (e) {}

  const possibleNames = ['Electron', pkgName, 'matrix-client', 'my-app'];
  for (const name of possibleNames) {
    const testPath = path.join(appData, name, 'playwright_profiles', `chrome_data_${accountId}`);
    if (fs.existsSync(testPath)) {
        return testPath; 
    }
  }
  return path.join(appData, pkgName, 'playwright_profiles', `chrome_data_${accountId}`);
}

async function runRadar() {
  console.log("=========================================");
  console.log("📡 [Matrix DOM Radar] 五大平台全息雷达 (V9 Iframe穿透版)");
  console.log("=========================================\n");
  console.log("请选择你要进行【DOM 结构扫描】的平台：");
  
  Object.keys(PLATFORM_URLS).forEach(key => {
    console.log(`  [${key}] - ${PLATFORM_URLS[key].name}`);
  });

  rl.question('\n👉 请输入平台编号 (1-5): ', async (platformChoice) => {
    const platform = PLATFORM_URLS[platformChoice];
    if (!platform) {
        console.log("❌ 编号无效，程序退出！");
        process.exit(1);
    }

    rl.question(`👉 请输入要在哪个账号环境下打开 (填账号ID，如 1, 2, 3...): `, async (accountId) => {
      accountId = accountId.trim() || '1';
      const userDataPath = getMatrixProfilePath(accountId);
      
      console.log(`\n⏳ 正在装载隔离沙盒 [chrome_data_${accountId}]，准备空降【${platform.name}】...`);
      
      let browserContext;
      try {
        browserContext = await chromium.launchPersistentContext(userDataPath, {
          headless: false, 
          channel: 'chrome', 
          viewport: null, 
          ignoreDefaultArgs: ['--enable-automation', '--disable-extensions'], 
          args: [
            '--start-maximized', 
            '--disable-blink-features=AutomationControlled', 
            '--disable-infobars',
            '--test-type' 
          ]
        });
      } catch (e) {
        console.log("\n❌ 启动失败！请确保电脑安装了正常的 Google Chrome，且没在 UI 界面中打开该账号！");
        process.exit(1);
      }

      const page = browserContext.pages().length > 0 ? browserContext.pages()[0] : await browserContext.newPage();
      
      // 彻底抹除 webdriver 指纹
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        delete window._playwrightDetector;
      });

      console.log(`🛸 正在前往 ${platform.name} 创作者中心...`);
      await page.goto(platform.url, { waitUntil: 'domcontentloaded' });

      console.log("\n=========================================");
      console.log("👉 【人类介入时间】");
      console.log(`1. 请在弹出的浏览器里，手动在 ${platform.name} 上传一个小视频。`);
      console.log(`2. 等页面跳转，并且看到【标题】和【简介】框等核心表单都出来后。`);
      console.log("3. 回到这个黑窗口，按下【回车键】！");
      console.log("=========================================\n");

      rl.question('🟢 画面准备好了吗？按下【回车键(Enter)】立刻开始全息扫描！\n', async () => {
        console.log(`🔍 [雷达启动] 开启 Iframe 穿透模式，正在无死角扫描 ${platform.name}...`);

        let finalOutput = "=========================================\n";
        finalOutput += `   ${platform.name} 创作者中心 DOM 嗅探情报书 (Iframe 穿透版)\n`;
        finalOutput += "   生成时间: " + new Date().toLocaleString() + "\n";
        finalOutput += "=========================================\n\n";

        // 🔥 核心修复：获取当前页面的所有框架（包含主文档和所有 Iframe）
        const frames = page.frames();
        console.log(`📡 雷达共探测到 ${frames.length} 个嵌套文档层级，正在逐一深潜...`);

        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i];
          try {
            const frameReport = await frame.evaluate((frameUrl) => {
              let output = "";

              // 1. 扫描输入区 (放宽限制，抓取更多可能)
              output += "🎯 【发现的可输入区域 (Input/Textarea/富文本)】\n";
              const inputs = document.querySelectorAll('input[type="text"], input[type="password"], textarea, [contenteditable="true"], .ql-editor, [class*="input"], [class*="editor"]');
              let inputCount = 1;
              inputs.forEach((el) => {
                if (el.offsetWidth === 0 || el.offsetHeight === 0) return; 
                
                let placeholder = el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || el.getAttribute('aria-label') || '无';
                if (placeholder === '无' && el.innerText === '') {
                   const pseudoBefore = window.getComputedStyle(el, '::before').content;
                   if (pseudoBefore && pseudoBefore !== 'none') placeholder = pseudoBefore.replace(/['"]/g, '');
                }

                const className = el.getAttribute('class') || '无';
                const textContent = el.innerText ? el.innerText.replace(/\n/g, '').trim().substring(0, 15) : '';
                const dataE2E = el.getAttribute('data-e2e') || '无';
                
                // 如果是没特征的隐藏输入框，跳过
                if (placeholder === '无' && className === '无' && dataE2E === '无' && !textContent) return;

                output += `  [输入框 ${inputCount}]\n`;
                output += `    - 提示词 (Placeholder): ${placeholder}\n`;
                output += `    - CSS 类名: ${className}\n`;
                output += `    - 标签类型: ${el.tagName}\n`;
                if (dataE2E !== '无') output += `    - Data-E2E: ${dataE2E}\n`;
                if (textContent) output += `    - 当前内容: ${textContent}\n`;
                output += `\n`;
                inputCount++;
              });

              // 2. 扫描进度条
              output += "📊 【上传进度条侦测】\n";
              const progressBars = document.querySelectorAll('[class*="progress"], [class*="percent"], [class*="upload"]');
              let progCount = 1;
              progressBars.forEach((el) => {
                 const text = el.innerText ? el.innerText.replace(/\n/g, '').trim() : '';
                 const classNameStr = el.getAttribute('class') || ''; 
                 if (text.includes('%') || text.includes('上传') || classNameStr.includes('progress')) {
                   output += `  [进度条 ${progCount}] 类名: ${classNameStr}, 内容: ${text.substring(0, 20)}\n`;
                   progCount++;
                 }
              });
              output += "\n";

              // 3. 扫描核心按钮与开关 (专门加入微信的 weui-btn 等特色类名)
              output += "🖱️ 【发现的核心交互按钮 (Button/Label/Checkbox)】\n";
              const buttons = document.querySelectorAll('button, div[role="button"], label, input[type="checkbox"], input[type="radio"], a, [class*="btn"], [class*="Btn"], [class*="button"], [class*="Button"]');
              let btnCount = 1;
              buttons.forEach((el) => {
                if (el.offsetWidth === 0 || el.offsetHeight === 0) return;
                
                let text = el.innerText ? el.innerText.replace(/\n/g, ' ').trim().substring(0, 15) : '';
                if (el.tagName === 'INPUT' && !text) {
                   const label = el.nextElementSibling || el.parentElement;
                   if (label && label.innerText) text = label.innerText.replace(/\n/g, ' ').trim().substring(0, 15);
                }

                const dataE2E = el.getAttribute('data-e2e') || '无';
                const className = el.getAttribute('class') || '无';
                
                // 只有带文字或者有特征的才是按钮
                if (text.length > 0 || dataE2E !== '无' || el.tagName === 'INPUT') {
                  output += `  [交互项 ${btnCount}] 文字: "${text}" | 标签: ${el.tagName} | 类名: ${className}\n`;
                  btnCount++;
                }
              });

              return output;
            }, frame.url());

            // 🔥 只有当这个框架里真的有输入框或者进度条时，才拼接到最终报告里，过滤废话
            if (frameReport.includes('[输入框 1]') || frameReport.includes('[交互项 1]') || frameReport.includes('[进度条 1]')) {
              finalOutput += `\n=========================================\n`;
              finalOutput += ` 🌐 【子窗口/Iframe 探测层】来源 URL: ${frame.url()}\n`;
              finalOutput += `=========================================\n\n`;
              finalOutput += frameReport;
            }

          } catch (err) {
            // 如果遇到跨域严格限制的 Iframe 报错，直接忽略
          }
        }

        const desktopPath = path.join(os.homedir(), 'Desktop');
        const reportPath = path.join(desktopPath, `${platform.name}_radar_report.txt`);
        fs.writeFileSync(reportPath, finalOutput, 'utf-8');

        console.log(`\n✅ 深度穿透侦察完毕！情报已保存至你的桌面：\n👉 ${reportPath}\n`);
        
        rl.close();
        await browserContext.close();
      });
    });
  });
}

runRadar().catch(console.error);