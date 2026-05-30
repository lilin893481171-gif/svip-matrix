import React, { useState, useRef, useEffect } from 'react';
import {
  Layers, Cpu, FileText, Copy, Zap, Send, Loader2, BrainCircuit,
  TrendingUp, Sparkles, CheckCircle2, RefreshCw
} from 'lucide-react';
import { cfApiUrl, authHeaders } from '../../../config/matrixConfig';
import { useAiTasks } from '../AiTaskContext';

function usePersistentState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : defaultValue;
    } catch (e) { return defaultValue; }
  });
  useEffect(() => { window.localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}

// ===========================
// 结构化工具配置表
// ===========================
const TXT_TOOL_CONFIG = {
  sv_trending: {
    title: '热点选题雷达',
    icon: TrendingUp,
    iconColor: 'text-teal-500',
    accent: 'teal',
    accentBg: 'bg-teal-50',
    accentBorder: 'border-teal-300',
    accentText: 'text-teal-700',
    trackOptions: [
      { value: 'beauty', label: '美妆护肤' },
      { value: 'tech', label: '数码测评' },
      { value: 'career', label: '职场成长' },
      { value: 'food', label: '美食探店' },
      { value: 'travel', label: '旅行攻略' },
      { value: 'fashion', label: '时尚穿搭' },
    ],
    platformOptions: [
      { value: 'douyin', label: '抖音' },
      { value: 'xiaohongshu', label: '小红书' },
      { value: 'bilibili', label: 'B站' },
      { value: 'shipinhao', label: '视频号' },
    ],
    defaultTrack: 'beauty',
    defaultPlatform: 'douyin',
    renderStages: ['正在接入热点数据中心...', '多维度交叉分析中...', '生成结构化选题方案...'],
    outputTitle: 'AI 选题方案',
  },

  sv_hook_script: {
    title: '黄金3秒爆款脚本',
    icon: Zap,
    iconColor: 'text-amber-500',
    accent: 'amber',
    accentBg: 'bg-amber-50',
    accentBorder: 'border-amber-300',
    accentText: 'text-amber-700',
    hookOptions: [
      { value: 'controversy', label: '制造争议', desc: '抛出一个反常识/反直觉的观点' },
      { value: 'suspense', label: '悬念钩子', desc: '开头设谜，结尾揭晓' },
      { value: 'counter_intuitive', label: '反常识暴击', desc: '用数据颠覆认知' },
      { value: 'pain_point', label: '痛点直击', desc: '精准戳中用户焦虑' },
      { value: 'story_hook', label: '故事开场', desc: '微型叙事抓住情绪' },
    ],
    emotionOptions: [
      { value: 'urgent', label: '紧迫感', icon: '⚡' },
      { value: 'humorous', label: '幽默吐槽', icon: '😏' },
      { value: 'inspirational', label: '热血励志', icon: '🔥' },
      { value: 'curious', label: '强烈好奇', icon: '🤔' },
      { value: 'empathetic', label: '共情治愈', icon: '💗' },
    ],
    defaultHook: 'controversy',
    defaultEmotion: 'urgent',
    renderStages: ['解析钩子策略...', '构建情绪曲线...', '生成爆款脚本...'],
    outputTitle: 'AI 爆款脚本',
  },

  sv_multi_platform: {
    title: '多平台文案裂变',
    icon: FileText,
    iconColor: 'text-purple-500',
    accent: 'purple',
    accentBg: 'bg-purple-50',
    accentBorder: 'border-purple-300',
    accentText: 'text-purple-700',
    platformOptions: [
      { id: 'xiaohongshu', label: '小红书', hint: '种草体 · 强情绪 · Emoji轰炸', color: 'rose' },
      { id: 'douyin', label: '抖音', hint: '口语体 · 强互动 · 反转节奏', color: 'sky' },
      { id: 'bilibili', label: 'B站', hint: '深度体 · 数据控 · 硬核沉浸', color: 'blue' },
    ],
    lengthOptions: [
      { value: 'short', label: '短文案 (~150字)' },
      { value: 'medium', label: '标准 (~300字)' },
      { value: 'long', label: '长文案 (~500字)' },
    ],
    defaultPlatforms: ['xiaohongshu', 'douyin'],
    defaultLength: 'medium',
    renderStages: ['分析目标平台风格...', '多版本并行创作中...', '格式化输出...'],
    outputTitle: 'AI 多平台文案',
  },

  _default: null,
};

// ===========================
// 组件本体
// ===========================
export default function TxtCorePanel({ activeWorkspace, workspaceMeta }) {
  const { guardDispatch } = useAiTasks();
  const toolConfig = TXT_TOOL_CONFIG[activeWorkspace] || TXT_TOOL_CONFIG._default;

  // 通用状态
  const [chatSessions, setChatSessions] = usePersistentState('aihub_chatSessions', {});
  const [chatInput, setChatInput] = usePersistentState('aihub_chatInput', '');
  const [isChatting, setIsChatting] = useState(false);

  // 结构化工具状态
  const [selectedTrack, setSelectedTrack] = usePersistentState(`txt_track_${activeWorkspace}`, toolConfig?.defaultTrack || '');
  const [selectedPlatform, setSelectedPlatform] = usePersistentState(`txt_platform_${activeWorkspace}`, toolConfig?.defaultPlatform || '');
  const [selectedHook, setSelectedHook] = usePersistentState(`txt_hook_${activeWorkspace}`, toolConfig?.defaultHook || '');
  const [selectedEmotion, setSelectedEmotion] = usePersistentState(`txt_emotion_${activeWorkspace}`, toolConfig?.defaultEmotion || '');
  const [selectedPlatforms, setSelectedPlatforms] = usePersistentState(`txt_platforms_${activeWorkspace}`, toolConfig?.defaultPlatforms || []);
  const [selectedLength, setSelectedLength] = usePersistentState(`txt_length_${activeWorkspace}`, toolConfig?.defaultLength || '');

  // 三态输出
  const [renderStage, setRenderStage] = useState(0);
  const [renderProgress, setRenderProgress] = useState(0);
  const [structuredOutput, setStructuredOutput] = useState(null); // 结构化结果
  const [isRendering, setIsRendering] = useState(false);

  const chatScrollRef = useRef(null);
  const textareaRef = useRef(null);
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const currentMessages = chatSessions[activeWorkspace] || [];

  // 初始化草稿
  useEffect(() => {
    const hasHistory = chatSessions[activeWorkspace] && chatSessions[activeWorkspace].length > 0;
    if (!hasHistory && workspaceMeta?.template && !toolConfig) {
      setChatInput(workspaceMeta.template);
    }
  }, [activeWorkspace]);

  // 滚动
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [currentMessages, isChatting]);

  // 文本框自适应
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [chatInput]);

  const handleClearMemory = () => {
    if (window.confirm('确定要清空该工具的对话记忆和草稿吗？')) {
      setChatSessions(prev => ({ ...prev, [activeWorkspace]: [] }));
      setChatInput(workspaceMeta?.template || '');
      setStructuredOutput(null);
    }
  };

  // 组装结构化 Prompt
  const composePrompt = () => {
    if (!toolConfig) return chatInput;
    const base = workspaceMeta?.template || '';
    let extra = '';

    if (activeWorkspace === 'sv_trending') {
      const trackLabel = toolConfig.trackOptions.find(o => o.value === selectedTrack)?.label || '';
      const platLabel = toolConfig.platformOptions.find(o => o.value === selectedPlatform)?.label || '';
      extra = `\n\n【赛道】：${trackLabel}\n【目标平台】：${platLabel}\n【补充指令】：${chatInput}`;
    } else if (activeWorkspace === 'sv_hook_script') {
      const hookLabel = toolConfig.hookOptions.find(o => o.value === selectedHook)?.label || '';
      const emotionLabel = toolConfig.emotionOptions.find(o => o.value === selectedEmotion)?.label || '';
      extra = `\n\n【钩子类型】：${hookLabel}\n【情绪基调】：${emotionLabel}\n【补充指令】：${chatInput}`;
    } else if (activeWorkspace === 'sv_multi_platform') {
      const names = selectedPlatforms.map(p => toolConfig.platformOptions.find(o => o.id === p)?.label || '').join(' + ');
      const lenLabel = toolConfig.lengthOptions.find(o => o.value === selectedLength)?.label || '';
      extra = `\n\n【目标平台】：${names}\n【文案长度】：${lenLabel}\n【补充指令】：${chatInput}`;
    }

    return `${base}${extra}`;
  };

  // 结构化生成
  const handleStructuredGenerate = async () => {
    if (!guardDispatch()) return;
    setIsRendering(true);
    setRenderProgress(0);
    setRenderStage(0);
    setStructuredOutput(null);

    const stages = toolConfig.renderStages;
    const tickInterval = 80;
    const totalTicks = (stages.length * 600) / tickInterval;
    let tick = 0;

    const interval = setInterval(() => {
      tick++;
      const progress = Math.min(Math.round((tick / totalTicks) * 100), 99);
      const stage = Math.min(Math.floor((tick / totalTicks) * stages.length), stages.length - 1);
      setRenderProgress(progress);
      setRenderStage(stage);

      if (tick >= totalTicks) {
        clearInterval(interval);
        if (!mountedRef.current) return;
      }
    }, tickInterval);

    try {
      const composedPrompt = composePrompt();
      const apiMessages = [
        { role: 'system', content: '你是一个顶级内容创作专家。请根据结构化参数输出结果。' },
        { role: 'user', content: `${composedPrompt}\n\n要求：不要输出解释性废话，直接给成品内容。` },
      ];

      const response = await fetch(cfApiUrl('/v1/chat/completions'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: 'deepseek-chat', messages: apiMessages }),
      });

      clearInterval(interval);
      if (!mountedRef.current) return;

      if (!response.ok) throw new Error(`网关异常 (${response.status})`);
      const data = await response.json();
      const rawText = data.choices[0].message.content;

      setRenderProgress(100);
      setStructuredOutput(rawText);
      setTimeout(() => { if (mountedRef.current) setIsRendering(false); }, 500);
    } catch (err) {
      clearInterval(interval);
      if (mountedRef.current) {
        setIsRendering(false);
        alert('生成失败: ' + err.message);
      }
    }
  };

  // 通用聊天发送 (非结构化工具)
  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatting) return;
    if (!guardDispatch()) return;
    const newUserMsg = { role: 'user', content: chatInput };
    const updatedMessages = [...currentMessages, newUserMsg];

    setChatSessions(prev => ({ ...prev, [activeWorkspace]: updatedMessages }));
    setChatInput('');
    setIsChatting(true);

    try {
      const apiMessages = [
        { role: 'system', content: '你是一个顶级的商业操盘手。禁止输出废话。' },
        ...updatedMessages.map((msg, index) => {
          if (index === 0 && workspaceMeta?.template) {
            return { role: msg.role, content: `【底层参数】：\n${workspaceMeta.template}\n\n【用户要求】：\n${msg.content}` };
          }
          return msg;
        }),
      ];

      const response = await fetch(cfApiUrl('/v1/chat/completions'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: 'deepseek-chat', messages: apiMessages }),
      });

      if (!response.ok) throw new Error(`网关响应异常 (${response.status})`);
      const data = await response.json();

      setChatSessions(prev => ({
        ...prev,
        [activeWorkspace]: [...(prev[activeWorkspace] || []), { role: 'assistant', content: data.choices[0].message.content }],
      }));
    } catch (err) {
      setChatSessions(prev => ({
        ...prev,
        [activeWorkspace]: [...(prev[activeWorkspace] || []), { role: 'assistant', content: '⚠️ 神经链路中断：' + err.message }],
      }));
    } finally {
      setIsChatting(false);
    }
  };

  // ─── 渲染：结构化工具 UI ───
  if (toolConfig) {
    const AccentIcon = toolConfig.icon;
    const accentColorMap = {
      teal: { border: 'border-teal-400', bg: 'bg-teal-50', text: 'text-teal-700', btn: 'bg-teal-600 hover:bg-teal-700', ring: 'ring-teal-500' },
      amber: { border: 'border-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', btn: 'bg-amber-600 hover:bg-amber-700', ring: 'ring-amber-500' },
      purple: { border: 'border-purple-400', bg: 'bg-purple-50', text: 'text-purple-700', btn: 'bg-purple-600 hover:bg-purple-700', ring: 'ring-purple-500' },
    };
    const ac = accentColorMap[toolConfig.accent] || accentColorMap.teal;

    return (
      <div className="flex-1 bg-zinc-50 p-8 animate-in slide-in-from-bottom-6 duration-500">
        <div className="max-w-6xl mx-auto w-full">
          {/* 标题栏 */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b border-zinc-200">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-black flex items-center">
                <AccentIcon size={22} className={`mr-2.5 ${toolConfig.iconColor}`} /> {workspaceMeta?.title}
              </h2>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mt-1.5">{workspaceMeta?.desc}</p>
            </div>
            <button onClick={handleClearMemory} className="text-xs font-bold text-zinc-400 hover:text-rose-500 transition-colors border border-zinc-200 bg-white px-3 py-1.5 rounded-sm shadow-sm">
              清除结果
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[650px]">
            {/* === 左侧控制台 === */}
            <div className="col-span-1 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block border-b border-zinc-100 pb-2">创作控制台</span>

                {/* ── sv_trending 控件 ── */}
                {activeWorkspace === 'sv_trending' && (
                  <>
                    <div>
                      <label className="text-xs font-black text-zinc-700 flex items-center mb-2">
                        <TrendingUp size={12} className="mr-1.5 text-teal-500" /> 内容赛道
                      </label>
                      <select value={selectedTrack} onChange={e => { setSelectedTrack(e.target.value); setStructuredOutput(null); }}
                        className="w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:border-teal-400 bg-white font-medium">
                        {toolConfig.trackOptions.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-black text-zinc-700 flex items-center mb-2">
                        <Send size={12} className="mr-1.5 text-teal-500" /> 目标平台
                      </label>
                      <select value={selectedPlatform} onChange={e => { setSelectedPlatform(e.target.value); setStructuredOutput(null); }}
                        className="w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:border-teal-400 bg-white font-medium">
                        {toolConfig.platformOptions.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className={`${ac.bg} border ${ac.border} rounded-sm p-3`}>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">当前配置</p>
                      <p className="text-xs font-black text-zinc-800">
                        {toolConfig.trackOptions.find(o => o.value === selectedTrack)?.label} · {toolConfig.platformOptions.find(o => o.value === selectedPlatform)?.label}
                      </p>
                    </div>
                  </>
                )}

                {/* ── sv_hook_script 控件 ── */}
                {activeWorkspace === 'sv_hook_script' && (
                  <>
                    <div>
                      <label className="text-xs font-black text-zinc-700 flex items-center mb-2">
                        <Zap size={12} className="mr-1.5 text-amber-500" /> 钩子类型
                      </label>
                      <div className="space-y-1.5">
                        {toolConfig.hookOptions.map(o => (
                          <label key={o.value}
                            className={`flex items-start gap-2 p-2.5 rounded-sm border cursor-pointer transition-all ${
                              selectedHook === o.value ? `${ac.border} ${ac.bg}` : 'border-zinc-200 hover:border-zinc-300'
                            }`}
                            onClick={() => { setSelectedHook(o.value); setStructuredOutput(null); }}>
                            <input type="radio" name="hook" checked={selectedHook === o.value} onChange={() => {}} className="sr-only" />
                            <div className={`w-3.5 h-3.5 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              selectedHook === o.value ? ac.border : 'border-zinc-300'
                            }`}>
                              {selectedHook === o.value && <div className={`w-2 h-2 rounded-full ${toolConfig.iconColor.replace('text-', 'bg-')}`} />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-zinc-800">{o.label}</p>
                              <p className="text-[10px] text-zinc-400 leading-relaxed">{o.desc}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-black text-zinc-700 block mb-2">情绪基调</label>
                      <div className="flex flex-wrap gap-1.5">
                        {toolConfig.emotionOptions.map(o => (
                          <button key={o.value}
                            onClick={() => { setSelectedEmotion(o.value); setStructuredOutput(null); }}
                            className={`text-xs font-bold px-3 py-2 rounded-sm border transition-all ${
                              selectedEmotion === o.value ? `${ac.border} ${ac.bg} ${toolConfig.accentText}` : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
                            }`}>
                            {o.icon} {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* ── sv_multi_platform 控件 ── */}
                {activeWorkspace === 'sv_multi_platform' && (
                  <>
                    <div>
                      <label className="text-xs font-black text-zinc-700 flex items-center mb-2">
                        <FileText size={12} className="mr-1.5 text-purple-500" /> 目标平台（多选）
                      </label>
                      <div className="space-y-1.5">
                        {toolConfig.platformOptions.map(p => {
                          const checked = selectedPlatforms.includes(p.id);
                          return (
                            <label key={p.id}
                              className={`flex items-start gap-2.5 p-2.5 rounded-sm border cursor-pointer transition-all ${
                                checked ? `${ac.border} ${ac.bg}` : 'border-zinc-200 hover:border-zinc-300'
                              }`}
                              onClick={() => {
                                setStructuredOutput(null);
                                setSelectedPlatforms(prev =>
                                  prev.includes(p.id)
                                    ? prev.length > 1 ? prev.filter(x => x !== p.id) : prev
                                    : [...prev, p.id]
                                );
                              }}>
                              <input type="checkbox" checked={checked} onChange={() => {}} className="sr-only" />
                              <div className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                checked ? 'bg-purple-500 border-purple-500' : 'border-zinc-300'
                              }`}>
                                {checked && <CheckCircle2 size={10} className="text-white" strokeWidth={4} />}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-zinc-800">{p.label}</p>
                                <p className="text-[10px] text-zinc-400">{p.hint}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-black text-zinc-700 block mb-2">文案长度</label>
                      <select value={selectedLength} onChange={e => { setSelectedLength(e.target.value); setStructuredOutput(null); }}
                        className="w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:border-purple-400 bg-white font-medium">
                        {toolConfig.lengthOptions.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* 底部算力 */}
              <div className="mt-8 pt-4 border-t border-zinc-100 flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">云端计费单耗</span>
                <span className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-sm">-{workspaceMeta?.cost} 算力点</span>
              </div>
            </div>

            {/* === 右侧输出画布 === */}
            <div className="col-span-2 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col h-full">
              {/* 空态 */}
              {!isRendering && !structuredOutput && (
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <Sparkles size={40} className={`mb-4 ${toolConfig.iconColor} opacity-40`} />
                    <h3 className="text-sm font-black text-zinc-600 uppercase tracking-wider mb-2">
                      {toolConfig.title} — 已就绪
                    </h3>
                    <p className="text-xs text-zinc-400 max-w-sm leading-relaxed mb-6">
                      左侧已配置结构化参数。可在下方补充额外指令，然后点击生成。
                    </p>
                  </div>
                  <div className="border-t border-zinc-100 pt-4">
                    <textarea ref={textareaRef}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleStructuredGenerate(); } }}
                      placeholder="补充额外指令（可选）... 按 Enter 直接生成"
                      className="w-full bg-zinc-50 border border-zinc-300 focus:border-zinc-500 rounded-sm p-3 text-xs outline-none resize-none min-h-[52px] custom-scrollbar" />
                    <div className="flex justify-end mt-3">
                      <button onClick={handleStructuredGenerate}
                        className={`${ac.btn} text-white text-xs font-black px-6 py-2.5 rounded-sm shadow-md flex items-center transition-all`}>
                        <Sparkles size={14} className="mr-1.5" /> 开始生成
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 渲染中 */}
              {isRendering && (
                <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in fade-in">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-zinc-200 flex items-center justify-center">
                      <div className={`w-12 h-12 rounded-full border-2 ${ac.border} animate-ping absolute`} />
                      <Loader2 size={28} className={`${toolConfig.iconColor} animate-spin`} />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className={`text-sm font-black ${toolConfig.iconColor} uppercase tracking-widest animate-pulse`}>
                      云端创作中
                    </p>
                    <p className="text-xs text-zinc-500 font-mono">{toolConfig.renderStages[renderStage]}</p>
                  </div>
                  <div className="w-72 space-y-1.5">
                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div className={`h-full ${toolConfig.iconColor.replace('text-', 'bg-')} transition-all duration-300 rounded-full`} style={{ width: `${renderProgress}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                      <span>Tensor Core</span><span>{renderProgress}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {toolConfig.renderStages.map((_, i) => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        i <= renderStage ? `${toolConfig.iconColor.replace('text-', 'bg-')} shadow-[0_0_6px_currentColor]` : 'bg-zinc-200'
                      }`} />
                    ))}
                  </div>
                </div>
              )}

              {/* 完成态 */}
              {structuredOutput && !isRendering && (
                <div className="flex-1 flex flex-col animate-in zoom-in-95">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-emerald-500" strokeWidth={2.5} />
                      <span className="text-sm font-black text-zinc-800 uppercase tracking-wider">{toolConfig.outputTitle}</span>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(structuredOutput); }}
                      className="text-[10px] font-bold text-zinc-500 hover:text-black border border-zinc-200 px-3 py-1.5 rounded-sm flex items-center gap-1 transition-colors">
                      <Copy size={10} /> 复制全文
                    </button>
                  </div>

                  {/* ── sv_trending 输出：选题卡片列表 ── */}
                  {activeWorkspace === 'sv_trending' && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                      {structuredOutput.split('\n').filter(l => l.trim()).map((line, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-sm border border-zinc-200 bg-zinc-50 hover:border-teal-200 transition-colors group">
                          <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-black shrink-0">{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-zinc-800 leading-relaxed">{line.replace(/^[\d\.\s、]+/, '')}</p>
                          </div>
                          <button onClick={() => navigator.clipboard.writeText(line.replace(/^[\d\.\s、]+/, ''))}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-[10px] font-bold text-teal-600 hover:text-teal-800 border border-teal-200 px-2 py-1 rounded">
                            <Copy size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── sv_hook_script 输出：分段时间轴 ── */}
                  {activeWorkspace === 'sv_hook_script' && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                      {['0-3秒 钩子开场', '3-15秒 冲突展开', '15-30秒 反转高潮', '30-45秒 行动号召'].map((label, i) => (
                        <div key={i} className="border-l-2 border-amber-300 pl-4 py-1 group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{label}</span>
                            <button onClick={() => {
                              const section = structuredOutput.split(/\n(?=\d+[-]\d+秒|$)/)[i];
                              if (section) navigator.clipboard.writeText(section);
                            }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-zinc-400 hover:text-amber-600 flex items-center gap-1">
                              <Copy size={10} /> 复制此段
                            </button>
                          </div>
                          <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{structuredOutput.split('\n').filter(l => l.trim()).slice(i * 3, (i + 1) * 3).join('\n') || structuredOutput}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── sv_multi_platform 输出：三栏对照 ── */}
                  {activeWorkspace === 'sv_multi_platform' && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-3 gap-3 h-full">
                        {selectedPlatforms.map(pid => {
                          const p = toolConfig.platformOptions.find(o => o.id === pid);
                          const colorMap = { rose: 'border-rose-300 bg-rose-50', sky: 'border-sky-300 bg-sky-50', blue: 'border-blue-300 bg-blue-50' };
                          const textMap = { rose: 'text-rose-700', sky: 'text-sky-700', blue: 'text-blue-700' };
                          const badgeMap = { rose: 'bg-rose-100 text-rose-600', sky: 'bg-sky-100 text-sky-600', blue: 'bg-blue-100 text-blue-600' };
                          return (
                            <div key={pid} className={`border rounded-sm p-4 ${colorMap[p.color]} flex flex-col`}>
                              <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-200/50">
                                <span className={`text-xs font-black ${textMap[p.color]}`}>{p.label}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeMap[p.color]}`}>{p.hint.split('·')[0].trim()}</span>
                              </div>
                              <div className="flex-1 text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap overflow-y-auto custom-scrollbar">
                                {structuredOutput}
                              </div>
                              <button onClick={() => navigator.clipboard.writeText(structuredOutput)}
                                className={`mt-3 text-[10px] font-bold ${textMap[p.color]} border ${colorMap[p.color].split(' ')[0]} px-2 py-1 rounded-sm flex items-center justify-center gap-1 hover:bg-white transition-colors`}>
                                <Copy size={10} /> 复制此版本
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 重新生成 + 底部输入 */}
                  <div className="border-t border-zinc-100 pt-4 mt-4">
                    <div className="flex items-center gap-3">
                      <textarea ref={textareaRef}
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleStructuredGenerate(); } }}
                        placeholder="调整指令重新生成..."
                        className="flex-1 bg-zinc-50 border border-zinc-300 focus:border-zinc-500 rounded-sm p-2.5 text-xs outline-none resize-none min-h-[40px] custom-scrollbar" />
                      <button onClick={handleStructuredGenerate}
                        className={`${ac.btn} text-white text-xs font-bold px-4 py-2.5 rounded-sm shadow-md flex items-center shrink-0 transition-all`}>
                        <RefreshCw size={12} className="mr-1" /> 重新生成
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── 渲染：通用聊天 UI (非结构化工具保持不变) ───
  return (
    <div className="flex-1 bg-zinc-50 p-8 animate-in slide-in-from-bottom-6 duration-500">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex items-start justify-between mb-8 pb-6 border-b border-zinc-200">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-black flex items-center">
              <Layers size={22} className="mr-2.5" /> {workspaceMeta?.title}
            </h2>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mt-1.5">{workspaceMeta?.desc}</p>
          </div>
          <button onClick={handleClearMemory} className="text-xs font-bold text-zinc-400 hover:text-rose-500 transition-colors border border-zinc-200 bg-white px-3 py-1.5 rounded-sm shadow-sm">
            清除该工具缓存
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[650px]">
          <div className="col-span-1 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-5">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block border-b border-zinc-100 pb-2">云端路由策略引擎</span>
              <div>
                <span className="block text-[9px] text-zinc-400 font-bold uppercase mb-1">已锁定云端分配模型</span>
                <span className="text-sm font-black text-zinc-800 bg-zinc-50 px-2 py-1 rounded border border-zinc-200/60 inline-block">{workspaceMeta?.engine}</span>
              </div>
              <div className="mt-6 flex flex-col items-center justify-center py-8 bg-zinc-950 rounded-md border border-zinc-800 shadow-inner group relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #52525b 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
                <BrainCircuit size={52} className="text-indigo-400 mb-4 group-hover:scale-110 transition-transform duration-700" strokeWidth={1.5} />
                <div className="flex items-center space-x-2 z-10 bg-zinc-900/80 px-3 py-1 rounded-full border border-zinc-800">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                  <span className="text-[10px] font-black tracking-widest text-zinc-300 uppercase">Neural Link Active</span>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-4 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">云端计费单耗</span>
              <span className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-sm">-{workspaceMeta?.cost} 算力点</span>
            </div>
          </div>

          <div className="col-span-2 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col h-full relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-black tracking-tight flex items-center"><FileText size={16} className="mr-2 text-indigo-600" /> 智脑 Copilot 连续对话流</h3>
              <span className="text-[9px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-sm flex items-center"><Zap size={10} className="mr-1" /> 工具记忆已隔离</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6 mb-4 custom-scrollbar" ref={chatScrollRef}>
              {currentMessages.length === 0 && (
                <div className="text-center flex flex-col items-center justify-center h-full text-zinc-400 opacity-60">
                  <Layers size={32} className="mb-3" />
                  <p className="text-xs font-bold">已为您装填好底层参数模板，请发送指令。</p>
                </div>
              )}

              {currentMessages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'assistant' && <span className="text-[9px] font-black text-indigo-400 mb-1.5 flex items-center uppercase"><Cpu size={12} className="mr-1" /> AGI 智脑输出</span>}
                  <div className={`relative group max-w-[95%] rounded-md p-4 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-zinc-100 text-zinc-800 rounded-tr-none' : 'bg-indigo-50/50 text-zinc-800 rounded-tl-none font-medium'}`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.role === 'assistant' && (
                      <div className="absolute -top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1 shadow-md">
                        <button onClick={() => { navigator.clipboard.writeText(msg.content); }} className="bg-white border border-zinc-200 hover:text-indigo-600 hover:border-indigo-300 text-zinc-600 p-1.5 rounded-sm flex items-center text-[10px] font-black transition-colors">
                          <Copy size={12} className="mr-1" /> 复制
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isChatting && (
                <div className="flex flex-col items-start mt-4">
                  <span className="text-[9px] font-black text-indigo-400 mb-1.5 flex items-center"><Cpu size={12} className="mr-1" /> AGI 智脑</span>
                  <div className="bg-indigo-50/50 text-zinc-500 rounded-md rounded-tl-none p-4 flex items-center space-x-2"><Loader2 size={14} className="animate-spin text-indigo-500" /><span className="text-xs font-mono">深度推理中...</span></div>
                </div>
              )}
            </div>

            <div className="relative mt-auto border-t border-zinc-100 pt-4">
              <textarea ref={textareaRef} value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="输入新需求 (按 Enter 发送，Shift+Enter换行)..." className="w-full bg-zinc-50 border border-zinc-300 focus:border-indigo-500 rounded-sm p-4 pr-[100px] text-sm outline-none resize-none min-h-[60px] custom-scrollbar" />
              <button onClick={handleSendMessage} disabled={!chatInput.trim() || isChatting} className="absolute bottom-4 right-3 bg-black text-white px-4 py-2.5 rounded-sm shadow-md flex items-center disabled:bg-zinc-300"><Send size={14} className="mr-1.5" /> 发射</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
