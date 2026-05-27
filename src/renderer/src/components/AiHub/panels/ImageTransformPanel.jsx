import React, { useState, useRef, useMemo } from 'react';
import {
  UploadCloud, Image as ImageIcon, Zap, Loader2, CheckCircle2, Download,
  ArrowLeftRight, Sparkles, Palette, Shirt, Package, ImagePlus, Store,
  Layers, Megaphone,
} from 'lucide-react';

// ──────────────────────────────────────────────
// 工具元数据配置表（配置驱动，不改组件逻辑）
// ──────────────────────────────────────────────
const TOOL_META = {
  ec_prod_scene: {
    title: '商品场景生产线',
    subtitle: '白底图批量生成 50+ 商业场景，从大理石到海滩一键切换',
    icon: Store,
    iconColor: 'text-amber-500',
    configLabel: '场景风格',
    configIcon: Palette,
    options: [
      { value: 'marble', label: '极简大理石' },
      { value: 'nordic', label: '北欧木质' },
      { value: 'beach', label: '海滩度假' },
      { value: 'cyber', label: '赛博霓虹' },
      { value: 'studio', label: '影棚柔光' },
      { value: 'retro', label: '复古胶片' },
      { value: 'ins', label: 'Ins 奶油风' },
      { value: 'outdoor', label: '自然户外' },
    ],
    defaultOption: 'marble',
    accent: 'amber',
  },
  ec_global_tryon: {
    title: 'AI 全球换装',
    subtitle: '平铺衣服直出亚洲/欧美/拉美/中东多肤色模特实穿图',
    icon: Shirt,
    iconColor: 'text-rose-500',
    configLabel: '模特特征',
    configIcon: Shirt,
    options: [
      { value: 'asian_female', label: '亚洲女性 · 170cm' },
      { value: 'asian_male', label: '亚洲男性 · 180cm' },
      { value: 'euro_female', label: '欧美女性 · 175cm' },
      { value: 'euro_male', label: '欧美男性 · 188cm' },
      { value: 'latino_female', label: '拉美女性 · 168cm' },
      { value: 'mid_east_female', label: '中东女性 · 170cm' },
      { value: 'african_female', label: '非洲女性 · 175cm' },
    ],
    defaultOption: 'asian_female',
    accent: 'rose',
    secondaryLabel: '场景氛围',
    secondaryOptions: [
      { value: 'street', label: '巴黎街头抓拍' },
      { value: 'studio_white', label: '极简白墙棚拍' },
      { value: 'cafe', label: '自然光咖啡厅' },
      { value: 'outdoor_park', label: '城市公园' },
    ],
    secondaryDefault: 'street',
  },
  ec_packaging: {
    title: '包装 & 材质渲染',
    subtitle: '线稿草图瞬间渲染为高光/磨砂/镭射/金属质感包装',
    icon: Package,
    iconColor: 'text-indigo-500',
    configLabel: '目标材质',
    configIcon: Layers,
    options: [
      { value: 'glossy_metal', label: '高光磨砂金属' },
      { value: 'holographic', label: '镭射幻彩' },
      { value: 'matte_black', label: '极简哑光黑金' },
      { value: 'kraft', label: '环保牛皮纸' },
      { value: 'clear_glass', label: '透明玻璃瓶' },
      { value: 'soft_touch', label: '亲肤软触感' },
      { value: 'carbon_fiber', label: '碳纤维纹理' },
    ],
    defaultOption: 'glossy_metal',
    accent: 'indigo',
    secondaryLabel: '背景板',
    secondaryOptions: [
      { value: 'white_studio', label: '纯白棚拍底' },
      { value: 'black_mirror', label: '黑色镜面倒影' },
      { value: 'wood_table', label: '木质桌面' },
      { value: 'gradient_color', label: '彩色渐变' },
    ],
    secondaryDefault: 'white_studio',
  },
  ec_ad_fission: {
    title: '广告素材裂变器',
    subtitle: '1 张主图 → 多平台/多尺寸/多风格广告创意矩阵',
    icon: Megaphone,
    iconColor: 'text-orange-500',
    configLabel: '投放平台',
    configIcon: Megaphone,
    options: [
      { value: 'facebook', label: 'Facebook / Instagram Ads' },
      { value: 'tiktok', label: 'TikTok Ads' },
      { value: 'google', label: 'Google Shopping' },
      { value: 'pinterest', label: 'Pinterest Ads' },
      { value: 'amazon', label: 'Amazon DSP' },
      { value: 'all_platforms', label: '全平台覆盖 (6合1)' },
    ],
    defaultOption: 'facebook',
    accent: 'orange',
    secondaryLabel: '输出套数',
    secondaryOptions: [
      { value: '10', label: '10 套 · 快速测试' },
      { value: '20', label: '20 套 · A/B 优选' },
      { value: '50', label: '50 套 · 全量覆盖' },
      { value: '100', label: '100 套 · 火力全开' },
    ],
    secondaryDefault: '20',
  },
  ec_outpainting: {
    title: '商品无损扩图',
    subtitle: '1:1 主图智能扩展为 16:9 / 21:9 横版海报，主体零损伤',
    icon: ImagePlus,
    iconColor: 'text-emerald-500',
    configLabel: '目标比例',
    configIcon: ImagePlus,
    options: [
      { value: '16:9', label: '16:9 横版海报' },
      { value: '21:9', label: '21:9 超宽横幅' },
      { value: '3:4', label: '3:4 竖版' },
      { value: '1:1', label: '1:1 方形' },
      { value: '9:16', label: '9:16 手机壁纸' },
    ],
    defaultOption: '16:9',
    accent: 'emerald',
  },
};

