import React, { useState } from 'react';

const COLLECTION_OPTIONS = ['无', '好物分享', '数码评测', '生活Vlog', '穿搭日常'];
const COVER_RATIOS = ['3:4', '1:1', '4:3', '16:9', '9:16'];
const CONTENT_DECLARATIONS = ['无声明', 'AI生成内容', '商业推广', '品牌合作', '产品体验'];

export default function XiaohongshuPanel({ config, onChange, onPublish, onSaveDraft }) {
  const cfg = config || {};
  const set = (field, value) => onChange && onChange(field, value);

  const title = cfg.title || '';
  const desc = cfg.desc || '';
  const tags = cfg.tags || '';
  const coverUrl = cfg.coverUrl || '';
  const coverRatio = cfg.coverRatio || '';
  const poi = cfg.poi || '';
  const collection = cfg.collection || '';
  const mentionUser = cfg.mentionUser || '';
  const mentionPosition = cfg.mentionPosition || '末尾';
  const productLink = cfg.productLink || '';
  const isOriginal = cfg.isOriginal ?? true;
  const declaration = cfg.declaration || '';
  const visibility = cfg.visibility || 'public';
  const scheduleType = cfg.scheduleType || 'now';
  const scheduleTime = cfg.scheduleTime || '';
  const firstComment = cfg.firstComment || '';
  const pinComment = cfg.pinComment ?? false;

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
            <div className="w-7 h-7 bg-[#ff2442] rounded-lg flex items-center justify-center text-white shadow-sm font-medium text-xs">
              小
            </div>
            <span className="font-bold text-gray-800 text-[16px]">小红书 专属配置</span>
            <span className="ml-auto text-xs bg-red-50 text-[#ff2442] px-2 py-1 rounded font-medium border border-red-100">
              全功能开放版
            </span>
          </div>

          <div className="space-y-6">

            {/* ================= 1. 标题 (上限 20 字符) ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">标题</div>
              <div className="flex-1">
                <div className="relative flex items-center border border-gray-300 rounded-lg focus-within:border-[#ff2442] focus-within:ring-2 focus-within:ring-red-100 transition-all bg-gray-50/50">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => set('title', e.target.value)}
                    maxLength={20}
                    placeholder="请输入"
                    className="w-full px-4 py-2.5 outline-none rounded-lg bg-transparent text-sm"
                  />
                  <div className="flex items-center gap-2 pr-3">
                    <button className="text-gray-400 hover:text-gray-600" onClick={() => set('title', '')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>
                    </button>
                    <span className="text-gray-400 text-xs font-mono">{title.length} / 20</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ================= 2. 封面 & 比例 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium"><span className="text-red-500 mr-1">*</span>封面</div>
              <div className="flex gap-6 flex-1">
                <div className="w-[104px] h-[104px] border border-gray-200 rounded-lg p-1.5 flex flex-col items-center justify-center cursor-pointer hover:border-[#ff2442] transition-all relative overflow-hidden group shadow-sm bg-white"
                  onClick={() => document.getElementById('xhs-cover-input')?.click()}
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
                    <span className="text-xs mt-1 font-medium">重新上传</span>
                  </div>
                </div>
                <input
                  id="xhs-cover-input"
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

                <div className="flex-1 max-w-[200px]">
                  <label className="block text-xs font-bold text-gray-400 mb-2">封面比例</label>
                  <select
                    className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#ff2442] transition-colors shadow-sm outline-none text-sm text-gray-400"
                    value={coverRatio}
                    onChange={e => set('coverRatio', e.target.value)}
                  >
                    <option value="">请选择封面比例</option>
                    {COVER_RATIOS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ================= 3. 简介 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">简介</div>
              <div className="flex-1">
                <div className="border border-gray-300 rounded-lg focus-within:border-[#ff2442] focus-within:ring-2 focus-within:ring-red-100 transition-all bg-white shadow-sm overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50/50 border-b border-gray-200 flex items-center">
                    <button type="button" className="px-3 py-1 bg-white border border-gray-200 rounded-md text-gray-600 text-xs flex items-center gap-1.5 hover:text-[#ff2442] hover:border-[#ff2442] transition-colors shadow-sm">
                      <span>☺</span>
                      <span>表情</span>
                    </button>
                  </div>
                  <div className="relative">
                    <textarea
                      rows={3}
                      placeholder="说点什么吧..."
                      value={desc}
                      onChange={e => set('desc', e.target.value)}
                      maxLength={1000}
                      className="w-full p-3 pb-8 outline-none resize-none text-sm bg-transparent leading-relaxed"
                    />
                    <span className="absolute bottom-2 right-3 text-gray-400 text-xs font-mono">{desc.length} / 1000</span>
                  </div>
                </div>
                <div className="text-[11px] text-gray-400 mt-1.5">不要在简介中输入带#的话题，请使用下方"话题"功能</div>
              </div>
            </div>

            {/* ================= 4. 话题 & @用户 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">话题</div>
              <div className="flex-1">
                <div className="h-[38px] border border-gray-300 rounded-lg px-3 flex items-center bg-gray-50/50 cursor-text hover:border-[#ff2442] transition-colors focus-within:border-[#ff2442] focus-within:ring-2 focus-within:ring-red-100">
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

            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">@用户</div>
              <div className="flex-1">
                <div className="h-[38px] border border-gray-300 rounded-lg px-3 flex items-center bg-gray-50/50 cursor-text hover:border-[#ff2442] transition-colors focus-within:border-[#ff2442] focus-within:ring-2 focus-within:ring-red-100 mb-2">
                  <input
                    type="text"
                    placeholder="请输入关键词搜索"
                    className="w-full bg-transparent outline-none text-sm text-gray-700"
                    value={mentionUser}
                    onChange={e => set('mentionUser', e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>@将追加到简介</span>
                  <select
                    className="border border-gray-300 rounded-md px-3 py-1 bg-white cursor-pointer hover:border-[#ff2442] transition-colors shadow-sm outline-none text-sm"
                    value={mentionPosition}
                    onChange={e => set('mentionPosition', e.target.value)}
                  >
                    <option value="末尾">末尾</option>
                    <option value="开头">开头</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ================= 5. 地理位置 & 合集 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">地理位置</div>
              <div className="flex-1">
                <select
                  className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#ff2442] transition-colors shadow-sm outline-none text-sm text-gray-400"
                  value={poi}
                  onChange={e => set('poi', e.target.value)}
                >
                  <option value="">请选择地理位置</option>
                  <option value="杭州">杭州</option>
                  <option value="北京">北京</option>
                  <option value="上海">上海</option>
                  <option value="广州">广州</option>
                  <option value="深圳">深圳</option>
                </select>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">添加到合集</div>
              <div className="flex-1">
                <select
                  className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#ff2442] transition-colors shadow-sm outline-none text-sm text-gray-400"
                  value={collection}
                  onChange={e => set('collection', e.target.value)}
                >
                  <option value="">请选择合集</option>
                  {COLLECTION_OPTIONS.filter(c => c !== '无').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ================= 6. 店铺商品 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">店铺商品</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="粘贴商品ID / 链接"
                    className="flex-1 h-[38px] border border-gray-300 rounded-lg px-3 bg-gray-50/50 text-sm text-gray-700 outline-none focus:border-[#ff2442] focus:ring-2 focus:ring-red-100 transition-all"
                    value={productLink}
                    onChange={e => set('productLink', e.target.value)}
                  />
                  <button type="button" className="px-5 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:border-[#ff2442] hover:text-[#ff2442] transition-colors shadow-sm font-medium text-sm flex-shrink-0">
                    ＋ 添加商品
                  </button>
                </div>
                <div className="text-[11px] text-gray-400 mt-2 font-mono">最多可添加 18 个商品</div>
              </div>
            </div>

            {/* ================= 7. 原创声明 & 内容声明 ================= */}
            <div className="flex items-start border-t border-gray-100 pt-6">
              <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">原创声明</div>
              <div className="flex-1 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer text-sm text-gray-700 leading-relaxed font-medium">
                  <input
                    type="checkbox"
                    className="accent-[#ff2442] w-4 h-4 rounded-sm mt-0.5"
                    checked={isOriginal}
                    onChange={e => set('isOriginal', e.target.checked)}
                  />
                  <span>声明后将获得原创笔记标记，且平台会保护你的作品</span>
                </label>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">内容声明</div>
              <div className="flex-1">
                <select
                  className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#ff2442] transition-colors shadow-sm outline-none text-sm text-gray-400"
                  value={declaration}
                  onChange={e => set('declaration', e.target.value)}
                >
                  <option value="">选择内容性质声明</option>
                  {CONTENT_DECLARATIONS.filter(d => d !== '无声明').map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ================= 8. 权限设置 & 发布时间 ================= */}
            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">权限设置</div>
              <div className="flex-1 flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="xhs_privacy" className="accent-[#ff2442] w-4 h-4"
                    checked={visibility === 'public'} onChange={() => set('visibility', 'public')} /> 公开
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="xhs_privacy" className="accent-[#ff2442] w-4 h-4"
                    checked={visibility === 'private'} onChange={() => set('visibility', 'private')} /> 仅自己可见
                </label>
              </div>
            </div>

            <div className="flex items-start">
              <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">发布时间</div>
              <div className="flex-1 flex gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="xhs_timing" className="accent-[#ff2442] w-4 h-4"
                    checked={scheduleType === 'now'} onChange={() => handleScheduleChange('now')} /> 立即发布
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="xhs_timing" className="accent-[#ff2442] w-4 h-4"
                    checked={scheduleType === 'platform'} onChange={() => handleScheduleChange('platform')} /> 定时发布
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="radio" name="xhs_timing" className="accent-[#ff2442] w-4 h-4"
                    checked={scheduleType === 'local'} onChange={() => handleScheduleChange('local')} /> 本机定时
                </label>
              </div>
            </div>

            {scheduleType !== 'now' && (
              <div className="flex items-start">
                <div className="w-[110px] flex-shrink-0"></div>
                <div className="flex-1">
                  <input
                    type="datetime-local"
                    className="w-full max-w-xs border border-gray-300 rounded-lg h-10 px-3 text-sm outline-none focus:border-[#ff2442]"
                    value={scheduleTime}
                    onChange={e => set('scheduleTime', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* ================= 9. 抢占首评 ================= */}
            <div className="flex items-start mt-2">
              <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">抢占首评</div>
              <div className="flex-1">
                <div className="relative border border-gray-300 rounded-lg p-3 bg-white focus-within:border-[#ff2442] focus-within:ring-2 focus-within:ring-red-100 transition-all shadow-sm">
                  <div className="text-right text-[#ff2442] text-[12px] mb-2 cursor-pointer font-medium hover:text-red-700">历史记录</div>
                  <textarea
                    value={firstComment}
                    onChange={(e) => set('firstComment', e.target.value)}
                    rows={3}
                    placeholder="设置第一条评论，抢占沙发流量..."
                    className="w-full outline-none resize-none bg-transparent text-sm leading-relaxed"
                  />
                  <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded accent-[#ff2442] w-4 h-4"
                        checked={pinComment}
                        onChange={e => set('pinComment', e.target.checked)}
                      /> 尝试置顶该评论
                    </label>
                  </div>
                </div>
                <div className="text-[11px] text-gray-400 mt-2 flex flex-col gap-0.5 leading-relaxed">
                  <span className="text-amber-600 font-medium">任务执行时，底层幽灵机甲会确保小红书创作者页面在前台保持活跃，确保首评追加成功。</span>
                </div>
              </div>
            </div>

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
            className="px-12 py-2.5 bg-[#ff2442] text-white rounded-xl shadow-md text-[14px] font-black hover:bg-[#e0203a] transition active:scale-95 shadow-[#ff2442]/30"
          >
            发表至小红书
          </button>
        </div>
      </div>
    </div>
  );
}
