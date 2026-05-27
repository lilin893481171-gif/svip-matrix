import React, { useState, useRef, useEffect } from 'react';
import { Layers, Mic, Settings2, Music, Download, Zap, Loader2, Play, Pause, Volume2, Star, PlayCircle, UploadCloud, Scissors, Radio, Vibrate } from 'lucide-react';
import { uploadToCloudinary } from '../../../services/cloudinaryService';
import VibeVoiceViewer from './VibeVoiceViewer';

function usePersistentState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try { return window.localStorage.getItem(key) !== null ? JSON.parse(window.localStorage.getItem(key)) : defaultValue; } 
    catch (e) { return defaultValue; }
  });
  useEffect(() => { window.localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}

const OFFICIAL_VOICES = [
  { id: 'v_movie', name: '影视解说-小帅', tag: '悬疑/叙事', demo: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-dinosaur.mp3' },
  { id: 'v_radio', name: '情感电台-知心大姐', tag: '治愈/温暖', demo: 'https://raw.githubusercontent.com/mdn/webaudio-examples/master/audio-analyser/viper.mp3' },
  { id: 'v_news', name: '央视播音-男低音', tag: '浑厚/专业', demo: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-dinosaur.mp3' }
];

export default function AudCorePanel({ activeWorkspace, workspaceMeta }) {
  const [chatInput, setChatInput] = usePersistentState(`aud_input_${activeWorkspace}`, '');
  const [uploadedAssetUrl, setUploadedAssetUrl] = usePersistentState(`aud_asset_${activeWorkspace}`, null);
  
  const [myVoices, setMyVoices] = usePersistentState('aihub_myVoices', []); 
  const [selectedVoiceId, setSelectedVoiceId] = useState('v_movie'); 
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState(null);
  const [playingDemoId, setPlayingDemoId] = useState(null); 
  const [audioParams, setAudioParams] = usePersistentState(`aud_params_${activeWorkspace}`, { refText: '', negativeTags: '' });
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const [foleyStyle, setFoleyStyle] = useState('Cinematic');

  // ✅ 新增：存储 VibeVoice 结果
  const [vibeVoiceResult, setVibeVoiceResult] = useState(null);
  const [taskResult, setTaskResult] = useState(null);
  const audioPlayerRef = useRef(null);
  const fileInputRef = useRef(null); 

  const title = workspaceMeta?.title || '';
  const isCloning = title.includes('克隆'); 
  const isMusic = title.includes('音乐') || title.includes('BGM') || title.includes('单曲') || title.includes('白噪音'); 
  const isProcessing = title.includes('提取') || title.includes('分离') || title.includes('降噪') || title.includes('后期') || title.includes('播客') || title.includes('字幕') || title.includes('打点'); 
  const isFoley = title.includes('音效'); 
  const isVibeVoice = title.includes('播客') || title.includes('字幕') || title.includes('打点');
  const isStandardTTS = !isCloning && !isMusic && !isProcessing && !isFoley; 

  useEffect(() => {
    if (!chatInput && workspaceMeta?.template) {
      setChatInput(workspaceMeta.template);
    }
    if (isCloning || isProcessing) setSelectedVoiceId('upload_new');
  }, [activeWorkspace, chatInput, workspaceMeta, isCloning, isProcessing]);

  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      setIsPlaying(false);
      setPlayingDemoId(null);
    };
  }, [activeWorkspace]);

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setAudioProgress(p => (p >= 100 ? 0 : p + 1));
        if(audioProgress >= 100) setIsPlaying(false);
      }, 300);
    }
    return () => clearInterval(interval);
  }, [isPlaying, audioProgress]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const result = await uploadToCloudinary(file);
    setIsUploading(false);

    if (result.success) {
      setUploadedAssetUrl(result.url);
      setSelectedVoiceId('upload_new');
    } else {
      alert('上传失败: ' + result.error);
    }
  };

  const handlePlayDemo = (voice) => {
    const player = audioPlayerRef.current;
    if (!player) return;

    if (playingDemoId === voice.id) {
      player.pause();
      setPlayingDemoId(null);
    } else {
      player.src = voice.demo;
      player.play().catch(e => alert('被浏览器拦截，请先点击一下页面'));
      setPlayingDemoId(voice.id);
      setIsPlaying(false); 
    }
  };

  const handleToggleMainPlayer = () => {
    const player = audioPlayerRef.current;
    if (!player) return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.src = generatedAudioUrl || 'https://raw.githubusercontent.com/mdn/webaudio-examples/master/audio-analyser/viper.mp3';
      player.play().catch(e => alert('播放失败: ' + e.message));
      setIsPlaying(true);
      setPlayingDemoId(null); 
    }
  };

  const handleTimeUpdate = () => {
    const player = audioPlayerRef.current;
    if (player && player.duration) setAudioProgress((player.currentTime / player.duration) * 100);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setPlayingDemoId(null);
    setAudioProgress(0);
  };

  const handleSaveToMyVoices = () => {
    const voiceName = window.prompt("给这个专属资产起个名字吧：");
    if (voiceName) {
      const newVoice = { id: `v_custom_${Date.now()}`, name: voiceName, tag: isFoley ? '专属音效' : '专属克隆', demo: 'https://raw.githubusercontent.com/mdn/webaudio-examples/master/audio-analyser/viper.mp3' };
      setMyVoices([...myVoices, newVoice]);
      setSelectedVoiceId(newVoice.id); 
      alert("✅ 已成功入库！您以后可以在左侧大厅直接调用它！");
    }
  };

  const startMediaRender = async () => {
    if (!isVibeVoice && !uploadedAssetUrl && !chatInput.trim() && !isProcessing) return;
    if (isProcessing && !uploadedAssetUrl) { alert('请先上传需要处理的音频文件！'); return; }
    
    setIsRendering(true);
    setRenderProgress(5); 
    setGeneratedAudioUrl(null); 
    setVibeVoiceResult(null); // ✅ 重置之前的结果

    const progressInterval = setInterval(() => {
      setRenderProgress(prev => (prev < 85 ? prev + 2 : prev));
    }, 1500);

    try {
      const gatewayUrl = isVibeVoice 
        ? "https://matrix-ai-hub.lilin893481171.workers.dev/v1/voice/vibevoice-asr"
        : "https://matrix-ai-hub.lilin893481171.workers.dev/v1/voice/omnivoice";
      
      const requestPayload = isVibeVoice 
        ? { audio: uploadedAssetUrl }
        : { prompt: chatInput, reference_audio: uploadedAssetUrl || "" };
      
      const initResponse = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Matrix-Token": "matrix-test-token-123"
        },
        body: JSON.stringify({ input: requestPayload })
      });

      let data = await initResponse.json();

      while (data.status === "IN_QUEUE" || data.status === "IN_PROGRESS") {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const pollResponse = await fetch(`${gatewayUrl}?jobId=${data.id}`, {
          method: "GET",
          headers: { "X-Matrix-Token": "matrix-test-token-123" }
        });
        data = await pollResponse.json();
      }
      
      clearInterval(progressInterval);
      setRenderProgress(100); 

      if (data.status === "COMPLETED") {
            if (data.output && data.output.status === "success") {
              
              // 🎯 分支 A：处理 VibeVoice
              if (isVibeVoice) {
                // ✅ 将正确的数据存入 State，不再用 alert 弹窗！
                setTaskResult(data.output); 
                setTimeout(() => setIsRendering(false), 800);
                return; 
              }

          const audioSrc = `data:audio/wav;base64,${data.output.audio_base64}`;
          setGeneratedAudioUrl(audioSrc);
          
        } else if (data.output && data.output.error) {
          alert(`🚨 Python 推理报错:\n${data.output.error}`);
        } else {
          alert(`🚨 未知业务状态:\n${JSON.stringify(data.output)}`);
        }
      } else {
        alert(`🚨 云端执行异常！\n最终状态: 【${data.status}】`);
      }

      setTimeout(() => setIsRendering(false), 800);

    } catch (error) {
      clearInterval(progressInterval);
      setIsRendering(false);
      alert("网络请求出错: " + error.message);
    }
  };
  
  return (
    <div className="flex-1 bg-zinc-50 p-8 animate-in slide-in-from-bottom-6 duration-500 relative">
      <audio ref={audioPlayerRef} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} className="hidden" />
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/mp3, audio/wav, audio/mpeg, video/mp4" className="hidden" />

      <div className="max-w-6xl mx-auto w-full">
        <div className="flex items-start justify-between mb-8 pb-6 border-b border-zinc-200">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-black flex items-center">
              {isMusic ? <Music size={22} className="mr-2.5" /> : isProcessing ? <Scissors size={22} className="mr-2.5"/> : isFoley ? <Vibrate size={22} className="mr-2.5" /> : <Layers size={22} className="mr-2.5" />}
              {workspaceMeta?.title}
            </h2>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mt-1.5">{workspaceMeta?.desc}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[650px]">
          <div className="col-span-1 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col justify-between overflow-y-auto custom-scrollbar">
            <div className="space-y-5 flex-1">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block border-b border-zinc-100 pb-2">云端路由策略</span>
              
              <div className="mt-6 space-y-4 animate-in fade-in">
                {isStandardTTS && (
                  <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-sm">
                    <label className="text-xs font-bold flex items-center mb-3"><Mic size={14} className="mr-1.5 text-indigo-500"/> 发音人音色库</label>
                    <div className="space-y-2 mb-4 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                      {[...OFFICIAL_VOICES, ...myVoices].map(voice => (
                        <div key={voice.id} onClick={() => { setSelectedVoiceId(voice.id); setUploadedAssetUrl(null); }} className={`flex items-center justify-between p-2.5 rounded border transition-colors cursor-pointer ${selectedVoiceId === voice.id ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-zinc-200'}`}>
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${selectedVoiceId === voice.id ? 'bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.6)]' : 'bg-zinc-300'}`}></div>
                            <div>
                              <p className="text-xs font-bold text-zinc-800 flex items-center">{voice.name} {voice.id.startsWith('v_custom') && <Star size={10} className="ml-1 text-orange-400 fill-orange-400"/>}</p>
                              <p className="text-[9px] text-zinc-400 mt-0.5">{voice.tag}</p>
                            </div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); handlePlayDemo(voice); }} className={`p-1.5 rounded-full transition-colors ${playingDemoId === voice.id ? 'bg-indigo-100 text-indigo-600 animate-pulse' : 'bg-zinc-100 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50'}`}>
                            {playingDemoId === voice.id ? <Volume2 size={14}/> : <PlayCircle size={14}/>}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isFoley && (
                  <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-sm">
                    <Vibrate size={32} className="text-emerald-500 mb-3" />
                    <h3 className="text-sm font-black mb-3">音效生成控制台</h3>
                    <p className="text-[11px] text-zinc-500 mb-4 leading-relaxed">系统将利用声音大模型，根据您在右侧描述的物理场景，直接生成影视级 Foley 音效流。</p>
                    
                    <div>
                       <label className="text-[10px] font-bold text-zinc-600 block mb-1.5">环境/材质偏好 (可选)</label>
                       <select value={foleyStyle} onChange={e => setFoleyStyle(e.target.value)} className="w-full text-xs p-2 border border-zinc-200 rounded bg-white outline-none">
                         <option value="Cinematic">🎬 电影级震撼 (Cinematic)</option>
                         <option value="Cartoon">🍄 夸张动画风 (Cartoon)</option>
                         <option value="UI">🖱️ APP交互清脆音 (UI/UX)</option>
                         <option value="Raw">🎤 原始干声无混响 (Raw Foley)</option>
                       </select>
                    </div>
                  </div>
                )}

                {(isCloning || isProcessing) && (
                  <div className="bg-zinc-50 border border-zinc-200 p-6 rounded-sm flex flex-col items-center justify-center text-center h-48 border-dashed">
                    <UploadCloud size={32} className="text-indigo-400 mb-3" />
                    <h3 className="text-sm font-black mb-1">{isProcessing ? '上传待处理音频' : '上传参考人声干声'}</h3>
                    <p className="text-[10px] text-zinc-400 mb-4">支持 WAV / MP3 格式</p>
                    
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={isUploading}
                      className="bg-black hover:bg-zinc-800 text-white text-xs font-bold px-6 py-2.5 rounded-sm transition-colors flex items-center shadow-md disabled:bg-zinc-400"
                    >
                      {isUploading ? <><Loader2 size={14} className="animate-spin mr-2"/> 上传至图床...</> : '浏览本地文件'}
                    </button>
                    
                    {uploadedAssetUrl && (
                      <div className="mt-4 text-[10px] font-mono text-emerald-600 bg-emerald-50 px-3 py-1 border border-emerald-200 rounded">✅ 云端资产挂载完毕</div>
                    )}
                  </div>
                )}

                {isMusic && (
                  <div className="bg-zinc-50 border border-zinc-200 p-6 rounded-sm flex flex-col justify-center h-48">
                    <Radio size={32} className="text-indigo-400 mb-3" />
                    <h3 className="text-sm font-black mb-1">音乐编曲控制台</h3>
                    <p className="text-[11px] text-zinc-500 mb-2">当前模式无需上传参考音频。系统将根据右侧输入的歌词，渲染出完整歌曲。</p>
                  </div>
                )}

                {(!isProcessing && !isMusic && !isFoley) && (
                  <div>
                    <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs font-bold text-zinc-500 hover:text-black flex items-center w-full justify-between border-t border-zinc-100 pt-3">
                      <span className="flex items-center"><Settings2 size={12} className="mr-1.5"/> 高级 Payload 参数</span>
                      <span>{showAdvanced ? '−' : '+'}</span>
                    </button>
                    {showAdvanced && (
                      <div className="mt-3 space-y-3 animate-in slide-in-from-top-2">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">参考文本 (用于克隆纠偏)</label>
                          <input value={audioParams.refText} onChange={e => setAudioParams({...audioParams, refText: e.target.value})} className="w-full text-xs p-2 border border-zinc-200 rounded-sm bg-zinc-50 outline-none" placeholder="输入上传干声对应的台词..." />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-8 pt-4 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">云端计费单耗</span>
              <span className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-sm">-{workspaceMeta?.cost} 算力点</span>
            </div>
          </div>

          <div className="col-span-2 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col h-full relative">
            <div className="flex-1 flex flex-col justify-between">
              
              {isRendering ? (
                 <div className="flex-1 flex flex-col items-center justify-center space-y-4 animate-in fade-in">
                   <Loader2 size={28} className="text-indigo-600 animate-spin" />
                   <p className="text-xs font-black uppercase tracking-widest text-indigo-900">
                     {isProcessing ? '云端录音室处理中...' : isMusic ? '编曲网络渲染中...' : isFoley ? '声场物理模拟中...' : '云端文本切片拼接中...'} {renderProgress}%
                   </p>
                   <div className="h-1 w-64 bg-zinc-100"><div className="h-full bg-indigo-500" style={{ width: `${renderProgress}%` }}></div></div>
                 </div>
              ) : renderProgress === 100 ? (
                 <div className="flex-1 flex flex-col items-center justify-center animate-in zoom-in-95 w-full max-w-2xl mx-auto h-full p-4">
                   <div className="w-full h-full bg-zinc-950 rounded-xl p-8 shadow-2xl border border-zinc-800 relative overflow-hidden group flex flex-col">
                      <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>
                      
                      <div className="flex justify-between items-start mb-6 relative z-10 shrink-0">
                        <div>
                          <h3 className="text-zinc-100 font-black tracking-tight flex items-center text-lg">
                            {isProcessing ? <Scissors size={18} className="mr-2 text-indigo-400"/> : isFoley ? <Vibrate size={18} className="mr-2 text-indigo-400"/> : isVibeVoice ? <Layers size={18} className="mr-2 text-indigo-400"/> : <Music size={18} className="mr-2 text-indigo-400"/>} 
                            {isVibeVoice ? '播客解析与转录完毕' : isProcessing ? '音轨清洗完毕' : '音轨合成完毕'}
                          </h3>
                        </div>
                        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-black px-2 py-1 rounded uppercase tracking-widest border border-indigo-500/30">
                          {isVibeVoice ? 'JSON Transcript' : 'WAV Audio'}
                        </span>
                      </div>

                     {/* 🔀 核心分流：根据任务类型渲染不同的 UI */}
                      {isVibeVoice ? (
                        <div className="w-full h-full overflow-hidden">
                           {/* ✅ 加上问号安全读取，生肉直接喂给生成式 UI */}
                           <VibeVoiceViewer rawMarkdown={taskResult?.data?.raw_markdown} />
                        </div>
                      ) : ( 
                        <div className="flex-1 flex flex-col justify-center">
                          <div className="flex items-center justify-between h-20 mb-8 space-x-1">
                            {[...Array(40)].map((_, i) => {
                              const h = isPlaying ? Math.random() * 100 : Math.sin(i) * 30 + 40;
                              const isPlayed = i < (audioProgress / 100) * 40;
                              return <div key={i} className={`w-1.5 rounded-full transition-all duration-150 ${isPlayed ? 'bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]' : 'bg-zinc-800'}`} style={{ height: `${h}%` }}></div>
                            })}
                          </div>

                          <div className="flex items-center justify-between border-t border-zinc-800 pt-6 relative z-10">
                            <button onClick={handleToggleMainPlayer} className="w-12 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                              {isPlaying ? <Pause size={20} className="fill-white"/> : <Play size={20} className="fill-white ml-1"/>}
                            </button>
                            <Volume2 size={18} className="text-zinc-600"/>
                          </div>
                        </div>
                      )}

                      <div className="flex space-x-3 mt-6 pt-4 border-t border-zinc-800 w-full justify-center shrink-0">
                          {isVibeVoice ? (
                            <button 
                              onClick={() => alert('即将导出 SRT 格式字幕文件...')}
                              className="text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-sm shadow-md flex items-center transition-all"
                            >
                              <Download size={14} className="mr-1.5"/> 下载 SRT 字幕
                            </button>
                          ) : (
                            <button 
                              onClick={() => {
                                if (!generatedAudioUrl) return alert('音频尚未生成！');
                                const a = document.createElement('a');
                                a.href = generatedAudioUrl;
                                a.download = `YuMatrix_Audio_${Date.now()}.wav`;
                                document.body.appendChild(a); a.click(); a.remove();
                              }}
                              className="text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-sm shadow-md flex items-center transition-all"
                            >
                              <Download size={14} className="mr-1.5"/> 下载无损原声 (WAV)
                            </button>
                          )}

                          <button onClick={() => { setRenderProgress(0); if(audioPlayerRef.current) audioPlayerRef.current.pause(); setIsPlaying(false); }} className="text-xs font-black text-zinc-400 bg-zinc-900 px-5 py-3 border border-zinc-700 hover:text-white hover:border-zinc-500 transition-colors rounded-sm">
                            返回修改
                          </button>
                      </div>
                   </div>
                 </div>
              ) : (
                 <div className="flex flex-col h-full">
                   {isProcessing ? (
                     <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 bg-zinc-50 rounded-sm">
                       <Scissors size={48} className="text-zinc-300 mb-4" />
                       <h3 className="text-lg font-black text-zinc-700 mb-2">准备清洗您的音轨</h3>
                       <p className="text-xs text-zinc-500 max-w-sm text-center mb-6">您已选择了云端录音室处理引擎。请确保左侧已挂载需要降噪或分离的音频资产。</p>
                       <button onClick={startMediaRender} disabled={!uploadedAssetUrl} className="px-8 py-3.5 bg-black text-white text-xs font-black flex items-center hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors shadow-lg">
                         <Zap size={14} className="mr-2"/> 开始云端深度处理
                       </button>
                     </div>
                   ) : (
                     <>
                       <div className="mb-4">
                         <h3 className="text-sm font-black tracking-tight mb-1 flex items-center">
                           {isMusic ? '请输入曲风描述与副歌歌词' : isFoley ? '描述你脑海中的物理声音场景' : '要配音的长文案'}
                           {isFoley && <span className="ml-3 text-[9px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded">环境配置: {foleyStyle}</span>}
                         </h3>
                       </div>
                       <textarea 
                         value={chatInput} 
                         onChange={e => setChatInput(e.target.value)} 
                         placeholder={isMusic ? "[Verse 1] 阳光穿过树叶...\n[Chorus] (Pop Rock) 放肆去奔跑吧..." : isFoley ? "例如：一扇巨大的生锈铁门缓缓推开，伴随着低沉的回声..." : "长文本系统会自动在云端进行切片与拼接..."} 
                         className="w-full flex-1 bg-zinc-50 border border-zinc-300 focus:border-indigo-500 p-5 text-sm outline-none resize-none mb-6 custom-scrollbar leading-relaxed" 
                       />
                       <div className="flex justify-between items-center pt-4 border-t border-zinc-100">
                         <div className="text-xs font-bold">
                           {isCloning ? (
                             <span className={uploadedAssetUrl ? "text-emerald-500" : "text-rose-500"}>
                               {uploadedAssetUrl ? '✅ 干声已就绪，准备提取声纹' : '⚠️ 请先在左侧上传参考干声'}
                             </span>
                           ) : isFoley ? <span className="text-emerald-500">🌟 正在调用 FOLEY 物理引擎</span> : <span className="text-zinc-400">已就绪</span>}
                         </div>
                         <button onClick={startMediaRender} disabled={!chatInput.trim() || (isCloning && !uploadedAssetUrl)} className="px-8 py-3 bg-black text-white text-xs font-black flex items-center hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors shadow-md">
                           <Music size={14} className="mr-2"/> 启动云端渲染
                         </button>
                       </div>
                     </>
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