/**
 * @file BilibiliPanel.jsx
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * B站沙盒发布表单 — v3 极客风换皮版
 * 7 大核心字段严丝合缝对齐 Publisher fillTemplate:
 *   {{USER_INPUT_TITLE}}    — title
 *   {{USER_INPUT_DESC}}     — desc
 *   {{USER_INPUT_TAGS}}     — tags (逗号分隔)
 *   {{USER_INPUT_DYNAMIC}}  — dynamic
 *   {{USER_INPUT_TID}}      — tid (分区ID)
 *   {{USER_INPUT_COPYRIGHT}}— copyright (1=自制, 2=转载)
 *   {{USER_INPUT_DTIME}}    — dtime (10位Unix时间戳, ≥4h)
 *
 * ⚠️ 状态/校验/generateBlueprint 严禁修改 — 只换皮囊
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  Send, Clock, AlertTriangle, X, Info,
  Hash, FileText, MessageSquare, FolderTree, ShieldCheck, Calendar, CornerDownLeft
} from 'lucide-react';
import PlatformHeader from './shared/PlatformHeader';

const ACCENT = '#FB7299';

// ═══════════════════════════════════════════
// 分区映射 (tid → 显示名)
// ═══════════════════════════════════════════
const TID_OPTIONS = [
  { tid: 161, label: '手工' },
  { tid: 174, label: '生活' },
  { tid: 138, label: '搞笑' },
  { tid: 188, label: '科技数码' },
  { tid: 4,   label: '游戏' },
  { tid: 17,  label: '单机游戏' },
  { tid: 160, label: '日常' },
  { tid: 3,   label: '音乐' },
  { tid: 5,   label: '动画' },
  { tid: 23,  label: '电影' },
  { tid: 11,  label: '电视剧' },
  { tid: 183, label: '知识' },
  { tid: 211, label: '美食' },
];

// ═══════════════════════════════════════════
// 胶囊切换器 (Segmented Control)
// ═══════════════════════════════════════════
function SegmentedControl({ options, value, onChange, variant = 'default' }) {
  const isAccent = variant === 'accent';
  return (
    <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-0.5 select-none">
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-200 ${
              active
                ? isAccent
                  ? 'bg-[#FB7299] text-white shadow-[0_2px_8px_rgba(251,114,153,0.35)]'
                  : 'bg-white text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {active && isAccent && (
              <span className="absolute inset-0 rounded-lg bg-white/10" />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════
// 内联标签输入 (Chips Inside Input)
// ═══════════════════════════════════════════
function TagsChipInput({ value, onChange }) {
  const chips = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const addChip = (raw) => {
    const trimmed = raw.replace(/^#/, '').trim();
    if (!trimmed) return;
    if (chips.includes(trimmed)) { setInput(''); return; }
    onChange([...chips, trimmed].join(','));
    setInput('');
  };

  const removeChip = (idx) => {
    onChange(chips.filter((_, i) => i !== idx).join(','));
    // keep focus on the wrapper after removal
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 min-h-[48px] px-3.5 py-2.5 bg-slate-50 border-2 rounded-2xl cursor-text transition-all duration-200 ${
        focused
          ? 'border-[#FB7299] shadow-[0_0_0_4px_rgba(251,114,153,0.08)]'
          : 'border-slate-200 hover:border-slate-300'
      }`}
      onClick={() => inputRef.current?.focus()}
    >
      {chips.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#FB7299]/10 text-[#FB7299] border border-[#FB7299]/20 select-none transition-all hover:bg-[#FB7299]/20"
        >
          <Hash size={10} className="opacity-50" />
          {chip}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeChip(i); }}
            className="ml-0.5 text-[#FB7299]/50 hover:text-[#FB7299] transition-colors rounded-full hover:bg-[#FB7299]/20 p-[1px]"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => {
          const v = e.target.value;
          if (v.endsWith(',') || v.endsWith('，')) { addChip(v.slice(0, -1)); return; }
          setInput(v);
        }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChip(input); } }}
        onBlur={() => { if (input.trim()) addChip(input); setFocused(false); }}
        onFocus={() => setFocused(true)}
        placeholder={chips.length === 0 ? '输入标签，按回车或逗号添加…' : ''}
        className="flex-1 min-w-[140px] bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400 py-0.5"
      />
      {input && (
        <span className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0 animate-in fade-in">
          <CornerDownLeft size={10} />
          Enter
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// 字段标签 (Stacked label-on-top)
// ═══════════════════════════════════════════
function FieldLabel({ icon: Icon, label, hint }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2 text-slate-500 text-[13px] font-semibold tracking-wide">
        <Icon size={15} className="text-slate-400" />
        {label}
      </div>
      {hint && (
        <span className="text-[11px] text-slate-400">{hint}</span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════
export default function BilibiliPanel({ config, onChange, onPublish, onSaveDraft, isPublishing = false }) {
  const cfg = config || {};
  const set = (field, value) => onChange && onChange(field, value);

  const title = cfg.title || '';
  const desc = cfg.desc || '';
  const tags = cfg.tags || '';
  const dynamic = cfg.dynamic || '';
  const tid = cfg.tid ?? 188;
  const copyright = cfg.copyright ?? 1;
  const scheduleType = cfg.scheduleType || 'now';
  const scheduleTime = cfg.scheduleTime || '';

  const setScheduleType = (type) => {
    set('scheduleType', type);
    set('scheduled', type !== 'now');
  };
  const setScheduleTime = (time) => { set('scheduleTime', time); };

  // ═══ dtime 校验: B站要求定时≥当前时间4小时 ═══
  const dtimeValidation = useMemo(() => {
    if (scheduleType === 'now') return { valid: true, unix: 0 };
    if (!scheduleTime) return { valid: false, error: '请选择定时发布时间', unix: 0 };
    const target = new Date(scheduleTime).getTime();
    const now = Date.now();
    const diffHours = (target - now) / 3600000;
    if (diffHours < 4) {
      return { valid: false, error: `必须≥当前时间4小时（当前距目标仅 ${diffHours.toFixed(1)} 小时）`, unix: 0 };
    }
    if (diffHours > 360) {
      return { valid: false, error: '定时发布不能超过15天', unix: 0 };
    }
    return { valid: true, unix: Math.floor(target / 1000) };
  }, [scheduleType, scheduleTime]);

  // ═══ 最小可选时间: 当前+4小时 ═══
  const minDatetime = useMemo(() => {
    const d = new Date(Date.now() + 4 * 3600000);
    return d.toISOString().slice(0, 16);
  }, []);

  // ═══ 生成最终发布图纸 ═══
  const generateBlueprint = () => {
    const dtimeUnix = scheduleType === 'now' ? 0 : dtimeValidation.unix;
    const blueprint = {
      title,
      desc,
      tags,
      dynamic,
      tid: Number(tid),
      copyright: Number(copyright),
      dtime: dtimeUnix,

      source: Number(copyright) === 1 ? '自制' : '转载',
      type: Number(copyright) === 1 ? '自制' : '转载',

      _meta: {
        scheduleType,
        scheduleTime: scheduleType !== 'now' ? scheduleTime : null,
        dtimeUnix,
        dtimeISO: dtimeUnix ? new Date(dtimeUnix * 1000).toISOString() : null,
        generatedAt: new Date().toISOString(),
      },
    };

    console.log(
      '%c▓▓ 最终发布图纸 ▓▓',
      'color: #FB7299; font-size: 16px; font-weight: bold; padding: 8px 0;'
    );
    console.log('%c════ 风控护照 — Request URL ════', 'color: #f59e0b; font-weight: bold;');
    console.log('%c(从 ProtocolAggregator 截获的带 w_rid/wts/csrf 的完整 URL)', 'color: #9ca3af; font-style: italic;');
    console.log('%c════ Request Body — 发送图纸 ════', 'color: #10b981; font-weight: bold;');
    console.log(JSON.stringify(blueprint, null, 2));
    console.log('%c════ 字段映射校验 ════', 'color: #6366f1; font-weight: bold;');
    console.table({
      '{{USER_INPUT_TITLE}}':    title,
      '{{USER_INPUT_DESC}}':     desc,
      '{{USER_INPUT_TAGS}}':     tags,
      '{{USER_INPUT_DYNAMIC}}':  dynamic,
      '{{USER_INPUT_TID}}':      Number(tid),
      '{{USER_INPUT_COPYRIGHT}}':Number(copyright),
      '{{USER_INPUT_DTIME}}':    dtimeUnix,
    });

    return blueprint;
  };

  // ── 字符计数工具 ──
  const charCount = (str) => str.length;

  return (
    <div className="min-h-full bg-[#f7f8fa] animate-in fade-in duration-300 py-8 pb-32 font-sans px-4 sm:px-8">
      <div className="max-w-[780px] w-full mx-auto">

        {/* ═══ 主卡片 ═══ */}
        <div className="w-full bg-white rounded-2xl p-8 sm:p-10 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_8px_40px_rgba(0,0,0,0.04)] font-sans text-[14px] text-[#333]">

          <PlatformHeader
            icon="B"
            name="B站(哔哩哔哩) — 沙盒发布工作台"
            accentColor={ACCENT}
            badgeAccent="bg-pink-50 text-[#FB7299] border-pink-100"
          />

          <div className="space-y-8">

            {/* ═══ 1. 标题 {{USER_INPUT_TITLE}} ═══ */}
            <div>
              <FieldLabel
                icon={FileText}
                label="视频标题"
                hint={`${charCount(title)} / 80`}
              />
              <input
                type="text"
                value={title}
                onChange={e => set('title', e.target.value)}
                maxLength={80}
                placeholder="给你的视频起一个吸引人的标题…"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#FB7299] focus:bg-white focus:shadow-[0_0_0_4px_rgba(251,114,153,0.08)]"
              />
            </div>

            {/* ═══ 2. 简介 {{USER_INPUT_DESC}} ═══ */}
            <div>
              <FieldLabel
                icon={FileText}
                label="视频简介"
                hint={`${charCount(desc)} / 250`}
              />
              <textarea
                rows={3}
                value={desc}
                onChange={e => set('desc', e.target.value)}
                maxLength={250}
                placeholder="介绍一下你的作品内容…"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm text-slate-800 outline-none transition-all duration-200 resize-none placeholder:text-slate-400 hover:border-slate-300 focus:border-[#FB7299] focus:bg-white focus:shadow-[0_0_0_4px_rgba(251,114,153,0.08)]"
              />
            </div>

            {/* ═══ 3. 标签 {{USER_INPUT_TAGS}} ═══ */}
            <div>
              <FieldLabel
                icon={Hash}
                label="视频标签"
                hint={`${tags ? tags.split(',').filter(Boolean).length : 0} 个标签`}
              />
              <TagsChipInput value={tags} onChange={v => set('tags', v)} />
            </div>

            {/* ═══ 4. 粉丝动态 {{USER_INPUT_DYNAMIC}} ═══ */}
            <div>
              <FieldLabel
                icon={MessageSquare}
                label="粉丝动态"
                hint={`${charCount(dynamic)} / 233`}
              />
              <input
                type="text"
                value={dynamic}
                onChange={e => set('dynamic', e.target.value)}
                maxLength={233}
                placeholder="发布时同步到动态的转发语…"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#FB7299] focus:bg-white focus:shadow-[0_0_0_4px_rgba(251,114,153,0.08)]"
              />
            </div>

            {/* ═══ 5 + 6. 分区 & 稿件类型 (双列) ═══ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* ── 分区 {{USER_INPUT_TID}} ── */}
              <div>
                <FieldLabel icon={FolderTree} label="内容分区" />
                <div className="relative">
                  <select
                    value={tid}
                    onChange={e => set('tid', Number(e.target.value))}
                    className="w-full h-[46px] px-4 pr-10 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm text-slate-700 cursor-pointer outline-none appearance-none transition-all duration-200 hover:border-slate-300 focus:border-[#FB7299] focus:bg-white focus:shadow-[0_0_0_4px_rgba(251,114,153,0.08)]"
                  >
                    {TID_OPTIONS.map(opt => (
                      <option key={opt.tid} value={opt.tid}>{opt.label}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 ml-1">
                  tid={tid}
                </p>
              </div>

              {/* ── 稿件类型 {{USER_INPUT_COPYRIGHT}} ── */}
              <div>
                <FieldLabel icon={ShieldCheck} label="稿件类型" />
                <SegmentedControl
                  options={[
                    { value: 1, label: '自制' },
                    { value: 2, label: '转载' },
                  ]}
                  value={copyright}
                  onChange={v => set('copyright', v)}
                  variant="accent"
                />
                <p className="text-[11px] text-slate-400 mt-1.5 ml-1">
                  copyright={copyright}{copyright === 1 ? ' · 需上传视频文件' : ' · 需填写来源链接'}
                </p>
              </div>
            </div>

            {/* ═══ 7. 发布时间 {{USER_INPUT_DTIME}} ═══ */}
            <div>
              <FieldLabel
                icon={Calendar}
                label="发布时间"
                hint={scheduleType === 'timed' && dtimeValidation.valid ? `Unix ${dtimeValidation.unix}` : undefined}
              />
              <SegmentedControl
                options={[
                  { value: 'now', label: '立即发布' },
                  { value: 'timed', label: '定时发布' },
                ]}
                value={scheduleType}
                onChange={setScheduleType}
              />

              {scheduleType === 'timed' && (
                <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-200">
                  <div className="relative">
                    <input
                      type="datetime-local"
                      className={`w-full sm:max-w-sm h-[46px] px-4 pr-10 border-2 rounded-2xl text-sm outline-none transition-all duration-200 ${
                        scheduleTime && !dtimeValidation.valid
                          ? 'border-red-300 bg-red-50/50 text-red-700 focus:border-red-400 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.08)]'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 focus:border-[#FB7299] focus:bg-white focus:shadow-[0_0_0_4px_rgba(251,114,153,0.08)]'
                      }`}
                      value={scheduleTime}
                      min={minDatetime}
                      onChange={e => setScheduleTime(e.target.value)}
                    />
                    <Calendar size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  </div>

                  {scheduleTime && !dtimeValidation.valid && (
                    <div className="flex items-center gap-2 mt-2.5 px-1 text-xs text-red-500 font-medium animate-in fade-in">
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 shrink-0">
                        <AlertTriangle size={12} className="text-red-500" />
                      </div>
                      {dtimeValidation.error}
                    </div>
                  )}

                  {scheduleTime && dtimeValidation.valid && (
                    <div className="flex items-center gap-2 mt-2.5 px-1 text-xs text-emerald-600 font-medium animate-in fade-in">
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 shrink-0">
                        <Clock size={12} className="text-emerald-600" />
                      </div>
                      将于 {new Date(dtimeValidation.unix * 1000).toLocaleString('zh-CN')} 发布
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mt-2 px-1 text-[11px] text-slate-400">
                    <Info size={11} />
                    定时发布必须设定在当前时间的 4 小时之后
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ═══ 底部操作栏 ═══ */}
        <div className="flex items-center justify-center gap-4 pt-8">
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={isPublishing}
            className="px-8 py-3 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl text-[13px] font-bold transition-all duration-200 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 hover:translate-y-[-1px] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] active:translate-y-0 active:shadow-none disabled:opacity-40 disabled:pointer-events-none"
          >
            存入草稿
          </button>
          <button
            type="button"
            onClick={() => {
              const bp = generateBlueprint();
              onPublish && onPublish(bp);
            }}
            disabled={isPublishing}
            className="px-10 py-3 text-white rounded-2xl text-[14px] font-black transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-2.5 hover:translate-y-[-1px] hover:shadow-[0_8px_24px_rgba(251,114,153,0.4)] shadow-[0_4px_16px_rgba(251,114,153,0.3)]"
            style={{ backgroundColor: ACCENT }}
          >
            <Send size={17} />
            生成最终发布图纸
          </button>
        </div>

        {/* ═══ 底部提示 ═══ */}
        <p className="text-center text-[11px] text-slate-400 mt-5">
          点击"生成最终发布图纸"将在浏览器控制台输出完整数据蓝图，用于对接 Publisher 洗稿引擎
        </p>

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 导出校验函数 (供 PublishTask.jsx 使用)
// ═══════════════════════════════════════════
export function validateBilibili(config) {
  const errors = [];
  if (!config.title || config.title.trim().length < 1) errors.push({ field: 'title', message: '请输入视频标题' });
  if (!config.desc || config.desc.trim().length < 1) errors.push({ field: 'desc', message: '请输入视频简介' });
  if (!config.tags || config.tags.trim().length < 1) errors.push({ field: 'tags', message: '请添加至少一个标签' });
  if (!config.dynamic || config.dynamic.trim().length < 1) errors.push({ field: 'dynamic', message: '请输入粉丝动态/转发语' });
  if (config.tid == null) errors.push({ field: 'tid', message: '请选择分区' });

  if (config.scheduleType && config.scheduleType !== 'now') {
    if (!config.scheduleTime) {
      errors.push({ field: 'scheduleTime', message: '定时发布必须设置时间' });
    } else {
      const target = new Date(config.scheduleTime).getTime();
      const diffHours = (target - Date.now()) / 3600000;
      if (diffHours < 4) errors.push({ field: 'scheduleTime', message: '定时发布必须≥4小时后' });
    }
  }

  return { valid: errors.length === 0, errors };
}
