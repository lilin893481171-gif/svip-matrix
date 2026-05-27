import React, { useState, useEffect } from 'react';
import { Layers, Cpu, Box, ArrowLeft, BrainCircuit, Sparkles, Rocket, MonitorPlay, Film, Palette } from 'lucide-react';

import IntentHeroInput from './IntentHeroInput';
import { parseUserIntent } from '../../services/llmRouteService';
import { AI_TOOLS_REGISTRY } from '../../config/aiMatrixData';


// 🌟 引入刚刚抽离出来的车间
import TxtCorePanel from './panels/TxtCorePanel';
import AudCorePanel from './panels/AudCorePanel';
import MediaCorePanel from './panels/MediaCorePanel';
import ImageTransformPanel from './panels/ImageTransformPanel';
import EcommerceCorePanel from './panels/EcommerceCorePanel';
const CF_DOMAIN = 'https://myapp.nikolaboy.com';

// 🚀 驾驶舱占位组件（引擎即将开放）
function CockpitPlaceholder({ title, engine, icon: Icon, themeColor }) {
  return (
    <div className="flex-1 bg-zinc-950 flex flex-col items-center justify-center p-12 animate-in fade-in duration-700">
      <div className="relative mb-10">
        <div className="w-24 h-24 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          <Icon size={40} className={themeColor} />
        </div>
        <div className="absolute -top-2 -right-2 bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">
          SOON
        </div>
      </div>
      <h2 className="text-2xl font-black text-white tracking-tight mb-2">{title}</h2>
      <p className="text-sm text-zinc-500 font-medium mb-3">{engine}</p>
      <div className="w-48 h-0.5 bg-zinc-800 rounded-full mb-6">
        <div className="h-full w-1/3 bg-gradient-to-r from-zinc-700 to-zinc-500 rounded-full animate-pulse" />
      </div>
      <p className="text-xs text-zinc-600 font-mono tracking-wider uppercase">引擎适配中 · Engine Calibrating</p>
      <div className="mt-10 flex gap-1.5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 1 ? 'bg-amber-500' : 'bg-zinc-700'}`} />
        ))}
      </div>
    </div>
  );
}

