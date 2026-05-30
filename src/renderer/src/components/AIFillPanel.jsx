import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, ChevronLeft, CheckSquare, Square, X,
  Edit3, CheckCircle2, FileText, Send, Bot, Wand2, RefreshCw,
} from 'lucide-react';
import { PLATFORM_COPY_PROMPTS, COPY_STYLES, cfApiUrl, authHeaders } from '../config/matrixConfig';

const ALL_PLATFORMS = Object.keys(PLATFORM_COPY_PROMPTS);

function getPlatformColor(platform) {
  const map = {
    '抖音': '#fe2c55', '小红书': '#ff2442', 'B站': '#fb7299', '微信视频号': '#07C160',
    '快手': '#FF7700', '知乎': '#0066ff', '微博': '#ff8200', '百家号': '#2b88ff',
    '企鹅号(腾讯)': '#00A4FF', '腾讯视频': '#00A4FF', '大鱼号(优酷)': '#FF6600', '爱奇艺号': '#059669'
  };
  return map[platform] || '#6b7280';
}

export default function AIFillPanel({ workbenchVideos, setWorkbenchVideos, onMapToPublish, onBack, onSkip }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const [selectedPlatforms, setSelectedPlatforms] = useState(new Set(['抖音', '小红书', 'B站']));
  const [selectedStyle, setSelectedStyle] = useState(COPY_STYLES[0]);
  const [aiResults, setAiResults] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const loadingKeyRef = useRef(null);

  const currentVideo = workbenchVideos[currentIndex];
  const currentKey = currentVideo ? `${currentVideo.name}|${currentVideo.size}` : '';
  const currentResult = aiResults[currentKey];

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    if (!currentKey) return;
    loadingKeyRef.current = currentKey;
    if (currentResult?.messages?.length > 0) {
      setMessages(currentResult.messages);
    } else {
      const platformsStr = Array.from(selectedPlatforms).join('、');
      setMessages([{
        role: 'ai',
        text: `你好！当前视频是「${currentVideo?.name}」。\n\n请告诉我这个视频的主要内容，我会根据你选择的平台（${platformsStr}）和文案风格（${selectedStyle.label}）为你生成各平台专属文案。\n\n例如："这是一个关于纯钛推牌的开箱测评，重点展示机械结构和段落声音反馈..."`,
        payload: null
      }]);
    }
  }, [currentKey]);

  useEffect(() => {
    if (!currentKey || loadingKeyRef.current === currentKey) return;
    if (messages.length > 0) {
      setAiResults(prev => ({ ...prev, [currentKey]: { ...prev[currentKey], messages } }));
    }
  }, [messages]);

  const togglePlatform = (p) => {
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const buildSystemPrompt = () => {
    const platforms = Array.from(selectedPlatforms);
    const platformRules = platforms.map(p => {
      const cfg = PLATFORM_COPY_PROMPTS[p];
      if (!cfg) return '';
      return `【${p}】\n- 调性：${cfg.tone}\n- 标题限制：≤${cfg.titleMax}字\n- 描述风格：${cfg.descTone}\n- 标签规范：${cfg.tagStyle}\n- 规则：${cfg.rules}`;
    }).filter(Boolean).join('\n\n');

    return `你是顶级的多平台视频文案策划专家。用户会描述视频内容，你需要为以下平台生成专属文案。

🎯 目标平台：${platforms.join('、')}
✨ 文案风格：${selectedStyle.label} — ${selectedStyle.prompt}

📋 各平台规则：
${platformRules}

⚠️ 重要：
- 标签输出为空格分隔的纯净词汇，不要带#号或逗号
- 标题字数必须严格控制在平台限制内
- 百家号没有独立标题字段，title 必须为空字符串 ""
- 每个平台的标签数量不超过 5 个（百家号不超过 2 个）

📦 必须返回合法 JSON（不要 markdown 代码块标记）：
{
  "text": "简短口语化说明策划思路",
  "payload": {
    "platforms": {
      "抖音": { "title": "...", "desc": "...", "tags": "标签1 标签2 标签3" },
      "小红书": { "title": "...", "desc": "...", "tags": "..." }
    }
  }
}`;
  };

  const callLLM = async (userText) => {
    const apiMessages = messages
      .filter(m => m.role === 'user' || m.role === 'ai')
      .slice(-8)
      .map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.text }));
    apiMessages.push({ role: 'user', content: userText });

    const response = await fetch(cfApiUrl('/v1/chat/completions'), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          ...apiMessages
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) throw new Error(`API 调用失败 (Status: ${response.status})`);

    const data = await response.json();
    const content = data.choices[0].message.content;
    const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanContent);
  };

  const executeSend = async (userText) => {
    if (!userText.trim() || isTyping) return;
    setMessages(prev => [...prev, { role: 'user', text: userText.trim() }]);
    setInput('');
    setIsTyping(true);

    try {
      const aiResponse = await callLLM(userText.trim());
      setMessages(prev => [...prev, {
        role: 'ai',
        text: aiResponse.text || '已为你生成文案！',
        payload: aiResponse.payload
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: `❌ 出错了: ${error.message}`
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = () => executeSend(input);

  const handleRegenerate = () => {
    executeSend('请重新生成，我对上次的结果不太满意，换一种完全不同的表达方式和角度，保持同样的文案风格。');
  };

  const applyToForms = (payload) => {
    if (!payload?.platforms) return;

    const LIMITS = {
      '小红书': { title: 20 }, '百家号': { title: 0, desc: 25 },
      '抖音': { title: 30 }, '快手': { title: 30 },
      '微信视频号': { title: 16, desc: 150 }, 'B站': { title: 80 },
    };

    const processedPayload = { platforms: {} };
    for (const [plat, fields] of Object.entries(payload.platforms)) {
      const processed = { ...fields };
      const limits = LIMITS[plat] || {};

      if (limits.title !== undefined && processed.title) {
        if (limits.title === 0) {
          processed.title = '';
        } else {
          const chars = Array.from(String(processed.title));
          if (chars.length > limits.title) processed.title = chars.slice(0, limits.title).join('');
        }
      }

      if (limits.desc !== undefined && processed.desc) {
        const chars = Array.from(String(processed.desc));
        if (chars.length > limits.desc) processed.desc = chars.slice(0, limits.desc).join('');
      }

      if (processed.tags) {
        let tagStr = String(processed.tags).replace(/[#＃,，、]/g, ' ').replace(/\s+/g, ' ').trim();
        const tagWords = tagStr.split(' ').filter(Boolean);
        const maxTags = plat === '百家号' ? 2 : 5;
        processed.tags = tagWords.slice(0, maxTags).join(' ');
      }

      processedPayload.platforms[plat] = processed;
    }

    setAiResults(prev => ({
      ...prev,
      [currentKey]: { ...prev[currentKey], applied: true, payload: processedPayload },
    }));
  };

  const handleRemoveVideo = (index) => {
    const key = `${workbenchVideos[index].name}|${workbenchVideos[index].size}`;
    setWorkbenchVideos(prev => prev.filter((_, i) => i !== index));
    setAiResults(prev => { const n = { ...prev }; delete n[key]; return n; });
    if (currentIndex >= workbenchVideos.length - 1 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleMapToPublish = () => {
    // 检查是否所有视频都已 AI 填表
    const unfilledVideos = workbenchVideos.filter(v => {
      const key = `${v.name}|${v.size}`;
      return !aiResults[key]?.applied;
    });
    if (unfilledVideos.length > 0) {
      const names = unfilledVideos.map(v => `  • ${v.name}`).join('\n');
      const confirmed = window.confirm(
        `⚠️ 以下 ${unfilledVideos.length} 个视频尚未 AI 填表：\n\n${names}\n\n这些视频将使用文件名作为标题，字段为空。\n确定要继续映射到发布台吗？`
      );
      if (!confirmed) return;
    }

    const results = [];
    for (const video of workbenchVideos) {
      const key = `${video.name}|${video.size}`;
      const saved = aiResults[key];
      const firstPlatform = Array.from(selectedPlatforms)[0];
      results.push({
        video,
        title: saved?.payload?.platforms?.[firstPlatform]?.title || video.name.replace(/\.[^/.]+$/, ''),
        aiResult: saved?.payload || null,
        platforms: Array.from(selectedPlatforms),
      });
    }
    onMapToPublish(results);
  };

  const handleNext = () => {
    if (currentIndex < workbenchVideos.length - 1) setCurrentIndex(currentIndex + 1);
  };
  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  if (workbenchVideos.length === 0) {
    return (
      <div className="flex-1 bg-zinc-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <FileText size={48} className="text-zinc-300 mx-auto" />
          <h3 className="text-lg font-black text-zinc-500">暂无待处理视频</h3>
          <p className="text-xs text-zinc-400 font-medium">请先在「媒体库」中勾选视频并加入工作台</p>
          <button onClick={onBack} className="px-5 py-2.5 bg-black text-white text-xs font-black rounded-sm hover:bg-zinc-800 transition-colors">
            <ChevronLeft size={14} className="inline mr-1.5" />返回媒体库
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-zinc-100 flex flex-col animate-in slide-in-from-bottom-4 duration-400">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-300 bg-white/80 flex-shrink-0">
        <div>
          <h2 className="text-lg font-black tracking-tight text-black flex items-center gap-2">
            <Sparkles size={18} className="text-purple-500" />
            AI 填表助理
          </h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">
            {currentIndex + 1} / {workbenchVideos.length} · 对话式文案生成
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* ====== Left Panel (320px) ====== */}
        <div className="w-[320px] flex-shrink-0 border-r border-zinc-200 bg-white overflow-y-auto p-4 space-y-4">
          {/* Video Queue */}
          <div>
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">
              待处理队列
            </h3>
            <div className="space-y-1 max-h-[160px] overflow-y-auto">
              {workbenchVideos.map((v, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-sm text-left transition-all ${
                    i === currentIndex ? 'bg-purple-50 border border-purple-200' : 'hover:bg-zinc-50 border border-transparent'
                  }`}
                >
                  <span className={`text-[10px] font-bold truncate flex-1 ${i === currentIndex ? 'text-purple-700' : 'text-zinc-600'}`}>
                    {v.name}
                  </span>
                  {aiResults[`${v.name}|${v.size}`]?.applied && (
                    <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveVideo(i); }}
                    className="p-0.5 hover:bg-zinc-200 rounded-sm flex-shrink-0"
                  >
                    <X size={12} className="text-zinc-400" />
                  </button>
                </button>
              ))}
            </div>
          </div>

          {/* Current Video Info */}
          <div className="border-t border-zinc-100 pt-4">
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">当前视频</h3>
            <p className="text-[11px] font-bold text-zinc-700 truncate">{currentVideo?.name}</p>
            {currentVideo?.size && (
              <p className="text-[10px] text-zinc-400 mt-0.5">
                {(currentVideo.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
          </div>

          {/* Platform Selector */}
          <div className="border-t border-zinc-100 pt-4">
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">
              目标平台
            </h3>
            <div className="flex flex-wrap gap-1">
              {ALL_PLATFORMS.map(p => {
                const isSelected = selectedPlatforms.has(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`px-2.5 py-1 rounded-sm text-[9px] font-bold transition-all flex items-center gap-1 ${
                      isSelected ? 'text-white shadow-sm' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                    }`}
                    style={isSelected ? { backgroundColor: getPlatformColor(p) } : {}}
                  >
                    {isSelected ? <CheckSquare size={10} /> : <Square size={10} />}
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Style Selector */}
          <div className="border-t border-zinc-100 pt-4">
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">
              文案风格
            </h3>
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              {COPY_STYLES.map(style => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style)}
                  className={`w-full text-left px-3 py-2 rounded-sm text-[10px] font-bold transition-all ${
                    selectedStyle.id === style.id
                      ? 'bg-purple-100 text-purple-700 border border-purple-300'
                      : 'bg-zinc-50 text-zinc-500 border border-transparent hover:bg-zinc-100'
                  }`}
                >
                  <div>{style.label}</div>
                  <div className="text-[9px] font-normal text-zinc-400 mt-0.5 leading-tight">
                    {style.prompt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ====== Right Panel: Chat Area ====== */}
        <div className="flex-1 flex flex-col bg-zinc-50">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`flex ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-2.5 max-w-[90%]`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'ai' ? 'bg-purple-600 shadow-lg shadow-purple-600/20' : 'bg-zinc-600'
                  }`}>
                    {msg.role === 'ai' ? <Bot size={15} className="text-white"/> : <Edit3 size={13} className="text-zinc-200"/>}
                  </div>
                  <div className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white rounded-tr-none'
                      : 'bg-white text-zinc-700 rounded-tl-none border border-zinc-200 shadow-sm whitespace-pre-wrap'
                  }`}>
                    {msg.text}

                    {/* Structured preview of generated content */}
                    {msg.payload?.platforms && msg.role === 'ai' && (
                      <div className="mt-3 space-y-2">
                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-1.5 mb-1">
                          生成预览
                        </div>
                        {Object.entries(msg.payload.platforms).map(([plat, data]) => (
                          <div key={plat} className="bg-zinc-50 rounded-lg p-2.5 border border-zinc-100">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getPlatformColor(plat) }} />
                              <span className="text-[10px] font-black text-zinc-500">{plat}</span>
                            </div>
                            {data.title ? (
                              <div className="mb-1">
                                <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">标题</span>
                                <p className="text-[11px] font-bold text-zinc-700 leading-snug">{data.title}</p>
                              </div>
                            ) : (
                              <div className="mb-1">
                                <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">标题</span>
                                <p className="text-[10px] text-zinc-400 italic">（该平台无标题字段）</p>
                              </div>
                            )}
                            {data.desc && (
                              <div className="mb-1">
                                <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">描述</span>
                                <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-3">{data.desc}</p>
                              </div>
                            )}
                            {data.tags && (
                              <div>
                                <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">标签</span>
                                <p className="text-[10px] text-zinc-500">{String(data.tags)}</p>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Action buttons */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => applyToForms(msg.payload)}
                            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-500 text-white py-2 rounded-lg font-black text-[11px] flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/30 hover:scale-[1.02] transition-transform active:scale-95"
                          >
                            <Wand2 size={13}/> 应用到表单
                          </button>
                          <button
                            onClick={handleRegenerate}
                            disabled={isTyping}
                            className="px-3 py-2 bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-colors disabled:opacity-40"
                          >
                            <RefreshCw size={13}/> 重新生成
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-1.5 ml-9">
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"/>
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '75ms'}}/>
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}/>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-zinc-200 bg-white">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={`描述视频内容，AI 将根据 ${selectedStyle.label} 风格为 ${Array.from(selectedPlatforms).slice(0, 3).join('、')}${selectedPlatforms.size > 3 ? '等平台' : ''} 生成文案...`}
                className="w-full max-h-40 min-h-[52px] bg-zinc-50 border border-zinc-200 rounded-2xl py-3 pl-4 pr-12 text-sm text-zinc-700 outline-none transition-all resize-none focus:border-purple-400"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className={`absolute bottom-2.5 right-2.5 p-2 rounded-xl transition-all ${
                  input.trim() && !isTyping
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40'
                    : 'bg-zinc-200 text-zinc-400'
                }`}
              >
                <Send size={15}/>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="px-4 py-2 text-xs font-black text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-sm flex items-center gap-1.5 transition-colors"
          >
            <ChevronLeft size={14} /> 上一步
          </button>
          <button
            onClick={() => onSkip?.()}
            className="px-4 py-2 text-xs font-black text-zinc-500 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-sm flex items-center gap-1.5 transition-colors"
            title="跳过AI填表，所有字段将手动填写"
          >
            跳过填表，直接发布 →
          </button>
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-3 py-2 text-[10px] font-bold text-zinc-500 hover:text-zinc-700 disabled:opacity-30 transition-colors"
          >
            ← 上一个视频
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex >= workbenchVideos.length - 1}
            className="px-3 py-2 text-[10px] font-bold text-zinc-500 hover:text-zinc-700 disabled:opacity-30 transition-colors"
          >
            下一个视频 →
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-400 font-medium">
            {Object.values(aiResults).filter(r => r?.applied).length} / {workbenchVideos.length} 个已应用
          </span>
          <button
            onClick={handleMapToPublish}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black rounded-sm flex items-center gap-2 transition-all shadow-sm uppercase tracking-wider active:scale-95"
          >
            <Send size={14} /> 映射到发布台
          </button>
        </div>
      </div>
    </div>
  );
}
