import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  UploadCloud, Image as ImageIcon, Zap, Loader2, CheckCircle2, Download,
  ArrowLeftRight, Sparkles, Palette, Camera, Sun, Box, Package, Gamepad2,
  Rocket, PenTool, Layout, Users, Wand2, ImagePlus, Layers,
} from 'lucide-react';
import { useAiTasks } from '../AiTaskContext';
import usePersistentState from '../../../hooks/usePersistentState';

// ──────────────────────────────────────────────
// 工具元数据配置表
// ──────────────────────────────────────────────
const TOOL_META = {
  fl_char_world: {
    title: '角色 & 世界观工坊',
    subtitle: '角色一致性三视图 + 表情包 + 场景概念图批量生成',
    icon: Users,
    iconColor: 'text-purple-500',
    configLabel: '角色类型',
    configIcon: Users,
    options: [
      { value: 'fantasy', label: '奇幻 · 精灵/兽人/法师' },
      { value: 'scifi', label: '科幻 · 机甲/赛博/星际' },
      { value: 'modern', label: '现代 · 都市/校园/职场' },
      { value: 'historical', label: '古装 · 武侠/宫廷/仙侠' },
    ],
    defaultOption: 'fantasy',
    accent: 'purple',
    secondaryLabel: '输出类型',
    secondaryOptions: [
      { value: 'full_set', label: '全套 (三视图 + 表情 + 场景)' },
      { value: 'three_view', label: '标准三视图 (正/侧/背)' },
      { value: 'expressions', label: '表情包 (喜怒哀乐 4 格)' },
      { value: 'scene', label: '角色场景概念图' },
    ],
    secondaryDefault: 'full_set',
  },
  ds_cad_render: {
    title: '线稿/CAD 极速渲染',
    subtitle: '黑白手绘/SketchUp 截图 → 照片级 3D 效果图，秒级出图',
    icon: PenTool,
    iconColor: 'text-cyan-500',
    configLabel: '设计风格',
    configIcon: Palette,
    options: [
      { value: 'french_luxe', label: '法式轻奢' },
      { value: 'wabi_sabi', label: '极简侘寂' },
      { value: 'cyber_industrial', label: '赛博工业风' },
      { value: 'modern_wood', label: '现代原木' },
      { value: 'nordic', label: '北欧简约' },
    ],
    defaultOption: 'modern_wood',
    accent: 'cyan',
    secondaryLabel: '输出分辨率',
    secondaryOptions: [
      { value: '2k', label: '2K 超清 · 快速预览' },
      { value: '4k', label: '4K 极清 · 照片级' },
    ],
    secondaryDefault: '4k',
  },
  ds_rough_finish: {
    title: '毛坯房一键精装',
    subtitle: '实拍毛坯 → AI 识别空间结构，自动填充硬装 + 软装方案',
    icon: Layout,
    iconColor: 'text-cyan-500',
    configLabel: '风格方案',
    configIcon: Palette,
    options: [
      { value: 'modern_minimal', label: '现代极简' },
      { value: 'french_luxe', label: '法式轻奢' },
      { value: 'japanese_wood', label: '日式原木' },
      { value: 'industrial_loft', label: '工业 Loft' },
      { value: 'nordic_warm', label: '北欧温馨' },
    ],
    defaultOption: 'modern_minimal',
    accent: 'cyan',
    secondaryLabel: '空间类型',
    secondaryOptions: [
      { value: 'living', label: '客厅' },
      { value: 'bedroom', label: '卧室' },
      { value: 'kitchen', label: '厨房' },
      { value: 'bathroom', label: '卫生间' },
    ],
    secondaryDefault: 'living',
  },
  ds_lighting: {
    title: '日夜 & 季节光影切换',
    subtitle: '一张实景 → 一键切换晨曦/黄昏/雨夜/大雪/赛博霓虹',
    icon: Sun,
    iconColor: 'text-cyan-500',
    configLabel: '光影氛围',
    configIcon: Sun,
    options: [
      { value: 'golden_morning', label: '金色晨曦 · 温暖柔光' },
      { value: 'sunset', label: '绝美晚霞 · 金色时刻' },
      { value: 'cyber_rain', label: '赛博霓虹雨夜' },
      { value: 'snow', label: '大雪纷飞 · 冬日静谧' },
      { value: 'summer_noon', label: '盛夏午后 · 强烈光影' },
      { value: 'moonlight', label: '月光静谧 · 蓝调夜色' },
    ],
    defaultOption: 'golden_morning',
    accent: 'cyan',
  },
  ds_3d_model: {
    title: '3D 模型生成',
    subtitle: '单张图片 → 带纹理的高精度 3D 模型，支持导出标准格式',
    icon: Box,
    iconColor: 'text-cyan-500',
    configLabel: '模型精度',
    configIcon: Box,
    options: [
      { value: 'high', label: '高精度 · 影视级 (500K 面)' },
      { value: 'medium', label: '中等 · 游戏资产 (50K 面)' },
      { value: 'low', label: '低多边形 · 风格化' },
    ],
    defaultOption: 'high',
    accent: 'cyan',
    secondaryLabel: '输出格式',
    secondaryOptions: [
      { value: 'glb', label: 'GLB · 通用 3D 格式' },
      { value: 'obj', label: 'OBJ · 兼容性最佳' },
      { value: 'fbx', label: 'FBX · 动画/引擎' },
    ],
    secondaryDefault: 'glb',
  },
  ds_ip_blindbox: {
    title: 'IP 潮玩盲盒设计',
    subtitle: '文字描述 → Popmart 质感 3D 角色 + 多种配色与包装方案',
    icon: Package,
    iconColor: 'text-cyan-500',
    configLabel: '设计风格',
    configIcon: Palette,
    options: [
      { value: 'popmart', label: 'Popmart 质感 · 光泽黏土' },
      { value: 'clay', label: '黏土风 · 手工质感' },
      { value: 'mecha', label: '机甲风 · 硬核科幻' },
      { value: 'chibi', label: '可爱 Q 版 · 大头萌系' },
    ],
    defaultOption: 'popmart',
    accent: 'cyan',
    secondaryLabel: '配色方案',
    secondaryOptions: [
      { value: 'classic', label: '经典原色' },
      { value: 'macaron', label: '马卡龙粉彩' },
      { value: 'dark', label: '暗黑限定' },
      { value: 'neon', label: '霓虹荧光' },
    ],
    secondaryDefault: 'classic',
  },
  ds_game_assets: {
    title: '游戏资产批量生成',
    subtitle: '道具图标/UI 元素/技能特效，统一风格批量输出',
    icon: Gamepad2,
    iconColor: 'text-cyan-500',
    configLabel: '游戏类型',
    configIcon: Gamepad2,
    options: [
      { value: 'fantasy_rpg', label: '奇幻 RPG' },
      { value: 'scifi_shooter', label: '科幻射击' },
      { value: 'casual', label: '休闲消除' },
      { value: 'anime_card', label: '二次元卡牌' },
    ],
    defaultOption: 'fantasy_rpg',
    accent: 'cyan',
    secondaryLabel: '资产类型',
    secondaryOptions: [
      { value: 'weapons', label: '武器图标' },
      { value: 'items', label: '道具 Icon' },
      { value: 'ui', label: 'UI 按钮' },
      { value: 'effects', label: '技能特效' },
    ],
    secondaryDefault: 'items',
  },
  ds_photo_enhance: {
    title: '摄影后期增强',
    subtitle: '老照片 → 4K 修复 / 杂物消除 / 背景替换 / 无损放大',
    icon: Camera,
    iconColor: 'text-cyan-500',
    configLabel: '处理类型',
    configIcon: Camera,
    options: [
      { value: 'enhance_4k', label: '4K 超清修复 · 去噪去马赛克' },
      { value: 'remove_objects', label: '杂物 & 路人消除' },
      { value: 'replace_bg', label: '背景替换' },
      { value: 'upscale', label: '无损放大 4×' },
      { value: 'full_enhance', label: '综合增强 (全流程)' },
    ],
    defaultOption: 'full_enhance',
    accent: 'cyan',
  },
  ds_material_sim: {
    title: '材质 & 质感模拟',
    subtitle: '一键切换塑料/金属/玻璃/木质/陶瓷/布料等物理材质渲染',
    icon: Rocket,
    iconColor: 'text-cyan-500',
    configLabel: '目标材质',
    configIcon: Layers,
    options: [
      { value: 'glossy_metal', label: '高光金属 · 镜面反射' },
      { value: 'matte_plastic', label: '磨砂塑料 · 柔光漫反射' },
      { value: 'clear_glass', label: '透明玻璃 · 折射+焦散' },
      { value: 'natural_wood', label: '天然木材 · PBR 纹理' },
      { value: 'matte_ceramic', label: '哑光陶瓷 · 次表面散射' },
      { value: 'silk_fabric', label: '丝绸布料 · 各向异性' },
      { value: 'carbon_fiber', label: '碳纤维 · 编织纹理' },
    ],
    defaultOption: 'glossy_metal',
    accent: 'cyan',
  },
};

