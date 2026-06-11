import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  PlayCircle, Users, RefreshCw, Trash2,
  BarChart2, Clock, ArrowUpRight, Sparkles, Flame, Crown,
  Lock, ShieldAlert, Heart, Radar
} from 'lucide-react';
import { useToast } from './ToastContext';

// ==============================================
// 🎨 平台专属品牌色与 Logo 映射字典
// ==============================================
const PLATFORM_STYLES = {
  '抖音': { bg: 'bg-[#151723]', text: '抖' },
  '小红书': { bg: 'bg-[#ff2442]', text: '小' },
  'B站': { bg: 'bg-[#fb7299]', text: 'B' },
  '快手': { bg: 'bg-[#ff5000]', text: '快' },
  '微信视频号': { bg: 'bg-[#07c160]', text: '微' },
  '百家号': { bg: 'bg-[#2162e4]', text: '百' },
  '爱奇艺号': { bg: 'bg-[#00cc36]', text: '爱' },
  '知乎': { bg: 'bg-[#0066ff]', text: '知' },
  '微博': { bg: 'bg-[#ff8200]', text: '微' },
  '企鹅号(腾讯)': { bg: 'bg-[#1b7ef2]', text: '企' },
  '腾讯视频': { bg: 'bg-[#ff5c38]', text: '腾' },
  '大鱼号(优酷)': { bg: 'bg-[#ff6600]', text: '大' }
};

// ==============================================
// ⏱️ 核心新增：24小时防风控冷却 Hook
// ==============================================
const COOLDOWN_TIME = 24 * 60 * 60 * 1000; 

const useSyncCooldown = () => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const lastSyncStr = localStorage.getItem('cloud_matrix_last_sync');
    if (lastSyncStr) {
      const lastSyncTime = parseInt(lastSyncStr, 10);
      const passedTime = Date.now() - lastSyncTime;
      if (passedTime < COOLDOWN_TIME) {
        setTimeLeft(COOLDOWN_TIME - passedTime);
      } else {
        localStorage.removeItem('cloud_matrix_last_sync');
      }
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          localStorage.removeItem('cloud_matrix_last_sync');
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const triggerCooldown = () => {
    localStorage.setItem('cloud_matrix_last_sync', Date.now().toString());
    setTimeLeft(COOLDOWN_TIME);
  };

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return { isCoolingDown: timeLeft > 0, formattedTime: formatTime(timeLeft), triggerCooldown };
};

// === 流量修仙段位计算器 ===
const getCultivationRank = (followers) => {
  if (followers < 1000) return { title: '炼气期', sub: '初入江湖', next: 1000, color: 'from-slate-500 to-slate-700' };
  if (followers < 10000) return { title: '筑基期', sub: '初级操盘手', next: 10000, color: 'from-emerald-500 to-teal-700' };
  if (followers < 100000) return { title: '结丹期', sub: '矩阵小成', next: 100000, color: 'from-blue-500 to-indigo-700' };
  if (followers < 1000000) return { title: '元婴期', sub: '一方诸侯', next: 1000000, color: 'from-purple-500 to-fuchsia-700' };
  if (followers < 10000000) return { title: '化神期', sub: '全网霸主', next: 10000000, color: 'from-rose-500 to-red-700' };
  return { title: '渡劫期', sub: '流量真仙', next: null, color: 'from-yellow-400 to-amber-600' };
};

// 数字滚动动画 Hook
const useCountUp = (target, duration = 1500) => {
  const [count, setCount] = useState(0);
  const countRef = useRef(null);
  
  useEffect(() => {
    let start = 0;
    const increment = target / (duration / 16);
    countRef.current = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(countRef.current);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    
    return () => clearInterval(countRef.current);
  }, [target, duration]);
  
  return count;
};

