/**
 * 小脑意图识别与路由服务 (LLM Router Service)
 * 经由 Cloudflare 代理网关 (DeepSeek) 进行安全请求
 */

import { cfApiUrl, authHeaders } from '../config/matrixConfig';

export const parseUserIntent = async (inputText) => {
  try {
    const response = await fetch(cfApiUrl('/v1/chat/completions'), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        model: "deepseek-chat", // 强制调用 DeepSeek
        messages: [
          { 
            role: "system", 
            content: `你是一个顶级 AGI 路由引擎。请分析用户的商业需求，并严格返回一段 JSON。
必须包含以下字段：
- id: (只能从这4个中选: img_core, vid_core, aud_core, txt_core)
- title: (对应的工作台名称)
- desc: (对用户需求的极简技术摘要)
- engine: (你推荐使用的大模型引擎名)
- cost: (预估消耗的算力点数，1-20之间)`
          },
          { role: "user", content: inputText }
        ],
        // DeepSeek 支持强制 JSON 格式输出
        response_format: { type: "json_object" } 
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    
    // 2. 解析 DeepSeek 返回的 JSON
    const routeConfig = JSON.parse(data.choices[0].message.content);
    return routeConfig;

  } catch (err) {
    console.error("CF 代理网关连接中断 / LLM 解析失败，触发降级策略:", err);
    
    // 3. 断网或 CF 报错时的极速本地降级策略 (兜底机制)
    if (inputText.includes('视') || inputText.includes('剧') || inputText.includes('播')) {
      return { id: 'vid_core', title: 'AI 动态影音自动化车间', desc: '视频混剪 / 数字人', engine: 'Wan2.1 / 可灵', cost: 15 };
    } else if (inputText.includes('听') || inputText.includes('音') || inputText.includes('唱')) {
      return { id: 'aud_core', title: 'AI 商业声学合成工坊', desc: '高仿真配音 / 病毒BGM', engine: 'ElevenLabs', cost: 8 };
    } else if (inputText.includes('文') || inputText.includes('字') || inputText.includes('本')) {
      return { id: 'txt_core', title: 'AI 智脑企划工作室', desc: '爆款脚本 / SEO矩阵', engine: 'DeepSeek-V4 Pro', cost: 1 };
    } else {
      return { id: 'img_core', title: 'AI 视觉设计营销工厂', desc: '商品场景重构 / 服装换模', engine: 'Flux.1 Pro', cost: 5 };
    }
  }
};