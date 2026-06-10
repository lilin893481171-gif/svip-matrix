import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Plus, X, Globe, MessageCircle,
  Video, Palette, Code, Music, Terminal, Box, BookOpen,
  Camera, ShoppingBag, Cloud, FileText,
  Loader2, Check, Grid3X3, Minimize2,
  FolderOpen, Cpu, MonitorPlay, Sparkles,
  Film, PenTool, Headphones
} from 'lucide-react';
import { useToast } from './ToastContext';

const getElectron = () => {
  if (typeof window !== 'undefined' && window.electron) return window.electron;
  return { ipcRenderer: { invoke: async () => ({}), on: () => {}, removeAllListeners: () => {} } };
};

const electron = getElectron();

// ── 平台检测 ────────────────────────────────────────────
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || '');

// ── 品牌色 ──────────────────────────────────────────────
const BRAND_COLORS = {
  微信:'#07C160',剪映:'#00E5FF',Chrome:'#4285F4','VS Code':'#007ACC',
  Photoshop:'#31A8FF',QQ:'#12B7F5',钉钉:'#0089FF',飞书:'#3370FF',
  Edge:'#0078D7',Firefox:'#FF7139',Premiere:'#9999FF',DaVinci:'#FF6B35',
  Illustrator:'#FF9A00',Figma:'#A259FF',WebStorm:'#00CD8F',Sublime:'#FF9800',
  Terminal:'#4AF626',Postman:'#FF6C37',Docker:'#2496ED',Notion:'#000000',
  网易云:'#EC4141',Spotify:'#1DB954',抖音:'#FE2C55',OBS:'#302E31',
  WPS:'#E93D35',百度网盘:'#3385FF','7-Zip':'#777777',Everything:'#FFA500',
  Snipaste:'#FF4081',PotPlayer:'#FF6B00',Bandizip:'#00A86B',
  腾讯会议:'#0052D9',Zoom:'#2D8CFF',Telegram:'#26A5E4',Discord:'#5865F2',
  Slack:'#4A154B',Obsidian:'#7C3AED',Typora:'#409EFF',Xmind:'#FC4C4F',
  墨刀:'#2468FF',Eagle:'#0078D4',Alfred:'#444444',Raycast:'#FF6363',
};

// ── icon 映射 ────────────────────────────────────────────
const ICON_OF = {
  Globe,MessageCircle,Video,Palette,Code,Music,Terminal,
  Box,BookOpen,Camera,ShoppingBag,Cloud,FileText,
  MonitorPlay,Film,PenTool,Headphones,Search,
};

// ── 默认 dock ───────────────────────────────────────────
const DEFAULT_PINNED = [
  {id:'wechat',name:'微信',cat:'MessageCircle'},
  {id:'jianying',name:'剪映',cat:'Film'},
  {id:'chrome',name:'Chrome',cat:'Globe'},
  {id:'vscode',name:'VS Code',cat:'Code'},
  {id:'photoshop',name:'Photoshop',cat:'Palette'},
];

