import React, { useState } from 'react';

const CMS_CATEGORIES = {
  '手作': ['手作', '编织', '陶艺'],
  '科技': ['科技', '数码', 'AI'],
  '美食': ['美食', '烹饪', '探店'],
  '旅游': ['旅游', '攻略', '民宿'],
  '时尚': ['时尚', '穿搭', '美妆'],
};

const WATERMARK_OPTIONS = ['不添加水印', '添加平台水印', '添加自定义水印'];
const REQUIRED_DECLARATIONS = ['无需声明', '含AI生成内容', '内容为转载', '含虚构演绎内容', '内容含营销信息', '个人观点'];
const SUPPLEMENTARY_DECLARATIONS = ['无', '内容可能引人不适', '内容含有高危险行为', '请理性适度消费', '未成年人请在监护人指导下浏览'];

export default function BaijiahaoPanel({ config, onChange, onPublish, onSaveDraft }) {
  const cfg = config || {};
  const set = (field, value) => onChange && onChange(field, value);

  const title = cfg.title || '';
  const coverUrl = cfg.coverUrl || '';
  const tags = cfg.tags || '';
  const category1 = cfg.category1 || '手作';
  const category2 = cfg.category2 || '手作';
  const watermark = cfg.watermark || '';
  const requiredDeclaration = cfg.requiredDeclaration || '无需声明';
  const supplementaryDeclaration = cfg.supplementaryDeclaration || '无';
  const scheduleType = cfg.scheduleType || 'now';
  const scheduleTime = cfg.scheduleTime || '';

  const handleScheduleChange = (type) => {
    set('scheduleType', type);
    set('scheduled', type !== 'now');
  };

  return (
    <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
      <div className="max-w-[840px] w-full mx-auto">
        <div className="w-full bg-white rounded-xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 font-sans text-[14px] text-[#333]">

          {/* 顶部平台标识 */}
          <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="w-7 h-7 bg-[#2B60FF] rounded-lg flex items-center justify-center text-white shadow-sm font-bold text-sm tracking-widest">
              百
            </div>
            <span className="font-bold text-gray-800 text-[16px]">百家号 专属配置</span>
            <span className="ml-auto text-xs bg-blue-50 text-[#2B60FF] px-2 py-1 rounded font-medium border border-blue-100">
              全功能开放版
            </span>
          </div>

          <div className="space-y-6">

            {/* ================= 1. 标题 (上限 50 字符) ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">标题</div>
              <div className="flex-1">
                <div className="relative flex items-center border border-gray-300 rounded-lg focus-within:border-[#2B60FF] focus-within:ring-2 focus-within:ring-blue-100 transition-all bg-gray-50/50">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => set('title', e.target.value)}
                    maxLength={50}
                    placeholder="请输入"
                    className="w-full px-4 py-2.5 outline-none rounded-lg bg-transparent text-sm"
                  />
                  <div className="flex items-center gap-2 pr-3">
                    <button className="text-gray-400 hover:text-gray-600" onClick={() => set('title', '')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>
                    </button>
                    <span className="text-gray-400 text-xs font-mono">{title.length} / 50</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ================= 2. 封面 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium"><span className="text-red-500 mr-1">*</span>封面</div>
              <div className="flex-1">
                <div className="w-[104px] h-[104px] border border-gray-200 rounded-lg p-1.5 flex flex-col items-center justify-center cursor-pointer hover:border-[#2B60FF] transition-all relative overflow-hidden group shadow-sm"
                  onClick={() => document.getElementById('bjh-cover-input')?.click()}
                >
                  {coverUrl ? (
                    <img src={coverUrl} className="w-full h-full object-cover rounded" alt="cover" />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <span className="text-2xl leading-none">+</span>
                      <span className="text-sm mt-1 font-medium">上传封面</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                    <span className="text-xl leading-none">+</span>
                    <span className="text-xs mt-1 font-medium">{coverUrl ? '重新上传' : '点击上传'}</span>
                  </div>
                </div>
                <input
                  id="bjh-cover-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => set('coverUrl', reader.result);
                    reader.readAsDataURL(file);
                    e.target.value = null;
                  }}
                />
              </div>
            </div>

            {/* ================= 3. 话题 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">话题</div>
              <div className="flex-1">
                <div className="h-[38px] border border-gray-300 rounded-lg px-3 flex items-center bg-gray-50/50 cursor-text hover:border-[#2B60FF] transition-colors focus-within:border-[#2B60FF] focus-within:ring-2 focus-within:ring-blue-100">
                  <input
                    type="text"
                    placeholder="请输入话题进行搜索"
                    className="w-full bg-transparent outline-none text-sm text-gray-700"
                    value={tags}
                    onChange={e => set('tags', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ================= 4. 分类 (CMS 双级联动映射) ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">分类</div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <select
                    className="w-[130px] h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#2B60FF] transition-colors shadow-sm focus:border-[#2B60FF] focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    value={category1}
                    onChange={e => { set('category1', e.target.value); set('category2', CMS_CATEGORIES[e.target.value]?.[0] || ''); }}
                  >
                    {Object.keys(CMS_CATEGORIES).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    className="w-[130px] h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#2B60FF] transition-colors shadow-sm focus:border-[#2B60FF] focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    value={category2}
                    onChange={e => set('category2', e.target.value)}
                  >
                    {(CMS_CATEGORIES[category1] || []).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <span className="text-[#2B60FF] text-sm cursor-pointer hover:text-blue-700 font-medium ml-1" onClick={() => { set('category1', ''); set('category2', ''); }}>清空</span>
                </div>
              </div>
            </div>

            {/* ================= 5. 水印控制 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">水印</div>
              <div className="flex-1">
                <select
                  className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#2B60FF] transition-colors shadow-sm focus:border-[#2B60FF] focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                  value={watermark}
                  onChange={e => set('watermark', e.target.value)}
                >
                  <option value="">请选择水印设置</option>
                  {WATERMARK_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ================= 6. 创作声明 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">创作声明</div>
              <div className="flex-1 space-y-3">
                {/* 必选声明 */}
                <div>
                  <div className="text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">必选声明</div>
                  <select
                    className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#2B60FF] transition-colors shadow-sm focus:border-[#2B60FF] focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    value={requiredDeclaration}
                    onChange={e => set('requiredDeclaration', e.target.value)}
                  >
                    {REQUIRED_DECLARATIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                {/* 补充声明（可选） */}
                <div>
                  <div className="text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">补充声明（可选）</div>
                  <select
                    className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#2B60FF] transition-colors shadow-sm focus:border-[#2B60FF] focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    value={supplementaryDeclaration}
                    onChange={e => set('supplementaryDeclaration', e.target.value)}
                  >
                    {SUPPLEMENTARY_DECLARATIONS.map(opt => (
                      <option key={opt} value={opt}>{opt === '无' ? '无' : opt}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ================= 7. 定时发布 ================= */}
            <div className="flex items-start border-t border-gray-100 pt-6">
              <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">定时发布</div>
              <div className="flex-1 flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="bjh_timing" className="accent-[#2B60FF] w-4 h-4" checked={scheduleType === 'now'} onChange={() => handleScheduleChange('now')} /> 立即发布
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="bjh_timing" className="accent-[#2B60FF] w-4 h-4" checked={scheduleType === 'platform'} onChange={() => handleScheduleChange('platform')} /> 定时发布
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="bjh_timing" className="accent-[#2B60FF] w-4 h-4" checked={scheduleType === 'local'} onChange={() => handleScheduleChange('local')} /> 本机定时
                </label>
              </div>
            </div>

            {scheduleType !== 'now' && (
              <div className="flex items-start">
                <div className="w-[110px] flex-shrink-0"></div>
                <div className="flex-1">
                  <input
                    type="datetime-local"
                    className="w-full max-w-xs border border-gray-300 rounded-lg h-10 px-3 text-sm outline-none focus:border-[#2B60FF]"
                    value={scheduleTime}
                    onChange={e => set('scheduleTime', e.target.value)}
                  />
                </div>
              </div>
            )}

          </div>
        </div>

        {/* 底部按钮 */}
        <div className="pt-6 pb-8 flex justify-center gap-4 border-t border-[#e3e4e5] mt-6">
          <button
            onClick={onSaveDraft}
            className="px-8 py-2.5 bg-white text-[#666] font-bold rounded-xl text-[13px] hover:bg-slate-50 transition border border-[#e3e4e5] shadow-sm"
          >
            存入草稿
          </button>
          <button
            onClick={onPublish}
            className="px-10 py-2.5 bg-[#2b88ff] text-white font-black rounded-xl text-[13px] hover:bg-[#1a73e8] transition shadow-md shadow-blue-200 active:scale-95"
          >
            立刻发布至百家号
          </button>
        </div>
      </div>
    </div>
  );
}
