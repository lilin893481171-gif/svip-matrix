import React from 'react';
import PlatformHeader from './shared/PlatformHeader';
import CharInput from './shared/CharInput';
import CharTextarea from './shared/CharTextarea';
import CoverUpload from './shared/CoverUpload';
import CoverRatioSelect from './shared/CoverRatioSelect';
import TagInput from './shared/TagInput';
import MentionInput from './shared/MentionInput';
import SchedulePicker from './shared/SchedulePicker';
import FirstComment from './shared/FirstComment';
import FooterActions from './shared/FooterActions';
import LabeledField from './shared/LabeledField';
import VisibilityRadio from './shared/VisibilityRadio';
import useScheduleState from '../hooks/useScheduleState';

const ACCENT = '#ff2442';

const COVER_RATIOS = ['3:4', '1:1', '4:3', '16:9', '9:16'];
const COLLECTION_OPTIONS = ['好物分享', '数码评测', '生活Vlog', '穿搭日常'];
const CONTENT_DECLARATIONS = ['AI生成内容', '商业推广', '品牌合作', '产品体验'];
const CITIES = ['杭州', '北京', '上海', '广州', '深圳'];

const VISIBILITY_OPTIONS = [
  { value: 'public', label: '公开' },
  { value: 'private', label: '仅自己可见' },
];

export default function XiaohongshuPanel({ config, onChange, onPublish, onSaveDraft, isPublishing = false }) {
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
  const isOriginal = cfg.isOriginal ?? true;
  const declaration = cfg.declaration || '';
  const visibility = cfg.visibility || 'public';
  const firstComment = cfg.firstComment || '';
  const pinComment = cfg.pinComment ?? false;
  const { scheduleType, scheduleTime, handleScheduleChange, setScheduleTime } = useScheduleState(cfg, set);

  return (
    <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
      <div className="max-w-[840px] w-full mx-auto">
        <div className="w-full bg-white rounded-xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 font-sans text-[14px] text-[#333]">

          <PlatformHeader icon="小" name="小红书" accentColor={ACCENT} badgeAccent="bg-red-50 text-[#ff2442] border-red-100" />

          <div className="space-y-6">

            <LabeledField label="标题" labelWidth="w-[110px]">
              <CharInput value={title} onChange={v => set('title', v)} maxLength={20} accentColor={ACCENT} placeholder="请输入" />
            </LabeledField>

            <LabeledField label="封面" required labelWidth="w-[110px]" topPadding="pt-1">
              <div className="flex gap-6 flex-1">
                <CoverUpload value={coverUrl} onChange={v => set('coverUrl', v)} accentColor={ACCENT} />
                <CoverRatioSelect value={coverRatio} onChange={v => set('coverRatio', v)} options={COVER_RATIOS} accentColor={ACCENT} />
              </div>
            </LabeledField>

            <LabeledField label="简介" labelWidth="w-[110px]">
              <CharTextarea
                value={desc}
                onChange={v => set('desc', v)}
                maxLength={1000}
                accentColor={ACCENT}
                rows={3}
                placeholder="说点什么吧..."
                hint={'不要在简介中输入带#的话题，请使用下方话题功能'}
                toolbar={
                  <button type="button" className="px-3 py-1 bg-white border border-gray-200 rounded-md text-gray-600 text-xs flex items-center gap-1.5 hover:text-[#ff2442] hover:border-[#ff2442] transition-colors shadow-sm">
                    <span>☺</span><span>表情</span>
                  </button>
                }
              />
            </LabeledField>

            <LabeledField label="话题" labelWidth="w-[110px]">
              <TagInput value={tags} onChange={v => set('tags', v)} accentColor={ACCENT} />
            </LabeledField>

            <LabeledField label="@用户" labelWidth="w-[110px]">
              <MentionInput
                value={mentionUser}
                onChange={v => set('mentionUser', v)}
                accentColor={ACCENT}
                position={mentionPosition}
                onPositionChange={v => set('mentionPosition', v)}
                searchPlaceholder="请输入关键词搜索"
              />
            </LabeledField>

            <LabeledField label="地理位置" labelWidth="w-[110px]">
              <select
                className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#ff2442] transition-colors shadow-sm outline-none text-sm text-gray-400"
                value={poi}
                onChange={e => set('poi', e.target.value)}
              >
                <option value="">请选择地理位置</option>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </LabeledField>

            <LabeledField label="添加到合集" labelWidth="w-[110px]">
              <select
                className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#ff2442] transition-colors shadow-sm outline-none text-sm text-gray-400"
                value={collection}
                onChange={e => set('collection', e.target.value)}
              >
                <option value="">请选择合集</option>
                {COLLECTION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </LabeledField>

            <LabeledField label="原创声明" labelWidth="w-[110px]" topPadding="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer text-sm text-gray-700 leading-relaxed font-medium">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded-sm mt-0.5"
                  style={{ accentColor: ACCENT }}
                  checked={isOriginal}
                  onChange={e => set('isOriginal', e.target.checked)}
                />
                <span>声明后将获得原创笔记标记，且平台会保护你的作品</span>
              </label>
            </LabeledField>

            <LabeledField label="内容声明" labelWidth="w-[110px]">
              <select
                className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#ff2442] transition-colors shadow-sm outline-none text-sm text-gray-400"
                value={declaration}
                onChange={e => set('declaration', e.target.value)}
              >
                <option value="">选择内容性质声明</option>
                {CONTENT_DECLARATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </LabeledField>

            <LabeledField label="权限设置" labelWidth="w-[110px]" topPadding="pt-1">
              <VisibilityRadio value={visibility} onChange={v => set('visibility', v)} accentColor={ACCENT} options={VISIBILITY_OPTIONS} name="xhs_privacy" />
            </LabeledField>

            <LabeledField label="发布时间" labelWidth="w-[110px]" topPadding="pt-1">
              <SchedulePicker
                scheduleType={scheduleType}
                scheduleTime={scheduleTime}
                onScheduleTypeChange={handleScheduleChange}
                onScheduleTimeChange={setScheduleTime}
                accentColor={ACCENT}
                name="xhs_timing"
              />
            </LabeledField>

            <LabeledField label="抢占首评" labelWidth="w-[110px]">
              <FirstComment
                value={firstComment}
                onChange={v => set('firstComment', v)}
                accentColor={ACCENT}
                pinComment={pinComment}
                onPinCommentChange={v => set('pinComment', v)}
                placeholder="设置第一条评论，抢占沙发流量..."
                hintText="任务执行时，底层幽灵机甲会确保小红书创作者页面在前台保持活跃，确保首评追加成功。"
              />
            </LabeledField>

          </div>
        </div>

        <FooterActions
          onSaveDraft={onSaveDraft}
          onPublish={onPublish}
          accentColor={ACCENT}
          publishLabel="发表至小红书"
          isPublishing={isPublishing}
        />
      </div>
    </div>
  );
}

export function validateXiaohongshu(config) {
  const errors = [];
  if (!config.title || config.title.trim().length < 1) errors.push({ field: 'title', message: '请输入视频标题' });
  if (!config.coverUrl) errors.push({ field: 'coverUrl', message: '请上传视频封面' });
  if (config.scheduleType !== 'now' && !config.scheduleTime) errors.push({ field: 'scheduleTime', message: '定时发布必须设置时间' });
  return { valid: errors.length === 0, errors };
}
