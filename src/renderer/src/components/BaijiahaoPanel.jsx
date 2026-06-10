import React from 'react';
import PlatformHeader from './shared/PlatformHeader';
import CharInput from './shared/CharInput';
import CoverUpload from './shared/CoverUpload';
import TagInput from './shared/TagInput';
import SchedulePicker from './shared/SchedulePicker';
import FooterActions from './shared/FooterActions';
import LabeledField from './shared/LabeledField';
import useScheduleState from '../hooks/useScheduleState';

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

const ACCENT = '#2B60FF';

export default function BaijiahaoPanel({ config, onChange, onPublish, onSaveDraft, isPublishing = false }) {
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
  const { scheduleType, scheduleTime, handleScheduleChange, setScheduleTime } = useScheduleState(cfg, set);

  return (
    <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
      <div className="max-w-[840px] w-full mx-auto">
        <div className="w-full bg-white rounded-xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 font-sans text-[14px] text-[#333]">

          <PlatformHeader icon="百" name="百家号" accentColor={ACCENT} badgeAccent="bg-blue-50 text-[#2B60FF] border-blue-100" />

          <div className="space-y-6">

            <LabeledField label="标题" labelWidth="w-[110px]">
              <CharInput value={title} onChange={v => set('title', v)} maxLength={50} accentColor={ACCENT} placeholder="请输入" />
            </LabeledField>

            <LabeledField label="封面" required labelWidth="w-[110px]" topPadding="pt-1">
              <CoverUpload value={coverUrl} onChange={v => set('coverUrl', v)} accentColor={ACCENT} />
            </LabeledField>

            <LabeledField label="话题" labelWidth="w-[110px]">
              <TagInput value={tags} onChange={v => set('tags', v)} accentColor={ACCENT} />
            </LabeledField>

            {/* 分类 (CMS 双级联动 — 平台特有,保留内联) */}
            <LabeledField label="分类" labelWidth="w-[110px]">
              <div className="flex items-center gap-3">
                <select
                  className="w-[130px] h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer outline-none text-sm"
                  value={category1}
                  onChange={e => { set('category1', e.target.value); set('category2', CMS_CATEGORIES[e.target.value]?.[0] || ''); }}
                >
                  {Object.keys(CMS_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  className="w-[130px] h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer outline-none text-sm"
                  value={category2}
                  onChange={e => set('category2', e.target.value)}
                >
                  {(CMS_CATEGORIES[category1] || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="text-[#2B60FF] text-sm cursor-pointer hover:text-blue-700 font-medium ml-1" onClick={() => { set('category1', ''); set('category2', ''); }}>清空</span>
              </div>
            </LabeledField>

            {/* 水印 (平台特有) */}
            <LabeledField label="水印" labelWidth="w-[110px]">
              <select
                className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer outline-none text-sm"
                value={watermark}
                onChange={e => set('watermark', e.target.value)}
              >
                <option value="">请选择水印设置</option>
                {WATERMARK_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </LabeledField>

            {/* 创作声明 (平台特有) */}
            <LabeledField label="创作声明" labelWidth="w-[110px]">
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">必选声明</div>
                  <select
                    className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer outline-none text-sm"
                    value={requiredDeclaration}
                    onChange={e => set('requiredDeclaration', e.target.value)}
                  >
                    {REQUIRED_DECLARATIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">补充声明（可选）</div>
                  <select
                    className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer outline-none text-sm"
                    value={supplementaryDeclaration}
                    onChange={e => set('supplementaryDeclaration', e.target.value)}
                  >
                    {SUPPLEMENTARY_DECLARATIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
            </LabeledField>

            <LabeledField label="定时发布" labelWidth="w-[110px]" topPadding="pt-1">
              <SchedulePicker
                scheduleType={scheduleType}
                scheduleTime={scheduleTime}
                onScheduleTypeChange={handleScheduleChange}
                onScheduleTimeChange={setScheduleTime}
                accentColor={ACCENT}
                name="bjh_timing"
              />
            </LabeledField>

          </div>
        </div>

        <FooterActions
          onSaveDraft={onSaveDraft}
          onPublish={onPublish}
          accentColor={ACCENT}
          publishLabel="立刻发布至百家号"
          isPublishing={isPublishing}
        />
      </div>
    </div>
  );
}

export function validateBaijiahao(config) {
  const errors = [];
  if (!config.title || config.title.trim().length < 1) errors.push({ field: 'title', message: '请输入视频标题' });
  if (!config.coverUrl) errors.push({ field: 'coverUrl', message: '请上传视频封面' });
  if (!config.category1) errors.push({ field: 'category1', message: '请选择一级分类' });
  if (config.scheduleType !== 'now' && !config.scheduleTime) errors.push({ field: 'scheduleTime', message: '定时发布必须设置时间' });
  return { valid: errors.length === 0, errors };
}