const RENDER_STAGES = [
  '正在解析输入图像的结构与特征...',
  'AI 语义分析与深度估计中...',
  '多模态扩散模型高精度渲染...',
  '4K 超分辨率细节增强...',
  '最终画面合成与色彩校准...',
];

// ──────────────────────────────────────────────
// 颜色映射
// ──────────────────────────────────────────────
const ACCENT_MAP = {
  purple: { border: 'border-purple-400', bg: 'bg-purple-50', text: 'text-purple-700', bar: 'from-purple-500 to-violet-500' },
  cyan: { border: 'border-cyan-400', bg: 'bg-cyan-50', text: 'text-cyan-700', bar: 'from-cyan-500 to-teal-500' },
};


export default function ImageStudioPanel({ activeWorkspace, workspaceMeta }) {
  const { guardDispatch } = useAiTasks();
  const meta = useMemo(() => TOOL_META[activeWorkspace] || TOOL_META.ds_cad_render, [activeWorkspace]);
  const Icon = meta.icon;
  const ac = ACCENT_MAP[meta.accent] || ACCENT_MAP.cyan;

  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedImageName, setUploadedImageName] = useState('');
  const [primaryOption, setPrimaryOption] = usePersistentState(`imgstudio_primary_${activeWorkspace}`, meta.defaultOption);
  const [secondaryOption, setSecondaryOption] = usePersistentState(`imgstudio_secondary_${activeWorkspace}`, meta.secondaryDefault || '');

  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderComplete, setRenderComplete] = usePersistentState(`imgstudio_complete_${activeWorkspace}`, false);
  const [generatedImageUrl, setGeneratedImageUrl] = usePersistentState(`imgstudio_result_${activeWorkspace}`, null);
  const [stageIndex, setStageIndex] = useState(0);

  const fileInputRef = useRef(null);

  const resetCanvas = () => {
    setRenderComplete(false);
    setRenderProgress(0);
    setGeneratedImageUrl(null);
    setStageIndex(0);
  };

  const processFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadedImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => { setUploadedImage(reader.result); resetCanvas(); };
    reader.readAsDataURL(file);
  };

  const startRender = () => {
    if (!uploadedImage) { alert('请先上传图片'); return; }
    if (!guardDispatch()) return;
    resetCanvas();
    setIsRendering(true);
    const totalStages = RENDER_STAGES.length;
    const stageDuration = 600;
    const tickInterval = 80;
    const totalTicks = (totalStages * stageDuration) / tickInterval;
    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      const progress = Math.min(Math.round((tick / totalTicks) * 100), 99);
      setRenderProgress(progress);
      setStageIndex(Math.min(Math.floor((tick / totalTicks) * totalStages), totalStages - 1));
      if (tick >= totalTicks) {
        clearInterval(interval);
        setRenderProgress(100);
        setGeneratedImageUrl('https://picsum.photos/800/600');
        setTimeout(() => { setIsRendering(false); setRenderComplete(true); }, 600);
      }
    }, tickInterval);
  };

  const handleDownload = () => {
    fetch(generatedImageUrl || 'https://picsum.photos/1600/1200')
      .then((r) => r.blob())
      .then((blob) => {
        const u = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = u;
        a.download = `YuMatrix_${activeWorkspace}_${Date.now()}.jpg`;
        document.body.appendChild(a); a.click(); a.remove();
        window.URL.revokeObjectURL(u);
      })
      .catch(() => alert('下载失败'));
  };

  const stageText = RENDER_STAGES[stageIndex] || RENDER_STAGES[0];

  return (
    <div className="flex-1 bg-zinc-100 p-6 animate-in slide-in-from-bottom-6 duration-500">
      <div className="max-w-7xl mx-auto w-full h-full">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-300">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-black flex items-center">
              <Icon size={22} className={`mr-2.5 ${meta.iconColor}`} />
              {meta.title}
            </h2>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mt-1">{meta.subtitle}</p>
          </div>
          {!isRendering && !renderComplete && (
            <span className="text-[10px] font-black text-zinc-400 bg-zinc-200 px-3 py-1.5 rounded-sm uppercase tracking-widest">GPU Standby</span>
          )}
          {isRendering && (
            <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-3 py-1.5 rounded-sm uppercase tracking-widest animate-pulse">Rendering</span>
          )}
          {renderComplete && (
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-sm uppercase tracking-widest">Completed</span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-80px)]">
          <div className="col-span-1 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-5 flex-1">
              <div
                onDrop={(e) => { e.preventDefault(); processFile(e.dataTransfer.files?.[0]); }}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-sm p-5 text-center cursor-pointer transition-all ${uploadedImage ? `${ac.border} ${ac.bg}` : `border-zinc-300 bg-zinc-50 hover:${ac.border} hover:${ac.bg}`}`}
              >
                <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => processFile(e.target.files?.[0])} className="hidden" />
                {uploadedImage ? (
                  <div className="space-y-2">
                    <img src={uploadedImage} alt="uploaded" className="w-full h-32 object-cover rounded-sm border border-zinc-200" />
                    <p className={`text-[10px] font-mono ${ac.text} py-1 px-2 rounded-sm bg-white/60 truncate`}>{uploadedImageName}</p>
                    <p className="text-[10px] font-bold text-zinc-400">点击或拖拽替换素材</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <UploadCloud size={30} className="mx-auto text-zinc-400" />
                    <p className="text-xs font-black text-zinc-600">上传图片素材</p>
                    <p className="text-[10px] text-zinc-400 font-medium">拖拽至此或点击选择 · JPG / PNG / WebP</p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3">核心参数</label>
                <label className="text-xs font-black flex items-center mb-2 text-zinc-700">
                  <meta.configIcon size={14} className={`mr-1.5 ${meta.iconColor}`} />{meta.configLabel}
                </label>
                <select value={primaryOption} onChange={(e) => { setPrimaryOption(e.target.value); resetCanvas(); }}
                  className={`w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:${ac.border} bg-white font-medium transition-colors`}>
                  {meta.options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>

              {meta.secondaryLabel && meta.secondaryOptions && (
                <div>
                  <label className="text-xs font-black flex items-center mb-2 text-zinc-700">
                    <Layout size={14} className="mr-1.5 text-zinc-400" />{meta.secondaryLabel}
                  </label>
                  <select value={secondaryOption} onChange={(e) => { setSecondaryOption(e.target.value); resetCanvas(); }}
                    className="w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:border-zinc-400 bg-white font-medium transition-colors">
                    {meta.secondaryOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 p-3 rounded-sm">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">预估算力</span>
                <span className={`text-xs font-black ${ac.text} ${ac.bg} border px-2.5 py-1 rounded-sm ${ac.border}`}>-5 算力点</span>
              </div>
            </div>

            <button onClick={startRender} disabled={isRendering || !uploadedImage}
              className={`mt-5 w-full py-3.5 text-white text-sm font-black flex items-center justify-center gap-2 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-all shadow-lg rounded-sm uppercase tracking-wider ${isRendering ? 'bg-zinc-500' : 'bg-black hover:bg-zinc-800'}`}>
              {isRendering ? (<><Loader2 size={16} className="animate-spin" />云端渲染中...</>) : (<><Zap size={16} />启动云端渲染</>)}
            </button>
          </div>

          <div className="col-span-2 bg-zinc-950 border border-zinc-800 rounded-sm p-6 shadow-sm flex flex-col">
            {!isRendering && !renderComplete && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Sparkles size={56} className="text-zinc-700 mb-6 animate-pulse" />
                <h3 className="text-lg font-black text-zinc-500 tracking-wider uppercase mb-2">等待渲染引擎接入...</h3>
                <p className="text-xs text-zinc-600 font-medium max-w-md text-center">上传图片，选择 {meta.configLabel}，点击「启动云端渲染」即刻生成</p>
                {uploadedImage && (
                  <div className="mt-8 flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-sm">
                    <ImageIcon size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-mono text-emerald-400">素材就绪 · {uploadedImageName}</span>
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded-sm border border-zinc-800">
                    {meta.configLabel}：{meta.options.find((o) => o.value === primaryOption)?.label || primaryOption}
                  </span>
                  {meta.secondaryLabel && secondaryOption && (
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded-sm border border-zinc-800">
                      {meta.secondaryLabel}：{meta.secondaryOptions?.find((o) => o.value === secondaryOption)?.label || secondaryOption}
                    </span>
                  )}
                </div>
              </div>
            )}

            {isRendering && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in fade-in">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-2 border-zinc-700 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-2 border-zinc-600 animate-ping absolute" />
                    <Loader2 size={32} className={`${meta.iconColor} animate-spin`} />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className={`text-sm font-black ${meta.iconColor} uppercase tracking-widest animate-pulse`}>GPU 张量核心运算中</p>
                  <p className="text-xs text-zinc-500 font-mono">{stageText}</p>
                </div>
                <div className="w-80 space-y-1.5">
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${ac.bar} transition-all duration-300 rounded-full`} style={{ width: `${renderProgress}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-zinc-600"><span>Render Progress</span><span>{renderProgress}%</span></div>
                </div>
                <div className="flex items-center gap-2">
                  {RENDER_STAGES.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i <= stageIndex ? `${meta.iconColor} shadow-[0_0_6px_rgba(168,85,247,0.6)]` : 'bg-zinc-700'}`} />
                  ))}
                </div>
              </div>
            )}

            {renderComplete && (
              <div className="flex-1 flex flex-col justify-center space-y-6 animate-in zoom-in-95">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 size={28} className="text-emerald-500" strokeWidth={2.5} />
                  <span className="text-sm font-black text-emerald-400 uppercase tracking-wider">{meta.title} · 已完成</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">原图 · Original</p>
                    <div className="aspect-[4/3] bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden">
                      {uploadedImage ? (<img src={uploadedImage} alt="original" className="w-full h-full object-cover opacity-70" />)
                        : (<div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs font-bold">—</div>)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className={`text-[10px] font-black ${meta.iconColor} uppercase tracking-widest text-center`}>生成图 · Generated</p>
                    <div className={`aspect-[4/3] bg-zinc-900 border ${ac.border}/30 rounded-sm overflow-hidden relative`}>
                      <img src={generatedImageUrl || 'https://picsum.photos/800/600'} alt="generated" className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2 bg-emerald-500 text-black text-[9px] font-black px-2 py-0.5 rounded-sm">4K</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-6 py-2.5 rounded-sm shadow-md flex items-center gap-1.5 transition-all">
                    <Download size={14} />下载高清图
                  </button>
                  <button onClick={resetCanvas} className="border border-zinc-700 hover:border-zinc-400 text-xs font-black px-6 py-2.5 rounded-sm transition-colors text-zinc-400 hover:text-white">
                    <ArrowLeftRight size={14} className="inline mr-1.5" />重新生成
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