const RENDER_STAGES = [
  '正在解析商品主体与光影特征...',
  'AI 语义分割与深度估计中...',
  '多模态扩散模型渲染中...',
  '4K 超分辨率后处理...',
  '最终画面合成与色彩校准...',
];

// ──────────────────────────────────────────────
// 组件本体
// ──────────────────────────────────────────────
export default function ImageTransformPanel({ activeWorkspace, workspaceMeta }) {
  const meta = useMemo(() => TOOL_META[activeWorkspace] || TOOL_META.ec_prod_scene, [activeWorkspace]);
  const Icon = meta.icon;

  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedImageName, setUploadedImageName] = useState('');
  const [primaryOption, setPrimaryOption] = useState(meta.defaultOption);
  const [secondaryOption, setSecondaryOption] = useState(meta.secondaryDefault || '');

  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderComplete, setRenderComplete] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);
  const [stageIndex, setStageIndex] = useState(0);

  const fileInputRef = useRef(null);

  // ── 重置 ──
  const resetCanvas = () => {
    setRenderComplete(false);
    setRenderProgress(0);
    setGeneratedImageUrl(null);
    setStageIndex(0);
  };

  // 切换主配置时自动重置
  const handlePrimaryChange = (val) => {
    setPrimaryOption(val);
    resetCanvas();
  };
  const handleSecondaryChange = (val) => {
    setSecondaryOption(val);
    resetCanvas();
  };

  // ── 上传 ──
  const processFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadedImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result);
      resetCanvas();
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    processFile(e.target.files?.[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    processFile(e.dataTransfer.files?.[0]);
  };

  // ── 渲染 ──
  const startRender = () => {
    if (!uploadedImage) {
      alert('请先上传商品图片');
      return;
    }
    resetCanvas();
    setIsRendering(true);
    setRenderProgress(0);
    setStageIndex(0);

    const totalStages = RENDER_STAGES.length;
    const stageDuration = 600;
    const tickInterval = 80;
    const totalTicks = (totalStages * stageDuration) / tickInterval;
    let tick = 0;

    const interval = setInterval(() => {
      tick++;
      const progress = Math.min(Math.round((tick / totalTicks) * 100), 99);
      const currentStage = Math.min(Math.floor((tick / totalTicks) * totalStages), totalStages - 1);
      setRenderProgress(progress);
      setStageIndex(currentStage);

      if (tick >= totalTicks) {
        clearInterval(interval);
        setRenderProgress(100);
        setGeneratedImageUrl('https://picsum.photos/800/600');
        setTimeout(() => {
          setIsRendering(false);
          setRenderComplete(true);
        }, 600);
      }
    }, tickInterval);
  };

  // ── 下载 ──
  const handleDownload = () => {
    const url = generatedImageUrl || 'https://picsum.photos/1600/1200';
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `YuMatrix_${activeWorkspace}_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(objectUrl);
      })
      .catch(() => alert('下载失败，请检查网络链路'));
  };

  const stageText = RENDER_STAGES[stageIndex] || RENDER_STAGES[0];

  // ── 颜色映射 ──
  const accentMap = {
    amber: { border: 'border-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', btn: 'bg-amber-500', glow: 'shadow-[0_0_6px_rgba(251,191,36,0.6)]', bar: 'from-amber-500 to-orange-500' },
    rose: { border: 'border-rose-400', bg: 'bg-rose-50', text: 'text-rose-700', btn: 'bg-rose-500', glow: 'shadow-[0_0_6px_rgba(244,63,94,0.6)]', bar: 'from-rose-500 to-pink-500' },
    indigo: { border: 'border-indigo-400', bg: 'bg-indigo-50', text: 'text-indigo-700', btn: 'bg-indigo-500', glow: 'shadow-[0_0_6px_rgba(99,102,241,0.6)]', bar: 'from-indigo-500 to-violet-500' },
    emerald: { border: 'border-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700', btn: 'bg-emerald-500', glow: 'shadow-[0_0_6px_rgba(16,185,129,0.6)]', bar: 'from-emerald-500 to-teal-500' },
  };
  const ac = accentMap[meta.accent] || accentMap.amber;

  return (
    <div className="flex-1 bg-zinc-100 p-6 animate-in slide-in-from-bottom-6 duration-500">
      <div className="max-w-7xl mx-auto w-full h-full">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-300">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-black flex items-center">
              <Icon size={22} className={`mr-2.5 ${meta.iconColor}`} />
              {meta.title}
            </h2>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mt-1">
              {meta.subtitle}
            </p>
          </div>
          {!isRendering && !renderComplete && (
            <span className="text-[10px] font-black text-zinc-400 bg-zinc-200 px-3 py-1.5 rounded-sm uppercase tracking-widest">
              GPU Standby
            </span>
          )}
          {isRendering && (
            <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-3 py-1.5 rounded-sm uppercase tracking-widest animate-pulse">
              Rendering
            </span>
          )}
          {renderComplete && (
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-sm uppercase tracking-widest">
              Completed
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-80px)]">
          {/* ═══ 左侧控制台 ═══ */}
          <div className="col-span-1 bg-white border border-zinc-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-5 flex-1">
              {/* 上传区 */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-sm p-5 text-center cursor-pointer transition-all ${
                  uploadedImage
                    ? `${ac.border} ${ac.bg}`
                    : `border-zinc-300 bg-zinc-50 hover:${ac.border} hover:${ac.bg}`
                }`}
              >
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                {uploadedImage ? (
                  <div className="space-y-2">
                    <img src={uploadedImage} alt="uploaded" className="w-full h-32 object-cover rounded-sm border border-zinc-200" />
                    <p className={`text-[10px] font-mono ${ac.text} py-1 px-2 rounded-sm bg-white/60 truncate`}>
                      {uploadedImageName}
                    </p>
                    <p className="text-[10px] font-bold text-zinc-400">点击或拖拽替换素材</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <UploadCloud size={30} className="mx-auto text-zinc-400" />
                    <p className="text-xs font-black text-zinc-600">上传商品图片</p>
                    <p className="text-[10px] text-zinc-400 font-medium">拖拽至此或点击选择 · JPG / PNG / WebP</p>
                  </div>
                )}
              </div>

              {/* 主配置 */}
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3">
                  核心参数
                </label>
                <label className="text-xs font-black flex items-center mb-2 text-zinc-700">
                  <meta.configIcon size={14} className={`mr-1.5 ${meta.iconColor}`} />
                  {meta.configLabel}
                </label>
                <select
                  value={primaryOption}
                  onChange={(e) => handlePrimaryChange(e.target.value)}
                  className={`w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:${ac.border} bg-white font-medium transition-colors`}
                >
                  {meta.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 副配置（部分工具有） */}
              {meta.secondaryLabel && meta.secondaryOptions && (
                <div>
                  <label className="text-xs font-black flex items-center mb-2 text-zinc-700">
                    <Layers size={14} className="mr-1.5 text-zinc-400" />
                    {meta.secondaryLabel}
                  </label>
                  <select
                    value={secondaryOption}
                    onChange={(e) => handleSecondaryChange(e.target.value)}
                    className="w-full text-xs p-2.5 border border-zinc-200 rounded-sm outline-none focus:border-zinc-400 bg-white font-medium transition-colors"
                  >
                    {meta.secondaryOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 算力提示 */}
              <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 p-3 rounded-sm">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">预估算力</span>
                <span className={`text-xs font-black ${ac.text} ${ac.bg} border px-2.5 py-1 rounded-sm ${ac.border}`}>
                  -5 算力点
                </span>
              </div>
            </div>

            {/* 渲染按钮 */}
            <button
              onClick={startRender}
              disabled={isRendering || !uploadedImage}
              className={`mt-5 w-full py-3.5 text-white text-sm font-black flex items-center justify-center gap-2 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-all shadow-lg rounded-sm uppercase tracking-wider ${
                isRendering ? 'bg-zinc-500' : 'bg-black hover:bg-zinc-800'
              }`}
            >
              {isRendering ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  云端渲染中...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  启动云端渲染
                </>
              )}
            </button>
          </div>

          {/* ═══ 右侧主画布 ═══ */}
          <div className="col-span-2 bg-zinc-950 border border-zinc-800 rounded-sm p-6 shadow-sm flex flex-col">
            {/* ── 空态 ── */}
            {!isRendering && !renderComplete && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Sparkles size={56} className="text-zinc-700 mb-6 animate-pulse" />
                <h3 className="text-lg font-black text-zinc-500 tracking-wider uppercase mb-2">
                  等待多模态渲染引擎接入...
                </h3>
                <p className="text-xs text-zinc-600 font-medium max-w-md text-center">
                  上传商品图片，选择 {meta.configLabel}，点击「启动云端渲染」即刻生成
                </p>
                {uploadedImage && (
                  <div className="mt-8 flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-sm">
                    <ImageIcon size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-mono text-emerald-400">
                      素材就绪 · {uploadedImageName}
                    </span>
                  </div>
                )}
                {/* 配置预览 */}
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

            {/* ── 渲染中 ── */}
            {isRendering && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in fade-in">
                <div className="relative">
                  <div className={`w-20 h-20 rounded-full border-2 border-${meta.accent}-500/30 flex items-center justify-center`}>
                    <div className={`w-16 h-16 rounded-full border-2 border-${meta.accent}-500/50 animate-ping absolute`} />
                    <Loader2 size={32} className={`text-${meta.accent}-400 animate-spin`} />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className={`text-sm font-black text-${meta.accent}-400 uppercase tracking-widest animate-pulse`}>
                    GPU 张量核心运算中
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">{stageText}</p>
                </div>
                <div className="w-80 space-y-1.5">
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${ac.bar} transition-all duration-300 rounded-full`}
                      style={{ width: `${renderProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                    <span>Render Progress</span>
                    <span>{renderProgress}%</span>
                  </div>
                </div>
                {/* 阶段指示器 */}
                <div className="flex items-center gap-2">
                  {RENDER_STAGES.map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        i <= stageIndex ? `bg-${meta.accent}-400 ${ac.glow}` : 'bg-zinc-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── 完成态：对比图 ── */}
            {renderComplete && (
              <div className="flex-1 flex flex-col justify-center space-y-6 animate-in zoom-in-95">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 size={28} className="text-emerald-500" strokeWidth={2.5} />
                  <span className="text-sm font-black text-emerald-400 uppercase tracking-wider">
                    {meta.title} · 已完成
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">
                      原图 · Original
                    </p>
                    <div className="aspect-[4/3] bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden">
                      {uploadedImage ? (
                        <img src={uploadedImage} alt="original" className="w-full h-full object-cover opacity-70" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs font-bold">—</div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className={`text-[10px] font-black text-${meta.accent}-400 uppercase tracking-widest text-center`}>
                      生成图 · Generated
                    </p>
                    <div className={`aspect-[4/3] bg-zinc-900 border ${ac.border}/30 rounded-sm overflow-hidden relative`}>
                      <img src={generatedImageUrl || 'https://picsum.photos/800/600'} alt="generated" className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2 bg-emerald-500 text-black text-[9px] font-black px-2 py-0.5 rounded-sm">4K</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-6 py-2.5 rounded-sm shadow-md flex items-center gap-1.5 transition-all">
                    <Download size={14} />
                    下载 4K 高清图
                  </button>
                  <button onClick={resetCanvas} className="border border-zinc-700 hover:border-zinc-400 text-xs font-black px-6 py-2.5 rounded-sm transition-colors text-zinc-400 hover:text-white">
                    <ArrowLeftRight size={14} className="inline mr-1.5" />
                    重新生成
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
