import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Users, Trash2, ChevronRight, X, Lock, Edit, ChevronDown, GripVertical, FolderPlus, Shield, Chrome, Loader2, ExternalLink, Globe, ShieldAlert, Activity, ChevronLeft, RotateCw, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const getElectron = () => {
  if (typeof window !== 'undefined' && window.electron) return window.electron;
  return {
    ipcRenderer: {
      invoke: async () => ({ success: false, message: '非原生环境' }),
      send: () => {},
      on: () => {},
      removeAllListeners: () => {}
    }
  };
};

export default function AccountManagerView({ accounts, setAccounts, browserTabs, setBrowserTabs, activeTabId, setActiveTabId }) {
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [loginMethod, setLoginMethod] = useState('scan'); 
  const [cookieStr, setCookieStr] = useState('');
  
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [formData, setFormData] = useState({ alias: '', customName: '', customUrl: '', proxy: '' });

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
  const newGroupInputRef = useRef(null);

  const [isAccountListCollapsed, setIsAccountListCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('account_list_collapsed') || 'false'); } catch { return false; }
  });
  const toggleAccountList = () => {
    const next = !isAccountListCollapsed;
    setIsAccountListCollapsed(next);
    localStorage.setItem('account_list_collapsed', JSON.stringify(next));
  };

  const [bindingStatus, setBindingStatus] = useState(null);
  
  const [sniffingStatus, setSniffingStatus] = useState({});
  const queuedAccounts = useRef(new Set());

  // ─── 多标签页内嵌浏览器（状态提升至 App.jsx，跨视图存活）───
  const [addressInput, setAddressInput] = useState('');
  const sessionPanelRef = useRef(null);

  // 当前活跃标签的 URL
  const activeTab = browserTabs.find(t => String(t.accountId) === String(activeTabId));
  const activeTabUrl = activeTab?.url || '';

  // 同步地址栏输入框与当前标签 URL
  useEffect(() => {
    if (activeTabId !== null) {
      setAddressInput(activeTabUrl);
    }
  }, [activeTabId, activeTabUrl]);

  // 导航操作
  const handleNavigate = (url) => {
    if (!activeTabId) return;
    let finalUrl = url.trim();
    if (!finalUrl) return;
    if (!/^https?:\/\//i.test(finalUrl) && !finalUrl.startsWith('about:') && !finalUrl.startsWith('file:')) {
      finalUrl = 'https://' + finalUrl;
    }
    setAddressInput(finalUrl);
    electron.ipcRenderer.invoke('navigate-account-browser', { accountId: String(activeTabId), url: finalUrl });
  };

  const handleBack = () => {
    if (!activeTabId) return;
    electron.ipcRenderer.send('account-browser-go-back', { accountId: String(activeTabId) });
  };

  const handleForward = () => {
    if (!activeTabId) return;
    electron.ipcRenderer.send('account-browser-go-forward', { accountId: String(activeTabId) });
  };

  const handleRefresh = () => {
    if (!activeTabId) return;
    electron.ipcRenderer.send('account-browser-reload', { accountId: String(activeTabId) });
  };

  // 打开内嵌浏览器的 DevTools
  const handleOpenDevTools = () => {
    if (!activeTabId) return;
    electron.ipcRenderer.invoke('open-account-browser-devtools', String(activeTabId));
  };

  // 标签切换时自动吸附/分离 BrowserView
  useEffect(() => {
    if (activeTabId !== null && sessionPanelRef.current) {
      const updateBounds = () => {
        if (!sessionPanelRef.current) return;
        const rect = sessionPanelRef.current.getBoundingClientRect();
        electron.ipcRenderer.send('attach-account-browser', {
          accountId: String(activeTabId),
          bounds: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) }
        });
      };
      setTimeout(updateBounds, 300);
      window.addEventListener('resize', updateBounds);
      // ResizeObserver 监听容器尺寸变化（侧边栏折叠/展开时触发）
      const ro = new ResizeObserver(() => updateBounds());
      ro.observe(sessionPanelRef.current);
      return () => {
        window.removeEventListener('resize', updateBounds);
        ro.disconnect();
        electron.ipcRenderer.send('detach-account-browser', { accountId: String(activeTabId) });
      };
    }
  }, [activeTabId]);

  // 弹窗/模态层打开时，隐藏 BrowserView 防止遮挡（BrowserView 原生层不受 CSS z-index 控制）
  const isAnyModalOpen = showModal || showGroupModal;
  useEffect(() => {
    if (activeTabId === null) return;
    if (isAnyModalOpen) {
      electron.ipcRenderer.send('detach-account-browser', { accountId: String(activeTabId) });
    } else {
      const timer = setTimeout(() => {
        if (sessionPanelRef.current && !showModal && !showGroupModal) {
          const rect = sessionPanelRef.current.getBoundingClientRect();
          electron.ipcRenderer.send('attach-account-browser', {
            accountId: String(activeTabId),
            bounds: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) }
          });
        }
      }, 150); // 等弹窗关闭动画完成
      return () => clearTimeout(timer);
    }
  }, [isAnyModalOpen]);

  // 关闭一个标签页
  const handleCloseTab = async (accountId) => {
    const idStr = String(accountId);
    electron.ipcRenderer.send('detach-account-browser', { accountId: idStr });
    await electron.ipcRenderer.invoke('close-account-session', { accountId: idStr });
    const newTabs = browserTabs.filter(t => String(t.accountId) !== idStr);
    setBrowserTabs(newTabs);
    if (String(activeTabId) === idStr) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].accountId : null);
    }
  };

  // 切换到指定标签
  const switchToTab = (accountId) => {
    if (String(activeTabId) === String(accountId)) return;
    if (activeTabId !== null) {
      electron.ipcRenderer.send('detach-account-browser', { accountId: String(activeTabId) });
    }
    setActiveTabId(accountId);
  };

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
      } catch (error) {}
    };
    fetchFreshData();
  }, []);

  useEffect(() => {
    if (accounts.length > 0) {
      const toSniff = accounts.filter(a => !queuedAccounts.current.has(a.id));
      
      if (toSniff.length > 0) {
        toSniff.forEach(a => queuedAccounts.current.add(a.id));
        
        setSniffingStatus(prev => {
          const next = { ...prev };
          toSniff.forEach(a => next[a.id] = 'sniffing');
          return next;
        });

        const queue = [...toSniff];
        let activeWorkers = 0;

        const processQueue = async () => {
          if (queue.length === 0 && activeWorkers === 0) return;
          while (activeWorkers < 2 && queue.length > 0) {
            const acc = queue.shift();
            activeWorkers++;
            
            electron.ipcRenderer.invoke('check-account-status', { accountId: acc.id, platform: acc.platform })
              .then(res => {
                setSniffingStatus(prev => ({ ...prev, [acc.id]: res.status }));
                setAccounts(prevAccounts => prevAccounts.map(a => a.id === acc.id ? { ...a, status: res.status } : a));
              })
              .catch(() => {
                setSniffingStatus(prev => ({ ...prev, [acc.id]: '离线异常' }));
              })
              .finally(() => {
                activeWorkers--;
                processQueue();
              });
          }
        };
        processQueue();
      }
    }
  }, [accounts]);

  // ─── 入网嗅探回调：主进程提取到用户数据后推送 ───
  useEffect(() => {
    const handler = (_event, payload) => {
      const { accountId, _status } = payload;
      if (!accountId) return;

      if (_status === 'started') {
        setSniffingStatus(prev => ({ ...prev, [accountId]: '嗅探中' }));
        return;
      }

      if (_status === 'login_detected') {
        setSniffingStatus(prev => ({ ...prev, [accountId]: '已登录-提取中' }));
        return;
      }

      // 数据入库完成或最终结算 → 刷新列表 + 更新标签页标题
      if (_status === 'complete' || _status === 'finalized') {
        const hasRealName = payload.real_name || payload.user_id;
        const displayName = payload.real_name || payload.user_id || '';
        setSniffingStatus(prev => ({
          ...prev,
          [accountId]: hasRealName ? '在线' : '在线(无数据)'
        }));
        // 更新浏览器标签页昵称
        if (displayName) {
          setBrowserTabs(prev => prev.map(t =>
            String(t.accountId) === String(accountId) ? { ...t, alias: displayName } : t
          ));
        }
        // 异步拉取最新账号列表
        electron.ipcRenderer.invoke('db-get-accounts').then(fresh => {
          if (fresh && fresh.length > 0) setAccounts(fresh);
        }).catch(() => {});
      }
    };

    electron.ipcRenderer.on('account-onboarding-data', handler);
    return () => {
      try { electron.ipcRenderer.removeAllListeners('account-onboarding-data'); } catch (e) { /* ignore */ }
    };
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

  const handlePlatformSelect = async (platform) => {
    if (platform.isCustom) { setSelectedPlatform(platform); setModalStep(2); return; }
    if (loginMethod === 'cookie') { setSelectedPlatform(platform); setModalStep(3); return; }

    setShowModal(false);
    setBindingStatus({ platform: platform.name, startTime: Date.now(), mode: 'scan' });
    try {
      // 先创建账户记录
      const createResult = await electron.ipcRenderer.invoke('db-add-account', {
        alias: `待绑定_${platform.name}`,
        group: '默认分组',
        platform: platform.name,
        proxy: formData.proxy || '',
        status: '等待扫码'
      });
      if (!createResult.success) throw new Error(createResult.message || '创建账户失败');

      const accountId = createResult.id || createResult.lastInsertRowid;
      // 用原生内嵌会话容器打开登录页（不弹外部 Chrome）
      const openResult = await electron.ipcRenderer.invoke('open-account-session', {
        platform: platform.name,
        accountKey: `待绑定_${platform.name}`,
        customUrl: PLATFORM_URLS[platform.name] || undefined,
        accountId
      });
      if (!openResult.success) throw new Error(openResult.message || '打开浏览器失败');

      // 多标签：新增标签页并切换
      const newTab = { accountId, platform: platform.name, alias: `待绑定_${platform.name}`, url: PLATFORM_URLS[platform.name] || '' };
      setBrowserTabs(prev => {
        if (prev.find(t => String(t.accountId) === String(accountId))) return prev;
        return [...prev, newTab];
      });
      if (activeTabId !== null) {
        electron.ipcRenderer.send('detach-account-browser', { accountId: String(activeTabId) });
      }
      setActiveTabId(accountId);

      const updatedAccounts = await electron.ipcRenderer.invoke('db-get-accounts');
      setAccounts(updatedAccounts || []);
      setBindingStatus({ platform: platform.name, startTime: Date.now(), mode: 'scan', done: true, success: true });
      setTimeout(() => setBindingStatus(null), 3000);
    } catch (e) {
      setBindingStatus({ platform: platform.name, startTime: Date.now(), mode: 'scan', done: true, success: false, message: e.message || '后端进程异常' });
    }
  };

  const handleAddSubmit = async () => {
    const pName = selectedPlatform.isCustom ? (formData.customName || '自定义平台') : selectedPlatform.name;
    const newAccData = { 
        alias: formData.alias || `${pName}新账号`, 
        group: '默认分组', 
        platform: pName, 
        customUrl: selectedPlatform.isCustom ? formData.customUrl : undefined,
        proxy: formData.proxy 
    };
    try {
      const result = await electron.ipcRenderer.invoke('db-add-account', newAccData);
      if (result.success) {
        const updatedAccounts = await electron.ipcRenderer.invoke('db-get-accounts');
        setAccounts(updatedAccounts || []);
        setShowModal(false); setModalStep(1); setFormData({ alias: '', customName: '', customUrl: '', proxy: '' });
      }
    } catch (e) {}
  };

  const handleCookieSubmit = async () => {
    if (!cookieStr.trim()) return alert('请填入 Cookie 数据！');
    setShowModal(false);
    setModalStep(1);
    
    const pName = selectedPlatform.name;
    setBindingStatus({ platform: pName, startTime: Date.now(), mode: 'cookie' });

    try {
        const result = await electron.ipcRenderer.invoke('import-account-cookie', {
            platform: pName,
            cookieStr: cookieStr,
            proxyStr: formData.proxy 
        });

        if (result.success) {
            const refreshed = await electron.ipcRenderer.invoke('db-get-accounts');
            setAccounts(refreshed || []);
            setBindingStatus({ platform: pName, startTime: Date.now(), mode: 'cookie', done: true, success: true, message: '会话初始化并提取数据成功！' });
            setCookieStr(''); 
            setTimeout(() => setBindingStatus(null), 3000);
        } else {
            setBindingStatus({ platform: pName, startTime: Date.now(), mode: 'cookie', done: true, success: false, message: result.message });
        }
    } catch(e) {
        setBindingStatus({ platform: pName, startTime: Date.now(), mode: 'cookie', done: true, success: false, message: '底层进程异常' });
    }
  };

  const toggleGroup = (groupName) => setCollapsedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  const submitNewGroup = () => {
    const trimmed = (newGroupInputRef.current?.value || newGroupName || '').trim();
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

    // 关闭对应的浏览器标签页
    const idStr = String(id);
    const existingTab = browserTabs.find(t => String(t.accountId) === idStr);
    if (existingTab) {
      electron.ipcRenderer.send('detach-account-browser', { accountId: idStr });
      await electron.ipcRenderer.invoke('close-account-session', { accountId: idStr });
      const newTabs = browserTabs.filter(t => String(t.accountId) !== idStr);
      setBrowserTabs(newTabs);
      if (String(activeTabId) === idStr) {
        setActiveTabId(newTabs.length > 0 ? newTabs[0].accountId : null);
      }
    }

    await electron.ipcRenderer.invoke('db-delete-account', id);
    setAccounts(accounts.filter(a => a.id !== id));
  };

  const getStatusInfo = (id, defaultStatus) => {
    const status = sniffingStatus[id] || defaultStatus;
    if (status === 'sniffing' || status === '嗅探中') return { color: 'bg-amber-500', ping: true, isOffline: false, icon: <Loader2 size={8} className="animate-spin text-white"/> };
    if (status === '已登录-提取中') return { color: 'bg-cyan-500', ping: true, isOffline: false, icon: <Loader2 size={8} className="animate-spin text-white"/> };
    if (status === '在线') return { color: 'bg-emerald-500', ping: false, isOffline: false, icon: null };
    if (status === '在线(无数据)') return { color: 'bg-amber-500', ping: false, isOffline: false, icon: null };
    if (status === '登录失效' || status === '扫码超时') return { color: 'bg-rose-500', ping: false, isOffline: true, icon: <X size={8} className="text-white stroke-[3]"/> };
    return { color: 'bg-rose-500', ping: false, isOffline: true, icon: <X size={8} className="text-white stroke-[3]"/> };
  };

  const formatElapsed = () => {
    if (!bindingStatus) return '';
    const elapsed = Math.floor((Date.now() - bindingStatus.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
  };

  return (
    <div className="flex h-full w-full rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white animate-in fade-in duration-300">
      
      {/* 左侧：隔离矩阵库 */}
      {!isAccountListCollapsed && (
      <div className="w-[270px] bg-slate-50 border-r border-slate-200 flex flex-col flex-shrink-0 min-h-0">
        <div className="p-4 bg-white border-b border-slate-200 flex-shrink-0">
          <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
            <span className="flex items-center"><Users size={16} className="mr-2 text-indigo-600" /> 隔离矩阵库</span>
            <button onClick={toggleAccountList} className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition" title="折叠列表">
              <PanelLeftClose size={14} />
            </button>
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

        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar min-h-0">
          {Object.entries(groupedAccounts).map(([groupName, groupAccs]) => (
            <div key={groupName} onDragOver={(e) => handleDragOver(e, groupName)} onDrop={(e) => handleDrop(e, groupName)}>
              <div className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-200/50 rounded-md group transition" onClick={() => toggleGroup(groupName)}>
                <div className="flex items-center text-xs font-bold text-slate-700 flex-1">
                  {collapsedGroups[groupName] ? <ChevronRight size={14} className="mr-1 text-slate-500" /> : <ChevronDown size={14} className="mr-1 text-slate-500" />}
                  {editingGroup.oldName === groupName ? (
                    <input autoFocus value={editingGroup.newName} onChange={(e) => setEditingGroup({ ...editingGroup, newName: e.target.value })} onBlur={() => handleRenameGroupSubmit(groupName, editingGroup.newName)} onKeyDown={(e) => { if(e.key === 'Enter') handleRenameGroupSubmit(groupName, editingGroup.newName); }} onClick={(e) => e.stopPropagation()} className="border-b border-red-500 outline-none bg-transparent w-full" />
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

              {!collapsedGroups[groupName] && (
                <div className="space-y-1.5 mt-1 px-1">
                  {groupAccs.map(acc => {
                    const statusInfo = getStatusInfo(acc.id, acc.status);
                    return (
                    <div key={acc.id} draggable onDragStart={(e) => handleDragStart(e, acc.id.toString())} onDragEnd={() => { setDraggingId(null); setDragOverGroup(null); }} 
                         className={`p-2.5 rounded-xl border cursor-pointer transition-all shadow-sm group relative overflow-hidden ${
                           statusInfo.isOffline ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400' : 'bg-white border-slate-200 hover:border-indigo-300'
                         } ${draggingId === acc.id.toString() ? 'opacity-50' : 'opacity-100'}`} 
                         onClick={async () => {
                           if (draggingId === acc.id.toString()) return;
                           const pName = acc.platform;
                           const idStr = String(acc.id);

                           // 已有标签页 → 直接切换
                           const existingTab = browserTabs.find(t => String(t.accountId) === idStr);
                           if (existingTab) {
                             switchToTab(acc.id);
                             return;
                           }

                           // 新建标签页
                           setBindingStatus({ platform: pName, startTime: Date.now(), mode: 'scan' });
                           try {
                             await electron.ipcRenderer.invoke('open-account-session', {
                               platform: pName,
                               accountKey: acc.alias,
                               customUrl: acc.custom_url || undefined,
                               accountId: acc.id
                             });
                             setSniffingStatus(prev => ({ ...prev, [acc.id]: '在线' }));

                             const newTab = { accountId: acc.id, platform: pName, alias: acc.alias, url: acc.custom_url || PLATFORM_URLS[pName] || '' };
                             setBrowserTabs(prev => {
                               if (prev.find(t => String(t.accountId) === idStr)) return prev;
                               return [...prev, newTab];
                             });
                             if (activeTabId !== null) {
                               electron.ipcRenderer.send('detach-account-browser', { accountId: String(activeTabId) });
                             }
                             setActiveTabId(acc.id);

                             const refreshed = await electron.ipcRenderer.invoke('db-get-accounts');
                             setAccounts(refreshed || []);
                             setBindingStatus(null);
                           } catch (e) {
                             setBindingStatus({ platform: pName, startTime: Date.now(), mode: 'scan', done: true, success: false, message: '打开浏览器失败' });
                           }
                         }}>
                      <div className="flex items-center pr-2">
                        <div className="relative flex-shrink-0">
                          {(acc.base64_avatar || acc.avatar) ? (
                            <img src={acc.base64_avatar || acc.avatar} referrerPolicy="no-referrer" className="w-9 h-9 rounded-lg object-cover border border-slate-100 shadow-sm" onError={(e) => { e.target.style.display='none'; e.target.nextElementSibling?.style?.removeProperty('display'); }} />
                          ) : null}
                          <div style={(acc.base64_avatar || acc.avatar) ? {display:'none'} : undefined} className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm ${platforms.find(p => p.name === acc.platform)?.color || 'bg-slate-400'}`}>
                            {acc.platform ? acc.platform[0] : 'N'}
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 ${statusInfo.color} rounded-full border-2 border-white flex items-center justify-center shadow-sm z-10`}>
                            {statusInfo.ping && <span className="absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75 animate-ping"></span>}
                            {statusInfo.icon}
                          </div>
                        </div>

                        <div className="ml-3 flex-1 min-w-0">
                          {editingTag.id === acc.id ? (
                            <input autoFocus value={editingTag.value} onChange={(e) => setEditingTag({ ...editingTag, value: e.target.value })} onBlur={() => submitEditTag(acc.id, acc.alias)} onKeyDown={(e) => { if (e.key === 'Enter') submitEditTag(acc.id, acc.alias); }} onClick={(e) => e.stopPropagation()} className="w-full text-xs font-bold text-indigo-600 outline-none bg-transparent border-b border-indigo-200" />
                          ) : (
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="text-xs font-bold text-slate-800 truncate" title={acc.real_name || acc.alias}>{acc.real_name || acc.alias}</div>
                            </div>
                          )}
                           <div className="text-[10px] text-slate-400 mt-0.5 truncate flex flex-col gap-0.5">
                              <span className="flex items-center gap-1.5">
                                {acc.platform}
                                {statusInfo.isOffline ? (
                                  <span className="text-rose-500 font-medium flex items-center gap-0.5 bg-rose-100/50 px-1 rounded-sm"><ShieldAlert size={10}/>点击重登</span>
                                ) : (
                                  acc.user_id && <span className="text-indigo-400 font-mono">ID:{acc.user_id}</span>
                                )}
                              </span>
                              <span className="flex items-center gap-2">
                                {acc.followers > 0 && <span className="text-emerald-500">粉:{acc.followers >= 10000 ? (acc.followers / 10000).toFixed(1) + 'w' : acc.followers.toLocaleString()}</span>}
                                {acc.total_views > 0 && <span className="text-amber-400">
                                  {['抖音', '快手', '小红书', '微信视频号', '百家号'].includes(acc.platform) ? '赞:' : '播放:'}
                                  {(acc.total_views >= 10000 ? (acc.total_views / 10000).toFixed(1) + 'w' : acc.total_views.toLocaleString())}
                                </span>}
                              </span>
                           </div>
                        </div>
                      </div>
                      
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-white/95 backdrop-blur-sm p-1 rounded-lg shadow-md border border-slate-100 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                         <button onClick={(e) => { e.stopPropagation(); setEditingTag({ id: acc.id, value: acc.alias }); }} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition" title="修改名称"><Edit size={12} /></button>
                         <button onClick={async (e) => { e.stopPropagation(); if (!confirm('⚠️ 确定要清除「' + (acc.real_name || acc.alias) + '」的会话数据吗？\n\n清除后需要重新扫码登录。')) return; const res = await electron.ipcRenderer.invoke('clear-account-session-data', { accountId: acc.id }); if (res.success) alert('✅ 会话数据已清除，请重新打开该账户扫码登录。'); }} className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition" title="清除会话数据"><ShieldAlert size={12} /></button>
                         <button onClick={(e) => handleDelete(e, acc.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition" title="删除账号"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      )}
      {isAccountListCollapsed && (
        <div className="w-[44px] bg-slate-50 border-r border-slate-200 flex flex-col items-center flex-shrink-0 py-3 gap-3 min-h-0">
          <button onClick={toggleAccountList} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition" title="展开列表">
            <PanelLeftOpen size={16} />
          </button>
          <span className="text-[10px] font-black text-slate-400" style={{ writingMode: 'vertical-rl' }}>
            矩阵{accounts.length}
          </span>
        </div>
      )}

      {/* 右侧：多标签浏览器 + 仪表盘 */}
      <div className="flex-1 bg-slate-900 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
        {/* ─── 标签栏（类似 Chrome Tabs）─── */}
        {browserTabs.length > 0 && (
          <div className="flex items-center bg-slate-800 border-b border-slate-700 flex-shrink-0 overflow-x-auto custom-scrollbar">
            {browserTabs.map(tab => {
              const isActive = String(activeTabId) === String(tab.accountId);
              return (
                <div key={tab.accountId}
                  onClick={() => switchToTab(tab.accountId)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer border-r border-slate-700/50 transition flex-shrink-0 select-none ${
                    isActive
                      ? 'bg-slate-900 text-white border-t-2 border-t-emerald-400 -mt-[1px]'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  <span className="font-bold text-[11px]">{tab.platform}</span>
                  <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{tab.alias}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.accountId); }}
                    className="ml-0.5 p-0.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition"
                    title="关闭标签"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── 地址栏 ─── */}
        {activeTabId !== null && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-800 border-b border-slate-700 flex-shrink-0">
            <button
              onClick={handleBack}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title="后退"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={handleForward}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title="前进"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={handleRefresh}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title="刷新"
            >
              <RotateCw size={13} />
            </button>
            <button
              onClick={handleOpenDevTools}
              className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-700 transition"
              title="打开此页面DevTools"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            </button>
            <input
              type="text"
              className="flex-1 bg-slate-700 text-white text-xs px-3 py-1.5 rounded-full outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-slate-600 transition font-mono"
              placeholder="输入网址后按 Enter 跳转..."
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNavigate(addressInput);
                }
              }}
              onFocus={(e) => e.target.select()}
            />
          </div>
        )}

        {/* ─── 浏览器视图区 ─── */}
        {activeTabId !== null && (
          <div className="flex-1 bg-white" ref={sessionPanelRef} />
        )}

        {/* ─── 仪表盘（无活跃标签时显示）─── */}
        {activeTabId === null && (
        <div className="flex-1 flex items-center justify-center">
          {bindingStatus ? (
            bindingStatus.done ? (
              <div className={`flex flex-col items-center space-y-4 p-8 rounded-2xl border shadow-lg z-50 ${bindingStatus.success ? 'bg-emerald-50/90 border-emerald-500/50' : 'bg-amber-50/90 border-amber-500/50'} backdrop-blur-md`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${bindingStatus.success ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {bindingStatus.success ? <Shield size={28} /> : <X size={28} />}
                </div>
                <div className="text-center">
                  <h3 className={`text-lg font-bold mb-1 ${bindingStatus.success ? 'text-emerald-900' : 'text-amber-900'}`}>
                    {bindingStatus.success ? '节点注入成功' : '部署异常'}
                  </h3>
                  <p className="text-sm text-slate-600">{bindingStatus.message || '操作已完成'}</p>
                </div>
                <button onClick={() => setBindingStatus(null)} className="px-6 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-black transition">返回调度舱</button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-6 p-10 rounded-3xl border border-indigo-500/30 bg-indigo-950/20 backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-300 shadow-[0_0_50px_rgba(99,102,241,0.2)]">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-400/50">
                    {bindingStatus.mode === 'cookie' ? <ShieldAlert size={48} className="text-rose-400 animate-pulse" /> : <Chrome size={48} className="text-indigo-400 animate-pulse" />}
                  </div>
                  <div className={`absolute -inset-2 rounded-full border-2 border-t-transparent animate-spin ${bindingStatus.mode === 'cookie' ? 'border-rose-500/20 border-r-rose-500' : 'border-indigo-500/20 border-l-indigo-500'}`}></div>
                </div>
                <div className="text-center space-y-3">
                  <h3 className="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-3">
                    {bindingStatus.mode === 'cookie' ? <ShieldAlert size={20} className="text-rose-400" /> : <ExternalLink size={20} className="text-indigo-400" />} 
                    {bindingStatus.mode === 'cookie' ? '正在执行会话初始化...' : '正在调起隔离环境...'}
                  </h3>
                  <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                    {bindingStatus.mode === 'cookie' 
                        ? <>系统正在后台隐形重载 <span className="text-rose-400 font-mono font-bold uppercase">{bindingStatus.platform}</span> 的安全容器，强制下发防风控凭证，请稍候...</>
                        : <>系统正在为 <span className="text-indigo-400 font-mono font-bold uppercase">{bindingStatus.platform}</span> 创建独立的指纹容器环境，请在弹出的浏览器中进行操作。</>}
                  </p>
                  <div className="pt-4 flex justify-center">
                    <span className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-mono text-indigo-300 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping"></div>
                      SESSION ACTIVE: {formatElapsed()}
                    </span>
                  </div>
                </div>
                <button onClick={() => setBindingStatus(null)} className="text-xs text-slate-500 hover:text-red-400 transition-colors uppercase tracking-widest font-bold border-b border-transparent hover:border-red-400 pb-0.5">终止进程</button>
              </div>
            )
          ) : (
            <div className="absolute inset-0 w-full h-full bg-[#050A15] overflow-hidden flex items-center justify-center font-mono select-none">
              <style>{`
                @keyframes radar-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes orbit-slow { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
                @keyframes float-up { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                @keyframes float-down { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(10px); } }
                @keyframes pulse-glow { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.8; box-shadow: 0 0 30px rgba(99,102,241,0.6); } }
                .glass-panel { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(12px); border: 1px solid rgba(99, 102, 241, 0.2); }
              `}</style>
              
              <div className="absolute inset-0 z-0 opacity-20" 
                   style={{ 
                     backgroundImage: 'linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px)', 
                     backgroundSize: '40px 40px',
                     backgroundPosition: 'center center'
                   }}>
              </div>

              <div className="relative w-[500px] h-[500px] flex items-center justify-center z-10">
                <div className="absolute inset-0 border border-indigo-500/10 rounded-full animate-[radar-spin_25s_linear_infinite]"></div>
                <div className="absolute inset-8 border border-cyan-500/10 rounded-full animate-[orbit-slow_20s_linear_infinite] border-dashed"></div>
                <div className="absolute inset-16 border border-emerald-500/10 rounded-full animate-[radar-spin_15s_linear_infinite]"></div>
                
                <div className="absolute inset-0 rounded-full animate-[radar-spin_4s_linear_infinite]" 
                     style={{ background: 'conic-gradient(from 0deg, transparent 70%, rgba(99,102,241,0.1) 95%, rgba(99,102,241,0.4) 100%)' }}>
                </div>

                <div className="absolute inset-0 animate-[radar-spin_25s_linear_infinite]">
                  <div className="absolute top-0 left-1/2 w-2 h-2 bg-indigo-400 rounded-full shadow-[0_0_10px_#818cf8]"></div>
                  <div className="absolute bottom-1/4 right-0 w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee]"></div>
                </div>
                <div className="absolute inset-8 animate-[orbit-slow_20s_linear_infinite]">
                  <div className="absolute bottom-0 left-1/4 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_10px_#34d399]"></div>
                </div>

                <div className="relative w-32 h-32 flex items-center justify-center animate-[pulse-glow_3s_ease-in-out_infinite] rounded-full bg-indigo-950 border border-indigo-500/50">
                  <div className="absolute inset-2 rounded-full border border-indigo-400/30 border-t-indigo-400 animate-spin"></div>
                  <Globe size={40} className="text-indigo-400" />
                </div>
              </div>

              <div className="absolute left-8 top-1/4 glass-panel p-4 rounded-xl w-64 animate-[float-up_6s_ease-in-out_infinite] z-20">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-indigo-500/20">
                  <Activity size={16} className="text-cyan-400" />
                  <span className="text-cyan-400 text-xs font-bold uppercase tracking-wider">Node Status</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">活跃矩阵点</span>
                    <span className="text-white font-black">{accounts.length} <span className="text-slate-500 text-[10px]">Nodes</span></span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">网络连通性</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-emerald-400">100% 极速</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">并发线程池</span>
                    <span className="text-indigo-400">Idle / Ready</span>
                  </div>
                </div>
              </div>

              <div className="absolute right-8 bottom-1/4 glass-panel p-4 rounded-xl w-64 animate-[float-down_7s_ease-in-out_infinite] z-20">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-indigo-500/20">
                  <Shield size={16} className="text-emerald-400" />
                  <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">环境检测</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">协议伪装层</span>
                    <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px]">ACTIVE</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">API 提取引擎</span>
                    <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded text-[10px]">ONLINE</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">DOM 环境检测</span>
                    <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded text-[10px]">STANDBY</span>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-12 flex flex-col items-center z-20 w-full">
                <div className="glass-panel px-8 py-4 rounded-2xl flex flex-col items-center text-center shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                  <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-400 tracking-[0.2em] mb-2">
                    全域聚合调度驾驶舱
                  </h2>
                  <p className="text-xs text-slate-400 max-w-md tracking-wider">
                    底层 <span className="text-cyan-400">Playwright 容器</span> 与 <span className="text-indigo-400">会话初始化引擎</span> 已就绪。<br/>
                    请点击左侧的 <span className="text-indigo-400 font-bold">「+ 加账号」</span> 注入新的媒体资产。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* 新建分组弹窗 */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center"><FolderPlus className="mr-2 text-indigo-500" size={16}/>新建分组</h3>
              <button onClick={() => setShowGroupModal(false)} className="p-1 hover:bg-slate-200 rounded-md text-slate-500 transition"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <input ref={newGroupInputRef} autoFocus className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:border-indigo-500 font-bold text-slate-900 text-sm" placeholder="例如：游戏自媒体矩阵" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') submitNewGroup(); }} />
              <button onClick={submitNewGroup} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold text-sm shadow-md hover:bg-indigo-700 transition">确认创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 选择平台入网弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                {modalStep === 1 ? '添加社交账号节点' : (modalStep === 3 ? 'Cookie 导入' : '自定义资产标签')}
              </h3>
              <button onClick={() => { setShowModal(false); setModalStep(1); setCookieStr(''); }} className="p-1 hover:bg-slate-200 rounded-md text-slate-500 transition"><X size={16} /></button>
            </div>
            <div className="p-5">
              
              {modalStep === 1 && (
                <>
                  <div className="flex bg-slate-200/50 p-1 rounded-lg mb-5 max-w-[280px] mx-auto">
                    <button onClick={() => setLoginMethod('scan')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${loginMethod === 'scan' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>常规扫码入网</button>
                    <button onClick={() => setLoginMethod('cookie')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition flex items-center justify-center gap-1 ${loginMethod === 'cookie' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}><ShieldAlert size={12}/> Cookie 导入</button>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-3 max-h-[40vh] overflow-y-auto p-1">
                    {platforms.map(p => (
                      <div key={p.name} onClick={() => handlePlatformSelect(p)} className={`flex flex-col items-center p-3 border border-slate-200 rounded-xl transition hover:border-indigo-500 hover:bg-indigo-50 cursor-pointer bg-white group`}>
                        <div className={`w-12 h-12 ${p.color} rounded-xl mb-2 flex items-center justify-center text-white font-black text-xl shadow-sm group-hover:scale-110 transition-transform`}>{p.isCustom ? '+' : p.name[0]}</div>
                        <span className="text-xs font-bold text-slate-700">{p.name}</span>
                      </div>
                    ))}
                  </div>

                  {loginMethod === 'scan' && (
                    <div className="mt-4 pt-4 border-t border-slate-100 max-w-lg mx-auto">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Globe size={14} className="text-slate-400" />
                            </div>
                            <input 
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 p-3 outline-none focus:border-indigo-500 font-mono text-slate-700 text-xs" 
                                placeholder="专属代理IP (选填) 格式: IP:端口:账:密" 
                                value={formData.proxy || ''}
                                onChange={e => setFormData({ ...formData, proxy: e.target.value })} 
                            />
                        </div>
                    </div>
                  )}
                </>
              )}

              {modalStep === 2 && (
                <div className="space-y-4 max-w-md mx-auto">
                  {selectedPlatform?.isCustom && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <input className="w-full bg-white border border-slate-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 font-bold text-sm" placeholder="平台名称" onChange={e => setFormData({ ...formData, customName: e.target.value })} />
                      <input className="w-full bg-white border border-slate-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 font-bold text-sm" placeholder="登录网址" onChange={e => setFormData({ ...formData, customUrl: e.target.value })} />
                    </div>
                  )}
                  <input className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none focus:border-indigo-500 font-bold text-slate-900 text-sm" placeholder="账号备注名 (必填)" onChange={e => setFormData({ ...formData, alias: e.target.value })} />
                  
                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Globe size={14} className="text-slate-400" />
                      </div>
                      <input 
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 p-3 outline-none focus:border-indigo-500 font-mono text-slate-700 text-xs" 
                          placeholder="专属代理IP (选填) 例: 192.168.1.1:8080:user:pass" 
                          value={formData.proxy || ''}
                          onChange={e => setFormData({ ...formData, proxy: e.target.value })} 
                      />
                  </div>

                  <button onClick={handleAddSubmit} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold text-sm shadow-md transition flex items-center justify-center mt-2 hover:bg-indigo-700"><Lock size={14} className="mr-1.5" />确认添加</button>
                </div>
              )}

              {modalStep === 3 && (
                <div className="space-y-4 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-2">
                  <div className="text-center mb-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-bold border border-rose-100">
                          <Shield size={12}/> 目标平台: {selectedPlatform?.name}
                      </span>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                    💡 <span className="font-bold">支持两种数据格式：</span><br/>
                    1. 浏览器插件导出的 <b>JSON</b> 数组。<br/>
                    2. 网络抓包提取的 <b>Header 字符串</b> (例如 <code>a1=xx; web_session=yy;</code>)。
                  </div>
                  <textarea 
                      autoFocus
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition-all text-xs font-mono h-32 custom-scrollbar placeholder:text-slate-400" 
                      placeholder="在此处粘贴包含授权凭证的 Cookie 数据..." 
                      value={cookieStr} 
                      onChange={e => setCookieStr(e.target.value)} 
                  />

                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Globe size={14} className="text-slate-400" />
                      </div>
                      <input 
                          className="w-full bg-white border border-slate-300 rounded-lg pl-9 p-3 outline-none focus:border-rose-500 font-mono text-slate-700 text-xs" 
                          placeholder="专属代理IP (选填) 例: 192.168.1.1:8080:user:pass" 
                          value={formData.proxy || ''}
                          onChange={e => setFormData({ ...formData, proxy: e.target.value })} 
                      />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => { setModalStep(1); setCookieStr(''); }} className="px-5 py-3 bg-slate-100 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-200 transition">返回</button>
                    <button onClick={handleCookieSubmit} className="flex-1 bg-rose-600 text-white py-3 rounded-lg font-bold text-sm shadow-md shadow-rose-500/30 transition flex items-center justify-center hover:bg-rose-700 hover:shadow-rose-500/50">
                        <ShieldAlert size={16} className="mr-2" /> 导入 Cookie 并初始化会话
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}