import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Users, Trash2, ChevronRight, X, Lock, Edit, ChevronDown, GripVertical, RefreshCw, ScanLine, FolderPlus, Shield, Chrome } from 'lucide-react';

const getElectron = () => {
  if (typeof window !== 'undefined' && window.electron) return window.electron;
  return {
    ipcRenderer: {
      invoke: async () => ({ success: false, message: '非原生环境' }),
      on: () => {}, 
      removeAllListeners: () => {}
    }
  };
};

export default function AccountManagerView({ accounts, setAccounts }) {
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [formData, setFormData] = useState({ alias: '', customName: '', customUrl: '' });
  
  const [editingTag, setEditingTag] = useState({ id: null, value: '' });

  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverGroup, setDragOverGroup] = useState(null);
  
  const [customGroups, setCustomGroups] = useState(() => {
    return JSON.parse(localStorage.getItem('nikola_custom_groups') || '[]');
  });
  const [editingGroup, setEditingGroup] = useState({ oldName: '', newName: '' });
  
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const [isSniffing, setIsSniffing] = useState({});
  const [activeTabs, setActiveTabs] = useState([]); 
  const [currentTabId, setCurrentTabId] = useState(null);

  const electron = getElectron();

  const PLATFORM_URLS = {
    '抖音': 'https://creator.douyin.com/creator-micro/home',
    '快手': 'https://cp.kuaishou.com/profile',
    '微信视频号': 'https://channels.weixin.qq.com/platform',
    'B站': 'https://member.bilibili.com/platform/home',
    '小红书': 'https://creator.xiaohongshu.com/new/home',
    '百家号': 'https://baijiahao.baidu.com/builder/rc/home',
    '知乎': 'https://www.zhihu.com/creator',
    '微博': 'https://me.weibo.com/',
    '爱奇艺号': 'https://mp.iqiyi.com/',
    '企鹅号(腾讯)': 'https://om.qq.com/',
    '腾讯视频': 'https://v.qq.com/biu/creator/home',
    '大鱼号(优酷)': 'https://mp.dayu.com/'
  };

  useEffect(() => {
    const fetchFreshData = async () => {
      try {
        const freshAccounts = await electron.ipcRenderer.invoke('db-get-accounts');
        if (freshAccounts && freshAccounts.length > 0) setAccounts(freshAccounts);
      } catch (error) { console.error('刷新数据库失败:', error); }
    };
    fetchFreshData();
  }, []);

  useEffect(() => {
    localStorage.setItem('nikola_custom_groups', JSON.stringify(customGroups));
  }, [customGroups]);

  const platforms = [

    { name: '抖音', color: 'bg-slate-900' },

    { name: '小红书', color: 'bg-red-500' },

    { name: 'B站', color: 'bg-pink-400' },

    { name: '快手', color: 'bg-orange-500' },

    { name: '微信视频号', color: 'bg-emerald-600' },

    { name: '百家号', color: 'bg-blue-600' },

    { name: '爱奇艺号', color: 'bg-green-500' },

    { name: '知乎', color: 'bg-blue-700' },

    { name: '微博', color: 'bg-amber-500' },

    { name: '企鹅号(腾讯)', color: 'bg-blue-500' },

    { name: '腾讯视频', color: 'bg-blue-500' },

    { name: '大鱼号(优酷)', color: 'bg-orange-600' },

    { name: '自定义', color: 'bg-slate-400', isCustom: true }

  ];

  const groupedAccounts = useMemo(() => {
    const groups = { '默认分组': [] };
    customGroups.forEach(g => { if (!groups[g]) groups[g] = []; });
    accounts.forEach(acc => {
      const gName = acc.group_name || acc.group || '默认分组'; 
      if (!groups[gName]) groups[gName] = [];
      groups[gName].push(acc);
    });
    return groups;
  }, [accounts, customGroups]);

  const handleOpenTab = (acc) => {
    const existingTab = activeTabs.find(t => t.accountId === acc.id);
    if (existingTab) {
      setCurrentTabId(existingTab.id); 
      return;
    }
    const newTab = {
      id: `tab_${Date.now()}`,
      accountId: acc.id,
      title: acc.real_name || acc.alias || acc.platform,
      url: PLATFORM_URLS[acc.platform] || acc.customUrl || 'https://www.baidu.com',
      partition: `persist:chrome_data_${acc.id}`, 
      platform: acc.platform,
      avatar: acc.avatar
    };
    setActiveTabs([...activeTabs, newTab]);
    setCurrentTabId(newTab.id);
  };

  const handleCloseTab = (e, tabId) => {
    e.stopPropagation(); 
    const newTabs = activeTabs.filter(t => t.id !== tabId);
    setActiveTabs(newTabs);
    if (currentTabId === tabId) setCurrentTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
  };

  const toggleGroup = (groupName) => setCollapsedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));

  const submitNewGroup = () => {
    const trimmed = newGroupName.trim();
    if (trimmed) {
      if (trimmed === '默认分组' || customGroups.includes(trimmed)) return alert("分组名称已存在！");
      setCustomGroups([...customGroups, trimmed]);
      setShowGroupModal(false); setNewGroupName('');
    }
  };

  const handleDeleteGroup = (groupName) => {
    if (groupName === '默认分组') return;
    setCustomGroups(prev => prev.filter(g => g !== groupName));
  };

  const handleRenameGroupSubmit = async (oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return setEditingGroup({ oldName: '', newName: '' });
    if (trimmed === '默认分组' || customGroups.includes(trimmed)) { alert("该分组名称已被占用！"); return setEditingGroup({ oldName: '', newName: '' }); }
    setCustomGroups(prev => prev.map(g => g === oldName ? trimmed : g));
    const accsInGroup = accounts.filter(a => (a.group_name || a.group || '默认分组') === oldName);
    for (let acc of accsInGroup) await electron.ipcRenderer.invoke('db-update-account-group', { id: acc.id, newGroup: trimmed });
    const updatedAccounts = await electron.ipcRenderer.invoke('db-get-accounts');
    setAccounts(updatedAccounts || []);
    setEditingGroup({ oldName: '', newName: '' });
  };

  const submitEditTag = async (id, oldAlias) => {
    const newAlias = editingTag.value.trim();
    if (newAlias && newAlias !== oldAlias) {
      const res = await electron.ipcRenderer.invoke('db-update-account-alias', { id, newAlias });
      if (res.success) setAccounts(accounts.map(a => a.id === id ? { ...a, alias: newAlias } : a));
    }
    setEditingTag({ id: null, value: '' });
  };

  const handleDragStart = (e, id) => { e.dataTransfer.setData('accountId', id); setDraggingId(id); setTimeout(() => setDraggingId(id), 0); };
  const handleDragOver = (e, groupName) => { e.preventDefault(); if (dragOverGroup !== groupName) setDragOverGroup(groupName); };
  const handleDrop = async (e, targetGroup) => {
    e.preventDefault(); setDragOverGroup(null); setDraggingId(null);
    const accountId = e.dataTransfer.getData('accountId');
    if (!accountId) return;
    const accToMove = accounts.find(a => a.id.toString() === accountId);
    if (accToMove && (accToMove.group_name || accToMove.group) !== targetGroup) {
      setAccounts(accounts.map(a => a.id.toString() === accountId ? { ...a, group_name: targetGroup, group: targetGroup } : a));
      await electron.ipcRenderer.invoke('db-update-account-group', { id: parseInt(accountId), newGroup: targetGroup });
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm("确定要永久删除此账号吗？")) return;
    await electron.ipcRenderer.invoke('db-delete-account', id);
    setAccounts(accounts.filter(a => a.id !== id));
    const tabsToClose = activeTabs.filter(t => t.accountId === id);
    if(tabsToClose.length > 0) handleCloseTab({stopPropagation: ()=>{}}, tabsToClose[0].id);
  };

  const handleSniff = async (e, acc) => {
    e.stopPropagation();
    setIsSniffing(prev => ({...prev, [acc.id]: true}));
    try {
      await electron.ipcRenderer.invoke('sync-30days-data', { accountId: acc.id, platform: acc.platform });
      const freshAccounts = await electron.ipcRenderer.invoke('db-get-accounts');
      setAccounts(freshAccounts || []);
    } catch(err) { console.error(err); alert('同步失败，请确保您已在右侧内嵌页面登录。'); } 
    finally { setIsSniffing(prev => ({...prev, [acc.id]: false})); }
  };

  const handlePlatformSelect = async (platform) => {
    if (platform.isCustom) { setSelectedPlatform(platform); setModalStep(2); return; }
    setShowModal(false); 
    const tempAlias = `待登录_${platform.name}_${Math.floor(Math.random()*1000)}`;
    const newAccData = { alias: tempAlias, group: '默认分组', platform: platform.name };
    try {
      const result = await electron.ipcRenderer.invoke('db-add-account', newAccData);
      if (result.success) {
        const updatedAccounts = await electron.ipcRenderer.invoke('db-get-accounts');
        setAccounts(updatedAccounts || []);
        const newAcc = updatedAccounts.find(a => a.alias === tempAlias) || updatedAccounts[updatedAccounts.length - 1];
        if (newAcc) handleOpenTab(newAcc);
      }
    } catch (e) { console.error(e); alert('建立沙盒节点失败！'); }
  };

  const handleAddSubmit = async () => {
    const pName = selectedPlatform.isCustom ? (formData.customName || '自定义平台') : selectedPlatform.name;
    const newAccData = { alias: formData.alias || `${pName}新账号`, group: '默认分组', platform: pName, customUrl: selectedPlatform.isCustom ? formData.customUrl : undefined };
    try {
      const result = await electron.ipcRenderer.invoke('db-add-account', newAccData);
      if (result.success) {
        const updatedAccounts = await electron.ipcRenderer.invoke('db-get-accounts');
        setAccounts(updatedAccounts || []);
        setShowModal(false); setModalStep(1); setFormData({ alias: '', customName: '', customUrl: '' });
        const newAcc = updatedAccounts.find(a => a.alias === newAccData.alias);
        if (newAcc) handleOpenTab(newAcc);
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="flex h-full w-full rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white animate-in fade-in duration-300">
      
      {/* 🚀 左侧：隔离矩阵库 */}
      <div className="w-[260px] bg-slate-50 border-r border-slate-200 flex flex-col flex-shrink-0 min-h-0">
        
        {/* 头部控制栏 */}
        <div className="p-4 bg-white border-b border-slate-200 flex-shrink-0">
          <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center">
            <Users size={16} className="mr-2 text-indigo-600" /> 隔离矩阵库
          </h2>
          <div className="flex gap-2">
            <button onClick={() => setShowGroupModal(true)} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center transition">
              <FolderPlus size={14} className="mr-1" /> 新分组
            </button>
            <button onClick={() => setShowModal(true)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-1.5 rounded-lg text-xs font-medium flex items-center justify-center transition shadow-sm">
              <Plus size={14} className="mr-1" /> 加账号
            </button>
          </div>
        </div>

        {/* 账号列表 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar min-h-0">
          {Object.entries(groupedAccounts).map(([groupName, groupAccs]) => (
            <div key={groupName} onDragOver={(e) => handleDragOver(e, groupName)} onDrop={(e) => handleDrop(e, groupName)}>
              
              {/* 分组头 */}
              <div 
                className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-200/50 rounded-md group transition"
                onClick={() => toggleGroup(groupName)}
              >
                <div className="flex items-center text-xs font-bold text-slate-700 flex-1">
                  {collapsedGroups[groupName] ? <ChevronRight size={14} className="mr-1 text-slate-500" /> : <ChevronDown size={14} className="mr-1 text-slate-500" />}
                  {editingGroup.oldName === groupName ? (
                    <input 
                      autoFocus value={editingGroup.newName} 
                      onChange={(e) => setEditingGroup({ ...editingGroup, newName: e.target.value })} 
                      onBlur={() => handleRenameGroupSubmit(groupName, editingGroup.newName)} 
                      onKeyDown={(e) => { if(e.key === 'Enter') handleRenameGroupSubmit(groupName, editingGroup.newName); }} 
                      onClick={(e) => e.stopPropagation()} 
                      className="border-b border-red-500 outline-none bg-transparent w-full" 
                    />
                  ) : (
                    <span className="truncate">{groupName}</span>
                  )}
                </div>
                <div className="flex items-center">
                   {groupName !== '默认分组' && (
                     <div className="opacity-0 group-hover:opacity-100 flex items-center mr-2 transition-opacity">
                       <Edit size={12} className="text-slate-400 hover:text-indigo-600 mr-2" onClick={(e) => { e.stopPropagation(); setEditingGroup({ oldName: groupName, newName: groupName }); }} />
                       {groupAccs.length === 0 && <Trash2 size={12} className="text-slate-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteGroup(groupName); }} />}
                     </div>
                   )}
                   <span className="text-[10px] text-slate-400 font-bold">{groupAccs.length}</span>
                </div>
              </div>

              {/* 卡片列表 */}
              {!collapsedGroups[groupName] && (
                <div className="space-y-1.5 mt-1 px-1">
                  {groupAccs.map(acc => (
                    <div 
                      key={acc.id} draggable onDragStart={(e) => handleDragStart(e, acc.id.toString())} onDragEnd={() => { setDraggingId(null); setDragOverGroup(null); }}
                      onClick={() => handleOpenTab(acc)}
                      className={`bg-white p-2.5 rounded-xl border cursor-pointer transition-all hover:border-indigo-300 shadow-sm group relative overflow-hidden
                        ${activeTabs.some(t => t.accountId === acc.id) ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-200'}
                        ${draggingId === acc.id.toString() ? 'opacity-50' : 'opacity-100'}
                      `}
                    >
                      <div className="flex items-center pr-2">
                        {/* 头像 */}
                        {acc.avatar ? (
                          <img src={acc.avatar} referrerPolicy="no-referrer" className="w-8 h-8 rounded-lg object-cover border border-slate-100 flex-shrink-0" />
                        ) : (
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs flex-shrink-0 ${platforms.find(p => p.name === acc.platform)?.color || 'bg-slate-400'}`}>
                            {acc.platform ? acc.platform[0] : 'N'}
                          </div>
                        )}
                        
                        {/* 文字信息 */}
                        <div className="ml-2.5 flex-1 min-w-0">
                          {editingTag.id === acc.id ? (
                            <input 
                              autoFocus value={editingTag.value} 
                              onChange={(e) => setEditingTag({ ...editingTag, value: e.target.value })} 
                              onBlur={() => submitEditTag(acc.id, acc.alias)} 
                              onKeyDown={(e) => { if (e.key === 'Enter') submitEditTag(acc.id, acc.alias); }} 
                              onClick={(e) => e.stopPropagation()} 
                              className="w-full text-xs font-bold text-indigo-600 outline-none bg-transparent border-b border-indigo-200" 
                            />
                          ) : (
                            <div className="text-xs font-bold text-slate-800 truncate" title={acc.real_name || acc.alias}>{acc.real_name || acc.alias}</div>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate flex items-center">
                             {acc.platform} 
                             {acc.followers > 0 && <span className="ml-1">粉:{(acc.followers / 1000).toFixed(1)}k</span>}
                          </div>
                        </div>
                      </div>

                      {/* 🚀 终极修改：悬浮操作胶囊 (在卡片右侧垂直居中) */}
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-white/95 backdrop-blur-sm p-1 rounded-lg shadow-md border border-slate-100 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                         <button onClick={(e) => handleSniff(e, acc)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition" title="嗅探数据">
                            {isSniffing[acc.id] ? <RefreshCw size={12} className="animate-spin" /> : <ScanLine size={12} />}
                         </button>
                         <button onClick={(e) => { e.stopPropagation(); setEditingTag({ id: acc.id, value: acc.alias }); }} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition" title="修改名称">
                            <Edit size={12} />
                         </button>
                         <button onClick={(e) => handleDelete(e, acc.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition" title="删除账号">
                            <Trash2 size={12} />
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 🚀 右侧：独立多标签浏览器系统 */}
      <div className="flex-1 bg-slate-100 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
        
        {/* 顶部标签栏 */}
        <div className="h-10 bg-slate-100 border-b border-slate-200 flex items-end px-1 gap-0.5 overflow-x-auto custom-scrollbar flex-shrink-0">
          {activeTabs.length === 0 ? (
             <div className="text-[11px] font-bold text-slate-400 mb-2 ml-4 flex items-center tracking-widest">
               <Shield size={12} className="mr-1.5"/> 资源调度已就绪，等待注入进程...
             </div>
          ) : (
            activeTabs.map(tab => (
              <div 
                key={tab.id} onClick={() => setCurrentTabId(tab.id)}
                className={`group relative h-8 px-3 min-w-[120px] max-w-[180px] flex items-center justify-between rounded-t-lg cursor-pointer transition-all border-t border-l border-r
                  ${currentTabId === tab.id ? 'bg-white border-slate-200 text-slate-800 font-bold z-10 before:absolute before:bottom-[-1px] before:left-0 before:w-full before:h-px before:bg-white' : 'bg-slate-200 border-transparent text-slate-500 hover:bg-slate-300'}`}
              >
                <div className="flex items-center overflow-hidden mr-2">
                   {tab.avatar ? (
                     <img src={tab.avatar} className="w-3.5 h-3.5 rounded object-cover mr-1.5" />
                   ) : (
                     <div className="w-3.5 h-3.5 rounded bg-slate-400 flex items-center justify-center text-[8px] text-white font-bold mr-1.5">{tab.platform[0]}</div>
                   )}
                  <span className="text-xs truncate select-none">{tab.title}</span>
                </div>
                <button onClick={(e) => handleCloseTab(e, tab.id)} className={`p-0.5 rounded-md hover:bg-slate-200 hover:text-red-500 transition ${currentTabId === tab.id ? 'text-slate-400' : 'text-transparent group-hover:text-slate-400'}`}><X size={12} /></button>
              </div>
            ))
          )}
        </div>

        {/* Browser 核心渲染区 */}
        <div className="flex-1 relative bg-white min-h-0 min-w-0 overflow-hidden">
          {activeTabs.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
               <Chrome size={48} className="mb-3 opacity-30" />
               <h3 className="text-sm font-bold tracking-widest mb-1">隔离浏览器内核已启动</h3>
               <p className="text-[11px] font-medium">请点击左侧平台账户查看数据</p>
            </div>
          ) : (
            activeTabs.map(tab => (
              <webview
                key={tab.id}
                src={tab.url}
                partition={tab.partition}
                allowpopups="true"
                className={`absolute inset-0 w-full h-full border-none outline-none bg-white transition-opacity duration-150 ${currentTabId === tab.id ? 'z-10 opacity-100' : 'z-0 opacity-0 pointer-events-none'}`}
              />
            ))
          )}
        </div>
      </div>

      {/* 新建分组弹窗 */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center"><FolderPlus className="mr-2 text-indigo-500" size={16}/>新建分组</h3>
              <button onClick={() => setShowGroupModal(false)} className="p-1 hover:bg-slate-200 rounded-md text-slate-500 transition"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <input autoFocus className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:border-indigo-500 font-bold text-slate-900 text-sm" placeholder="例如：游戏自媒体矩阵" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') submitNewGroup(); }} />
              <button onClick={submitNewGroup} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold text-sm shadow-md hover:bg-indigo-700 transition">确认创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 选择平台入网弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">{modalStep === 1 ? '添加社交账号节点' : '自定义资产标签'}</h3>
              <button onClick={() => { setShowModal(false); setModalStep(1); }} className="p-1 hover:bg-slate-200 rounded-md text-slate-500 transition"><X size={16} /></button>
            </div>
            <div className="p-5">
              {modalStep === 1 ? (
                <div className="grid grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto p-1">
                  {platforms.map(p => (
                    <div key={p.name} onClick={() => handlePlatformSelect(p)} className={`flex flex-col items-center p-3 border border-slate-200 rounded-xl transition hover:border-red-500 hover:bg-red-50 cursor-pointer bg-white`}>
                      <div className={`w-10 h-10 ${p.color} rounded-lg mb-2 flex items-center justify-center text-white font-black text-lg`}>{p.isCustom ? '+' : p.name[0]}</div>
                      <span className="text-xs font-bold text-slate-700">{p.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4 max-w-md mx-auto">
                  {selectedPlatform?.isCustom && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <input className="w-full bg-white border border-slate-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 font-bold text-sm" placeholder="平台名称" onChange={e => setFormData({ ...formData, customName: e.target.value })} />
                      <input className="w-full bg-white border border-slate-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 font-bold text-sm" placeholder="登录网址" onChange={e => setFormData({ ...formData, customUrl: e.target.value })} />
                    </div>
                  )}
                  <input className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none focus:border-indigo-500 font-bold text-slate-900 text-sm" placeholder="账号备注名 (必填)" onChange={e => setFormData({ ...formData, alias: e.target.value })} />
                  <button onClick={handleAddSubmit} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold text-sm shadow-md transition flex items-center justify-center mt-2 hover:bg-red-700"><Lock size={14} className="mr-1.5" />确认添加</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}