// ── 兜底应用列表 (IPC 扫描失败时使用) ────────────────
const FALLBACK_DISCOVERED_WIN = [
  {id:'qq',name:'QQ',cat:'MessageCircle',path:'C:\\Program Files\\Tencent\\QQ\\Bin\\QQ.exe'},
  {id:'dingtalk',name:'钉钉',cat:'MessageCircle',path:'C:\\Program Files\\DingDing\\DingTalk.exe'},
  {id:'feishu',name:'飞书',cat:'MessageCircle',path:'C:\\Users\\%USER%\\AppData\\Local\\Feishu\\Feishu.exe'},
  {id:'edge',name:'Edge',cat:'Globe',path:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'},
  {id:'firefox',name:'Firefox',cat:'Globe',path:'C:\\Program Files\\Mozilla Firefox\\firefox.exe'},
  {id:'premiere',name:'Premiere',cat:'Film',path:'C:\\Program Files\\Adobe\\Adobe Premiere Pro\\Adobe Premiere Pro.exe'},
  {id:'davinci',name:'DaVinci',cat:'Film',path:'C:\\Program Files\\Blackmagic Design\\DaVinci Resolve\\Resolve.exe'},
  {id:'illustrator',name:'Illustrator',cat:'PenTool',path:'C:\\Program Files\\Adobe\\Adobe Illustrator\\Support Files\\Contents\\Windows\\Illustrator.exe'},
  {id:'figma',name:'Figma',cat:'Palette',path:'C:\\Users\\%USER%\\AppData\\Local\\Figma\\Figma.exe'},
  {id:'webstorm',name:'WebStorm',cat:'Code',path:'C:\\Program Files\\JetBrains\\WebStorm\\bin\\webstorm64.exe'},
  {id:'sublime',name:'Sublime',cat:'Code',path:'C:\\Program Files\\Sublime Text\\sublime_text.exe'},
  {id:'terminal',name:'Terminal',cat:'Terminal',path:'C:\\Program Files\\WindowsApps\\Microsoft.WindowsTerminal\\wt.exe'},
  {id:'postman',name:'Postman',cat:'Globe',path:'C:\\Users\\%USER%\\AppData\\Local\\Postman\\Postman.exe'},
  {id:'docker',name:'Docker',cat:'Box',path:'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'},
  {id:'notion',name:'Notion',cat:'BookOpen',path:'C:\\Users\\%USER%\\AppData\\Local\\Programs\\Notion\\Notion.exe'},
  {id:'netease',name:'网易云',cat:'Music',path:'C:\\Program Files\\Netease\\CloudMusic\\cloudmusic.exe'},
  {id:'spotify',name:'Spotify',cat:'Music',path:'C:\\Users\\%USER%\\AppData\\Roaming\\Spotify\\Spotify.exe'},
  {id:'douyin',name:'抖音',cat:'Video',path:'C:\\Program Files\\douyin\\Douyin.exe'},
  {id:'obs',name:'OBS',cat:'Video',path:'C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe'},
  {id:'wps',name:'WPS',cat:'FileText',path:'C:\\Program Files\\Kingsoft\\WPS Office\\wps.exe'},
  {id:'baidu-pan',name:'百度网盘',cat:'Cloud',path:'C:\\Program Files\\Baidu\\BaiduNetdisk\\BaiduNetdisk.exe'},
  {id:'7zip',name:'7-Zip',cat:'Box',path:'C:\\Program Files\\7-Zip\\7zFM.exe'},
  {id:'everything',name:'Everything',cat:'Search',path:'C:\\Program Files\\Everything\\Everything.exe'},
  {id:'snipaste',name:'Snipaste',cat:'Camera',path:'C:\\Program Files\\Snipaste\\Snipaste.exe'},
  {id:'potplayer',name:'PotPlayer',cat:'MonitorPlay',path:'C:\\Program Files\\DAUM\\PotPlayer\\PotPlayerMini64.exe'},
  {id:'tencent-meeting',name:'腾讯会议',cat:'Video',path:'C:\\Program Files\\Tencent\\WeMeet\\wemeetapp.exe'},
  {id:'zoom',name:'Zoom',cat:'Video',path:'C:\\Users\\%USER%\\AppData\\Roaming\\Zoom\\bin\\Zoom.exe'},
  {id:'telegram',name:'Telegram',cat:'MessageCircle',path:'C:\\Users\\%USER%\\AppData\\Roaming\\Telegram Desktop\\Telegram.exe'},
  {id:'discord',name:'Discord',cat:'MessageCircle',path:'C:\\Users\\%USER%\\AppData\\Local\\Discord\\app\\Discord.exe'},
  {id:'obsidian',name:'Obsidian',cat:'BookOpen',path:'C:\\Users\\%USER%\\AppData\\Local\\Obsidian\\Obsidian.exe'},
  {id:'typora',name:'Typora',cat:'FileText',path:'C:\\Program Files\\Typora\\Typora.exe'},
  {id:'xmind',name:'Xmind',cat:'FileText',path:'C:\\Program Files\\XMind\\XMind.exe'},
];

const FALLBACK_DISCOVERED_MAC = [
  {id:'safari',name:'Safari',cat:'Globe',path:'/Applications/Safari.app'},
  {id:'chrome',name:'Chrome',cat:'Globe',path:'/Applications/Google Chrome.app'},
  {id:'edge',name:'Edge',cat:'Globe',path:'/Applications/Microsoft Edge.app'},
  {id:'firefox',name:'Firefox',cat:'Globe',path:'/Applications/Firefox.app'},
  {id:'terminal',name:'Terminal',cat:'Terminal',path:'/System/Applications/Utilities/Terminal.app'},
  {id:'vscode',name:'VS Code',cat:'Code',path:'/Applications/Visual Studio Code.app'},
  {id:'sublime',name:'Sublime',cat:'Code',path:'/Applications/Sublime Text.app'},
  {id:'webstorm',name:'WebStorm',cat:'Code',path:'/Applications/WebStorm.app'},
  {id:'xcode',name:'Xcode',cat:'Code',path:'/Applications/Xcode.app'},
  {id:'figma',name:'Figma',cat:'Palette',path:'/Applications/Figma.app'},
  {id:'photoshop',name:'Photoshop',cat:'Palette',path:'/Applications/Adobe Photoshop/Adobe Photoshop.app'},
  {id:'illustrator',name:'Illustrator',cat:'PenTool',path:'/Applications/Adobe Illustrator/Adobe Illustrator.app'},
  {id:'premiere',name:'Premiere',cat:'Film',path:'/Applications/Adobe Premiere Pro/Adobe Premiere Pro.app'},
  {id:'davinci',name:'DaVinci',cat:'Film',path:'/Applications/DaVinci Resolve/DaVinci Resolve.app'},
  {id:'finalcut',name:'Final Cut',cat:'Film',path:'/Applications/Final Cut Pro.app'},
  {id:'obs',name:'OBS',cat:'Video',path:'/Applications/OBS.app'},
  {id:'spotify',name:'Spotify',cat:'Music',path:'/Applications/Spotify.app'},
  {id:'notion',name:'Notion',cat:'BookOpen',path:'/Applications/Notion.app'},
  {id:'obsidian',name:'Obsidian',cat:'BookOpen',path:'/Applications/Obsidian.app'},
  {id:'postman',name:'Postman',cat:'Globe',path:'/Applications/Postman.app'},
  {id:'docker',name:'Docker',cat:'Box',path:'/Applications/Docker.app'},
  {id:'discord',name:'Discord',cat:'MessageCircle',path:'/Applications/Discord.app'},
  {id:'telegram',name:'Telegram',cat:'MessageCircle',path:'/Applications/Telegram.app'},
  {id:'zoom',name:'Zoom',cat:'Video',path:'/Applications/zoom.us.app'},
  {id:'slack',name:'Slack',cat:'MessageCircle',path:'/Applications/Slack.app'},
  {id:'alfred',name:'Alfred',cat:'Search',path:'/Applications/Alfred 5.app'},
  {id:'raycast',name:'Raycast',cat:'Search',path:'/Applications/Raycast.app'},
  {id:'iterm',name:'iTerm2',cat:'Terminal',path:'/Applications/iTerm.app'},
  {id:'sketch',name:'Sketch',cat:'PenTool',path:'/Applications/Sketch.app'},
  {id:'things',name:'Things',cat:'Box',path:'/Applications/Things3.app'},
  {id:'typora',name:'Typora',cat:'FileText',path:'/Applications/Typora.app'},
];

const FALLBACK_DISCOVERED = isMac ? FALLBACK_DISCOVERED_MAC : FALLBACK_DISCOVERED_WIN;

const SCAN_PATHS_WIN = [
  'C:\\Program Files\\','C:\\Program Files (x86)\\',
  'C:\\Users\\%USER%\\AppData\\Local\\','C:\\Users\\%USER%\\AppData\\Roaming\\',
  'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\',
  'D:\\Applications\\','E:\\Portable\\',
];

const SCAN_PATHS_MAC = [
  '/Applications/','/System/Applications/','~/Applications/',
  '/usr/local/bin/','/opt/homebrew/bin/',
];

const SCAN_PATHS = isMac ? SCAN_PATHS_MAC : SCAN_PATHS_WIN;

const SCAN_LINES_WIN = [
  '初始化系统扫描引擎...','建立目录索引...','正在遍历 Program Files...',
  '发现可执行文件 .exe','正在遍历 AppData...','解析快捷方式 .lnk',
  '正在遍历 Start Menu...','扫描 Portable 目录...','校验数字签名...',
  '提取应用元数据...','匹配图标资源...','构建应用清单...',
];

const SCAN_LINES_MAC = [
  '初始化系统扫描引擎...','建立 Spotlight 索引...','正在遍历 /Applications...',
  '发现 .app 应用包','正在遍历 ~/Applications...','解析 Info.plist',
  '正在遍历 /usr/local/bin...','扫描 Homebrew Casks...','校验代码签名...',
  '提取应用元数据...','匹配图标资源...','构建应用清单...',
];

const SCAN_LINES = isMac ? SCAN_LINES_MAC : SCAN_LINES_WIN;

const LS_KEY = 'app_launcher_dock_v1';

// ── AppIcon ──────────────────────────────────────────────
function AppIcon({name,cat,size=44,onClick}) {
  const color = BRAND_COLORS[name] || '#64748B';
  const Icon = ICON_OF[cat] || Box;
  return (
    <button onClick={onClick} title={`启动 ${name}`}
      className="relative flex flex-col items-center gap-1.5 group flex-shrink-0">
      <div className="relative rounded-2xl flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:-translate-y-1 group-active:scale-95"
        style={{width:size,height:size,
          background:`linear-gradient(135deg,${color}22,${color}44)`,
          boxShadow:`0 4px 12px ${color}22,inset 0 1px 0 ${color}33`}}>
        <Icon size={size*0.5} style={{color}} strokeWidth={1.8}/>
      </div>
      <span className="text-[11px] font-semibold text-slate-400 group-hover:text-white transition-colors truncate max-w-[60px] text-center leading-tight">
        {name}
      </span>
    </button>
  );
}

// ── AppCard (网格卡片) ──────────────────────────────────
function AppCard({app,selected,onToggle}) {
  const color = BRAND_COLORS[app.name] || '#64748B';
  const Icon = ICON_OF[app.cat] || Box;
  return (
    <button onClick={onToggle}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-200 group ${
        selected
          ? 'bg-red-600/10 border border-red-600/40 scale-105'
          : 'bg-slate-800/40 border border-transparent hover:bg-slate-800 hover:border-slate-700'
      }`}>
      <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${
        selected
          ? 'bg-red-600 text-white shadow-md shadow-red-600/30 scale-100'
          : 'bg-slate-700 text-transparent scale-75 group-hover:scale-100 group-hover:bg-slate-600'
      }`}>
        {selected ? <Check size={11}/> : <Plus size={11} className="text-slate-400"/>}
      </div>
      <div className="rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105"
        style={{width:48,height:48,
          background:`linear-gradient(135deg,${color}18,${color}35)`,
          boxShadow:selected?`0 0 16px ${color}44`:'none'}}>
        <Icon size={24} style={{color}} strokeWidth={1.6}/>
      </div>
      <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white transition-colors truncate w-full text-center leading-tight">
        {app.name}
      </span>
      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-950 text-slate-400 text-[9px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-mono z-10">
        {app.path}
      </span>
    </button>
  );
}

// ── 主组件 ──────────────────────────────────────────────
export default function AppLauncherWidget() {
  const toast = useToast();

  const [pinned,setPinned] = useState(()=>{
    try{const s=localStorage.getItem(LS_KEY);if(s)return JSON.parse(s)}catch(e){}
    return DEFAULT_PINNED;
  });

  const [dockOpen,setDockOpen] = useState(false);
  const [scanOpen,setScanOpen] = useState(false);
  const [scanTick,setScanTick] = useState(0);         // 递增计数器驱动动画
  const [scanDone,setScanDone] = useState(false);
  const [results,setResults] = useState([]);
  const [selected,setSelected] = useState(new Set());

  const dockRef = useRef(null);
  const timerRef = useRef(null);

  // 持久化
  useEffect(()=>{
    localStorage.setItem(LS_KEY,JSON.stringify(pinned));
  },[pinned]);

  // 点外部关 dock
  useEffect(()=>{
    if(!dockOpen)return;
    const h=e=>{if(dockRef.current&&!dockRef.current.contains(e.target))setDockOpen(false);};
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[dockOpen]);

  // 扫描驱动：用 setTimeout 链代替 setInterval，杜绝堆叠
  const SCAN_DONE_TICK = SCAN_LINES.length + SCAN_PATHS.length + 2;

  useEffect(()=>{
    if(!scanOpen||scanDone)return;
    if(scanTick>=SCAN_DONE_TICK) return;
    // 每 150ms 推进一帧动画
    timerRef.current = setTimeout(()=>{
      setScanTick(t=>t+1);
    },150);
    return ()=>clearTimeout(timerRef.current);
  },[scanOpen,scanDone,scanTick]);

  // 构建实时日志行
  const logLines = [];
  for(let i=0;i<Math.min(scanTick,SCAN_LINES.length);i++){
    logLines.push(SCAN_LINES[i]);
  }
  for(let i=0;i<scanTick-SCAN_LINES.length&&i<SCAN_PATHS.length;i++){
    logLines.push('  ↳ '+SCAN_PATHS[i]);
  }
  if(scanTick>=SCAN_LINES.length+SCAN_PATHS.length){
    logLines.push('');
    logLines.push('✓ 扫描完成 - 已建立桌面应用索引');
  }

  // 进度阶段
  const stage = scanTick<4?0:scanTick<8?1:scanTick<12?2:scanTick>=SCAN_LINES.length+SCAN_PATHS.length?4:3;

  // ── 操作 ──────────────────────────────────────────────
  const launch = useCallback(async (app)=>{
    if (!app.path) {
      toast.addToast('warning','应用路径未解析','请点击"唤醒目的"重新扫描本机应用',2500);
      return;
    }
    toast.addToast('info','正在启动 '+app.name,'应用即将打开...',1500);
    try {
      const res = await electron.ipcRenderer.invoke('launch-or-focus-app', { name: app.name, path: app.path });
      if (!res.success) throw new Error(res.error);
      if (res.action === 'focused') {
        toast.addToast('success','已唤醒 '+app.name,'窗口已置于前台',1500);
      }
    } catch (err) {
      toast.addToast('error','启动失败 '+app.name,err.message||'未能打开该应用',2500);
    }
  },[toast]);

  const removeApp = useCallback((e,id)=>{
    e.stopPropagation();
    setPinned(p=>p.filter(a=>a.id!==id));
  },[]);

  const openScan = useCallback(async ()=>{
    setScanOpen(true);
    setScanTick(0);
    setScanDone(false);
    setResults([]);
    setSelected(new Set());

    const scanPromise = electron.ipcRenderer.invoke('scan-installed-apps');

    // 动画走完后取真实结果
    timerRef.current = setTimeout(async () => {
      try {
        const data = await scanPromise;
        if (data.success && data.apps.length > 0) {
          const pinnedIds = new Set(pinned.map(a=>a.id));
          const pinnedNames = new Set(pinned.map(a=>a.name.toLowerCase()));
          setResults(data.apps.filter(a=>!pinnedIds.has(a.id)&&!pinnedNames.has(a.name.toLowerCase())));
        } else {
          const pinnedIds = new Set(pinned.map(a=>a.id));
          setResults(FALLBACK_DISCOVERED.filter(a=>!pinnedIds.has(a.id)));
        }
      } catch (_) {
        const pinnedIds = new Set(pinned.map(a=>a.id));
        setResults(FALLBACK_DISCOVERED.filter(a=>!pinnedIds.has(a.id)));
      }
      setScanDone(true);
    }, 4200);
    return ()=>clearTimeout(timerRef.current);
  },[pinned]);

  const closeScan = useCallback(()=>{
    setScanOpen(false);
    setScanTick(0);
    setScanDone(false);
    setResults([]);
    setSelected(new Set());
    if(timerRef.current){clearTimeout(timerRef.current);timerRef.current=null;}
  },[]);

  const toggleSel = useCallback((id)=>{
    setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  },[]);

  const confirmAdd = useCallback(()=>{
    const toAdd = results.filter(a=>selected.has(a.id));
    if(!toAdd.length)return;
    setPinned(p=>{
      const exist = new Set(p.map(a=>a.id));
      return [...p,...toAdd.filter(a=>!exist.has(a.id))];
    });
    closeScan();
    toast.addToast('success','已添加 '+toAdd.length+' 个应用','应用坞已更新',2000);
  },[results,selected,toast,closeScan]);

  // ── 渲染 ──────────────────────────────────────────────
  return (<>
    {/* ═══ 浮动 dock ═══ */}
    <div className="fixed bottom-6 right-6 z-[9998] flex flex-col items-end gap-2">
      {dockOpen && (
        <div ref={dockRef}
          className="bg-slate-900/95 border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/50 p-5 min-w-[420px]">
          {/* 头 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center shadow-lg shadow-red-600/20">
                <Grid3X3 size={16} className="text-white"/>
              </div>
              <div>
                <h3 className="text-white font-black text-sm tracking-wide">本地超级应用坞</h3>
                <p className="text-slate-500 text-[10px] font-medium">Local App Dock - {pinned.length} 个已固定</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={openScan}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 hover:bg-red-600/20 hover:text-red-300 text-[11px] font-bold transition-all">
                <Search size={13}/>唤醒目的
              </button>
              <button onClick={()=>setDockOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                <Minimize2 size={14}/>
              </button>
            </div>
          </div>

          {/* 图标行 */}
          {!pinned.length ? (
            <div className="text-center py-6 text-slate-600 text-xs font-medium">
              尚未固定任何应用 - 点击"唤醒目的"扫描本机软件
            </div>
          ) : (
            <div className="flex items-center gap-3 overflow-x-auto pb-1 app-dock-scroll">
              {pinned.map(a=>(
                <div key={a.id} className="relative group/dock flex-shrink-0">
                  <AppIcon name={a.name} cat={a.cat} onClick={()=>launch(a)}/>
                  <button onClick={e=>removeApp(e,a.id)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-slate-700 hover:bg-red-600 text-slate-400 hover:text-white rounded-full flex items-center justify-center opacity-0 group-hover/dock:opacity-100 transition-all">
                    <X size={10}/>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-600">
            <span className="flex items-center gap-1"><Cpu size={10}/>点击图标启动 - 悬停显示移除</span>
            <span className="font-mono">{pinned.length} APPS</span>
          </div>
        </div>
      )}

      {/* 触发按钮 */}
      <button onClick={()=>setDockOpen(p=>!p)}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-2xl border ${
          dockOpen
            ? 'bg-red-600 border-red-500 shadow-red-600/30 rotate-45'
            : 'bg-slate-900/95 border-slate-700/60 hover:border-red-600/40 hover:bg-slate-800 shadow-black/40 hover:shadow-red-600/15'
        }`}>
        <Grid3X3 size={20} className={dockOpen?'text-white':'text-slate-300'}/>
      </button>
    </div>

    {/* ═══ 扫描弹窗 ═══ */}
    {scanOpen && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85">
        <div className="bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl w-[640px] max-h-[85vh] flex flex-col overflow-hidden">

          {/* 头 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center shadow-lg shadow-red-600/20">
                {scanDone
                  ? <Sparkles size={18} className="text-white"/>
                  : <Loader2 size={18} className="text-white animate-spin"/>}
              </div>
              <div>
                <h3 className="text-white font-black text-sm">
                  {scanDone ? `发现 ${results.length} 个应用` : '正在扫描本机应用...'}
                </h3>
                <p className="text-slate-500 text-[10px] font-medium">
                  {scanDone ? '选择要添加到应用坞的软件' : (isMac ? '检索 Spotlight 与应用包索引' : '深度检索系统目录与注册表')}
                </p>
              </div>
            </div>
            <button onClick={closeScan}
              className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
              <X size={18}/>
            </button>
          </div>

          {/* 扫描动画区 */}
          {!scanDone && (
            <div className="px-6 py-4 space-y-3 flex-shrink-0">
              {/* 阶段进度条 */}
              <div className="flex items-center gap-2">
                {[0,1,2,3].map(i=>(
                  <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                    style={{background:i<=stage?'linear-gradient(90deg,#DC2626,#E11D48)':'#1E293B',
                      boxShadow:i<=stage?'0 0 8px rgba(220,38,38,.27)':'none'}}/>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>索引目录</span><span>解析文件</span><span>校验签名</span><span>构建清单</span>
              </div>

              {/* 终端 */}
              <div className="bg-black/60 border border-slate-800 rounded-xl p-4 font-mono text-[11px] leading-relaxed h-[180px] overflow-y-auto app-dock-scroll">
                {logLines.map((line,i)=>(
                  <div key={i}>
                    {line.startsWith('  ↳')?(
                      <span className="text-slate-600">{line}</span>
                    ):line.startsWith('✓')?(
                      <span className="text-emerald-400 font-bold">{line}</span>
                    ):line.startsWith('初始化')||line.startsWith('建立')?(
                      <span className="text-amber-400">{line}</span>
                    ):(
                      <span className="text-slate-400">{line}</span>
                    )}
                  </div>
                ))}
                {logLines.length>0&&logLines[logLines.length-1].startsWith('✓')&&(
                  <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-0.5 align-middle"/>
                )}
              </div>

              {/* 雷达 */}
              <div className="flex justify-center py-1">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border border-red-600/20 animate-ping"/>
                  <div className="absolute inset-2 rounded-full border border-red-600/30 animate-pulse"/>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Cpu size={24} className="text-red-400 animate-pulse"/>
                  </div>
                  <div className="absolute inset-0 rounded-full border-t-2 border-red-500/60 animate-spin"/>
                </div>
              </div>
            </div>
          )}

          {/* 结果网格 */}
          {scanDone && results.length>0 && (<>
            <div className="flex-1 overflow-y-auto px-6 py-4 app-dock-scroll">
              <div className="grid grid-cols-6 gap-3">
                {results.map(a=>(
                  <AppCard key={a.id} app={a} selected={selected.has(a.id)} onToggle={()=>toggleSel(a.id)}/>
                ))}
              </div>
            </div>

            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-500 font-medium">
                {selected.size>0
                  ? `已选择 ${selected.size} 个应用`
                  : '点击应用右上角 + 号选择'}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={closeScan}
                  className="px-4 py-2 text-[12px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
                  取消
                </button>
                <button onClick={confirmAdd} disabled={selected.size===0}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[12px] font-black rounded-xl shadow-lg shadow-red-600/20 hover:shadow-red-600/40 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100">
                  <Plus size={14}/>添加到我的工作台
                </button>
              </div>
            </div>
          </>)}

          {/* 空结果 */}
          {scanDone && results.length===0 && (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center text-slate-500">
                <FolderOpen size={40} className="mx-auto mb-3 text-slate-700"/>
                <p className="text-sm font-medium">本机所有应用已在坞中</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  </>);
}
