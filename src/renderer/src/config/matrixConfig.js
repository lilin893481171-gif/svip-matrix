// =====================================================================
// YuMatrix 统一配置中心 —— 所有环境变量与 Worker 路由的单一事实来源
// =====================================================================

// Matrix 认证令牌 (构建时注入，缺少时拒绝启动以避免泄露默认值)
export const MATRIX_AUTH_TOKEN = import.meta.env.VITE_MATRIX_AUTH_TOKEN;

// Cloudflare Worker 网关域名
export const CF_API_DOMAIN =
  import.meta.env.VITE_CF_API_DOMAIN || 'https://myapp.nikolaboy.com';

// AI 推理 Worker 域名
export const MATRIX_WORKER_URL =
  import.meta.env.VITE_MATRIX_WORKER_URL || 'https://matrix-ai-hub.lilin893481171.workers.dev';

// =====================================================================
// 发布工作台：系统预设媒体文件夹 & 平台 AI 文案模板
// =====================================================================

// AI 生成的视频默认输出目录 (可通过环境变量覆盖)
export const SYSTEM_MEDIA_FOLDER = import.meta.env.VITE_SYSTEM_MEDIA_FOLDER || '';

// 各平台 AI 填表 Prompt 模板（调性 / 标题限制 / 标签规范 / 禁止事项）
export const PLATFORM_COPY_PROMPTS = {
  '抖音': {
    tone: '口语化、强互动、制造悬念或争议、前3秒钩子、节奏快、多用感叹号和反问句',
    titleMax: 30,
    descTone: '轻松活泼，引导评论互动，结尾加引导语（如"你觉得呢？"）',
    tagStyle: '热门话题标签 + 垂直领域标签',
    tagMax: 5,
    rules: '禁止出现微信号/二维码/外站链接；禁止违禁词（第一/最/国家级）；标题避免过于标题党'
  },
  '小红书': {
    tone: '情绪化、大量Emoji、闺蜜/姐妹口吻、种草风、真诚分享感',
    titleMax: 20,
    descTone: '像写笔记一样自然，多用✨💯🔥等emoji，分点列举，结尾加相关话题',
    tagStyle: '精准关键词标签 + 热门话题标签',
    tagMax: 5,
    rules: '禁止站外引流链接；禁止明显广告用语；标题不可夸张失实；内容需有真实分享感'
  },
  'B站': {
    tone: '深度硬核、专业数据支撑、可加幽默吐槽、长尾关键词覆盖',
    titleMax: 80,
    descTone: '用2-3段话概括内容核心亮点，引用专业术语，结尾引导三连',
    tagStyle: '精准分区标签 + 内容方向标签 + 热门话题',
    tagMax: 5,
    rules: '禁止低质标题党；标题需与内容强相关；分区选择必须准确；简介中可放合理外部链接'
  },
  '微信视频号': {
    tone: '简洁有力、偏正能量、适合朋友圈转发、标题有共鸣感',
    titleMax: 30,
    descTone: '简短精炼，强调价值点或情感共鸣，可带#话题；有搜索短标题字段，≤20字概括视频主要内容',
    tagStyle: '精准话题标签',
    tagMax: 5,
    rules: '禁止诱导分享/关注；禁止夸大宣传；内容需符合微信内容规范'
  },
  '快手': {
    tone: '接地气、真实感、老铁口吻、突出反差或实用价值',
    titleMax: 0,
    descTone: '标题和描述合并在一个字段，格式为【标题】\\n描述内容，直接说重点，用"老铁""兄弟们"等亲切称呼',
    tagStyle: '热门挑战标签 + 领域标签',
    tagMax: 5,
    rules: '禁止低俗内容；禁止诱导双击/关注；标题不可过度夸张；注意：平台无独立标题字段，title 留空，标题内容通过【标题】格式放在 desc 开头'
  },
  '知乎': {
    tone: '理性客观、有数据支撑、先抛问题再给答案、专业但不晦涩',
    titleMax: 50,
    descTone: '问题导向式开头，结构化论述，引用来源或数据，保持专业调性',
    tagStyle: '精准话题标签，3-5个',
    rules: '禁止纯广告内容；需有实质性观点或知识输出；标题需为明确的问题或观点'
  },
  '微博': {
    tone: '短平快、紧跟热点、话题性强、可用超话和@',
    titleMax: 40,
    descTone: '精炼有力，带#话题词#和@相关账号，适当使用网络热梗',
    tagStyle: '2-3个核心话题标签 + 超话签到',
    rules: '禁止发布谣言；需遵守微博社区公约；营销内容需标注'
  },
  '百家号': {
    tone: '新闻化、客观专业、标题准确概括内容、适合搜索引擎收录',
    titleMax: 50,
    descTone: '新闻导语式开头，正文结构化，注重SEO关键词布局',
    tagStyle: '精准领域标签',
    tagMax: 5,
    rules: '禁止标题党；禁止抄袭搬运；内容需原创或合法授权；禁止违规推广'
  },
  '企鹅号(腾讯)': {
    tone: '专业资讯风、标题准确、内容结构化、适合多平台分发',
    titleMax: 30,
    descTone: '资讯导语风格，正文分点论述，配图说明，注重信息密度',
    tagStyle: '内容分类标签，3-5个',
    rules: '禁止低质内容；禁止虚假信息；需遵守腾讯内容开放平台规范'
  },
  '腾讯视频': {
    tone: '影视娱乐风、突出看点、标题有吸引力且准确',
    titleMax: 40,
    descTone: '突出视频亮点和看点，简介清晰概括内容，可加演职员信息',
    tagStyle: '影视分类标签 + 类型标签，5-8个',
    rules: '禁止侵权内容；标题需与视频一致；禁止违规营销'
  },
  '大鱼号(优酷)': {
    tone: '轻松娱乐化、突出视觉冲击力、标题有悬念感',
    titleMax: 40,
    descTone: '简介概括视频亮点，语言简洁有吸引力，引导观看',
    tagStyle: '内容分类标签 + 热点标签，5-8个',
    rules: '禁止低质搬运；内容需原创；遵守阿里大文娱内容规范'
  },
  '爱奇艺号': {
    tone: '影视专业风、突出内容品质、标题体现内容价值',
    titleMax: 40,
    descTone: '内容简介需准确专业，可加演职员和看点说明，结构化呈现',
    tagStyle: '影视分类 + 类型标签，5-8个',
    rules: '禁止侵权；禁止违规内容；需遵守爱奇艺号内容规范'
  }
};

