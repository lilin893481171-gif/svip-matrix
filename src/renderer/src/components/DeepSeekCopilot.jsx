import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Settings, X, Bot, Edit, Wand2, Send, Check, ExternalLink, Cpu, MessageSquare, Rocket, Activity, Loader2 } from 'lucide-react';

// 🚀 新增：文案风格预设词库
const COPY_STYLES = [
  { id: 'net', label: '🔥 爆款网感', prompt: '文案要有极强的“网感”，善用热门梗，前3秒必须抓人眼球，制造悬念或情绪共鸣，适合泛流量抓取。' },
  { id: 'hardcore', label: '⚙️ 硬核解压', prompt: '文案聚焦在产品的机械结构、材质（如纯钛/合金）、声音反馈（如段落感/清脆声），多用拟声词和触觉描写，精准击中ASMR和EDC玩家痛点。' },
  { id: 'premium', label: '💎 高端测评', prompt: '文案克制、高级、专业。多用行业术语、参数对比，凸显做工精良和设计美学，像苹果发布会一样的高级感，适合高客单价转化。' },
  { id: 'emotion', label: '❤️ 情感共鸣', prompt: '文案走心，像老朋友聊天。结合深夜失眠、打工焦虑、通勤无聊等生活场景，将产品包装成情绪的出口和精神寄托。' },
];

