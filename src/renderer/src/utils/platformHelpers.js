export const PLATFORM_COLORS = {
  '抖音': { text: 'text-[#fe2c55]', bg: 'bg-[#fe2c55]', border: 'border-[#fe2c55]', ring: 'focus:border-[#fe2c55]', tabBg: 'bg-[#161823]', tabText: 'text-white', accent: '#FE2C55', accentClass: 'bg-[#FE2C55]', hoverAccent: 'hover:bg-[#e0264b]' },
  '小红书': { text: 'text-[#ff2442]', bg: 'bg-[#ff2442]', border: 'border-[#ff2442]', ring: 'focus:border-[#ff2442]', tabBg: 'bg-[#ff2442]', tabText: 'text-white', accent: '#ff2442', accentClass: 'bg-[#ff2442]', hoverAccent: 'hover:bg-[#e0203b]' },
  'B站': { text: 'text-[#fb7299]', bg: 'bg-[#fb7299]', border: 'border-[#fb7299]', ring: 'focus:border-[#fb7299]', tabBg: 'bg-[#fb7299]', tabText: 'text-white', accent: '#FB7299', accentClass: 'bg-[#FB7299]', hoverAccent: 'hover:bg-[#e5648a]' },
  '微信视频号': { text: 'text-[#07C160]', bg: 'bg-[#07C160]', border: 'border-[#07C160]', ring: 'focus:border-[#07C160]', tabBg: 'bg-[#07C160]', tabText: 'text-white', accent: '#07C160', accentClass: 'bg-[#07C160]', hoverAccent: 'hover:bg-[#06ad56]' },
  '快手': { text: 'text-[#FF7700]', bg: 'bg-[#FF7700]', border: 'border-[#FF7700]', ring: 'focus:border-[#FF7700]', tabBg: 'bg-[#FF7700]', tabText: 'text-white', accent: '#FF7700', accentClass: 'bg-[#FF7700]', hoverAccent: 'hover:bg-[#e66a00]' },
  '知乎': { text: 'text-[#0066ff]', bg: 'bg-[#0066ff]', border: 'border-[#0066ff]', ring: 'focus:border-[#0066ff]', tabBg: 'bg-[#0066ff]', tabText: 'text-white', accent: '#0066ff', accentClass: 'bg-[#0066ff]', hoverAccent: 'hover:bg-[#005ce6]' },
  '微博': { text: 'text-[#ff8200]', bg: 'bg-[#ff8200]', border: 'border-[#ff8200]', ring: 'focus:border-[#ff8200]', tabBg: 'bg-[#ff8200]', tabText: 'text-white', accent: '#ff8200', accentClass: 'bg-[#ff8200]', hoverAccent: 'hover:bg-[#e67500]' },
  '百家号': { text: 'text-[#2b88ff]', bg: 'bg-[#2b88ff]', border: 'border-[#2b88ff]', ring: 'focus:border-[#2b88ff]', tabBg: 'bg-[#2b88ff]', tabText: 'text-white', accent: '#2B60FF', accentClass: 'bg-[#2B60FF]', hoverAccent: 'hover:bg-[#254fdb]' },
  '企鹅号(腾讯)': { text: 'text-[#00A4FF]', bg: 'bg-[#00A4FF]', border: 'border-[#00A4FF]', ring: 'focus:border-[#00A4FF]', tabBg: 'bg-[#00A4FF]', tabText: 'text-white', accent: '#00A4FF', accentClass: 'bg-[#00A4FF]', hoverAccent: 'hover:bg-[#008ce6]' },
  '腾讯视频': { text: 'text-[#00A4FF]', bg: 'bg-[#00A4FF]', border: 'border-[#00A4FF]', ring: 'focus:border-[#00A4FF]', tabBg: 'bg-[#00A4FF]', tabText: 'text-white', accent: '#00A4FF', accentClass: 'bg-[#00A4FF]', hoverAccent: 'hover:bg-[#008ce6]' },
  '大鱼号(优酷)': { text: 'text-[#FF6600]', bg: 'bg-[#FF6600]', border: 'border-[#FF6600]', ring: 'focus:border-[#FF6600]', tabBg: 'bg-[#FF6600]', tabText: 'text-white', accent: '#FF6600', accentClass: 'bg-[#FF6600]', hoverAccent: 'hover:bg-[#e65c00]' },
  '爱奇艺号': { text: 'text-emerald-600', bg: 'bg-emerald-600', border: 'border-emerald-600', ring: 'focus:border-emerald-600', tabBg: 'bg-emerald-600', tabText: 'text-white', accent: '#059669', accentClass: 'bg-emerald-600', hoverAccent: 'hover:bg-emerald-700' }
};

export const getBrand = (platform) => PLATFORM_COLORS[platform] || { text: 'text-slate-600', bg: 'bg-slate-600', border: 'border-slate-600', ring: 'focus:border-slate-600', tabBg: 'bg-slate-800', tabText: 'text-white', accent: '#475569', accentClass: 'bg-slate-600', hoverAccent: 'hover:bg-slate-700' };

export const PLATFORM_LABELS = {
  '抖音': { publishBtn: '立即发布至抖音', header: '抖音 专属配置' },
  '小红书': { publishBtn: '发表至小红书', header: '小红书 专属配置' },
  'B站': { publishBtn: '立即投稿', header: 'B站 专属配置' },
  '微信视频号': { publishBtn: '发表至视频号', header: '微信视频号 专属配置' },
  '快手': { publishBtn: '发布至快手', header: '快手 专属配置' },
  '百家号': { publishBtn: '立刻发布至百家号', header: '百家号 专属配置' },
};

export const getPlatformLabel = (platform, key = 'header') => {
  return (PLATFORM_LABELS[platform] || {})[key] || `${platform} 专属配置`;
};