// =====================================================================
// 文案风格预设词库 (AI 填表 & Copilot 共用)
// =====================================================================
export const COPY_STYLES = [
  { id: 'net', label: '🔥 爆款网感', prompt: '文案要有极强的"网感"，善用热门梗，前3秒必须抓人眼球，制造悬念或情绪共鸣，适合泛流量抓取。' },
  { id: 'hardcore', label: '⚙️ 硬核解压', prompt: '文案聚焦在产品的机械结构、材质（如纯钛/合金）、声音反馈（如段落感/清脆声），多用拟声词和触觉描写，精准击中ASMR和EDC玩家痛点。' },
  { id: 'premium', label: '💎 高端测评', prompt: '文案克制、高级、专业。多用行业术语、参数对比，凸显做工精良和设计美学，像苹果发布会一样的高级感，适合高客单价转化。' },
  { id: 'emotion', label: '❤️ 情感共鸣', prompt: '文案走心，像老朋友聊天。结合深夜失眠、打工焦虑、通勤无聊等生活场景，将产品包装成情绪的出口和精神寄托。' },
  { id: 'humor', label: '🤣 幽默段子手', prompt: '文案轻松搞怪，多用网络热梗和夸张比喻，让人会心一笑的同时记住产品亮点，适合娱乐向内容和年轻用户群体。' },
  { id: 'knowledge', label: '📚 知识科普', prompt: '文案以"你知道吗"开头，用数据和事实说话，深入浅出地讲解产品背后的原理或行业知识，建立专业信任感。' },
  { id: 'suspense', label: '🎬 剧情悬念', prompt: '文案像电影预告片，先抛出一个让人好奇的问题或场景，层层递进揭开答案，让用户忍不住看完。适合故事性强的视频。' },
  { id: 'marketing', label: '💼 商业营销', prompt: '文案直接点明痛点→给出方案→展示效果，配合限时优惠或稀缺性话术，强行动号召力，适合带货转化场景。' },
];

// =====================================================================
// Worker 路由清单 (所有已接入的网关端点)
// =====================================================================
export const WORKER_ROUTES = {
  hubConfig:    '/v1/hub-config',              // GET  — 拉取云端策略与灰度配置
  chat:         '/v1/chat/completions',        // POST — LLM 对话补全 (DeepSeek 等)
  voiceOmni:    '/v1/voice/omnivoice',         // POST — 通用语音合成 / 克隆 / 分离
  voiceVibe:    '/v1/voice/vibevoice-asr',     // POST — 播客转写 / 说话人分离
};

// 构建完整的请求 URL
export function workerUrl(route) {
  return `${MATRIX_WORKER_URL}${route}`;
}

export function cfApiUrl(route) {
  return `${CF_API_DOMAIN}${route}`;
}

// 标准请求头 (可被调用方覆盖)
export function authHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'X-Matrix-Token': MATRIX_AUTH_TOKEN,
    ...extra,
  };
}
