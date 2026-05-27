import React, { useState, useEffect } from 'react';
import { Layers, Loader2, CheckCircle2, Zap, Image as ImageIcon, Video, Settings2, Wand2, Scissors, UploadCloud, MonitorPlay, Smartphone, Download } from 'lucide-react';
import AssetUploadBox from '../AssetUploadBox'; 

function usePersistentState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try { return window.localStorage.getItem(key) !== null ? JSON.parse(window.localStorage.getItem(key)) : defaultValue; } 
    catch (e) { return defaultValue; }
  });
  useEffect(() => { window.localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}

export default function MediaCorePanel({ activeWorkspace, workspaceMeta }) {
  const [chatInput, setChatInput] = usePersistentState(`media_input_${activeWorkspace}`, '');
  const [uploadedAssetUrl, setUploadedAssetUrl] = usePersistentState(`media_asset_${activeWorkspace}`, null);
  
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [aspectRatio, setAspectRatio] = useState('16:9'); 
  const [renderStyle, setRenderStyle] = useState('写实摄影'); 

  // 🕵️‍♂️ 核心黑科技：智能业务探针
  const title = workspaceMeta?.title || '';
  const isVideo = workspaceMeta?.coreId === 'vid_core';
  
  const isProcessingOnly = title.includes('超分') || title.includes('补帧') || title.includes('无损') || title.includes('消除') || title.includes('修复'); 
  const needsUpload = title.includes('重构') || title.includes('换装') || title.includes('替换') || title.includes('渲染') || title.includes('精装') || title.includes('数字人') || title.includes('说话') || title.includes('转绘') || title.includes('混剪') || isProcessingOnly;
  const isTextToMediaOnly = !needsUpload; 

  useEffect(() => {
    if (!chatInput && workspaceMeta?.template) {
      setChatInput(workspaceMeta.template);
    }
  }, [activeWorkspace, chatInput, workspaceMeta]);

  const startMediaRender = () => {
    if (needsUpload && !uploadedAssetUrl) { alert('请先挂载核心视觉资产！'); return; }
    if (!isProcessingOnly && !chatInput.trim()) { alert('请完善画面提示词描述！'); return; }
    
    setIsRendering(true);
    setRenderProgress(5);
    const interval = setInterval(() => {
      setRenderProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsRendering(false), 800);
          return 100;
        }
        return prev + 5;
      });
    }, 150);
  };

  return (
    <div className="flex-1 bg-zinc-50 p-8 animate-in slide-in-from-bottom-6 duration-500">
      <div className="max-w-6xl mx-auto w-full">
        
        <div className="flex items-start justify-between mb-8 pb-6 border-b border-zinc-200">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-black flex items-center">
              {isVideo ? <Video size={22} className="mr-2.5 text-indigo-600"/> : <ImageIcon size={22} className="mr-2.5 text-emerald-600"/>}
              {workspaceMeta?.title}
            </h2>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mt-1.5">{workspaceMeta?.desc}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[650px]">
          
          {/* 左栏：动态变形参数面板 */}
          <div className="col-span-1 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col justify-between overflow-y-auto custom-scrollbar">
            <div className="space-y-5 flex-1">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block border-b border-zinc-100 pb-2">云端张量控制台</span>
              
              <div className="mt-6 space-y-6">
                {isTextToMediaOnly && (
                  <div>
                    <label className="text-xs font-black flex items-center mb-3 text-zinc-700">画面输出比例</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => setAspectRatio('16:9')} className={`py-2 px-1 text-[10px] font-bold rounded border flex flex-col items-center justify-center ${aspectRatio === '16:9' ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white border-zinc-200 text-zinc-500 hover:border-indigo-200'}`}><MonitorPlay size={14} className="mb-1"/> 16:9 横屏</button>
                      <button onClick={() => setAspectRatio('9:16')} className={`py-2 px-1 text-[10px] font-bold rounded border flex flex-col items-center justify-center ${aspectRatio === '9:16' ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white border-zinc-200 text-zinc-500 hover:border-indigo-200'}`}><Smartphone size={14} className="mb-1"/> 9:16 竖屏</button>
                      <button onClick={() => setAspectRatio('1:1')} className={`py-2 px-1 text-[10px] font-bold rounded border flex flex-col items-center justify-center ${aspectRatio === '1:1' ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white border-zinc-200 text-zinc-500 hover:border-indigo-200'}`}><Layers size={14} className="mb-1"/> 1:1 方形</button>
                    </div>
                  </div>
                )}

                {needsUpload && (
                  <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-sm border-dashed">
                    <label className="text-xs font-black flex items-center mb-3"><UploadCloud size={14} className="mr-1.5 text-indigo-500"/> 挂载基础视觉资产</label>
                    <AssetUploadBox onAssetReady={(url) => setUploadedAssetUrl(url)} />
                    {uploadedAssetUrl && <div className="mt-3 text-[10px] text-center font-mono text-emerald-600 bg-emerald-50 py-1.5 border border-emerald-200 rounded">✅ 云端资产已挂载</div>}
                  </div>
                )}

                {!isProcessingOnly && (
                  <div>
                    <label className="text-xs font-black flex items-center mb-3 text-zinc-700"><Wand2 size={14} className="mr-1.5 text-purple-500"/> 视觉重构风格</label>
                    <select value={renderStyle} onChange={(e) => setRenderStyle(e.target.value)} className="w-full text-xs p-2 border border-zinc-200 rounded outline-none focus:border-indigo-400 bg-white font-medium">
                      <option value="写实摄影">📸 商业写实摄影 (默认)</option>
                      <option value="赛博朋克">🌆 赛博朋克 2077</option>
                      <option value="二次元">🎨 顶级二次元插画</option>
                      <option value="3D模型">🧸 3D 盲盒潮玩渲染</option>
                      <option value="极简白底">🛒 电商极简白底</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-8 pt-4 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">云端计费单耗</span>
              <span className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-sm">-{workspaceMeta?.cost} 算力点</span>
            </div>
          </div>

          {/* 右栏：多态核心交互区 */}
          <div className="col-span-2 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col h-full relative">
            <div className="flex-1 flex flex-col justify-between">
              {isRendering ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4 animate-in fade-in">
                  <Loader2 size={32} className="text-indigo-600 animate-spin" />
                  <div className="text-center">
                    <p className="text-xs font-black uppercase tracking-widest animate-pulse text-indigo-900">云端 GPU 渲染矩阵工作跑流中...</p>
                    <p className="text-[10px] text-zinc-400 font-mono mt-1">Tensor Core Computing: {renderProgress}%</p>
                  </div>
                  <div className="h-1 w-64 bg-zinc-100 rounded-full overflow-hidden relative"><div className="h-full bg-indigo-500 transition-all duration-150" style={{ width: `${renderProgress}%` }}></div></div>
                </div>
              ) : renderProgress === 100 ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4 animate-in zoom-in-95">
                  <CheckCircle2 size={48} className="text-emerald-500" strokeWidth={2.5} />
                  <p className="text-lg font-black tracking-tight text-zinc-800">视觉资产已生成</p>
                  <p className="text-xs text-zinc-500 font-medium">素材已封存至云端，推荐下载后在剪辑软件中进行二次配音与混剪。</p>
                  <div className="w-full max-w-sm h-48 bg-zinc-100 rounded-md border border-zinc-200 mt-4 flex items-center justify-center text-zinc-400 font-black tracking-widest uppercase">
                    [这里将渲染云端返回的图像/视频流]
                  </div>
                  
                  {/* 🌟 核心修改点：下载流与二次创作闭环 */}
                  <div className="flex space-x-3 pt-6">
                    <button 
                      onClick={() => {
                        const visualUrl = 'https://picsum.photos/800/400'; // 这里填云端真实的 URL
                        fetch(visualUrl)
                          .then(r => r.blob())
                          .then(blob => {
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `YuMatrix_Visual_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            window.URL.revokeObjectURL(url);
                          })
                          .catch(() => alert('下载失败，请检查网络链路！'));
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-6 py-2.5 rounded-sm shadow-md flex items-center transition-all"
                    >
                      <Download size={14} className="mr-1.5"/> 下载原图/视频
                    </button>
                    
                    {/* 替换掉了 RPA 按钮，变为二次创作归档 */}
                    <button onClick={() => alert('素材已归档！您可以将其导入剪映/PR中，配合声音工厂生成的配音进行最终合成。')} className="bg-zinc-800 hover:bg-black text-white text-xs font-black px-6 py-2.5 rounded-sm shadow-md flex items-center transition-all">
                      <Layers size={14} className="mr-1.5"/> 归档并开启二次创作
                    </button>

                    <button onClick={() => setRenderProgress(0)} className="border border-zinc-300 hover:border-black text-xs font-black px-6 py-2.5 transition-colors rounded-sm text-zinc-600 hover:text-black">重新修改参数</button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between">
                  {isProcessingOnly ? (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 bg-zinc-50 rounded-sm">
                      <Scissors size={48} className="text-zinc-300 mb-4" />
                      <h3 className="text-lg font-black text-zinc-700 mb-2">准备开启自动化 {workspaceMeta.title.replace('工厂 | ', '')}</h3>
                      <p className="text-xs text-zinc-500 max-w-sm text-center mb-6">您已选择了无提示词云端处理流。请确保左侧已挂载需要处理的原素材。</p>
                      <button onClick={startMediaRender} disabled={!uploadedAssetUrl} className="px-8 py-3.5 bg-black text-white text-xs font-black flex items-center hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors shadow-lg">
                        <Zap size={14} className="mr-2"/> 启动视觉矩阵处理
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                       <div className="mb-4">
                         <h3 className="text-sm font-black tracking-tight mb-1 flex items-center">
                           画面生成指令 / Prompt
                           <span className="ml-3 text-[9px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded">已应用: {renderStyle}</span>
                         </h3>
                         <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Master Prompt Engineering</p>
                       </div>
                       <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="在这里输入你脑海中的终极画面细节，越详细越好..." className="w-full flex-1 bg-zinc-50 border border-zinc-300 focus:border-indigo-500 rounded-sm p-5 text-sm outline-none resize-none mb-6 custom-scrollbar leading-relaxed" />
                       <div className="flex justify-between items-center pt-4 border-t border-zinc-100">
                         <div className="text-xs font-bold">
                           {needsUpload ? (
                             <span className={uploadedAssetUrl ? "text-emerald-500" : "text-rose-500"}>{uploadedAssetUrl ? '✅ 基础垫图/视频已锁定' : '⚠️ 引擎正等待左侧素材挂载'}</span>
                           ) : <span className="text-indigo-500">🌟 准备从零渲染宇宙</span>}
                         </div>
                         <button onClick={startMediaRender} disabled={!chatInput.trim() || (needsUpload && !uploadedAssetUrl)} className="px-8 py-3 bg-black text-white text-xs font-black flex items-center hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors shadow-md">
                           <Wand2 size={14} className="mr-2"/> 启动 AGI 渲染引擎
                         </button>
                       </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}