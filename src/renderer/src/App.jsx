import React, { useState, useEffect, useRef, useMemo } from 'react';
import DeepSeekCopilot from './components/DeepSeekCopilot';
import FanChat from './components/FanChat';
import AccountManagerView from './components/AccountManagerView';
import RiskControl from './components/RiskControl';
import Dashboard from './components/Dashboard';
import PublishTask from './components/PublishTask';
import PublishHistoryView from './components/PublishHistoryView'; // 🚀 找回了我们的神器！

import { 
  Users, Send, Activity, MessageSquare, PieChart, 
  LogOut, Plus, X, Lock, Shield, RefreshCw, 
  Clock, MapPin, ShoppingBag, Hash, PlayCircle, 
  MessageCircle, Globe, ChevronRight, CheckCircle,
  FolderOpen, TrendingUp, DollarSign, UploadCloud, 
  Trash2, Image, Loader2, AlertTriangle, Settings,
  Search, Bot, Reply, MoreVertical, Smartphone, 
  AlignLeft, Scissors, Video, Edit, FolderTree, 
  Archive, XCircle, ToggleRight, Eye, Download, 
  Link as LinkIcon, AtSign, Rss, Radio, Cpu, FileText, Zap,
  Sparkles, Wand2, Smile, Menu
} from 'lucide-react';

const logoImg = './assets/logo.png';

const getElectron = () => {
  if (typeof window !== 'undefined' && window.electron) return window.electron;
  return {
    ipcRenderer: {
      invoke: async (channel, data) => {
        console.warn(`[Mock] 模拟调用: ${channel}`, data);
        if (channel === 'select-local-videos') alert("⚠️ 后台尚未重启！请在终端按 Ctrl+C 然后 npm run dev！");
        return channel === 'db-get-accounts' ? [] : { success: false, message: '非原生环境' };
      },
      on: () => {}, 
      removeAllListeners: () => {}
    }
  };
};

const handleImageError = (e) => {
  e.target.onerror = null;
  e.target.src = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9ImJvbGQiIGZvbnQtc2l6ZT0iNDAiPk48L3RleHQ+PC9zdmc+";
};