export default function DeepSeekCopilot({ isOpen, onClose, activeVideo, updateConfig }) {
  const [view, setView] = useState('chat');
  const [chatMode, setChatMode] = useState('matrix'); 
  
  const [selectedStyle, setSelectedStyle] = useState(COPY_STYLES[0]);

  const [config, setConfig] = useState({
    provider: localStorage.getItem('matrix_ai_provider') || 'DeepSeek',
    apiKey: localStorage.getItem('matrix_ai_key') || '',
    baseUrl: localStorage.getItem('matrix_ai_base_url') || 'https://api.deepseek.com/chat/completions',
    model: localStorage.getItem('matrix_ai_model') || 'deepseek-chat'
  });
  
  const [messages, setMessages] = useState([
    { 
      role: 'ai', 
      text: '你好，宇哥！我是你的 AI 创作助理。\n\n⚠️ 如果遇到网络错误，说明我们已经接入了最新的【底层直连通道】，请点右上角 ⚙️ 齿轮【测试 API 连通性】，它会告诉你最真实的报错（大概率是账号没钱了）！',
      payload: null 
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const [testStatus, setTestStatus] = useState(null); 
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
  }, [messages, isTyping, isOpen, chatMode]);

  const handleProviderChange = (p) => {
    let newConfig = { ...config, provider: p };
    if (p === 'DeepSeek') {
      newConfig.baseUrl = 'https://api.deepseek.com/chat/completions';
      newConfig.model = 'deepseek-chat';
    } else if (p === 'Grok') {
      newConfig.baseUrl = 'https://api.x.ai/v1/chat/completions';
      newConfig.model = 'grok-beta';
    } else if (p === 'OpenAI') {
      newConfig.baseUrl = 'https://api.openai.com/v1/chat/completions';
      newConfig.model = 'gpt-4o-mini';
    } else if (p === '通义千问') {
      newConfig.baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      newConfig.model = 'qwen-plus';
    }
    setConfig(newConfig);
    setTestStatus(null); 
  };

  const saveConfig = () => {
    localStorage.setItem('matrix_ai_provider', config.provider);
    localStorage.setItem('matrix_ai_key', config.apiKey);
    localStorage.setItem('matrix_ai_base_url', config.baseUrl);
    localStorage.setItem('matrix_ai_model', config.model);
    setView('chat');
  };

  const invokeLLMRequest = async (url, options) => {
    const electron = typeof window !== 'undefined' ? window.electron : null;
    if (electron && electron.ipcRenderer) {
      const res = await electron.ipcRenderer.invoke('llm-request', { url, options });
      if (!res.success) throw new Error(res.message);
      return res.data;
    } else {
      const res = await fetch(url, options);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      return await res.json();
    }
  };

  const testConnection = async () => {
    if (!config.apiKey || !config.baseUrl) {
      setTestStatus('error');
      setTestMsg("请先填写完整的 Base URL 和 API Key！");
      return;
    }
    setTestStatus('testing');
    setTestMsg('正在经由 Node.js 底层发送测试数据包...');
    
    try {
      await invokeLLMRequest(config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: 'Ping! 回复数字 1 即可。' }],
          max_tokens: 5
        })
      });
      setTestStatus('success');
      setTestMsg('✅ 测试通过，请开始你的表演！');
    } catch (error) {
      setTestStatus('error');
      setTestMsg(`❌ 阻断原因追踪完成：\n${error.message}`);
    }
  };

  // 🚀 核心安检门：再次收缩百家号的拦截红线
  const applyAIDataToForms = (payload) => {
    try {
      // 1. 定义各大平台的字数红线
      const LIMITS = {
        '小红书': { title: 20, desc: 1000 },
        '百家号': { title: 0, desc: 25 },  // 🌟 百家号极度压缩，留一点余量设为25字
        '抖音': { title: 30, desc: 1000 },
        '快手': { title: 30, desc: 1000 },
        '微信视频号': { title: 16, desc: 150 }, 
        'B站': { title: 80, desc: 2000 }
      };

      const enforceLimit = (platform, key, value) => {
        if (!value) return value;
        let finalValue = String(value);

        // 🌟 1. 处理话题标签的异形格式
        if (key === 'tags') {
          // 清洗掉所有的符号，只保留纯文字
          const cleanWords = finalValue.replace(/[#＃,，、]/g, ' ').split(/\s+/).filter(t => t.trim() !== '');
          
          if (platform === '百家号') {
            // 🌟 百家号专属安检：只给 2 个纯净词汇（RPA会负责去敲#号和等待下拉）
            finalValue = cleanWords.slice(0, 2).join(' ');
          } else {
            // 其他平台保留最多 4 个
            finalValue = cleanWords.slice(0, 4).join(' ');
          }
          return finalValue;
        }
        
        // 🌟 2. 处理百家号的“无标题”特性
        if (platform === '百家号' && key === 'title') {
            return ''; // 强制清空百家号标题
        }

        // 🌟 3. 字数截断安检 (保护 Emoji 不乱码)
        const limits = LIMITS[platform] || { title: 80, desc: 2000 };
        const limit = limits[key];
        
        if (limit !== undefined) {
           const charArray = Array.from(finalValue);
           if (charArray.length > limit) {
              console.warn(`[AI 纠错] ${platform} ${key} 超限 (${charArray.length}/${limit})，已自动截断！`);
              finalValue = charArray.slice(0, limit).join('');
           }
        }
        return finalValue;
      };

      // 2. 注入全局
      if (payload.universal) {
        Object.entries(payload.universal).forEach(([k, v]) => {
          updateConfig('universal', k, enforceLimit('universal', k, v));
        });
      }

      // 3. 注入专属
      if (payload.platforms) {
        Object.entries(payload.platforms).forEach(([plat, fields]) => {
          Object.entries(fields).forEach(([k, v]) => {
             updateConfig(plat, k, enforceLimit(plat, k, v));
          });
        });
      }
      
      alert('⚡️ 物理注入成功！已强制应用各平台字数限制与专属标签格式！');
    } catch (e) {
      alert('注入失败，数据格式可能有误！');
    }
  };

  const callLLM = async (userText) => {
    if (!config.apiKey || !config.baseUrl) {
      throw new Error("请先点击右上角齿轮⚙️，配置你的 API Key 和接口地址！");
    }

// 🚀 重写系统提示词：百家号独立极简法则
const SYSTEM_PROMPT_MATRIX = `
你是一个顶级的全网自媒体矩阵爆款策划专家，擅长根据各平台算法逻辑定制文案。

🚨 核心创作禁令（违规将导致封号降权）：
1. 严禁使用极限词（如：最、第一、绝对、顶尖、全网唯一等）。
2. 数量控制：任何平台的话题/标签数量【绝对严禁超过 4 个】。
3. 话题输出格式：只需输出核心词组，用空格隔开，【绝对禁止输出 # 号或逗号】。

🎯 深度平台调性与【极端字数限制】指南（必须严格遵守！）：
- 【抖音/快手】：标题前3个字抓人眼球。标题≤30字。
- 【小红书】：标题要有氛围感。正文多用Emoji，语气像闺蜜聊天。标题≤20字。
- 【微信视频号】：文案必须极简！短标题严格≤16字；简介严格≤150字！
- 【百家号】：【极度重要：百家号没有独立的标题字段！】你只需提供一段极度精简的“简介”，【严格控制在 20 字左右】！话题标签【必须且只能提供 2 个纯净词汇】。
- 【B站】：走硬核路线。标题允许稍长，简介真诚像跟老粉交流。
- 【知乎】：走知识科普路线。文案要有逻辑感。

🔥 当前用户的【核心文案风格要求】：
风格：【${selectedStyle.label}】
策略：${selectedStyle.prompt}

📦 输出格式要求（唯一格式）：
必须返回合法的 JSON 对象，禁止输出 markdown 代码块标记，不要包含任何额外说明文字。
{
  "text": "简短口语化说明策划思路",
  "payload": {
    "universal": { "title": "...", "desc": "...", "tags": "..." },
    "platforms": {
      "抖音": { "title": "...", "desc": "...", "tags": "..." },
      "微信视频号": { "title": "16字以内的短标题", "desc": "150字以内的极简简介", "tags": "..." },
      "百家号": { "title": "", "desc": "20字左右的极简简介", "tags": "解压 玩具" },
      "小红书": {...},
      "B站": {...},
      "快手": {...},
      "知乎": {...},
      "微博": {...},
      "企鹅号": {...},
      "腾讯视频": {...},
      "大鱼号": {...},
      "爱奇艺号": {...}
    }
  }
}
`;

const SYSTEM_PROMPT_CHAT = `
你是专业的自媒体运营与内容创作助理。
负责解答运营疑问、提供选题灵感、撰写短视频口播脚本与文案。
回答要求：
- 语言自然专业，重点突出
- 排版清晰，可适当使用emoji
- 简洁实用，不冗余不跑题
`;

    let apiMessages = [];
    if (chatMode === 'chat') {
      apiMessages = messages
        .filter(m => m.role === 'user' || m.role === 'ai')
        .slice(-6)
        .map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.text }));
    }
    apiMessages.push({ role: 'user', content: userText });

    const requestBody = {
      model: config.model,
      messages: [
        { role: 'system', content: chatMode === 'matrix' ? SYSTEM_PROMPT_MATRIX : SYSTEM_PROMPT_CHAT },
        ...apiMessages
      ],
      temperature: chatMode === 'matrix' ? 0.3 : 0.7 
    };

    if (chatMode === 'matrix') {
      requestBody.response_format = { type: 'json_object' };
    }

    const data = await invokeLLMRequest(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const content = data.choices[0].message.content;
    
    if (chatMode === 'matrix') {
      try {
        const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanContent);
      } catch(e) {
          throw new Error("AI 返回了非标准格式数据，请重试。");
      }
    } else {
      return { text: content, payload: null };
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userText = input;
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setIsTyping(true);

    try {
      const aiResponse = await callLLM(userText);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: aiResponse.text || "执行完毕！", 
        payload: aiResponse.payload 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: `❌ 出现错误: ${error.message}` 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>}
      <div className={`fixed top-0 right-0 h-full w-[440px] bg-[#0b0f1a] border-l border-slate-800 shadow-2xl z-50 transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-5 bg-slate-900/80 flex-shrink-0">
          <div className="flex items-center text-white font-black tracking-tighter">
            <Sparkles className="text-rose-500 mr-2" size={20} />
            {view === 'chat' ? 'AI CREATIVE COPILOT' : 'API CONFIGURATION'}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView(view === 'chat' ? 'settings' : 'chat')} className={`p-2 rounded-lg transition ${view === 'settings' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
              <Settings size={20}/>
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition">
              <X size={20}/>
            </button>
          </div>
        </div>

        {/* View Switcher */}
        {view === 'chat' ? (
          <>
            <div className="bg-slate-950/80 p-2 border-b border-slate-800 flex gap-2 flex-shrink-0">
              <button onClick={() => setChatMode('matrix')} className={`flex-1 py-2 text-[12px] font-bold rounded-xl transition flex items-center justify-center gap-1 ${chatMode === 'matrix' ? 'bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-lg shadow-rose-600/20' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}>
                <Rocket size={14}/> 矩阵填表
              </button>
              <button onClick={() => setChatMode('chat')} className={`flex-1 py-2 text-[12px] font-bold rounded-xl transition flex items-center justify-center gap-1 ${chatMode === 'chat' ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}>
                <MessageSquare size={14}/> 自由闲聊
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-gradient-to-b from-transparent to-slate-900/20">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`flex ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-3 max-w-[95%]`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'ai' ? (chatMode === 'chat' ? 'bg-indigo-600 shadow-indigo-600/20' : 'bg-rose-600 shadow-rose-600/20') + ' shadow-lg' : 'bg-slate-700'}`}>
                      {msg.role === 'ai' ? <Bot size={18} className="text-white"/> : <Edit size={16} className="text-slate-300"/>}
                    </div>
                    <div className={`rounded-2xl p-4 text-[13px] leading-relaxed ${msg.role === 'user' ? (chatMode === 'chat' ? 'bg-indigo-600' : 'bg-rose-600') + ' text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/50 shadow-sm whitespace-pre-wrap'}`}>
                      {msg.text}
                      
                      {msg.payload && chatMode === 'matrix' && (
                        <button onClick={() => applyAIDataToForms(msg.payload)} className="mt-4 w-full bg-gradient-to-r from-rose-600 to-orange-500 text-white py-2.5 rounded-xl font-black text-[12px] flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 hover:scale-[1.02] transition-transform active:scale-95">
                          <Wand2 size={16}/> ⚡️ 一键提取并填满工作台
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && <div className="flex gap-2 ml-11"><div className={`w-1.5 h-1.5 ${chatMode === 'chat' ? 'bg-indigo-500' : 'bg-rose-500'} rounded-full animate-bounce`}></div><div className={`w-1.5 h-1.5 ${chatMode === 'chat' ? 'bg-indigo-500' : 'bg-rose-500'} rounded-full animate-bounce delay-75`}></div><div className={`w-1.5 h-1.5 ${chatMode === 'chat' ? 'bg-indigo-500' : 'bg-rose-500'} rounded-full animate-bounce delay-150`}></div></div>}
              <div ref={messagesEndRef} />
            </div>

            {chatMode === 'matrix' && (
              <div className="bg-slate-950 px-4 pt-3 pb-1 border-t border-slate-800">
                <div className="text-[10px] text-slate-500 font-bold mb-2 flex items-center"><Sparkles size={12} className="mr-1 text-rose-500"/> 文案风格引擎 (点击切换)</div>
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                  {COPY_STYLES.map(style => (
                    <button 
                      key={style.id}
                      onClick={() => setSelectedStyle(style)}
                      className={`whitespace-nowrap px-3 py-1.5 text-[12px] rounded-full border transition-all flex-shrink-0 ${
                        selectedStyle.id === style.id 
                        ? 'bg-rose-600/20 border-rose-500 text-rose-400 font-bold shadow-[0_0_10px_rgba(225,29,72,0.2)]' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 border-t border-slate-800 bg-slate-900/80">
              <div className="relative">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={chatMode === 'matrix' ? `当前预设：${selectedStyle.label}\n如：拍了一期纯钛推牌，发出清脆撞击声，帮我写文案...` : "有什么问题随便问我，或者让我帮你想几个选题..."}
                  className={`w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 pr-14 text-sm text-slate-200 outline-none transition-all h-28 resize-none shadow-inner ${chatMode === 'chat' ? 'focus:border-indigo-500' : 'focus:border-rose-500'}`}
                />
                <button onClick={handleSend} className={`absolute bottom-4 right-4 p-2.5 rounded-xl transition-all ${input.trim() ? (chatMode === 'chat' ? 'bg-indigo-600 shadow-indigo-600/40' : 'bg-rose-600 shadow-rose-600/40') + ' text-white shadow-lg' : 'bg-slate-800 text-slate-600'}`}>
                  <Send size={18}/>
                </button>
              </div>
              <div className="text-center mt-3 text-[10px] text-slate-500 flex items-center justify-center">
                <Cpu size={10} className="mr-1"/> Model: {config.model}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950 custom-scrollbar">
            
            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Provider / 快捷预设</label>
              <div className="grid grid-cols-2 gap-3">
                {['DeepSeek', '通义千问', 'Grok', 'OpenAI'].map(p => (
                  <button key={p} onClick={() => handleProviderChange(p)} className={`py-2 rounded-lg border-2 font-bold text-[13px] transition ${config.provider === p ? 'border-rose-500 bg-rose-500/10 text-rose-500' : 'border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                    {p}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500">点击上方按钮，可自动填入对应接口的 Base URL 和默认模型。</div>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Base URL / 请求地址</label>
              <input 
                type="text" 
                value={config.baseUrl}
                onChange={e => setConfig({...config, baseUrl: e.target.value})}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-rose-500 transition"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Model / 模型名称</label>
              <input 
                type="text" 
                value={config.model}
                onChange={e => setConfig({...config, model: e.target.value})}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 outline-none focus:border-rose-500 transition"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
                <span>API Secret Key / 密钥</span>
                <span className="text-rose-500">*必填</span>
              </label>
              <input 
                type="password" 
                value={config.apiKey}
                onChange={e => setConfig({...config, apiKey: e.target.value})}
                placeholder="sk-...................."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm text-rose-500 font-mono outline-none focus:border-rose-500 transition"
              />
            </div>

            <div className="pt-4 border-t border-slate-800">
              <button 
                onClick={testConnection} 
                disabled={testStatus === 'testing'} 
                className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl hover:bg-slate-700 transition flex items-center justify-center shadow-md active:scale-95 disabled:opacity-50"
              >
                {testStatus === 'testing' ? <Loader2 size={16} className="animate-spin mr-2"/> : <Activity size={16} className="mr-2 text-rose-500"/>}
                ⚡️ 测试 API 连通性
              </button>

              {testStatus && testStatus !== 'testing' && (
                <div className={`mt-3 p-4 rounded-xl text-[12px] leading-relaxed whitespace-pre-wrap font-bold ${testStatus === 'success' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50' : 'bg-red-900/30 text-red-400 border border-red-800/50'}`}>
                  {testMsg}
                </div>
              )}
            </div>

            <button onClick={saveConfig} className="w-full bg-white text-black font-black py-4 rounded-xl hover:bg-slate-200 transition shadow-xl active:scale-95 mt-2">
              💾 保存配置并返回聊天
            </button>
            
          </div>
        )}
      </div>
    </>
  );
}