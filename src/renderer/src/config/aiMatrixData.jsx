import React from 'react';
import { 
  Command, Sparkles, Cpu, Image as ImageIcon, Film, Layout, Maximize, Clock, Settings, User, Music, Volume2, Mic, Radio, Box, Scissors, Smile, Wand2, Shirt, Users, Search, MessageSquare, FileText, Briefcase, Shield, Scale, Terminal, Code, BookOpen, ImagePlus, Palette, Activity, Grid, Camera, Video, Clapperboard, Globe, HeadphonesIcon, Zap, MousePointer, Layers, Store,
  ShoppingBag, TrendingUp, Sun, Gamepad2, MonitorPlay, Megaphone, Rocket, Package, Monitor, PenTool,
} from 'lucide-react';

// =====================================================================
// 👑 全域统一大模型注册表 (保持原样，底层算力池不变)
// =====================================================================
export const MODEL_REGISTRY = {
  text: [
    { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', vendor: '算力直连', cost: 1, icon: <Command size={14} className="text-indigo-500"/>, bg: 'bg-indigo-100', params: [] },
    { id: 'gpt-4o', name: 'GPT-4o', vendor: 'OpenAI', cost: 2, icon: <Sparkles size={14} className="text-emerald-500"/>, bg: 'bg-emerald-100', params: [] },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', vendor: 'Anthropic', cost: 2, icon: <Cpu size={14} className="text-orange-500"/>, bg: 'bg-orange-100', params: [] },
  ],
  image: [
    { 
      id: 'Qubico/flux1-schnell', name: 'Flux.1 极速版', vendor: 'Black Forest', cost: 1, icon: <ImageIcon size={14} className="text-amber-500"/>, bg: 'bg-amber-100',
      uploadSlots: [{ id: 'image', label: '参考图 (选填)', accept: 'image/*' }],
      params: [
        { id: 'aspect_ratio', label: '画幅比例', type: 'select', icon: <Maximize size={14}/>, options: [{l:'横屏 16:9', v:'16:9'}, {l:'竖屏 9:16', v:'9:16'}, {l:'正方 1:1', v:'1:1'}], default: '16:9' },
        { id: 'denoise', label: '重绘幅度 (Denoise)', type: 'slider', min: 0.1, max: 1.0, step: 0.1, default: 0.7 },
        { id: 'guidance_scale', label: '提示词相关度 (CFG)', type: 'slider', min: 1, max: 10, step: 0.5, default: 3.0 },
        { id: 'batch_size', label: '生成数量', type: 'slider', min: 1, max: 4, step: 1, default: 1 }
      ]
    },
    // ... (保留你原来所有的 image 模型配置)
    { 
      id: 'Qubico/flux1-dev-advanced', name: 'Flux.1 Pro 高级版', vendor: 'Black Forest', cost: 5, icon: <ImageIcon size={14} className="text-amber-500"/>, bg: 'bg-amber-100',
      uploadSlots: [{ id: 'image', label: '参考图 (选填)', accept: 'image/*' }],
      params: [
        { id: 'aspect_ratio', label: '画幅比例', type: 'select', icon: <Maximize size={14}/>, options: [{l:'宽屏 21:9', v:'21:9'}, {l:'横屏 16:9', v:'16:9'}, {l:'竖屏 9:16', v:'9:16'}, {l:'正方 1:1', v:'1:1'}], default: '16:9' },
        { id: 'steps', label: '迭代步数 (Steps)', type: 'slider', min: 10, max: 40, step: 1, default: 28 },
        { id: 'denoise', label: '重绘幅度 (Denoise)', type: 'slider', min: 0.1, max: 1.0, step: 0.1, default: 0.7 }
      ]
    },
    { 
      id: 'seedream', name: 'Seedream 5.0 Lite', vendor: 'Seedream', cost: 3, icon: <ImageIcon size={14} className="text-amber-500"/>, bg: 'bg-amber-100',
      uploadSlots: [{ id: 'image_urls', label: '参考图 (选填)', accept: 'image/*' }],
      params: [
        { id: 'aspect_ratio', label: '画幅比例', type: 'select', icon: <Maximize size={14}/>, options: [{l:'1:1', v:'1:1'}, {l:'16:9', v:'16:9'}, {l:'9:16', v:'9:16'}, {l:'4:3', v:'4:3'}, {l:'3:4', v:'3:4'}], default: '16:9' },
        { id: 'size', label: '输出分辨率', type: 'select', icon: <Maximize size={14}/>, options: [{l:'2K 超清', v:'2K'}, {l:'3K 极清', v:'3K'}], default: '2K' }
      ]
    }
  ],
  video: [
    { 
      id: 'wan22-txt2video-14b', name: 'WanX 14B (阿里)', vendor: 'Alibaba', cost: 12, icon: <Film size={14} className="text-purple-500"/>, bg: 'bg-purple-100',
      uploadSlots: [{ id: 'image', label: '首帧图 (选填)', accept: 'image/*' }],
      params: [
        { id: 'aspect_ratio', label: '画幅比例', type: 'select', icon: <Layout size={14}/>, options: [{l:'16:9', v:'16:9'}, {l:'9:16', v:'9:16'}, {l:'1:1', v:'1:1'}, {l:'4:3', v:'4:3'}], default: '16:9' },
        { id: 'resolution', label: '分辨率', type: 'select', icon: <Maximize size={14}/>, options: [{l:'1080P', v:'1080P'}, {l:'720P', v:'720P'}], default: '1080P' }
      ]
    },
    // ... (保留你原来所有的 video 模型配置)
  ],
  music: [
    { 
      id: 'microsoft/vibevoice', name: 'VibeVoice 语音与转写', vendor: 'Microsoft', cost: 3, icon: <Mic size={14} className="text-rose-500"/>, bg: 'bg-rose-100',
      uploadSlots: [{ id: 'audio', label: '长音频/参考音频 (必填)', accept: 'audio/*' }],
      params: []
    },
    // ... (保留你原来所有的 music 模型配置)
  ]
};

// =====================================================================
// 🚀 宇阵 AI · 四大引擎矩阵
// =====================================================================
export const AI_TOOLS_REGISTRY = [
  // ═══════════════════════════════════════════════════════════
  // 引擎一：🛒 电商增长引擎 (E-Commerce Growth Engine)
  // ═══════════════════════════════════════════════════════════
  {
    category: '🛒 电商增长引擎',
    tagline: 'AI 驱动的全球化商品视觉与数字营销矩阵',
    theme: { text: 'text-amber-500', bg: 'bg-amber-50', icon: 'text-amber-600', border: 'hover:border-amber-300', shadow: 'hover:shadow-amber-500/10' },
    items: [
      { id: 'ecommerce_vision', name: '商业视觉控制台', desc: '场景重构 · 虚拟模特 · 多模态深度工作台', icon: <Store size={24} />, type: 'ecommerce', template: '', isCockpit: true },
      { id: 'ec_prod_scene', name: '商品场景生产线', desc: '白底图批量生成 50+ 商业场景，从大理石到海滩一键切换', icon: <ImageIcon size={20} />, type: 'ec_image', template: '【商品场景生产线】\n[拖入白底商品图]\n目标场景：[极简大理石 / 北欧木质 / 海滩度假 / 赛博霓虹]\n要求：生成真实物理投影、环境光反射，4K 影棚级画质。' },
      { id: 'ec_global_tryon', name: 'AI 全球换装', desc: '平铺衣服直出亚洲/欧美/拉美/中东多肤色模特实穿图', icon: <Shirt size={20} />, type: 'ec_image', template: '【AI 全球化虚拟试穿】\n[拖入服装平铺图]\n模特设定：[亚洲女性 170cm / 欧美男性 185cm / 中东女性]\n场景：[巴黎街头抓拍 / 极简白墙棚拍 / 自然光咖啡厅]' },
      { id: 'ec_video_snap', name: '商品短视频工厂', desc: '单张主图直出 15s 运镜展示视频，BGM + 卖点字幕自动合成', icon: <Video size={20} />, type: 'video', template: '【商品短视频智能生成】\n[拖入商品主图]\n视频风格：[360° 环绕运镜 / 微距细节展示 / 生活场景叙事]\n时长：15 秒，自动匹配背景音乐与卖点字幕。' },
      { id: 'ec_packaging', name: '包装 & 材质渲染', desc: '线稿草图瞬间渲染为高光/磨砂/镭射/金属质感包装', icon: <Package size={20} />, type: 'ec_image', template: '【包装材质渲染】\n[拖入包装设计线稿或粗糙草图]\n材质目标：[高光磨砂金属 / 镭射幻彩 / 极简黑金 / 环保牛皮纸]\n要求：影棚级布光，超高精度材质还原。' },
      { id: 'ec_digital_human', name: '数字人直播间', desc: '克隆老板形象与声音，24h 多语种自动直播带货', icon: <User size={20} />, type: 'video', template: '【数字人直播分身生成】\n[上传 30 秒正面说话视频 + 声音样本]\n话术脚本：[粘贴直播话术]\n要求：自然眨眼、手势、微表情，看不出 AI 痕迹。' },
      { id: 'ec_overseas', name: '出海本地化套件', desc: '一键切换模特种族 + 目标语言配音 + 唇形同步', icon: <Globe size={20} />, type: 'video', template: '【出海素材本地化】\n[拖入原始商品素材]\n目标市场：[美国 / 中东 / 拉美 / 东南亚]\n要求：自动切换当地主流肤色模特，翻译配音并匹配唇形。' },
      { id: 'ec_ad_fission', name: '广告素材裂变器', desc: '1 张主图 → 50 套不同风格/尺寸/文案的广告创意组合', icon: <Megaphone size={20} />, type: 'ec_image', template: '【广告素材批量裂变】\n[拖入商品主图]\n变体需求：[不同背景 / 不同模特 / 不同文案 / 不同尺寸]\n目标平台：[Facebook Ads / TikTok / Google Shopping]\n要求：输出 50 组可直接投放的广告创意素材包。' },
      { id: 'ec_outpainting', name: '商品无损扩图', desc: '1:1 主图智能扩展为 16:9 / 21:9 横版海报，主体零损伤', icon: <ImagePlus size={20} />, type: 'ec_image', template: '【商品无损扩图 Outpainting】\n[拖入原图]\n目标比例：[16:9 横版海报 / 21:9 超宽横幅 / 3:4 竖版]\n要求：智能识别商品环境，向四周自然扩展补全，不破坏主体。' },
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 引擎二：📱 短视频创作引擎 (Short Video Creator Engine)
  // ═══════════════════════════════════════════════════════════
  {
    category: '📱 短视频创作引擎',
    tagline: '从灵感到发布，一站式内容创作流水线',
    theme: { text: 'text-teal-500', bg: 'bg-teal-50', icon: 'text-teal-600', border: 'hover:border-teal-300', shadow: 'hover:shadow-teal-500/10' },
    items: [
      { id: 'content_studio', name: '内容驾驶舱', desc: '选题 · 脚本 · 配音 · 剪辑 · 发布，全链路深度工作台', icon: <MonitorPlay size={24} />, type: 'content_studio', template: '', isCockpit: true },
      { id: 'sv_trending', name: '热点选题雷达', desc: 'AI 追踪全网热搜趋势，每日推送定制化爆款选题建议', icon: <TrendingUp size={20} />, type: 'text', template: '【AI 热点选题雷达】\n我的赛道：[美妆 / 数码测评 / 职场 / 美食 / 旅行]\n目标平台：[抖音 / 小红书 / B站 / 视频号]\n要求：分析当日热搜，推荐 10 个爆款选题，附脚本框架。' },
      { id: 'sv_hook_script', name: '黄金 3 秒脚本工坊', desc: '争议钩子 + 反转结构 + 情绪爽点，结构化爆款文案输出', icon: <Zap size={20} />, type: 'text', template: '【黄金 3 秒爆款脚本】\n核心冲突/卖点：[如：月薪 3000 的我如何在一年内买下第一套房]\n要求：前 3 秒制造极致悬念或争议，严格遵循「钩子+反转+爽点」结构，口语化，节奏紧凑。' },
      { id: 'sv_multi_platform', name: '多平台文案裂变', desc: '一个主题 → 小红书种草 / 抖音口语 / B站深度三版本', icon: <FileText size={20} />, type: 'text', template: '【全域多平台文案裂变】\n主题/产品：[输入主题]\n要求：\n1. 小红书版：情绪拉满+大量 Emoji+闺蜜口吻\n2. 抖音版：强互动口语+反转悬念\n3. B站版：深度硬核+专业数据支撑' },
      { id: 'sv_voice_clone', name: '声音克隆 & 情感配音', desc: '3 秒样本克隆音色，可控叹气/哽咽/大笑等细腻情感', icon: <Mic size={20} />, type: 'music', template: '【声音克隆与情感化配音】\n[上传 3-10 秒干净语音样本]\n播报文本：[粘贴需要配音的内容]\n情感指令：[开心激动 / 低沉哽咽 / 愤怒斥责 / 温柔叙述]\n要求：完美复刻样本音色，精准还原指定情感。' },
      { id: 'sv_talking_head', name: 'AI 口播增强器', desc: '单机位口播 → 自动切多机位 + 素材填充 + 动效字幕', icon: <Camera size={20} />, type: 'video', template: '【AI 口播画面增强】\n[上传口播视频]\n增强需求：[自动切近景/中景/远景 / 匹配素材画面 / 动态字幕]\n风格：[专业严肃 / 活泼快节奏 / 治愈慢节奏]' },
      { id: 'sv_auto_clip', name: '一键成片', desc: '输入文案自动匹配素材 + 智能卡点 + BGM + 字幕，极速出片', icon: <Clapperboard size={20} />, type: 'video', template: '【AI 全自动剪辑流水线】\n口播文案：[粘贴完整文案]\n视觉风格：[治愈风景 / 赛博科技 / 复古胶片 / 商务极简]\n时长：30-60 秒，自动卡点、自动字幕、自动 BGM。' },
      { id: 'sv_bgm_studio', name: 'BGM 定制工坊', desc: '卡点/悬疑/治愈/国风/电子，15s-60s 可商用原创配乐', icon: <Music size={20} />, type: 'music', template: '【短视频原创 BGM 定制】\n情绪风格：[动感卡点 / 悬疑反转 / 治愈放松 / 国风古韵]\n乐器偏好：[808重低音 / 古筝+笛子 / 赛博合成器 / 钢琴独奏]\n时长：[15s / 30s / 60s]，纯音乐模式。' },
      { id: 'sv_format_adapter', name: '多平台格式适配器', desc: '一次创作 → 抖音 9:16 / 小红书 3:4 / B站 16:9 多版本', icon: <Monitor size={20} />, type: 'video', template: '【多平台视频格式适配】\n[上传原始视频]\n目标平台：[抖音 / 小红书 / B站 / 视频号 / YouTube Shorts]\n要求：智能裁剪构图，自动适配各平台尺寸与时长限制。' },
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 引擎三：🎬 影视 & 短剧引擎 (Film & AI Drama Engine)
  // ═══════════════════════════════════════════════════════════
  {
    category: '🎬 影视 & 短剧引擎',
    tagline: '从剧本到成片，一个人就是一支剧组',
    theme: { text: 'text-purple-500', bg: 'bg-purple-50', icon: 'text-purple-600', border: 'hover:border-purple-300', shadow: 'hover:shadow-purple-500/10' },
    items: [
      { id: 'film_studio', name: '制片驾驶舱', desc: '剧本 → 分镜 → 角色 → 拍摄 → 后期，全流程深度工作台', icon: <Film size={24} />, type: 'film_studio', template: '', isCockpit: true },
      { id: 'fl_script_accel', name: '剧本加速器', desc: '大纲 → 分场 → 对白 → 分镜描述，AI 全链路辅助创作', icon: <PenTool size={20} />, type: 'text', template: '【AI 剧本全链路加速】\n核心梗概：[输入你的故事梗概或一句话简介]\n要求：扩展为完整的剧本大纲，包含分场结构、主要对白片段、关键情节点，并生成每场戏的分镜描述。格式：标准影视工业剧本格式。' },
      { id: 'fl_char_world', name: '角色 & 世界观工坊', desc: '角色一致性三视图 + 表情包 + 场景概念图批量生成', icon: <Users size={20} />, type: 'image', template: '【角色与世界观设计工坊】\n角色设定：[如：25岁银发精灵女弓箭手，绿色披风，琥珀色眼睛]\n输出要求：\n1. 标准三视图（正面/侧面/背面）\n2. 喜怒哀乐 4 种表情\n3. 角色生活的核心场景概念图\n要求：严格保持角色面部一致性。' },
      { id: 'fl_storyboard', name: 'AI 动态分镜', desc: '文本描述 → 连贯分镜动画，新海诚/赛博/水墨多种风格', icon: <Layout size={20} />, type: 'video', template: '【AI 动态分镜故事板】\n分镜描述：[粘贴关键场次的分镜文字描述]\n视觉风格：[新海诚唯美 / 暗黑赛博朋克 / 中国水墨 / 吉卜力手绘]\n要求：生成连贯的分镜动画序列，每个镜头 3-5 秒，包含基础运镜。' },
      { id: 'fl_sora', name: 'Sora 级大片引擎', desc: '高保真物理规律文生视频，8K 电影级画质输出', icon: <Sparkles size={20} />, type: 'video', template: '【Sora 级电影短片生成】\n画面描述：[如：微距镜头下，一颗露珠从翠绿的叶尖缓缓滑落，水珠表面折射着金色夕阳，背景是朦胧的森林光斑]\n技术参数：8K分辨率，高帧率慢动作，真实物理光照与流体模拟。' },
      { id: 'fl_style_transfer', name: '视频风格转绘', desc: '实拍视频逐帧重绘 → 二次元/机甲/日漫/乐高/GTA 风', icon: <Wand2 size={20} />, type: 'video', template: '【全视频风格重绘 Video2Video】\n[上传一段真人实拍视频]\n目标风格：[90年代日漫 / 赛博机甲 / 乐高定格 / GTA游戏画面 / 油画风]\n要求：严格保持原视频的人物动作轨迹，逐帧稳定渲染，零闪烁。' },
      { id: 'fl_sound_post', name: '声音后期全链路', desc: 'AI 配音克隆 + 环境拟音 Foley + 影视配乐定制，一站式混音', icon: <HeadphonesIcon size={20} />, type: 'music', template: '【影视声音后期全链路】\n[上传粗略的剪辑成片]\n声音需求：\n1. 角色配音（可指定克隆音色）\n2. 环境音自动生成（雨声/街道/森林/室内混响）\n3. 情绪配乐（史诗/紧张/浪漫/悲伤）\n要求：所有音轨自动对位，输出混音成品。' },
      { id: 'fl_animate_photo', name: '人物活化', desc: '静态照片/画像 → 开口说话 + 自然微表情 + 头部微动', icon: <User size={20} />, type: 'video', template: '【静态人物活化驱动】\n[上传一张正面人物照片]\n驱动音频：[上传讲话音频或输入文本让AI配音]\n要求：提取音频的节奏与情感，驱动嘴部、眼部微表情和头部自然微动。' },
      { id: 'fl_global_dist', name: '海外发行本地化', desc: '多语种翻译 + AI 配音 + 唇形同步 + 字幕本地化', icon: <Globe size={20} />, type: 'video', template: '【短剧海外发行本地化】\n[上传中文短剧成片]\n目标语言：[英语（美式）/ 西班牙语 / 阿拉伯语 / 日语]\n要求：翻译并本土化对白，AI 配音匹配原角色情绪，唇形同步校准，输出符合当地文化习惯的字幕。' },
    ]
  },

  // ═══════════════════════════════════════════════════════════
  // 引擎四：🎨 创意 & 空间设计引擎 (Creative & Spatial Design Engine)
  // ═══════════════════════════════════════════════════════════
  {
    category: '🎨 创意 & 空间设计引擎',
    tagline: '像素到现实，灵感零延迟的可视化设计中枢',
    theme: { text: 'text-cyan-500', bg: 'bg-cyan-50', icon: 'text-cyan-600', border: 'hover:border-cyan-300', shadow: 'hover:shadow-cyan-500/10' },
    items: [
      { id: 'design_studio', name: '视觉设计驾驶舱', desc: '线稿渲染 · 材质重组 · 光影切换 · 3D 生成，设计探索中枢', icon: <Palette size={24} />, type: 'design_studio', template: '', isCockpit: true },
      { id: 'ds_cad_render', name: '线稿/CAD 极速渲染', desc: '黑白手绘/SketchUp 截图 → 照片级 3D 效果图，秒级出图', icon: <PenTool size={20} />, type: 'image', template: '【CAD/线稿智能渲染】\n[拖入手绘线稿或 SketchUp 截图]\n设计风格：[法式轻奢 / 极简侘寂 / 赛博工业风 / 现代原木]\n要求：照片级真实感渲染，暖色调环境光，超高清晰度。' },
      { id: 'ds_rough_finish', name: '毛坯房一键精装', desc: '实拍毛坯 → AI 识别空间结构，自动填充硬装 + 软装方案', icon: <Layout size={20} />, type: 'image', template: '【毛坯房智能精装设计】\n[拖入毛坯房实拍照片]\n风格方案：[现代极简 / 法式轻奢 / 日式原木 / 工业loft]\n要求：AI 自动识别门窗和承重结构，智能填充地板、墙面、家具、灯具和软装饰品。' },
      { id: 'ds_lighting', name: '日夜 & 季节光影切换', desc: '一张实景 → 一键切换晨曦/黄昏/雨夜/大雪/赛博霓虹', icon: <Sun size={20} />, type: 'image', template: '【光影氛围 Relight 重构】\n[拖入实景照片]\n目标光影：[金色晨曦 / 绝美晚霞 / 赛博霓虹雨夜 / 大雪纷飞 / 盛夏午后]\n要求：严格保持建筑/空间结构不变，仅重构光影和氛围。' },
      { id: 'ds_3d_model', name: '3D 模型生成', desc: '单张图片 → 带纹理的高精度 3D 模型，支持导出标准格式', icon: <Box size={20} />, type: 'image', template: '【图片转 3D 模型】\n[拖入目标物体的正面照片]\n模型要求：[高精度 / 带纹理贴图 / 多角度完整]\n输出格式：[GLB / OBJ / FBX]\n要求：还原物体的体积感与材质纹理。' },
      { id: 'ds_ip_blindbox', name: 'IP 潮玩盲盒设计', desc: '文字描述 → Popmart 质感 3D 角色 + 多种配色与包装方案', icon: <Package size={20} />, type: 'image', template: '【IP 潮玩盲盒形象设计】\nIP 设定：[如：一只戴着飞行员护目镜的柴犬，喜欢冒险]\n风格要求：Popmart 盲盒质感，光泽黏土材质，亚克力外壳，Octane 渲染，极简纯色背景。输出多配色方案。' },
      { id: 'ds_game_assets', name: '游戏资产批量生成', desc: '道具图标/UI 元素/技能特效，统一风格批量输出', icon: <Gamepad2 size={20} />, type: 'image', template: '【游戏资产批量生成】\n游戏类型：[奇幻 RPG / 科幻射击 / 休闲消除 / 二次元卡牌]\n资产需求：[武器图标 / 道具 icon / UI按钮 / 技能特效 / 金币钻石]\n要求：统一风格、高饱和度、透明背景 PNG。' },
      { id: 'ds_photo_enhance', name: '摄影后期增强', desc: '老照片 → 4K 修复 / 杂物消除 / 背景替换 / 无损放大', icon: <Camera size={20} />, type: 'image', template: '【AI 摄影后期增强】\n[拖入需要处理的照片]\n处理需求：\n1. 画质无损拉升至 4K\n2. 消除画面中的杂物和路人\n3. [可选]替换背景为指定场景\n要求：面部细节修复，去噪去马赛克，自然不假。' },
      { id: 'ds_material_sim', name: '材质 & 质感模拟', desc: '一键切换塑料/金属/玻璃/木质/陶瓷/布料等物理材质渲染', icon: <Rocket size={20} />, type: 'image', template: '【材质质感智能模拟】\n[拖入产品设计图或线稿]\n目标材质：[高光金属 / 磨砂塑料 / 透明玻璃 / 天然木材 / 哑光陶瓷 / 丝绸布料]\n要求：真实物理级材质渲染 (PBR)，体现环境反射、表面粗糙度和次表面散射。' },
    ]
  },
];