function usePersistentState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try { return window.localStorage.getItem(key) !== null ? JSON.parse(window.localStorage.getItem(key)) : defaultValue; } 
    catch (e) { return defaultValue; }
  });
  useEffect(() => { window.localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}

export default function AiHubView() {
  const [cloudConfig, setCloudConfig] = useState(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [activeWorkspace, setActiveWorkspace] = usePersistentState('aihub_activeWorkspace', null);
  const [workspaceMeta, setWorkspaceMeta] = usePersistentState('aihub_workspaceMeta', null);
  const engineMatrixRef = React.useRef(null); 

  useEffect(() => {
    const fetchCloudConfig = async () => {
      try {
        const res = await fetch(`${CF_DOMAIN}/v1/hub-config`, { headers: { 'X-Matrix-Token': 'matrix-test-token-123' } });
        setCloudConfig(await res.json());
      } catch (err) {
        setCloudConfig({ strategy: { txt_core: { engine: '离线模型', cost: 1 }, aud_core: { engine: '离线模型', cost: 8 }, img_core: {engine: '离线', cost: 5}, vid_core: {engine: '离线', cost: 15}, ecommerce_core: {engine: '离线', cost: 18}, content_core: {engine: '离线', cost: 10}, film_core: {engine: '离线', cost: 20}, design_core: {engine: '离线', cost: 12}, ec_image_core: {engine: '离线', cost: 5} }});
      } finally { setTimeout(() => setIsBooting(false), 800); }
    };
    fetchCloudConfig();
  }, []);

  const handleIntentLaunch = async (inputText) => {
    setIsAnalyzing(true);
    try {
      const meta = await parseUserIntent(inputText);
      launchWorkspaceDirectly(`intent_${meta.id}`, meta.id, meta.title, meta.desc, inputText);
    } catch (e) {} finally { setIsAnalyzing(false); }
  };

  const launchWorkspaceDirectly = (toolId, coreId, title, desc, template) => {
    const currentStrategy = cloudConfig.strategy[coreId] || { engine: '云端失联', cost: 0 };
    setWorkspaceMeta({ coreId, title, desc, engine: currentStrategy.engine, cost: currentStrategy.cost, template: template || '' });
    setActiveWorkspace(toolId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <BrainCircuit size={48} className="text-indigo-500 animate-pulse mb-6" />
        <h1 className="text-xl font-black text-zinc-100 uppercase mb-2">Matrix Core Booting</h1>
        <div className="w-48 h-1 bg-zinc-800 mt-6 overflow-hidden rounded-full"><div className="h-full bg-indigo-500 animate-[pulse_1s_ease-in-out_infinite] w-full origin-left scale-x-0 transition-transform duration-1000" style={{ transform: 'scaleX(1)' }}></div></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col">
      <header className="h-16 border-b border-zinc-200 flex items-center justify-between px-8 bg-white/80 sticky top-0 z-50">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveWorkspace(null)}>
          <Box size={22} className="text-black" strokeWidth={2.5} />
          <span className="text-xl font-black tracking-tighter">YuMatrix</span>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-xs font-bold text-zinc-400 flex items-center"><Cpu size={14} className="mr-1.5" /> 算力集群节点: <span className="text-black font-black ml-1">12,450</span></div>
          {activeWorkspace && (
            <button onClick={() => { setActiveWorkspace(null); setTimeout(() => engineMatrixRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }} className="bg-black text-white text-xs font-bold px-4 py-2 rounded-sm flex items-center"><ArrowLeft size={12} className="mr-1.5" /> 返回控制台</button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {activeWorkspace ? (
          <>
            {workspaceMeta?.coreId === 'txt_core' && <TxtCorePanel activeWorkspace={activeWorkspace} workspaceMeta={workspaceMeta} />}
            {workspaceMeta?.coreId === 'aud_core' && <AudCorePanel activeWorkspace={activeWorkspace} workspaceMeta={workspaceMeta} />}
            {(workspaceMeta?.coreId === 'img_core' || workspaceMeta?.coreId === 'vid_core') && <MediaCorePanel activeWorkspace={activeWorkspace} workspaceMeta={workspaceMeta} />}
            {workspaceMeta?.coreId === 'ecommerce_core' && <EcommerceCorePanel />}
            {workspaceMeta?.coreId === 'ec_image_core' && <ImageTransformPanel activeWorkspace={activeWorkspace} workspaceMeta={workspaceMeta} />}
            {workspaceMeta?.coreId === 'content_core' && <CockpitPlaceholder title="内容驾驶舱" engine="短视频创作引擎" icon={MonitorPlay} themeColor="text-teal-400" />}
            {workspaceMeta?.coreId === 'film_core' && <CockpitPlaceholder title="制片驾驶舱" engine="影视 & 短剧引擎" icon={Film} themeColor="text-purple-400" />}
            {workspaceMeta?.coreId === 'design_core' && <CockpitPlaceholder title="视觉设计驾驶舱" engine="创意 & 空间设计引擎" icon={Palette} themeColor="text-cyan-400" />}
          </>
        ) : (
          <div className="animate-in fade-in duration-300">
            <IntentHeroInput onLaunchIntent={handleIntentLaunch} isAnalyzing={isAnalyzing} />
            <section ref={engineMatrixRef} className="bg-zinc-50 py-14 px-8 border-t border-zinc-200 w-full">
              <div className="max-w-7xl mx-auto">
                <div className="mb-12 text-center">
                  <h3 className="text-sm font-black text-zinc-400 uppercase tracking-[0.3em]">YuMatrix AI Engine Matrix</h3>
                  <p className="text-3xl font-black text-zinc-900 mt-3 tracking-tight">选择你的 AI 引擎，开启创造</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
                {AI_TOOLS_REGISTRY.map((section, sIdx) => (
                  <div key={sIdx}>
                    <div className="mb-4 pb-3 border-b border-zinc-200">
                      <h4 className="font-black text-sm uppercase tracking-wider">{section.category}</h4>
                      {section.tagline && <p className="text-[10px] font-medium text-zinc-400 mt-1 leading-relaxed">{section.tagline}</p>}
                    </div>
                    <ul className="space-y-2">
                      {section.items.map((item) => {
                        const coreId = item.type === 'video' ? 'vid_core' : item.type === 'music' ? 'aud_core' : item.type === 'text' ? 'txt_core' : item.type === 'ecommerce' ? 'ecommerce_core' : item.type === 'content_studio' ? 'content_core' : item.type === 'film_studio' ? 'film_core' : item.type === 'design_studio' ? 'design_core' : item.type === 'ec_image' ? 'ec_image_core' : 'img_core';
                        const coreDescs = { img_core: '视觉设计', vid_core: '视频混剪', aud_core: '声音工坊', txt_core: '智脑企划', ecommerce_core: '电商增长引擎', content_core: '短视频创作引擎', film_core: '影视短剧引擎', design_core: '创意设计引擎', ec_image_core: '电商图像工坊' };
                        if (item.isCockpit) {
                          return (
                            <li key={item.id} onClick={() => launchWorkspaceDirectly(item.id, coreId, item.name, coreDescs[coreId], item.template)} className="cursor-pointer group mb-3">
                              <div className="flex items-center gap-3 p-3.5 rounded-sm bg-zinc-900 hover:bg-black transition-all shadow-md group-hover:shadow-xl group-hover:-translate-y-0.5 border border-zinc-800 hover:border-zinc-700">
                                <div className="p-2 bg-white/10 rounded-sm shrink-0 group-hover:bg-white/15 transition-colors">
                                  {item.icon}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-black text-white truncate">{item.name}</div>
                                  <p className="text-[10px] text-zinc-400 leading-relaxed mt-0.5 line-clamp-2">{item.desc}</p>
                                </div>
                              </div>
                            </li>
                          );
                        }
                        return (
                          <li key={item.id} onClick={() => launchWorkspaceDirectly(item.id, coreId, item.name, coreDescs[coreId], item.template)} className="group cursor-pointer py-1">
                            <span className="text-xs font-bold text-zinc-600 group-hover:text-black flex items-center gap-1.5">
                              <span className="text-zinc-300 group-hover:text-black transition-colors text-[10px]">✦</span> {item.name}
                            </span>
                            <p className="text-[10px] text-zinc-400 ml-4 mt-0.5 leading-relaxed">{item.desc}</p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}