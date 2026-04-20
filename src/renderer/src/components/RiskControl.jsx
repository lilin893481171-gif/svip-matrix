import React, { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, Activity, AlertTriangle, CheckCircle, PauseCircle, RefreshCw, ShieldCheck, Zap, Search, Filter } from 'lucide-react';

export default function RiskControl() {
  // 1. 原始数据状态
  const [riskData, setRiskData] = useState({
    systemHealth: 'healthy', 
    totalIntercepts: 0,
    activeNodes: 0,
    accounts: []
  });
  const [loading, setLoading] = useState(true);

  // 2. 新增：筛选条件状态
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterRisk, setFilterRisk] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // 🚀 核心：呼叫后台雷达获取真实账号状态
  const fetchRiskData = async () => {
    try {
      // 模拟或者真实的 IPC 调用
      if (window.electron && window.electron.ipcRenderer) {
        const res = await window.electron.ipcRenderer.invoke('get-risk-stats');
        if (res.success) setRiskData(res.data);
      } else {
        // 如果在普通浏览器测试，为了展示效果，这里 mock 一点测试数据
        setRiskData({
          systemHealth: 'healthy', totalIntercepts: 12, activeNodes: 4,
          accounts: [
            { alias: '品牌宣发号01', platform: 'B站', lastAction: '实时监控中', level: 'low', reason: '环境指纹稳定', status: '正常运行' },
            { alias: '测试跑量02', platform: '抖音', lastAction: '挂机中', level: 'high', reason: 'IP波动频繁', status: '已熔断' },
            { alias: '引流矩阵-A', platform: '视频号', lastAction: '发文中', level: 'medium', reason: '触发验证码', status: '降权观察' }
          ]
        });
      }
    } catch (error) {
      console.error('拉取风控数据失败', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskData();
    const interval = setInterval(fetchRiskData, 10000);
    return () => clearInterval(interval);
  }, []);

  // 3. 新增：前端多条件过滤逻辑
  const filteredAccounts = useMemo(() => {
    return riskData.accounts.filter(acc => {
      const matchSearch = acc.alias.toLowerCase().includes(searchQuery.toLowerCase());
      const matchPlatform = filterPlatform === 'all' || acc.platform === filterPlatform;
      const matchRisk = filterRisk === 'all' || acc.level === filterRisk;
      const matchStatus = filterStatus === 'all' || acc.status === filterStatus;
      return matchSearch && matchPlatform && matchRisk && matchStatus;
    });
  }, [riskData.accounts, searchQuery, filterPlatform, filterRisk, filterStatus]);

  const getRiskStyle = (level) => {
    switch (level) {
      case 'high': return 'bg-red-100 text-red-600 border-red-200';
      case 'medium': return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'low': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  if (loading) return <div className="p-8 text-slate-500">🛡️ 天网防御系统启动中...</div>;

  return (
    <div className="p-8 bg-slate-50 min-h-screen w-full">
      
      {/* 🚀 顶部标题 & 全局状态栏 */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mb-4">流速与风控中心</h1>
        <div className={`flex items-center justify-between p-4 rounded-xl border ${riskData.systemHealth === 'warning' ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center">
            {riskData.systemHealth === 'warning' ? <ShieldAlert size={20} className="text-red-500 mr-3 animate-pulse" /> : <ShieldCheck size={20} className="text-emerald-500 mr-3" />}
            <span className={`font-bold ${riskData.systemHealth === 'warning' ? 'text-red-700' : 'text-emerald-700'}`}>
              {riskData.systemHealth === 'warning' ? '风控预警：检测到部分账号环境/流量异常，系统已自动拦截！' : '系统安全：所有矩阵节点运行平稳，零风控警报。'}
            </span>
          </div>
          <button className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all shadow-sm ${riskData.systemHealth === 'warning' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`} onClick={fetchRiskData}>
            {riskData.systemHealth === 'warning' ? '一键深度检测' : '手动雷达扫描'}
          </button>
        </div>
      </div>

      {/* 📊 核心监控卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-slate-500 text-sm font-medium mb-1">本周累计拦截风险</h3>
            <div className="text-3xl font-black text-slate-800">{riskData.totalIntercepts} <span className="text-sm font-normal text-slate-400">次</span></div>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl"><ShieldAlert size={28} className="text-slate-400" /></div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-slate-500 text-sm font-medium mb-1">活跃沙盒节点</h3>
            <div className="text-3xl font-black text-slate-800">{riskData.activeNodes} <span className="text-sm font-normal text-slate-400">个</span></div>
          </div>
          <div className="p-4 bg-emerald-50 rounded-2xl"><Activity size={28} className="text-emerald-500" /></div>
        </div>

        {/* 🌟 升级：带 SVG 趋势图的流速卡片 */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 shadow-lg flex flex-col justify-between text-white relative overflow-hidden group">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <h3 className="text-slate-300 text-sm font-medium mb-1">全局发文/互动流速</h3>
              <div className="text-3xl font-black flex items-baseline">12.5 <span className="text-sm font-normal text-slate-400 ml-1">次 / 分钟</span></div>
            </div>
            <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl"><Zap size={24} className="text-emerald-400" /></div>
          </div>
          
          {/* 纯净版 SVG 折线图 */}
          <div className="absolute bottom-0 left-0 right-0 h-16 opacity-60 group-hover:opacity-100 transition-opacity">
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full">
              <defs>
                <linearGradient id="chart-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.4"/>
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <polygon fill="url(#chart-gradient)" points="0,30 0,15 10,20 20,10 30,25 40,8 50,18 60,5 70,22 80,12 90,20 100,10 100,30" />
              <polyline fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points="0,15 10,20 20,10 30,25 40,8 50,18 60,5 70,22 80,12 90,20 100,10" />
            </svg>
          </div>
        </div>
      </div>

      {/* 🚨 风险账号隔离区 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        
        {/* 标题栏 */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between md:items-center bg-slate-50/50 gap-4">
          <h3 className="font-extrabold text-slate-800 text-lg flex items-center min-w-max">
            <AlertTriangle size={18} className="mr-2 text-slate-500" /> 全网节点监控舱
          </h3>
          
          {/* 🌟 升级：多条件筛选操作区 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="搜索账号名..." 
                className="pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent w-40"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <select 
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-800 cursor-pointer bg-white"
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
            >
              <option value="all">全部平台</option>
              <option value="B站">B站</option>
              <option value="抖音">抖音</option>
              <option value="视频号">视频号</option>
            </select>

            <select 
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-800 cursor-pointer bg-white"
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
            >
              <option value="all">全部分险</option>
              <option value="low">低风险</option>
              <option value="medium">中风险</option>
              <option value="high">高危风险</option>
            </select>

            <select 
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-800 cursor-pointer bg-white"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">全部状态</option>
              <option value="正常运行">正常运行</option>
              <option value="降权观察">降权观察</option>
              <option value="已熔断">已熔断</option>
            </select>
          </div>
        </div>
        
        {/* 数据表格 */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
              <tr>
                <th className="p-4 font-bold pl-6">账号信息</th>
                <th className="p-4 font-bold">风险级别</th>
                <th className="p-4 font-bold">触发原因</th>
                <th className="p-4 font-bold">当前状态</th>
                <th className="p-4 font-bold text-right pr-6">干预动作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredAccounts.map((acc, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="font-bold text-slate-800">{acc.alias}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{acc.platform} · {acc.lastAction}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${getRiskStyle(acc.level)}`}>
                      {acc.level === 'high' ? '高危' : acc.level === 'medium' ? '中危' : '低风险'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 font-medium">{acc.reason}</td>
                  <td className="p-4">
                    <div className="flex items-center">
                      <span className={`w-2 h-2 rounded-full mr-2 ${acc.status === '已熔断' ? 'bg-red-500' : acc.status === '降权观察' ? 'bg-orange-500' : 'bg-emerald-500'}`}></span>
                      <span className={acc.status === '已熔断' ? 'text-red-600 font-bold' : acc.status === '降权观察' ? 'text-orange-600 font-bold' : 'text-emerald-600 font-bold'}>{acc.status}</span>
                    </div>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="强制熔断 (断开环境)"><PauseCircle size={18} /></button>
                      <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="重置沙盒环境"><RefreshCw size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {/* 无数据空状态 */}
              {filteredAccounts.length === 0 && riskData.accounts.length > 0 && (
                <tr>
                  <td colSpan="5" className="p-16 text-center text-slate-400">
                    <Filter size={40} className="text-slate-200 mb-3 mx-auto" />
                    <span className="font-medium text-slate-500">没有符合筛选条件的节点</span>
                  </td>
                </tr>
              )}
              {riskData.accounts.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-16 text-center text-slate-400">
                    <CheckCircle size={48} className="text-emerald-100 mb-3 mx-auto" />
                    <span className="font-medium">当前矩阵环境纯净，尚未添加任何账号</span>
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