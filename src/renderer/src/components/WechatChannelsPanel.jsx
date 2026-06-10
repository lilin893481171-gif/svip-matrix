import React from 'react';
import PlatformHeader from './shared/PlatformHeader';
import CharInput from './shared/CharInput';
import CharTextarea from './shared/CharTextarea';
import CoverUpload from './shared/CoverUpload';
import TagInput from './shared/TagInput';
import MentionInput from './shared/MentionInput';
import SchedulePicker from './shared/SchedulePicker';
import FirstComment from './shared/FirstComment';
import FooterActions from './shared/FooterActions';
import LabeledField from './shared/LabeledField';
import ProductLink from './shared/ProductLink';
import useScheduleState from '../hooks/useScheduleState';

const ACCENT = '#07C160';

export default function WechatChannelsPanel({ config, onChange, onPublish, onSaveDraft, activeVideo, isPublishing = false }) {
  const cfg = config || {};
  const set = (field, value) => onChange && onChange(field, value);

  const title = cfg.title || '';
  const desc = cfg.desc || '';
  const poi = cfg.poi || '';
  const productLink = cfg.productLink || '';
  const isOriginal = cfg.isOriginal ?? cfg.original ?? true;
  const firstComment = cfg.firstComment || '';
  const linkType = cfg.linkType || '';
  const coverPath = cfg.coverUrl || cfg.coverPath || '';
  const coverHorizontal = cfg.coverHorizontal || '';
  const { scheduleType, scheduleTime, handleScheduleChange, setScheduleTime } = useScheduleState(cfg, set);

  return (
    <div className="w-full max-w-[720px] bg-white rounded-xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 font-sans text-[14px] text-[#333]">

      <PlatformHeader
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.03 2 11c0 2.76 1.43 5.23 3.68 6.84.23.16.34.46.25.73l-.46 1.55c-.09.31.25.56.52.4l1.62-.95c.21-.13.47-.16.7-.08 1.15.42 2.4.65 3.69.65 5.52 0 10-4.03 10-9s-4.48-9-10-9zm0 15c-1.13 0-2.22-.2-3.23-.57-.45-.15-.96-.1-1.37.08l-2.61 1.52.74-2.49c.14-.49-.03-1.02-.4-1.34C3.34 12.87 2.2 10.96 2.2 8.8c0-3.97 4.39-7.2 9.8-7.2s9.8 3.23 9.8 7.2c0 3.98-4.39 7.2-9.8 7.2z"/></svg>}
        name="微信视频号"
        accentColor={ACCENT}
        badgeAccent="bg-green-50 text-[#07c160] border-green-100"
      />

      <div className="space-y-6">

        <LabeledField label="标题" required labelWidth="w-[110px]">
          <CharInput value={title} onChange={v => set('title', v)} maxLength={30} accentColor={ACCENT} placeholder="请输入视频标题" showClearButton={false} />
        </LabeledField>

        <LabeledField label="封面" required labelWidth="w-[110px]" topPadding="pt-1">
          <CoverUpload
            value={coverPath}
            onChange={v => set('coverPath', v)}
            accentColor={ACCENT}
            secondCover={{ value: coverHorizontal, onChange: v => set('coverHorizontal', v), label: '封面/4:3' }}
          />
        </LabeledField>

        <LabeledField label="简介" labelWidth="w-[110px]">
          <CharTextarea value={desc} onChange={v => set('desc', v)} maxLength={1000} accentColor={ACCENT} rows={3} />
        </LabeledField>

        <LabeledField label="话题" labelWidth="w-[110px]">
          <TagInput value={cfg.tags || ''} onChange={v => set('tags', v)} accentColor={ACCENT} hint="每个话题最多50个字，按回车键确认; 最多可添加10个" />
        </LabeledField>

        <LabeledField label="@视频号" labelWidth="w-[110px]">
          <MentionInput value={cfg.mentionUser || ''} onChange={v => set('mentionUser', v)} accentColor={ACCENT} position={cfg.mentionPosition || '末尾'} onPositionChange={v => set('mentionPosition', v)} label="@视频号" searchPlaceholder="请输入关键词搜索" />
        </LabeledField>

        <LabeledField label="地理位置" labelWidth="w-[110px]">
          <select className="h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer outline-none text-sm w-full" value={poi} onChange={e => set('poi', e.target.value)}>
            <option value="">不显示位置</option>
            {['北京市','上海市','广州市','深圳市','杭州市','成都市','南京市','武汉市','重庆市'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </LabeledField>

        <LabeledField label="添加到合集" labelWidth="w-[110px]">
          <select className="h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer outline-none text-sm w-full" value={cfg.collection || ''} onChange={e => set('collection', e.target.value)}>
            <option value="">请选择合集</option>
            <option value="3d-print">3D打印作品</option>
            <option value="tech-review">科技评测</option>
            <option value="tutorial">教程合集</option>
          </select>
        </LabeledField>

        <LabeledField label="扩展链接" labelWidth="w-[110px]">
          <select className="h-[38px] border border-gray-300 rounded-lg bg-white w-full px-3 cursor-pointer outline-none text-sm" value={linkType} onChange={e => set('linkType', e.target.value)}>
            <option value="">选择公众号文章链接</option>
            <option value="article">公众号文章</option>
            <option value="vip">会员专区</option>
            <option value="redenvelope">红包封面</option>
            <option value="product">商品</option>
            <option value="minigame">小游戏</option>
            <option value="minidrama">小程序短剧</option>
          </select>
        </LabeledField>

        <LabeledField label="活动" labelWidth="w-[110px]">
          <div className="h-[38px] border border-gray-300 rounded-lg bg-white flex items-center px-3">
            <input type="text" placeholder="输入内容搜索官方活动" className="w-full bg-transparent outline-none text-sm" value={cfg.activity || ''} onChange={e => set('activity', e.target.value)} />
          </div>
        </LabeledField>

        <LabeledField label="商品挂车" labelWidth="w-[110px]">
          <ProductLink
            value={productLink}
            onChange={v => set('productLink', v)}
            accentColor={ACCENT}
            placeholder="粘贴商品ID / 链接"
            showButton={false}
          />
        </LabeledField>

        <LabeledField label="发布时间" labelWidth="w-[110px]" topPadding="pt-1">
          <SchedulePicker scheduleType={scheduleType} scheduleTime={scheduleTime} onScheduleTypeChange={handleScheduleChange} onScheduleTimeChange={setScheduleTime} accentColor={ACCENT} name="wx_timing" />
        </LabeledField>

        <LabeledField label="原创声明" labelWidth="w-[110px]" topPadding="pt-1">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 font-medium">
            <input type="checkbox" className="w-4 h-4 rounded-sm" style={{ accentColor: ACCENT }} checked={isOriginal} onChange={e => set('isOriginal', e.target.checked)} />
            视频为原创
          </label>
        </LabeledField>

        <LabeledField label="短标题" labelWidth="w-[110px]">
          <input type="text" placeholder="概括视频主要内容，建议6-16个字符" className="w-full h-[38px] border border-gray-300 rounded-lg px-4 outline-none text-sm bg-gray-50/50" value={cfg.shortTitle || title} onChange={e => set('shortTitle', e.target.value)} maxLength={22} />
        </LabeledField>

        <LabeledField label="抢占首评" labelWidth="w-[110px]">
          <FirstComment
            value={firstComment}
            onChange={v => set('firstComment', v)}
            accentColor={ACCENT}
            pinComment={cfg.pinComment ?? false}
            onPinCommentChange={v => set('pinComment', v)}
            placeholder="设置第一条评论，引导用户加粉或转化..."
            hintText="机器人将在微信视频号发布成功后，第一时间在评论区发布并尝试置顶此内容。"
            pinLabel="尝试置顶该评论"
          />
        </LabeledField>

      </div>

      <FooterActions onSaveDraft={onSaveDraft} onPublish={onPublish} accentColor={ACCENT} publishLabel="发表至视频号" isPublishing={isPublishing} />
    </div>
  );
}

export function validateWechatChannels(config) {
  const errors = [];
  if (!config.title || config.title.trim().length < 1) errors.push({ field: 'title', message: '请输入视频标题' });
  if (!config.coverUrl && !config.coverPath) errors.push({ field: 'coverPath', message: '请上传视频封面' });
  if (config.scheduleType !== 'now' && !config.scheduleTime) errors.push({ field: 'scheduleTime', message: '定时发布必须设置时间' });
  return { valid: errors.length === 0, errors };
}
