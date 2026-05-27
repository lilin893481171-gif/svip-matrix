import React, { useState, useRef, useEffect } from 'react';
import { Layers, Cpu, FileText, Copy, Zap, Send, Loader2, BrainCircuit } from 'lucide-react';

const CF_DOMAIN = 'https://myapp.nikolaboy.com';

// 💾 固态硬盘缓存 Hook
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

export default function TxtCorePanel({ activeWorkspace, workspaceMeta }) {
  // 只属于文案车间的私有记忆
  const [chatSessions, setChatSessions] = usePersistentState('aihub_chatSessions', {}); 
  const [chatInput, setChatInput] = usePersistentState('aihub_chatInput', '');
  const [isChatting, setIsChatting] = useState(false);  
  
  const chatScrollRef = useRef(null);                   
  const textareaRef = useRef(null); 

  const currentMessages = chatSessions[activeWorkspace] || [];

  // 初始化草稿
  useEffect(() => {
    const hasHistory = chatSessions[activeWorkspace] && chatSessions[activeWorkspace].length > 0;
    if (!hasHistory && workspaceMeta?.template) {
      setChatInput(workspaceMeta.template); 
    }
  }, [activeWorkspace]);

  // 滚动条自适应
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [currentMessages, isChatting]);

  // 文本框高度自适应
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 240)}px`;
    }
  }, [chatInput]);

  const handleClearMemory = () => {
    if(window.confirm('确定要清空该工具的对话记忆和草稿吗？')) {
      setChatSessions(prev => ({ ...prev, [activeWorkspace]: [] }));
      setChatInput(workspaceMeta?.template || '');
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatting) return;
    const newUserMsg = { role: 'user', content: chatInput };
    const updatedMessages = [...currentMessages, newUserMsg];
    
    setChatSessions(prev => ({ ...prev, [activeWorkspace]: updatedMessages }));
    setChatInput(''); 
    setIsChatting(true);

    try {
      const apiMessages = [
        { role: "system", content: "你是一个顶级的商业操盘手。禁止输出废话。" },
        ...updatedMessages.map((msg, index) => {
           if (index === 0 && workspaceMeta?.template) {
              return { role: msg.role, content: `【底层参数】：\n${workspaceMeta.template}\n\n【用户要求】：\n${msg.content}` };
           }
           return msg;
        })
      ];

      const response = await fetch(`${CF_DOMAIN}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Matrix-Token': 'matrix-test-token-123' },
        body: JSON.stringify({ model: "deepseek-chat", messages: apiMessages })
      });

      if (!response.ok) throw new Error(`网关响应异常 (${response.status})`);
      const data = await response.json();
      
      setChatSessions(prev => ({
        ...prev,
        [activeWorkspace]: [...(prev[activeWorkspace] || []), { role: 'assistant', content: data.choices[0].message.content }]
      }));
    } catch (err) {
      setChatSessions(prev => ({
        ...prev,
        [activeWorkspace]: [...(prev[activeWorkspace] || []), { role: 'assistant', content: "⚠️ 神经链路中断：" + err.message }]
      }));
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="flex-1 bg-zinc-50 p-8 animate-in slide-in-from-bottom-6 duration-500">
      <div className="max-w-6xl mx-auto w-full">
        
        {/* 顶部标题栏 */}
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

        {/* 左右分栏布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[650px]">
          
          {/* 左侧脑图 */}
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

          {/* 右侧聊天区 */}
          <div className="col-span-2 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col h-full relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
               <h3 className="text-sm font-black tracking-tight flex items-center"><FileText size={16} className="mr-2 text-indigo-600"/> 智脑 Copilot 连续对话流</h3>
               <span className="text-[9px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-sm flex items-center"><Zap size={10} className="mr-1"/> 工具记忆已隔离</span>
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
                  {msg.role === 'assistant' && <span className="text-[9px] font-black text-indigo-400 mb-1.5 flex items-center uppercase"><Cpu size={12} className="mr-1"/> AGI 智脑输出</span>}
                  
                  {/* 🌟 注意这里的 group 属性，它控制着悬浮按钮的显隐 */}
                  <div className={`relative group max-w-[95%] rounded-md p-4 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-zinc-100 text-zinc-800 rounded-tr-none' : 'bg-indigo-50/50 text-zinc-800 rounded-tl-none font-medium'}`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    
                    {/* 🌟 满血复活的复制与RPA按钮 🌟 */}
                    {msg.role === 'assistant' && (
                      <div className="absolute -top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1 shadow-md">
                        <button 
                          onClick={() => { navigator.clipboard.writeText(msg.content); alert('文案已成功复制！'); }} 
                          className="bg-white border border-zinc-200 hover:text-indigo-600 hover:border-indigo-300 text-zinc-600 p-1.5 rounded-sm flex items-center text-[10px] font-black transition-colors"
                        >
                          <Copy size={12} className="mr-1" /> 复制
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isChatting && (
                <div className="flex flex-col items-start mt-4">
                  <span className="text-[9px] font-black text-indigo-400 mb-1.5 flex items-center"><Cpu size={12} className="mr-1"/> AGI 智脑</span>
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