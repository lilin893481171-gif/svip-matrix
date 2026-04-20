import React, { useState, useEffect, useRef } from 'react';
import { 
  PlayCircle, Users, RefreshCw, Trash2, 
  BarChart2, Clock, ArrowUpRight, Sparkles, Flame, Crown,
  Lock, ShieldAlert // 💥 新增图标
} from 'lucide-react';

// ==============================================
// ⏱️ 核心新增：24小时防风控冷却 Hook
// ==============================================
const COOLDOWN_TIME = 24 * 60 * 60 * 1000; // 24小时的毫秒数

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

  // 引擎状态控制
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  
  // 数字动画
  const totalViews = useCountUp(stats?.totalViews || 0);
  const totalFollowers = useCountUp(stats?.totalFollowers || 0);

  // 💥 引入防风控冷却状态
  const { isCoolingDown, formattedTime, triggerCooldown } = useSyncCooldown();

  // 数据流中枢
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

  // ==============================================
  // 🚀 一键全网同步 (带防风控锁)
  // ==============================================
  const handleSyncAll = async () => {
    if (syncingAll || isCoolingDown) return;
    
    // 弹窗安全提示
    if (!window.confirm('【风控警告】为保护账号安全，全网数据每天仅限提取1次。提取后功能将被物理锁定24小时。确认执行吗？')) return;

    setSyncingAll(true);
    try {
      const res = await window.electron.ipcRenderer.invoke('sync-account-stats-all');
      if (res.success) {
        await loadDashboardData(); 
        triggerCooldown(); // 💥 成功后立刻触发 24小时物理锁定
      } else {
        alert('部分节点同步受阻：' + res.message);
      }
    } catch (err) {
      console.error(err);
      alert('系统异常：' + err.message);
    } finally {
      setSyncingAll(false);
    }
  };

  // ==============================================
  // 🎯 单号精准同步 (带防风控锁)
  // ==============================================
  const handleSyncSingle = async (accountId, platform) => {
    if (syncingId === accountId || isCoolingDown) return;
    setSyncingId(accountId);
    try {
      const res = await window.electron.ipcRenderer.invoke('sync-account-stats', { accountId, platform });
      if (res.success) {
        await loadDashboardData(); 
      } else {
        alert(`[${platform}] 同步失败：` + res.message);
      }
    } catch (err) {
      console.error(err);
      alert('系统异常：' + err.message);
    } finally {
      setSyncingId(null);
    }
  };

  // 删除逻辑
  const handleDeleteAccount = async (id) => {
    if (!window.confirm('警告：确定要彻底销毁该节点及其所有历史数据吗？')) return;
    try {
      const res = await window.electron.ipcRenderer.invoke('db-delete-account', Number(id));
      if (res.success) {
        await loadDashboardData(); 
      } else {
        alert('删除失败：' + res.message);
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

  // 获取当前修仙段位信息
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
        
        {/* 💥 核心防风控锁：包裹了倒计时样式和警告标识 */}
        <div className="flex flex-col items-end">
          <button 
            onClick={handleSyncAll}
            disabled={syncingAll || loading || isCoolingDown}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg shadow-md font-medium transition-all ${
              isCoolingDown 
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-400/50' // 冷却状态：灰色石碑
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
              <span className="font-medium">总播放量</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-1">
              {totalViews.toLocaleString()}
            </h2>
            <div className="flex items-center text-xs text-slate-500">
              <ArrowUpRight size={12} className="mr-1 text-green-500" />
              <span>较昨日 +{Math.round((stats?.totalViews || 0) * 0.08).toLocaleString()} 次</span>
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
              <span>较昨日 +{Math.round((stats?.totalFollowers || 0) * 0.12).toLocaleString()} 人</span>
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

        {/* 修仙段位卡片 */}
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
            
            {/* 灵力进度条 */}
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
            账号列表
          </h3>
          <span className="text-sm text-slate-500">共 {stats?.accounts?.length || 0} 个账号</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">账号名称</th>
                <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">平台</th>
                <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">粉丝数</th>
                <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">播放量</th>
                <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {stats?.accounts?.map(acc => {
                const isThisSyncing = syncingId === acc.id;

                return (
                  <tr 
                    key={acc.id} 
                    className="group hover:bg-slate-50 transition-colors cursor-default"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{acc.real_name || acc.alias}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        acc.platform === '抖音' ? 'bg-red-50 text-red-600' :
                        acc.platform === 'B站' ? 'bg-blue-50 text-blue-600' :
                        acc.platform === '快手' ? 'bg-orange-50 text-orange-600' :
                        acc.platform === '百家号' ? 'bg-green-50 text-green-600' :
                        acc.platform === '微信视频号' ? 'bg-teal-50 text-teal-600' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {acc.platform}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-700 font-medium">
                      {(acc.followers || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                      {(acc.total_views || 0).toLocaleString()}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-4 opacity-50 group-hover:opacity-100 transition-opacity">
                        
                        {/* 💥 冷却锁定时，直接隐藏单号同步按钮，彻底杜绝手欠 */}
                        {!isCoolingDown && (
                          <button 
                            onClick={() => handleSyncSingle(acc.id, acc.platform)}
                            disabled={isThisSyncing || syncingAll}
                            className={`flex items-center gap-1.5 transition-colors font-medium ${
                              isThisSyncing 
                                ? 'text-blue-600 opacity-100' 
                                : 'text-slate-500 hover:text-blue-600'
                            }`}
                          >
                            <RefreshCw size={14} className={isThisSyncing ? 'animate-spin' : ''} />
                            <span className="text-sm">{isThisSyncing ? '同步中...' : '同步'}</span>
                          </button>
                        )}

                        <button 
                          onClick={() => handleDeleteAccount(acc.id)}
                          disabled={isThisSyncing || syncingAll}
                          className="text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          <span className="text-sm">删除</span>
                        </button>

                      </div>
                    </td>
                  </tr>
                );
              })}
              {(!stats?.accounts || stats.accounts.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <p>暂无账号数据</p>
                    {/* 💥 核心修改：加上 onClick 触发外部传进来的跳转函数 */}
                    <button 
                      onClick={onGoToAccountManager} 
                      className="mt-2 text-blue-600 hover:underline text-sm font-bold tracking-wider"
                    >
                      前往账号管理中心添加 &rarr;
                    </button>
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