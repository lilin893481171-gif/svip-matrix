/**
 * @file vision-agent.js
 * @description 基于 UI-TARS / SoM 辅助瞄准的顶级视觉推理驱动器 (防幻觉加强版)
 *              v2.0: Electron 原生 API，零 Playwright 依赖
 */

export class VisionAgent {
  constructor(webContents, interactions) {
    this.wc = webContents;
    this.i = interactions;

    this.LLM_API_URL = process.env.VLM_API_URL || 'http://127.0.0.1:11434/v1/chat/completions';
    this.LLM_API_KEY = process.env.VLM_API_KEY || 'ollama';
    this.MODEL_NAME = 'qwen2.5-vl';
  }

  async executeIntent(intent) {
    console.log(`\n👁️  [Vision Agent] 接收到执行意图: "${intent}"`);

    // 获取视口尺寸
    const viewportSize = await this.i.getViewportSize();

    // ==========================================
    // 🌟 SoM 辅助瞄准
    // ==========================================
    console.log(`🖌️ [Vision Agent] 正在启动 SoM 战术引擎，重绘屏幕目标...`);
    const elementMarks = await this.wc.executeJavaScript(`
      (() => {
        let idCounter = 1;
        const markMap = {};

        const elements = Array.from(document.querySelectorAll('button, a, input, [role="button"], [class*="upload"], [class*="btn"], .tab-wrap span'));

        elements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 20 && rect.height > 10 && rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight) {
            const id = idCounter++;
            markMap[id] = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

            const box = document.createElement('div');
            box.className = 'som-overlay-mark';
            box.style.position = 'fixed';
            box.style.left = rect.left + 'px';
            box.style.top = rect.top + 'px';
            box.style.width = rect.width + 'px';
            box.style.height = rect.height + 'px';
            box.style.border = '3px solid #FFFF00';
            box.style.backgroundColor = 'rgba(255,255,0,0.05)';
            box.style.zIndex = '999999';
            box.style.pointerEvents = 'none';

            const label = document.createElement('div');
            label.style.position = 'absolute';
            label.style.left = '-3px';
            label.style.top = '-3px';
            label.style.backgroundColor = '#FFFF00';
            label.style.color = '#000000';
            label.style.fontSize = '16px';
            label.style.fontWeight = '900';
            label.style.padding = '2px 6px';
            label.innerText = id;

            box.appendChild(label);
            document.body.appendChild(box);
          }
        });
        return markMap;
      })()
    `);

    console.log(`📸 [Vision Agent] 正在对标记画面进行视觉采样 (Screenshot)...`);
    const screenshotBuffer = await this.i.captureScreenshot(85);
    const base64Image = screenshotBuffer.toString('base64');

    // ==========================================
    // 2. THINK (想)：物理锁死大模型的输出范围
    // ==========================================
    const validIdsStr = Object.keys(elementMarks).join(', ');

    console.log(`🧠 [Vision Agent] 提交带框截图至 ${this.MODEL_NAME} 进行推理 (有效可选ID: ${validIdsStr})...`);

    const prompt = `
      你是一个顶级的 GUI 自动化测试 Agent。
      我在截图的关键元素上画了【黄色粗边框】，并在左上角标上了【黑色的数字ID】。
      用户的意图是：【${intent}】

      当前画面中真实存在的有效数字 ID 只有：[${validIdsStr}]。

      请仔细观察截图，找到用户想要操作的那个元素对应的【数字ID】。
      警告：你必须且只能从上述有效 ID 中选择一个整数！绝对不允许输出像 1234567890 这种不存在的捏造数字！

      请只返回一个严格的 JSON。严格遵循以下格式：
      {
        "id": 5,
        "reason": "我看到数字5对应的框是..."
      }
    `;

    let actionTarget = null;

    try {
      const response = await fetch(this.LLM_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.LLM_API_KEY}` },
        body: JSON.stringify({
          model: this.MODEL_NAME,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }],
          temperature: 0.0,
          max_tokens: 200
        })
      });

      if (!response.ok) throw new Error(`VLM 接口请求失败: ${response.status}`);

      const responseData = await response.json();
      const rawOutput = responseData.choices[0].message.content.trim();

      let resultObj;
      try {
        const cleanJsonStr = rawOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        resultObj = JSON.parse(cleanJsonStr);
      } catch (e) {
        throw new Error(`模型返回了无法解析的格式: ${rawOutput}`);
      }

      console.log(`🎯 [Vision Agent] 推理成功！目标编号: [${resultObj.id}], 理由: ${resultObj.reason}`);

      actionTarget = elementMarks[resultObj.id];
      if (!actionTarget) {
        throw new Error(`大模型仍然捏造了不存在的 ID: ${resultObj.id}`);
      }

    } catch (error) {
      console.error(`🚨 [Vision Agent] 执行崩溃:`, error.message);
    } finally {
      await this.wc.executeJavaScript(`
        (() => {
          document.querySelectorAll('.som-overlay-mark').forEach(el => el.remove());
        })()
      `);
      console.log(`🧹 [Vision Agent] 辅助瞄准框已清除。`);
    }

    if (!actionTarget) return false;

    console.log(`🤖 [Vision Agent] 鼠标正在精确打击目标 [${Math.round(actionTarget.x)}, ${Math.round(actionTarget.y)}]...`);
    await this.i.humanClickAtCoordinates(actionTarget.x, actionTarget.y);

    console.log(`✅ [Vision Agent] 意图执行完毕！\n`);
    return true;
  }
}