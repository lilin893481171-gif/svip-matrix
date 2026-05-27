import React, { useState, useEffect } from 'react';
import DeepSeekCopilot from './components/DeepSeekCopilot';
import AccountManagerView from './components/AccountManagerView';
import RiskControl from './components/RiskControl';
import Dashboard from './components/Dashboard';
import PublishTask from './components/PublishTask';
import PublishHistoryView from './components/PublishHistoryView';
import InteractionView from './components/InteractionView'; 
import AiHubView from "./components/AiHub/AiHubView";
import { AiTaskProvider } from './components/AiHub/AiTaskContext'; // 引入大脑

import logoImg from './assets/logo.png';
import { 
  Users, Send, Activity, MessageSquare, PieChart, 
  LogOut, Shield, AlignLeft, Sparkles, ChevronRight, Archive, Bot, Smartphone, Gift, X,
  QrCode, RefreshCw, Check // 🌟 新增了扫码登录需要的图标
} from 'lucide-react';

const getElectron = () => {
  if (typeof window !== 'undefined' && window.electron) return window.electron;
  return { ipcRenderer: { invoke: async () => ({}), on: () => {}, removeAllListeners: () => {} } };
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
      className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 justify-center ${ isSidebarCollapsed ? 'px-3' : '' } ${ isActive ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'hover:bg-slate-900 text-slate-400' }`}
    >
      <span className="flex items-center justify-center">{React.cloneElement(icon, { size: isSidebarCollapsed ? 22 : 20 })}</span>
      {!isSidebarCollapsed && <span className="font-bold text-sm ml-3">{label}</span>}
    </button>
  );
}

function StatisticsView({ setActiveTab }) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 pb-10">
      <Dashboard onGoToAccountManager={() => setActiveTab('accounts')} />
    </div>
  );
}

// 🌟 升级版：微信扫码 + 密钥双通道登录界面
function LoginScreen({ onLogin }) {
  const [loginMode, setLoginMode] = useState('wechat'); // 'wechat' 或 'key'
  const [pw, setPw] = useState('');
  const [qrStatus, setQrStatus] = useState('loading'); // loading, ready, scanned

  // 模拟从后端拉取微信登录二维码的动作
  useEffect(() => {
    if (loginMode === 'wechat') {
      setQrStatus('loading');
      const timer = setTimeout(() => {
        setQrStatus('ready');
        // 这里将来要替换成真实的轮询逻辑：检查用户是否已用微信扫码
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loginMode]);

  // 模拟用户掏出手机扫码成功的交互 (为了让你测试，加了个双击二维码直接进的后门)
  const handleSimulateScan = () => {
    setQrStatus('scanned');
    setTimeout(() => {
      onLogin(); // 扫码成功，直接放行进入主界面！
    }, 800);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
      
      {/* 炫酷的背景光晕 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-[400px] p-10 bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl text-center shadow-2xl relative z-10 animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl p-2">
          <img src={logoImg} alt="LOGO" className="w-full h-full object-contain" onError={handleImageError} />
        </div>
        
        <h2 className="text-white font-black text-2xl tracking-widest uppercase">YuMatrixAI</h2>
        <p className="text-red-500 text-xs font-bold mt-2 mb-8 tracking-widest">高端社交管理系统</p>

        {/* ================= 微信扫码通道 ================= */}
        {loginMode === 'wechat' ? (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div 
              className="w-48 h-48 mx-auto bg-white rounded-2xl p-2 mb-4 relative flex items-center justify-center cursor-pointer group shadow-[0_0_30px_rgba(225,29,72,0.15)]"
              onDoubleClick={handleSimulateScan} // 🌟 留给你的测试后门：双击白块直接登录
              title="双击模拟扫码成功"
            >
              {qrStatus === 'loading' ? (
                <div className="flex flex-col items-center text-slate-400">
                  <RefreshCw size={24} className="animate-spin mb-2 text-red-500" />
                  <span className="text-xs font-bold">正在拉取加密通道...</span>
                </div>
              ) : qrStatus === 'scanned' ? (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center animate-in fade-in">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mb-2 shadow-lg shadow-green-500/40">
                    <Check size={24} className="text-white" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">扫码成功，正在验证...</span>
                </div>
              ) : (
                <div className="w-full h-full border-4 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 group-hover:border-red-500/50 transition-colors">
                  {/* 这里将来放后端的真实二维码图片 <img src={qrCodeUrl} /> */}
                  <QrCode size={64} className="text-slate-200 group-hover:text-red-500/50 transition-colors" />
                </div>
              )}
            </div>
            
            <p className="text-slate-400 text-sm font-medium mb-6">
              请使用 <span className="text-green-500 font-bold">微信</span> 扫码安全登录
            </p>

            <button 
              onClick={() => setLoginMode('key')}
              className="text-xs text-slate-500 hover:text-white transition-colors font-bold underline decoration-slate-800 underline-offset-4"
            >
              切换至企业密钥登录
            </button>
          </div>
        ) : (
          /* ================= 企业密钥通道 ================= */
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <input 
              type="password" 
              placeholder="请输入企业授权密钥" 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-white mb-6 focus:border-red-500 outline-none text-center font-mono tracking-widest transition-colors" 
              value={pw} 
              onChange={e => setPw(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && pw === 'yuge666' && onLogin()} 
            />
            <button 
              onClick={() => pw === 'yuge666' && onLogin()} 
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black text-lg py-4 rounded-xl shadow-xl shadow-red-600/20 transition-all flex items-center justify-center active:scale-95"
            >
              启动引擎 <ChevronRight size={18} className="ml-1"/>
            </button>
            
            <button 
              onClick={() => setLoginMode('wechat')}
              className="mt-6 text-xs text-slate-500 hover:text-white transition-colors font-bold underline decoration-slate-800 underline-offset-4"
            >
              返回微信扫码登录
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false); // 🌟 设为 false 让其先展示登录页
  const [activeTab, setActiveTab] = useState('publish');
  const [accounts, setAccounts] = useState([]);
  const [videoList, setVideoList] = useState([]);
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [publishHistory, setPublishHistory] = useState([]);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 🌟🌟🌟 渐进式拦截核心状态
  const [isPhoneBound, setIsPhoneBound] = useState(false); 
  const [showBindModal, setShowBindModal] = useState(false); 

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
            group: item.group_name, status: item.status, customUrl: item.custom_url,
            real_name: item.real_name, username: item.username, user_id: item.user_id,
            avatar: item.avatar, followers: item.followers, following: item.following,
            posts: item.posts, total_views: item.total_views
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

  // 🌟 处理手机号绑定提交 (模拟)
  const handlePhoneSubmit = (e) => {
    e.preventDefault();
    setIsPhoneBound(true);
    setShowBindModal(false);
    alert('🎉 绑定成功！已为您下发 100 点初始算力金，请尽情创作吧！');
  };

  if (!isLoggedIn) return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;

  return (
    <AiTaskProvider>
      <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden select-none relative">
        
        {/* 🌟🌟🌟 新增：高级感的手机号拦截绑定弹窗 */}
        {showBindModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4 relative overflow-hidden animate-in zoom-in-95">
              
              {/* 装饰性背景 */}
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-red-50 to-white -z-10"></div>
              
              <button 
                onClick={() => setShowBindModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center text-center mt-2 relative">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30 mb-6">
                  <Gift size={32} className="text-white" />
                </div>
                
                <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">激活算力引擎</h3>
                <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
                  为了保障服务安全及遵守相关实名规定，<br/>
                  绑定手机号后，我们将为您自动下发 <strong className="text-red-500">100 点算力金</strong>。
                </p>

                <form onSubmit={handlePhoneSubmit} className="w-full space-y-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Smartphone size={18} className="text-slate-400" />
                    </div>
                    <input 
                      type="tel" 
                      placeholder="请输入中国大陆手机号码" 
                      required
                      pattern="[1][3-9][0-9]{9}"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-sm text-slate-800 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all font-medium placeholder:font-normal"
                    />
                  </div>
                  
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      placeholder="验证码" 
                      required
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-3.5 px-4 text-sm text-slate-800 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all font-medium placeholder:font-normal"
                    />
                    <button 
                      type="button" 
                      className="w-28 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      获取验证码
                    </button>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-black py-4 rounded-xl shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all mt-2"
                  >
                    立即绑定并领取算力
                  </button>
                </form>

                <p className="text-[11px] text-slate-400 mt-6">
                  点击绑定即表示您同意《Matrix AI 服务协议》及《隐私条款》
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 🌟 在发布页面显示带气泡引导的悬浮球 */}
        {activeTab === 'publish' && (
          <div className="fixed bottom-8 right-8 z-30 flex flex-col items-end gap-3">
            {!isCopilotOpen && (
              <div 
                className="bg-white px-4 py-2.5 rounded-2xl shadow-2xl border border-red-100 relative animate-bounce flex items-center gap-2"
                style={{ filter: 'drop-shadow(0 10px 15px rgba(225, 29, 72, 0.1))' }}
              >
                <span className="text-[13px] font-black text-slate-700 tracking-tight">
                  选好视频后，点击我唤醒 AI 助理
                </span>
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <div className="absolute -bottom-1 right-6 w-3 h-3 bg-white border-r border-b border-red-100 rotate-45"></div>
              </div>
            )}

            <button
              onClick={() => setIsCopilotOpen(true)}
              className="w-14 h-14 bg-gradient-to-br from-red-500 to-rose-600 rounded-full shadow-2xl shadow-red-500/40 flex items-center justify-center hover:scale-110 hover:shadow-red-500/60 transition-all duration-300 group border-2 border-red-400/30"
              title="唤醒 AI 创作助理"
            >
              <Sparkles className="text-white w-6 h-6 group-hover:animate-pulse" />
            </button>

            {/* 🌟 传递拦截状态给子组件 */}
            <DeepSeekCopilot 
              isOpen={isCopilotOpen} 
              onClose={() => setIsCopilotOpen(false)} 
              activeVideo={activeVideo}
              updateConfig={updateConfigGlobal}
              isPhoneBound={isPhoneBound}
              onRequestBind={() => setShowBindModal(true)}
            />
          </div>
        )}

        <div className={`bg-slate-950 text-slate-300 flex flex-col shadow-2xl z-20 transition-all border-r border-slate-900 flex-shrink-0 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
          <div className="h-20 flex items-center px-4 border-b border-slate-800/50">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center mr-3 shadow-lg shadow-red-600/30 overflow-hidden p-0.5">
              <img src={logoImg} alt="LOGO" className="w-full h-full object-contain" onError={handleImageError} />
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col">
                <span className="text-base font-black text-white tracking-widest uppercase">YuMatrixAI</span>
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
            <NavItem icon={<Bot />} label="AI 算力引擎中枢" id="aihub" activeTab={activeTab} setActiveTab={setActiveTab} isSidebarCollapsed={isSidebarCollapsed} />
            <NavItem icon={<Activity />} label="流速与风控" id="monitor" activeTab={activeTab} setActiveTab={setActiveTab} isSidebarCollapsed={isSidebarCollapsed} />
            <NavItem icon={<MessageSquare />} label="评论私信总控" id="interact" activeTab={activeTab} setActiveTab={setActiveTab} isSidebarCollapsed={isSidebarCollapsed} />
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
              {activeTab === 'aihub' && 'Matrix AI Hub 商业级算力聚合分发引擎'}
              {activeTab !== 'publish' && activeTab !== 'aihub' && '全平台聚合调度驾驶舱'}
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-red-500 flex items-center justify-center font-bold text-sm shadow-md border border-red-500/30">N</div>
              <span className="text-sm font-bold text-slate-700">超级管理员</span>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'dashboard' && <StatisticsView setActiveTab={setActiveTab} />}
            {activeTab === 'accounts' && <AccountManagerView accounts={accounts} setAccounts={setAccounts} />}
            {activeTab === 'publish' && <PublishTask setActiveTab={setActiveTab} setIsCopilotOpen={setIsCopilotOpen} accounts={accounts} videoList={videoList} setVideoList={setVideoList} activeVideoId={activeVideoId} setActiveVideoId={setActiveVideoId} publishHistory={publishHistory} setPublishHistory={setPublishHistory} />}
            {activeTab === 'history' && <PublishHistoryView videoList={videoList} setVideoList={setVideoList} publishHistory={publishHistory} setActiveTab={setActiveTab} setActiveVideoId={setActiveVideoId} />}
            {activeTab === 'monitor' && <RiskControl/>}
            {activeTab === 'interact' && <InteractionView accounts={accounts} />}
            
            {/* 🌟 传递拦截状态给主算力大盘 */}
            {activeTab === 'aihub' && (
              <AiHubView 
                isPhoneBound={isPhoneBound} 
                onRequestBind={() => setShowBindModal(true)} 
              />
            )}
          </div>
        </div>
      </div>
    </AiTaskProvider>
  );
}