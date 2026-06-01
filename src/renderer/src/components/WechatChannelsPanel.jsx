import React, { useState } from 'react';

export default function WechatChannelsPanel({ config, onChange, onPublish, onSaveDraft, activeVideo }) {
  const cfg = config || {};
  const set = (field, value) => onChange && onChange(field, value);

  const title = cfg.title || '';
  const desc = cfg.desc || '';
  const poi = cfg.poi || '';
  const productLink = cfg.productLink || '';
  const isOriginal = cfg.isOriginal ?? cfg.original ?? true;
  const scheduled = cfg.scheduled || false;
  const scheduleType = cfg.scheduleType || 'now';
  const firstComment = cfg.firstComment || '';
  const linkType = cfg.linkType || '';

  const coverPath = cfg.coverPath || '';
  const coverHorizontal = cfg.coverHorizontal || '';

  const handleScheduleChange = (type) => {
    set('scheduleType', type);
    set('scheduled', type !== 'now');
  };

  return (
    <div className="w-full max-w-[720px] bg-white rounded-xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 font-sans text-[14px] text-[#333]">

      {/* 顶部平台标识 */}
      <div className="mb-6 flex items-center gap-2 border-b border-gray-100 pb-4">
        <div className="w-6 h-6 bg-[#07c160] rounded flex items-center justify-center text-white shadow-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.03 2 11c0 2.76 1.43 5.23 3.68 6.84.23.16.34.46.25.73l-.46 1.55c-.09.31.25.56.52.4l1.62-.95c.21-.13.47-.16.7-.08 1.15.42 2.4.65 3.69.65 5.52 0 10-4.03 10-9s-4.48-9-10-9zm0 15c-1.13 0-2.22-.2-3.23-.57-.45-.15-.96-.1-1.37.08l-2.61 1.52.74-2.49c.14-.49-.03-1.02-.4-1.34C3.34 12.87 2.2 10.96 2.2 8.8c0-3.97 4.39-7.2 9.8-7.2s9.8 3.23 9.8 7.2c0 3.98-4.39 7.2-9.8 7.2z"/>
          </svg>
        </div>
        <span className="font-bold text-gray-800 text-[16px]">微信视频号 专属配置</span>
        <span className="ml-auto text-xs bg-green-50 text-[#07c160] px-2 py-1 rounded font-medium border border-green-100">
          全功能开放版
        </span>
      </div>

      <div className="space-y-6">

        {/* ================= 1. 封面 ================= */}
        <div className="flex items-start">
          <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">
            <span className="text-red-500 mr-1">*</span>封面
          </div>
          <div className="flex gap-5 flex-1">
            {/* 主封面 */}
            <div>
              <div className="w-[104px] h-[104px] border border-gray-200 rounded-lg p-1.5 flex flex-col items-center justify-center cursor-pointer hover:border-[#07c160] transition-all relative overflow-hidden group shadow-sm">
                {coverPath ? (
                  <img src={`file:///${coverPath.replace(/\\/g, '/')}`} className="w-full h-full object-cover rounded" alt="cover" />
                ) : activeVideo && (activeVideo.videoPath || activeVideo.path) ? (
                  <img src={`file:///${(activeVideo.videoPath || activeVideo.path || '').replace(/\\/g, '/')}`} className="w-full h-full object-cover rounded opacity-50" alt="video" />
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
            </div>
            {/* 4:3 封面 */}
            <div className="relative">
              <div className="w-[104px] h-[104px] border border-dashed border-gray-300 bg-gray-50 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#07c160] hover:bg-green-50/50 transition-all text-gray-400 group">
                {coverHorizontal ? (
                  <img src={coverHorizontal} className="w-full h-full object-cover rounded" alt="cover4:3" />
                ) : (
                  <>
                    <span className="text-2xl leading-none group-hover:text-[#07c160]">+</span>
                    <span className="text-sm mt-1 group-hover:text-[#07c160] font-medium">上传</span>
                  </>
                )}
              </div>
              <div className="text-gray-500 text-xs text-center font-medium mt-1">封面/4:3</div>
            </div>
          </div>
        </div>

        {/* ================= 2. 简介 ================= */}
        <div className="flex items-start">
          <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">简介</div>
          <div className="flex-1">
            <div className="border border-gray-300 rounded-lg focus-within:border-[#07c160] focus-within:ring-2 focus-within:ring-green-100 transition-all relative bg-gray-50/50">
              <textarea
                rows={3}
                value={desc}
                onChange={e => set('desc', e.target.value)}
                maxLength={1000}
                className="w-full p-3 pb-8 outline-none resize-none rounded-lg text-sm bg-transparent leading-relaxed"
              />
              <span className="absolute bottom-2 right-3 text-gray-400 text-xs font-mono">{desc.length} / 1000</span>
            </div>
          </div>
        </div>

        {/* ================= 3. 话题 ================= */}
        <div className="flex items-start">
          <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">话题</div>
          <div className="flex-1">
            <div className="h-[38px] border border-gray-300 rounded-lg px-3 flex items-center bg-gray-50/50 cursor-text hover:border-[#07c160] transition-colors focus-within:border-[#07c160] focus-within:ring-2 focus-within:ring-green-100">
              <input
                type="text"
                placeholder="请输入话题进行搜索"
                className="w-full bg-transparent outline-none text-sm text-gray-700"
                value={cfg.tags || ''}
                onChange={e => set('tags', e.target.value)}
              />
            </div>
            <div className="text-[11px] text-gray-400 mt-1.5">每个话题最多50个字，按回车键确认; 最多可添加10个</div>
          </div>
        </div>

        {/* ================= 4. @视频号 ================= */}
        <div className="flex items-start">
          <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">@视频号</div>
          <div className="flex-1">
            <div className="h-[38px] border border-gray-300 rounded-lg px-3 flex items-center bg-gray-50/50 cursor-text hover:border-[#07c160] transition-colors focus-within:border-[#07c160] focus-within:ring-2 focus-within:ring-green-100 mb-2">
              <input
                type="text"
                placeholder="请输入关键词搜索"
                className="w-full bg-transparent outline-none text-sm text-gray-700"
                value={cfg.mentionUser || ''}
                onChange={e => set('mentionUser', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>@将追加到简介</span>
              <div className="border border-gray-300 rounded-md px-3 py-1 flex items-center justify-between w-[96px] bg-white cursor-pointer hover:border-[#07c160] transition-colors shadow-sm">
                <span>{cfg.mentionPosition || '末尾'}</span>
                <span className="text-[10px] text-gray-400">▼</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 5. 地理位置 & 合集 ================= */}
        <div className="flex items-start">
          <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">地理位置</div>
          <div className="flex-1">
            <div className="h-[38px] border border-gray-300 rounded-lg px-3 flex items-center justify-between bg-white cursor-pointer hover:border-[#07c160] transition-colors shadow-sm">
              <span className="text-[#333] text-sm">{poi || '不显示位置'}</span>
              <div className="flex gap-2 items-center text-gray-400">
                {poi && <span className="hover:text-gray-600 text-xs cursor-pointer" onClick={() => set('poi', '')}>✕</span>}
                <span className="text-[10px]">▼</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-start">
          <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">添加到合集</div>
          <div className="flex-1">
            <div className="h-[38px] border border-gray-300 rounded-lg px-3 flex items-center justify-between bg-white cursor-pointer hover:border-[#07c160] transition-colors shadow-sm">
              <select
                className="w-full bg-transparent outline-none text-sm text-gray-400 appearance-none cursor-pointer"
                value={cfg.collection || ''}
                onChange={e => set('collection', e.target.value)}
              >
                <option value="">请选择合集</option>
                <option value="3d-print">3D打印作品</option>
                <option value="tech-review">科技评测</option>
                <option value="tutorial">教程合集</option>
              </select>
            </div>
          </div>
        </div>

        {/* ================= 6. 扩展链接 / 活动 ================= */}
        <div className="flex items-start">
          <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">扩展链接</div>
          <div className="flex-1">
            <select
              className="h-[38px] border border-gray-300 rounded-lg bg-white w-full flex items-center px-3 cursor-pointer hover:border-[#07c160] transition-colors shadow-sm outline-none text-sm text-gray-400 appearance-none"
              value={linkType}
              onChange={e => set('linkType', e.target.value)}
            >
              <option value="">选择公众号文章链接</option>
              <option value="article">公众号文章</option>
              <option value="vip">会员专区</option>
              <option value="redenvelope">红包封面</option>
              <option value="product">商品</option>
              <option value="minigame">小游戏</option>
              <option value="minidrama">小程序短剧</option>
            </select>
            <div className="text-[11px] text-gray-400 mt-1.5">绑定有效链接，引导私域转化</div>
          </div>
        </div>

        <div className="flex items-start">
          <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">活动</div>
          <div className="flex-1">
            <div className="h-[38px] border border-gray-300 rounded-lg bg-white flex items-center justify-between px-3 cursor-text hover:border-[#07c160] transition-colors shadow-sm focus-within:border-[#07c160] focus-within:ring-2 focus-within:ring-green-100">
              <input
                type="text"
                placeholder="输入内容搜索官方活动"
                className="w-full bg-transparent outline-none text-sm text-gray-700"
                value={cfg.activity || ''}
                onChange={e => set('activity', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ================= 7. 商品挂车 ================= */}
        <div className="flex items-start">
          <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">商品挂车</div>
          <div className="flex-1">
            <div className="h-[38px] border border-gray-300 rounded-lg px-3 flex items-center bg-gray-50/50 hover:border-[#07c160] transition-colors focus-within:border-[#07c160] focus-within:ring-2 focus-within:ring-green-100">
              <input
                type="text"
                placeholder="粘贴商品ID / 链接"
                className="w-full bg-transparent outline-none text-sm text-gray-700"
                value={productLink}
                onChange={e => set('productLink', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ================= 8. 发布时间 ================= */}
        <div className="flex items-start border-t border-gray-100 pt-6">
          <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">发布时间</div>
          <div className="flex-1 flex gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="radio" name="wx_timing" className="accent-[#07c160] w-4 h-4" checked={scheduleType === 'now'} onChange={() => handleScheduleChange('now')} /> 立即发布
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="radio" name="wx_timing" className="accent-[#07c160] w-4 h-4" checked={scheduleType === 'platform'} onChange={() => handleScheduleChange('platform')} /> 定时发布
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="radio" name="wx_timing" className="accent-[#07c160] w-4 h-4" checked={scheduleType === 'local'} onChange={() => handleScheduleChange('local')} /> 本机定时
            </label>
          </div>
        </div>

        {scheduleType !== 'now' && (
          <div className="flex items-start">
            <div className="w-[110px] flex-shrink-0"></div>
            <div className="flex-1">
              <input
                type="datetime-local"
                className="w-full max-w-xs border border-gray-300 rounded-lg h-10 px-3 text-sm outline-none focus:border-[#07c160]"
                value={cfg.scheduleTime || ''}
                onChange={e => set('scheduleTime', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ================= 9. 原创声明 ================= */}
        <div className="flex items-start">
          <div className="w-[110px] flex-shrink-0 pt-1 text-right pr-4 text-gray-600 font-medium">原创声明</div>
          <div className="flex-1 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 font-medium">
              <input
                type="checkbox"
                className="accent-[#07c160] w-4 h-4 rounded-sm"
                checked={isOriginal}
                onChange={e => set('isOriginal', e.target.checked)}
              />
              视频为原创
            </label>
          </div>
        </div>

        {/* ================= 10. 短标题 ================= */}
        <div className="flex items-start">
          <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium flex justify-end items-center gap-1">
            短标题
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="概括视频主要内容，建议6-16个字符"
              className="w-full h-[38px] border border-gray-300 rounded-lg px-4 outline-none focus:border-[#07c160] focus:ring-2 focus:ring-green-100 transition-all bg-gray-50/50 text-sm shadow-sm"
              value={cfg.shortTitle || title}
              onChange={e => set('shortTitle', e.target.value)}
              maxLength={22}
            />
          </div>
        </div>

        {/* ================= 11. 追评 ================= */}
        <div className="flex items-start mt-2">
          <div className="w-[110px] flex-shrink-0 pt-2 text-right pr-4 text-gray-600 font-medium">抢占首评</div>
          <div className="flex-1">
            <div className="relative border border-gray-300 rounded-lg p-3 bg-white focus-within:border-[#07c160] focus-within:ring-2 focus-within:ring-green-100 transition-all shadow-sm">
              <div className="text-right text-[#07c160] text-[12px] mb-2 cursor-pointer font-medium hover:text-[#06ad56]">历史记录</div>
              <textarea
                rows={3}
                placeholder="设置第一条评论，引导用户加粉或转化..."
                className="w-full outline-none resize-none bg-transparent text-sm"
                value={firstComment}
                onChange={e => set('firstComment', e.target.value)}
              />
              <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded accent-[#07c160] w-4 h-4"
                    checked={cfg.pinComment ?? false}
                    onChange={e => set('pinComment', e.target.checked)}
                  /> 尝试置顶该评论
                </label>
              </div>
            </div>
            <div className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
              机器人将在微信视频号发布成功后，第一时间在评论区发布并尝试置顶此内容。
            </div>
          </div>
        </div>

        {/* ================= 底部按钮 ================= */}
        <div className="pt-6 flex justify-center gap-3 border-t border-gray-100">
          <button
            onClick={onSaveDraft}
            className="px-8 py-2.5 bg-white border border-gray-300 text-[#666] rounded-xl text-[13px] font-bold hover:bg-[#f9f9f9] transition shadow-sm"
          >
            存入草稿
          </button>
          <button
            onClick={onPublish}
            className="px-12 py-2.5 bg-[#07C160] text-white rounded-xl shadow-md text-[14px] font-black hover:bg-[#06ad56] transition active:scale-95 shadow-[#07C160]/30"
          >
            发表至视频号
          </button>
        </div>
      </div>
    </div>
  );
}