export default function Dashboard({ onGoToAccountManager }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const toast = useToast();
  
  // 💥 核心：全局 30天 播放总量实时计算
  const global30DaysViews = useMemo(() => {
    let sum = 0;
    stats?.accounts?.forEach(acc => {
      if (acc.trend_data) {
        try {
          const arr = JSON.parse(acc.trend_data);
          sum += arr.reduce((s, item) => s + item.views, 0);
        } catch(e) {}
      }
    });
    return sum;
  }, [stats?.accounts]);

  const topTotalViews = useCountUp(global30DaysViews);
  const totalFollowers = useCountUp(stats?.totalFollowers || 0);

  const { isCoolingDown, formattedTime, triggerCooldown } = useSyncCooldown();

  const loadDashboardData = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const [statsRes, accountsRes] = await Promise.all([
        window.electron.ipcRenderer.invoke('get-dashboard-stats'),
        window.electron.ipcRenderer.invoke('db-get-accounts')
      ]);

      setStats({
        ...(statsRes.success ? statsRes.data : {}),
        accounts: accountsRes || []
      });
    } catch (err) {
      console.error('仪表盘数据请求失败：', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData(true);
  }, []); 

  const handleSyncAll = async () => {
    if (syncingAll || isCoolingDown) return;
    if (!window.confirm('【风控警告】为保护账号安全，全网数据每天仅限提取1次。提取后功能将被物理锁定24小时。确认执行吗？')) return;

    setSyncingAll(true);
    try {
      const res = await window.electron.ipcRenderer.invoke('sync-account-stats-all');
      if (res.success) {
        await loadDashboardData();
        triggerCooldown();
        toast.success('全网数据同步完成');
      } else {
        toast.error('部分节点同步受阻：' + res.message);
      }
    } catch (err) {
      console.error(err);
      toast.error('系统异常：' + err.message);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleBasicSync = async (accountId, platform) => {
    if (syncingId === accountId) return;
    // Per-account cooldown (24h)
    const cooldownKey = `sync_cooldown_${accountId}`;
    const lastSync = localStorage.getItem(cooldownKey);
    if (lastSync && Date.now() - parseInt(lastSync) < 24 * 60 * 60 * 1000) {
      toast.warning(`${platform} 今日已同步，请24小时后再试`);
      return;
    }
    setSyncingId(accountId);
    try {
      const res = await window.electron.ipcRenderer.invoke('sync-account-stats', { accountId, platform });
      if (res.success) {
        await loadDashboardData();
        localStorage.setItem(cooldownKey, Date.now().toString());
        toast.success(`${platform} 同步完成`);
      } else {
        toast.error(`[${platform}] 基础同步失败：` + res.message);
      }
    } catch (err) {
      console.error(err);
      toast.error(`[${platform}] 同步异常：` + err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleDeepSync = async (accountId, platform) => {
    if (syncingId === accountId) return;
    setSyncingId(accountId);
    try {
      const res = await window.electron.ipcRenderer.invoke('sync-30days-data', { accountId, platform });
      if (res.success) {
        await loadDashboardData();
        toast.success(`${platform} 深度提取完成`);
      } else {
        toast.error(`[${platform}] 深度提取失败：` + res.message);
      }
    } catch (err) {
      console.error(err);
      toast.error('系统异常：' + err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleDeleteAccount = async (id) => {
    if (!window.confirm('警告：确定要彻底销毁该节点及其所有历史数据吗？')) return;
    try {
      const res = await window.electron.ipcRenderer.invoke('db-delete-account', Number(id));
      if (res.success) {
        await loadDashboardData(); 
      } else {
        toast.error('删除失败：' + res.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
      <div className="relative">
        <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
        <Sparkles className="absolute -bottom-2 -right-2 w-6 h-6 text-amber-500 animate-pulse" />
      </div>
      <p className="mt-4 text-slate-500 font-medium">加载全网数据中...</p>
    </div>
  );

  const rankInfo = getCultivationRank(stats?.totalFollowers || 0);
  const progressPercent = rankInfo.next ? Math.min(100, ((stats?.totalFollowers || 0) / rankInfo.next) * 100) : 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
      {/* 顶部标题栏 */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-[clamp(1.5rem,3vw,2.5rem)] font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-700">
            全平台聚合调度驾驶舱
          </h1>
          
          <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50/80 border border-blue-100/50 shadow-sm backdrop-blur-sm">
              <Flame size={16} className="text-orange-500 animate-pulse drop-shadow-md" />
              <span className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 tracking-wider">
                运筹帷幄之中，决胜全网之外！掌控矩阵，裂变未来。
              </span>
            </div>
            
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-white/60 border border-slate-200/60 px-2 py-1 rounded-md shadow-sm">
              <Clock size={12} className="text-slate-400" />
              Last Sync: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          <button 
            onClick={handleSyncAll}
            disabled={syncingAll || loading || isCoolingDown}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg shadow-md font-medium transition-all ${
              isCoolingDown 
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-400/50' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white hover:shadow-lg active:scale-95'
            }`}
          >
            {isCoolingDown ? (
              <Lock size={18} />
            ) : (
              <RefreshCw size={18} className={syncingAll ? 'animate-spin' : ''} />
            )}
            
            {syncingAll 
              ? '矩阵抽水中...' 
              : isCoolingDown 
                ? `系统锁定: ${formattedTime}` 
                : '一键全网同步'}
          </button>
          
          <p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400 font-medium tracking-wide">
            <ShieldAlert size={11} className="text-orange-400" />
            防风控策略：每日限同步1次
          </p>
        </div>
      </div>

      {/* 核心数据卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all border border-slate-200 p-6 relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-24 h-24 bg-blue-50 rounded-full opacity-70 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-blue-600 mb-3">
              <PlayCircle size={20} />
              <span className="font-medium">30天播放总量</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-1">
              {topTotalViews.toLocaleString()}
            </h2>
            <div className="flex items-center text-xs text-slate-500">
              <ArrowUpRight size={12} className="mr-1 text-green-500" />
              <span>涵盖所有节点近30天播放累加</span>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all border border-slate-200 p-6 relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-24 h-24 bg-indigo-50 rounded-full opacity-70 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Users size={20} />
              <span className="font-medium">总粉丝数</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-1">
              {totalFollowers.toLocaleString()}
            </h2>
            <div className="flex items-center text-xs text-slate-500">
              <ArrowUpRight size={12} className="mr-1 text-green-500" />
              <span>涵盖所有节点粉丝指标累加</span>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all border border-slate-200 p-6 relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-24 h-24 bg-amber-50 rounded-full opacity-70 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-amber-600 mb-3">
              <BarChart2 size={20} />
              <span className="font-medium">账号总数</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-1">
              {stats?.accounts?.length || 0}
            </h2>
            <div className="flex items-center text-xs text-slate-500">
              <span>覆盖 {new Set(stats?.accounts?.map(acc => acc.platform)).size} 个平台</span>
            </div>
          </div>
        </div>

        <div className={`bg-gradient-to-br ${rankInfo.color} rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 relative overflow-hidden group`}>
          <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/10 rounded-full opacity-70 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="relative z-10 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Crown size={20} className="text-yellow-300 drop-shadow-md" />
                <span className="font-medium text-white/90">帝国扩张段位</span>
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-white/20 rounded-md backdrop-blur-md border border-white/10">
                {rankInfo.sub}
              </span>
            </div>
            
            <h2 className="text-3xl md:text-4xl font-black tracking-tight drop-shadow-lg mb-3">
              {rankInfo.title}
            </h2>
            
            <div className="mt-auto">
              <div className="flex justify-between text-[10px] sm:text-xs mb-1.5 opacity-90 font-medium">
                <span>当前修为: {(stats?.totalFollowers || 0).toLocaleString()}</span>
                {rankInfo.next ? <span>目标: {rankInfo.next.toLocaleString()}</span> : <span>已臻化境</span>}
              </div>
              <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden backdrop-blur-sm border border-black/10">
                <div 
                  className="h-full bg-gradient-to-r from-white/50 to-white rounded-full relative transition-all duration-1000 ease-out"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute right-0 top-0 bottom-0 w-3 bg-white blur-[2px] animate-pulse"></div>
                </div>
              </div>
              {rankInfo.next && (
                <p className="text-[10px] mt-1.5 opacity-80 text-right">
                  离突破下一境界还需 <span className="font-bold">{(rankInfo.next - (stats?.totalFollowers || 0)).toLocaleString()}</span> 粉
                </p>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 账号列表 */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 size={18} className="text-blue-600" />
            节点雷达阵列
          </h3>
          <span className="text-sm text-slate-500 font-medium">存活 {stats?.accounts?.length || 0} 个节点</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">账号名称</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">平台</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">粉丝数</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1"><PlayCircle size={14} className="text-blue-500"/> 30天播放</div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1"><Heart size={14} className="text-rose-500"/> 获赞量</div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">操作指令</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats?.accounts?.map(acc => {
                const isThisSyncing = syncingId === acc.id;
                
                // 🎨 平台样式与逻辑判断
                const pStyle = PLATFORM_STYLES[acc.platform] || { bg: 'bg-slate-500', text: acc.platform?.[0] || 'N' };
                
                // 🧠 从 JSON 中现场提取 30 天总播放量
                let thirtyDaysViews = 0;
                if (acc.trend_data) {
                  try {
                    const arr = JSON.parse(acc.trend_data);
                    thirtyDaysViews = arr.reduce((sum, item) => sum + item.views, 0);
                  } catch(e) {}
                }

                // 💥 拆分显示逻辑 (极简一统版：无视平台，只要有值就显！)
                const thirtyViewsStr = thirtyDaysViews > 0 ? thirtyDaysViews.toLocaleString() : '--';
                const likesStr = acc.total_views > 0 ? acc.total_views.toLocaleString() : '--';

                return (
                  <tr key={acc.id} className="group hover:bg-indigo-50/30 transition-colors cursor-default">
                    {/* 账号名称 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-slate-800 text-sm">{acc.real_name || acc.alias}</div>
                    </td>
                    
                    {/* 平台 Logo + 文字 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-md ${pStyle.bg}`}>
                          {pStyle.text}
                        </div>
                        <span className="text-sm font-bold text-slate-700">{acc.platform}</span>
                      </div>
                    </td>
                    
                    {/* 粉丝数 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-slate-800 font-bold">{(acc.followers || 0).toLocaleString()}</span>
                    </td>
                    
                    {/* 30天播放量 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {thirtyViewsStr !== '--' 
                        ? <span className="text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-md">{thirtyViewsStr}</span> 
                        : <span className="text-slate-300 font-medium tracking-widest">{thirtyViewsStr}</span>}
                    </td>
                    
                    {/* 获赞量 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {likesStr !== '--' 
                        ? <span className="text-rose-500 font-bold bg-rose-50 px-2.5 py-1 rounded-md">{likesStr}</span> 
                        : <span className="text-slate-300 font-medium tracking-widest">--</span>}
                    </td>
                    
                    {/* 🚀 操作列 */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-3 opacity-50 group-hover:opacity-100 transition-opacity">
                        
                        {!isCoolingDown && (
                          <>
                            {/* 基础同步按钮 */}
                            <button 
                              onClick={() => handleBasicSync(acc.id, acc.platform)}
                              disabled={isThisSyncing || syncingAll}
                              className={`flex items-center gap-1 transition-colors font-bold px-2 py-1 rounded ${
                                isThisSyncing ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                              }`}
                              title="后台静默刷新基础信息"
                            >
                              <RefreshCw size={13} className={isThisSyncing ? 'animate-spin' : ''} />
                              <span className="text-xs">基础刷新</span>
                            </button>

                            {/* 深度提取按钮 */}
                            {['抖音', '快手', '小红书', '微信视频号', '百家号', 'B站'].includes(acc.platform) && (
                              <button 
                                onClick={() => handleDeepSync(acc.id, acc.platform)}
                                disabled={isThisSyncing || syncingAll}
                                className={`flex items-center gap-1 transition-colors font-bold px-2 py-1 rounded ${
                                  isThisSyncing ? 'text-orange-500' : 'text-orange-400 hover:text-orange-600 hover:bg-orange-50'
                                }`}
                                title="打开雷达深度嗅探30天曲线数据"
                              >
                                <Radar size={13} className={isThisSyncing ? 'animate-ping' : ''} />
                                <span className="text-xs">深度提取</span>
                              </button>
                            )}
                          </>
                        )}
                        
                        <div className="w-px h-4 bg-slate-200 mx-1"></div>

                        {/* 删除按钮 */}
                        <button 
                          onClick={() => handleDeleteAccount(acc.id)}
                          disabled={isThisSyncing || syncingAll}
                          className="text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 font-bold disabled:opacity-50 p-1"
                          title="销毁节点"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              
              {(!stats?.accounts || stats.accounts.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                        <BarChart2 size={32} className="text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-medium">矩阵库空空如也</p>
                      <button 
                        onClick={onGoToAccountManager} 
                        className="mt-2 px-6 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-full text-sm font-bold tracking-wider transition-colors"
                      >
                        前往账号管理中心注入节点 &rarr;
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}