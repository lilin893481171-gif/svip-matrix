import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Bot, Edit, Wand2, Send, Cpu, MessageSquare, Rocket } from 'lucide-react';
import { cfApiUrl, authHeaders, COPY_STYLES } from '../config/matrixConfig';

export default function DeepSeekCopilot({ isOpen, onClose, activeVideo, updateConfig }) {
  const [chatMode, setChatMode] = useState('matrix'); 
  const [selectedStyle, setSelectedStyle] = useState(COPY_STYLES[0]);
  
  const [messages, setMessages] = useState([
    { 
      role: 'ai', 
      text: '你好，我是多模态分发矩阵 AI 助理。\n\n我已经接入了底层专属高速算力通道，无需配置，请直接告诉我你视频的主题，我来帮你一键填满各平台的发布表格！',
      payload: null 
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null); // 自适应高度

  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
  }, [messages, isTyping, isOpen, chatMode]);

  // 输入框自适应高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // 🚀 核心安检门：物理级注入各平台数据
  const applyAIDataToForms = (payload) => {
    try {
      const LIMITS = {
        '小红书': { title: 20, desc: 1000 },
        '百家号': { title: 0, desc: 25 },  
        '抖音': { title: 30, desc: 1000 },
        '快手': { title: 30, desc: 1000 },
        '微信视频号': { title: 16, desc: 150 }, 
        'B站': { title: 80, desc: 2000 }
      };

      const enforceLimit = (platform, key, value) => {
        if (!value) return value;
        let finalValue = String(value);

        if (key === 'tags') {
          const cleanWords = finalValue.replace(/[#＃,，、]/g, ' ').split(/\s+/).filter(t => t.trim() !== '');
          if (platform === '百家号') {
            finalValue = cleanWords.slice(0, 2).join(' ');
          } else {
            finalValue = cleanWords.slice(0, 4).join(' ');
          }
          return finalValue;
        }
        
        if (platform === '百家号' && key === 'title') return ''; 

        const limits = LIMITS[platform] || { title: 80, desc: 2000 };
        const limit = limits[key];
        
        if (limit !== undefined) {
           const charArray = Array.from(finalValue);
           if (charArray.length > limit) {
              console.warn(`[AI 纠错] ${platform} ${key} 超限，已自动截断！`);
              finalValue = charArray.slice(0, limit).join('');
           }
        }
        return finalValue;
      };

      if (payload.universal) {
        Object.entries(payload.universal).forEach(([k, v]) => {
          updateConfig('universal', k, enforceLimit('universal', k, v));
        });
      }

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

  // 🌟 核心：直连咱们自己的 Cloudflare 商业网关
  const callLLM = async (userText) => {
    const MODEL_NAME = 'deepseek-chat';

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

🔥 当前用户的【核心文案风格要求】：
风格：【${selectedStyle.label}】
策略：${selectedStyle.prompt}

📦 输出格式要求（唯一格式）：
必须返回合法的 JSON 对象，禁止输出 markdown 代码块标记。
{
  "text": "简短口语化说明策划思路",
  "payload": {
    "universal": { "title": "...", "desc": "...", "tags": "..." },
    "platforms": {
      "抖音": { "title": "...", "desc": "...", "tags": "..." },
      "微信视频号": { "title": "...", "desc": "...", "tags": "..." },
      "百家号": { "title": "", "desc": "20字左右的极简简介", "tags": "解压 玩具" },
      "小红书": {...},
      "B站": {...},
      "快手": {...}
    }
  }
}
`;

    const SYSTEM_PROMPT_CHAT = `你是专业的自媒体运营与内容创作助理。回答要求自然专业、排版清晰、简洁实用。`;

    let apiMessages = [];
    if (chatMode === 'chat') {
      apiMessages = messages
        .filter(m => m.role === 'user' || m.role === 'ai')
        .slice(-6)
        .map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.text }));
    }
    apiMessages.push({ role: 'user', content: userText });

    const requestBody = {
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: chatMode === 'matrix' ? SYSTEM_PROMPT_MATRIX : SYSTEM_PROMPT_CHAT },
        ...apiMessages
      ],
      temperature: chatMode === 'matrix' ? 0.3 : 0.7 
    };

    if (chatMode === 'matrix') {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await fetch(cfApiUrl('/v1/chat/completions'), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`底层接口调用失败 (Status: ${response.status})`);
    }

    const data = await response.json();
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
    if (!input.trim() || isTyping) return;
    const userText = input.trim();
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
        
        {/* 🌟 极简 Header，移除设置按钮 */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-5 bg-slate-900/80 flex-shrink-0">
          <div className="flex items-center text-white font-black tracking-tighter">
            <Sparkles className="text-rose-500 mr-2" size={20} />
            DISTRIBUTION COPILOT
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition">
            <X size={20}/>
          </button>
        </div>

        {/* View Switcher */}
        <div className="bg-slate-950/80 p-2 border-b border-slate-800 flex gap-2 flex-shrink-0">
          <button onClick={() => setChatMode('matrix')} className={`flex-1 py-2 text-[12px] font-bold rounded-xl transition flex items-center justify-center gap-1 ${chatMode === 'matrix' ? 'bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-lg shadow-rose-600/20' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}>
            <Rocket size={14}/> 矩阵填表
          </button>
          <button onClick={() => setChatMode('chat')} className={`flex-1 py-2 text-[12px] font-bold rounded-xl transition flex items-center justify-center gap-1 ${chatMode === 'chat' ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}>
            <MessageSquare size={14}/> 自由闲聊
          </button>
        </div>

        {/* Chat Area */}
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
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={chatMode === 'matrix' ? `当前预设：${selectedStyle.label}\n如：一期纯钛推牌，写文案...` : "随时待命..."}
              className={`w-full max-h-40 min-h-[56px] bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-4 pr-14 text-sm text-slate-200 outline-none transition-all resize-none shadow-inner custom-scrollbar ${chatMode === 'chat' ? 'focus:border-indigo-500' : 'focus:border-rose-500'}`}
              rows={1}
            />
            <button 
              onClick={handleSend} 
              disabled={!input.trim() || isTyping}
              className={`absolute bottom-3 right-3 p-2 rounded-xl transition-all ${input.trim() && !isTyping ? (chatMode === 'chat' ? 'bg-indigo-600 shadow-indigo-600/40' : 'bg-rose-600 shadow-rose-600/40') + ' text-white shadow-lg' : 'bg-slate-800 text-slate-600'}`}
            >
              <Send size={16}/>
            </button>
          </div>
          <div className="text-center mt-3 text-[10px] text-slate-500 flex items-center justify-center font-bold">
            <Cpu size={10} className="mr-1 text-emerald-500"/> DeepSeek 商业版已挂载
          </div>
        </div>
      </div>
    </>
  );
}