function NavItem({ icon, label, id, activeTab, setActiveTab, isSidebarCollapsed }) {
  const isActive = activeTab === id;
  return (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 justify-center ${ 
        isSidebarCollapsed ? 'px-3' : '' 
      } ${ 
        isActive ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'hover:bg-slate-900 text-slate-400' 
      }`}
    >
      <span className="flex items-center justify-center">{React.cloneElement(icon, { size: isSidebarCollapsed ? 22 : 20 })}</span>
      {!isSidebarCollapsed && <span className="font-bold text-sm ml-3">{label}</span>}
    </button>
  );
}

function StatisticsView({ setActiveTab }) {
  const electron = getElectron();
  const [globalStats, setGlobalStats] = useState({
    totalPlays: '0 W', totalFans: '0', interactions: '0 W', revenue: '¥0',
    trends: { plays: '+0%', fans: '+0%', interactions: '+0%', revenue: '+0%' },
    platformBreakdown: []
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await electron.ipcRenderer.invoke('get-global-stats');
        if (data) setGlobalStats(data);
      } catch (e) { console.error(e); }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 pb-10">
      <Dashboard onGoToAccountManager={() => setActiveTab('accounts')} />
    </div>
  );
}

function InteractionView() {
  const electron = getElectron();
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [currentReplyId, setCurrentReplyId] = useState(null);
  const [msgType, setMsgType] = useState('评论');

  const fetchMessages = async () => {
    try {
      const data = await electron.ipcRenderer.invoke('get-messages');
      if (data) setMessages(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSummonSandbox = async () => {
    if (!activeMsg) return;
    try {
      const res = await electron.ipcRenderer.invoke('open-reply-sandbox', { messageId: activeMsg.id, replyText: replyText });
      if (res.success) { setReplyText(''); } else { alert(`唤起失败: ${res.message}`); }
    } catch (e) { console.error(e); alert('调用降临引擎失败，请检查控制台。'); }
  };

  const activeMsg = messages.find(m => m.id === currentReplyId);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in max-w-7xl mx-auto pb-10">
      <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50">
        <div className="p-3 border-b border-slate-200">
          <div className="flex space-x-2 mb-3">
            <button onClick={() => { setMsgType('评论'); setCurrentReplyId(null); setReplyText(''); }} className={`flex-1 font-bold text-sm py-1.5 rounded-md shadow-sm transition ${msgType === '评论' ? 'bg-white border border-red-500 text-red-600' : 'bg-transparent border border-transparent text-slate-500 hover:bg-slate-200'}`}>
              聚合评论
            </button>
            <button onClick={() => { setMsgType('私信'); setCurrentReplyId(null); setReplyText(''); }} className={`flex-1 font-bold text-sm py-1.5 rounded-md shadow-sm transition ${msgType === '私信' ? 'bg-white border border-red-500 text-red-600' : 'bg-transparent border border-transparent text-slate-500 hover:bg-slate-200'}`}>
              聚合私信
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input type="text" placeholder="全局搜索粉丝或内容..." className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none focus:border-red-500 bg-white" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {messages.filter(msg => msg.type === msgType).map((msg) => (
            <div key={msg.id} onClick={() => { setCurrentReplyId(msg.id); setReplyText(''); }} className={`p-4 border-b border-slate-100 cursor-pointer transition ${currentReplyId === msg.id ? 'bg-red-50/50 border-l-4 border-l-red-600' : 'hover:bg-white border-l-4 border-l-transparent'}`}>
              <div className="flex justify-between items-start mb-1">
                <div className="text-sm font-bold text-slate-800">{msg.user}</div>
                <div className="text-[10px] text-slate-400">{msg.time}</div>
              </div>
              <p className="text-xs text-slate-600 line-clamp-2 mb-2">{msg.content}</p>
              <div className="flex justify-between items-center">
                <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">{msg.platform} · {msg.account}</span>
                {msg.status !== '已回复' ? <span className="w-2 h-2 rounded-full bg-red-500"></span> : <span className="text-[10px] text-emerald-500 flex items-center"><CheckCircle size={10} className="mr-0.5"/> 已复</span>}
              </div>
            </div>
          ))}
          {messages.filter(msg => msg.type === msgType).length === 0 && <div className="text-center text-slate-400 text-xs py-10">暂无互动数据</div>}
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-slate-50/30">
        <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 shadow-sm z-10">
          <div>
            <div className="font-bold text-slate-800">{activeMsg ? `回复: ${activeMsg.user}` : '选择左侧消息开始回复'}</div>
            {activeMsg && <div className="text-xs text-slate-500 mt-0.5">来源：{activeMsg.platform}</div>}
          </div>
          <button className="text-slate-400 hover:text-slate-600"><MoreVertical size={18}/></button>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          {activeMsg && (
            <>
              <div className="flex flex-col items-center mb-6"><span className="text-[10px] bg-slate-200 text-slate-500 px-3 py-1 rounded-full border border-slate-300">针对选中的消息</span></div>
              <div className="flex items-start mb-6">
                <div className="w-10 h-10 rounded-full bg-slate-300 mr-3 flex items-center justify-center font-bold text-slate-600 text-lg">{activeMsg.user[0]}</div>
                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm text-sm text-slate-700 max-w-lg">
                  {activeMsg.content}
                  <div className="text-[10px] text-slate-400 mt-2">{activeMsg.time}</div>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="mb-3 flex gap-2 overflow-x-auto">
            <span className="text-xs font-medium text-slate-500 flex items-center bg-slate-100 px-2 py-1 rounded"><Bot size={14} className="mr-1 text-red-600"/> AI话术推荐:</span>
            <button onClick={() => setReplyText('感谢支持！已收到您的留言~')} className="text-xs border border-red-200 text-red-600 bg-red-50 px-3 py-1 rounded-full hover:bg-red-100 transition whitespace-nowrap">感谢支持！</button>
          </div>
          <div className="relative flex flex-col gap-2">
            <div className="relative">
              <textarea 
                value={replyText} onChange={e => setReplyText(e.target.value)} disabled={!activeMsg}
                placeholder={activeMsg ? "输入回复内容，点击下方唤起沙盒..." : "请先选择一条消息"} 
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 pb-14 outline-none focus:border-emerald-500 text-sm resize-none transition disabled:opacity-50"
                style={{ minHeight: '110px' }}
              ></textarea>
              <div className="absolute right-3 bottom-3 flex gap-2 items-center">
                <button className="p-2 text-slate-400 hover:text-emerald-600 transition bg-white border border-slate-200 rounded-lg shadow-sm"><Clock size={16}/></button>
                <button onClick={handleSummonSandbox} disabled={!activeMsg || !replyText.trim()} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-2 px-4 rounded-lg shadow-md transition flex items-center text-sm disabled:opacity-50 active:scale-95">
                  <Shield size={14} className="mr-1.5"/>唤起沙盒
                </button>
              </div>
            </div>
            <div className="text-xs text-slate-400 px-2 mt-1">💡 提示：话术将被自动复制，在真实网页按 <strong className="text-slate-600">Ctrl+V</strong> 即可发送</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState('');
  return (
    <div className="h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
      <div className="w-[400px] p-10 bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl text-center shadow-2xl relative z-10 animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-white rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl p-2"><img src={logoImg} alt="LOGO" className="w-full h-full object-contain" onError={handleImageError} /></div>
        <h2 className="text-white font-black text-2xl tracking-widest uppercase">NIKOLATOYS SVIP</h2>
        <p className="text-red-500 text-xs font-bold mt-2 mb-8">高端社交管理系统</p>
        <input type="password" placeholder="请输入企业授权密钥" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-white mb-6 focus:border-red-500 outline-none text-center font-mono tracking-widest" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && pw === 'yuge666' && onLogin()} />
        <button onClick={() => pw === 'yuge666' && onLogin()} className="w-full bg-red-600 hover:bg-red-700 text-white font-black text-lg py-4 rounded-xl shadow-xl transition-all flex items-center justify-center">启动引擎 <ChevronRight size={18} className="ml-1"/></button>
      </div>
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [activeTab, setActiveTab] = useState('publish');
  const [accounts, setAccounts] = useState([]);
  const [videoList, setVideoList] = useState([]);
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [publishHistory, setPublishHistory] = useState([]);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const activeVideo = videoList.find(v => v.id === activeVideoId);

  const updateConfigGlobal = (level, key, value) => {
    if (!activeVideoId) return;
    setVideoList(prev => prev.map(v => {
      if (v.id !== activeVideoId) return v;
      if (level === 'universal') {
        return { ...v, config: { ...v.config, universal: { ...v.config.universal, [key]: value } } };
      } else {
        return { ...v, config: { ...v.config, platforms: { ...v.config.platforms, [level]: { ...(v.config.platforms[level] || {}), [key]: value } } } };
      }
    }));
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    const electron = getElectron();
    
    async function loadData() {
      try {
        const data = await electron.ipcRenderer.invoke('db-get-accounts');
        if (Array.isArray(data)) {
          setAccounts(data.map(item => ({ 
            id: item.id, alias: item.alias, platform: item.platform, 
            group: item.group_name, status: item.status, customUrl: item.custom_url 
          })));
        }
      } catch (error) { console.error(error); }
    }
    loadData();

    const handleUpdate = (event, payload) => {
      const safeMsg = (typeof payload.error === 'object' && payload.error) 
        ? String(payload.error.message || JSON.stringify(payload.error)) 
        : String(payload.error || payload.status || '未知状态');
      
      setPublishHistory(prev => {
        const exists = prev.find(item => item.historyId === payload.historyId);
        if (exists) {
          return prev.map(item => item.historyId === payload.historyId 
            ? { ...item, status: payload.status, message: safeMsg, platform: payload.platform || item.platform, accountAlias: payload.accountAlias || item.accountAlias } 
            : item
          );
        }
        return [{ 
          historyId: payload.historyId, videoId: payload.videoId, videoName: payload.title || '未知视频', 
          platform: payload.platform || '', accountAlias: payload.accountAlias || '', 
          status: payload.status, time: new Date(payload.timestamp).toLocaleTimeString(), message: safeMsg 
        }, ...prev];
      });

      if (['任务成功', '任务失败', '已取消'].includes(payload.status)) {
        setVideoList(prev => prev.map(v => v.id === payload.videoId 
          ? { ...v, status: payload.status === '任务成功' ? '发布完成' : payload.status === '已取消' ? '已取消' : '含失败项' } 
          : v));
      }
    };

    if (electron.ipcRenderer.on) electron.ipcRenderer.on('task-progress-update', handleUpdate);
    return () => { if (electron.ipcRenderer.removeAllListeners) electron.ipcRenderer.removeAllListeners('task-progress-update'); };
  }, [isLoggedIn]);

  if (!isLoggedIn) return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden select-none relative">
      <button
        onClick={() => setIsCopilotOpen(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-br from-red-500 to-rose-600 rounded-full shadow-2xl shadow-red-500/40 flex items-center justify-center hover:scale-110 hover:shadow-red-500/60 transition-all duration-300 z-30 group border-2 border-red-400/30"
        title="唤醒 DeepSeek 助理"
      >
        <Sparkles className="text-white w-6 h-6 group-hover:animate-pulse" />
      </button>

      <DeepSeekCopilot 
        isOpen={isCopilotOpen} 
        onClose={() => setIsCopilotOpen(false)} 
        activeVideo={activeVideo}
        updateConfig={updateConfigGlobal}
      />

      {/* 左侧导航栏 */}
      <div className={`bg-slate-950 text-slate-300 flex flex-col shadow-2xl z-20 transition-all border-r border-slate-900 flex-shrink-0 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="h-20 flex items-center px-4 border-b border-slate-800/50">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center mr-3 shadow-lg shadow-red-600/30 overflow-hidden p-0.5">
            <img src={logoImg} alt="LOGO" className="w-full h-full object-contain" onError={handleImageError} />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col">
              <span className="text-base font-black text-white tracking-widest uppercase">NIKOLATOYS SVIP</span>
              <span className="text-[10px] text-red-500 font-bold tracking-widest">高端社交管理系统</span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`ml-auto p-2 rounded-xl hover:bg-slate-900 transition ${isSidebarCollapsed ? 'rotate-180' : ''}`}
          >
            <AlignLeft size={20} />
          </button>
        </div>

        <div className="flex-1 py-6 space-y-1.5 px-3">
          <NavItem icon={<PieChart />} label="全域数据罗盘" id="dashboard" activeTab={activeTab} setActiveTab={setActiveTab} isSidebarCollapsed={isSidebarCollapsed} />
          <NavItem icon={<Users />} label="社交账号矩阵" id="accounts" activeTab={activeTab} setActiveTab={setActiveTab} isSidebarCollapsed={isSidebarCollapsed} />
          <NavItem icon={<Send />} label="千人千面发布台" id="publish" activeTab={activeTab} setActiveTab={setActiveTab} isSidebarCollapsed={isSidebarCollapsed} />
          <NavItem icon={<Activity />} label="流速与风控" id="monitor" activeTab={activeTab} setActiveTab={setActiveTab} isSidebarCollapsed={isSidebarCollapsed} />
          <NavItem icon={<MessageSquare />} label="评论私信总控" id="interact" activeTab={activeTab} setActiveTab={setActiveTab} isSidebarCollapsed={isSidebarCollapsed} />
          {/* 🚀 这里的 ID 是 history，它会渲染 PublishHistoryView */}
          <NavItem icon={<Archive />} label="发布队列与历史" id="history" activeTab={activeTab} setActiveTab={setActiveTab} isSidebarCollapsed={isSidebarCollapsed} />
        </div>

        <div className="p-4 border-t border-slate-900 bg-black/20">
          {!isSidebarCollapsed && (
            <div className="flex items-center mb-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              <Shield size={12} className="mr-2 text-red-500" /> 物理隔离已激活
            </div>
          )}
          <button 
            onClick={() => setIsLoggedIn(false)} 
            className="text-slate-500 hover:text-red-500 transition flex items-center w-full p-2 hover:bg-slate-900 rounded-lg group"
          >
            <LogOut size={18} className="mr-2 group-hover:rotate-180 transition-all duration-300" />
            {!isSidebarCollapsed && <span className="text-sm font-bold">安全退出系统</span>}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-100/50">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shadow-sm flex-shrink-0">
          <div className="font-bold text-slate-700 text-lg">
            {activeTab === 'publish' && '千人千面超级工作站 (12平台 1:1 原生复刻)'}
            {activeTab !== 'publish' && '全平台聚合调度驾驶舱'}
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-red-500 flex items-center justify-center font-bold text-sm shadow-md border border-red-500/30">N</div>
            <span className="text-sm font-bold text-slate-700">超级管理员</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'dashboard' && <StatisticsView setActiveTab={setActiveTab} />}
          {activeTab === 'accounts' && <AccountManagerView accounts={accounts} setAccounts={setAccounts} />}
          {/* 🚀 注入了 setActiveTab 给发布页，让它发完立刻跳转！ */}
          {activeTab === 'publish' && <PublishTask setActiveTab={setActiveTab} setIsCopilotOpen={setIsCopilotOpen} accounts={accounts} videoList={videoList} setVideoList={setVideoList} activeVideoId={activeVideoId} setActiveVideoId={setActiveVideoId} publishHistory={publishHistory} setPublishHistory={setPublishHistory} />}
          
          {/* 🚀 这才是拥有“接管屏幕”功能的终极看板！ */}
          {activeTab === 'history' && <PublishHistoryView videoList={videoList} setVideoList={setVideoList} publishHistory={publishHistory} setActiveTab={setActiveTab} setActiveVideoId={setActiveVideoId} />}
          
          {activeTab === 'monitor' && <RiskControl/>}
          {activeTab === 'interact' && <InteractionView />}
        </div>
      </div>
    </div>
  );
}