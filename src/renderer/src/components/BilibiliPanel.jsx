import React from 'react';
import PlatformHeader from './shared/PlatformHeader';
import CharInput from './shared/CharInput';
import CharTextarea from './shared/CharTextarea';
import CoverUpload from './shared/CoverUpload';
import TagInput from './shared/TagInput';
import SchedulePicker from './shared/SchedulePicker';
import FirstComment from './shared/FirstComment';
import FooterActions from './shared/FooterActions';
import LabeledField from './shared/LabeledField';
import VisibilityRadio from './shared/VisibilityRadio';
import useScheduleState from '../hooks/useScheduleState';

const ACCENT = '#FB7299';

const CATEGORIES = ['科技数码', '游戏', '生活', '知识', '动画', '音乐', '舞蹈', '影视', '娱乐', '鬼畜', '时尚', '其他'];
const DECLARATION_OPTIONS = ['无需声明', '含AI生成内容', '内容为转载', '含虚构演绎内容', '内容含营销信息', '个人观点'];
const SUPPLEMENTARY_DECLARATIONS = ['无', '内容可能引人不适', '内容含有高危险行为', '请理性适度消费', '未成年人请在监护人指导下浏览'];
const SUGGESTED_TOPICS = ['#花生AI创作', '#在剑网3玩大富翁', '#第一视角讨生活'];

const TYPE_OPTIONS = [
  { value: '自制', label: '自制' },
  { value: '转载', label: '转载' },
];

export default function BilibiliPanel({ config, onChange, onPublish, onSaveDraft, isPublishing = false }) {
  const cfg = config || {};
  const set = (field, value) => onChange && onChange(field, value);

  const title = cfg.title || '';
  const desc = cfg.desc || '';
  const tags = cfg.tags || '';
  const coverUrl = cfg.coverUrl || '';
  const videoType = cfg.type || '自制';
  const category = cfg.category || '科技数码';
  const dynamic = cfg.dynamic || '';
  const firstComment = cfg.firstComment || '';
  const pinComment = cfg.pinComment ?? false;
  const allowRecreate = cfg.allowRecreate ?? false;
  const commercial = cfg.commercial ?? false;
  const noReprint = cfg.noReprint ?? true;
  const enableCharge = cfg.enableCharge ?? true;
  const dolbyAudio = cfg.dolbyAudio ?? false;
  const hifiAudio = cfg.hifiAudio ?? false;
  const watermark = cfg.watermark ?? false;
  const closeDanmu = cfg.closeDanmu ?? false;
  const closeComment = cfg.closeComment ?? false;
  const selectedComment = cfg.selectedComment ?? false;
  const declaration = cfg.declaration || '';
  const supplementaryDeclaration = cfg.supplementaryDeclaration || '无';
  const { scheduleType, scheduleTime, handleScheduleChange, setScheduleTime } = useScheduleState(cfg, set);

  return (
    <div className="bg-[#f5f6f7] min-h-full animate-in fade-in duration-300 py-6 pb-32 font-sans px-4 sm:px-8">
      <div className="max-w-[840px] w-full mx-auto">
        <div className="w-full bg-white rounded-xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 font-sans text-[14px] text-[#333]">

          <PlatformHeader icon="B" name="B站(哔哩哔哩)" accentColor={ACCENT} badgeAccent="bg-pink-50 text-[#FB7299] border-pink-100" />

          <div className="space-y-6">

            <LabeledField label="标题" required labelWidth="w-[110px]">
              <CharInput value={title} onChange={v => set('title', v)} maxLength={80} accentColor={ACCENT} placeholder="请输入标题" />
            </LabeledField>

            <LabeledField label="封面" required labelWidth="w-[110px]" topPadding="pt-1">
              <CoverUpload value={coverUrl} onChange={v => set('coverUrl', v)} accentColor={ACCENT} />
            </LabeledField>

            <LabeledField label="类型" required labelWidth="w-[110px]" topPadding="pt-1">
              <VisibilityRadio value={videoType} onChange={v => set('type', v)} accentColor={ACCENT} options={TYPE_OPTIONS} name="bili_type" />
            </LabeledField>

            <LabeledField label="分区" required labelWidth="w-[110px]">
              <select
                className="w-[180px] h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#FB7299] transition-colors shadow-sm focus:border-[#FB7299] focus:ring-2 focus:ring-pink-100 outline-none text-sm"
                value={category}
                onChange={e => set('category', e.target.value)}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </LabeledField>

            <LabeledField label="标签" required labelWidth="w-[110px]">
              <TagInput
                value={tags}
                onChange={v => set('tags', v)}
                accentColor={ACCENT}
                placeholder="请输入标签进行搜索 (按回车添加)"
                suggestedTags={SUGGESTED_TOPICS}
              />
            </LabeledField>

            <LabeledField label="简介" labelWidth="w-[110px]">
              <CharTextarea
                value={desc}
                onChange={v => set('desc', v)}
                maxLength={250}
                accentColor={ACCENT}
                rows={3}
                placeholder="介绍一下你的作品吧"
              />
            </LabeledField>

            {/* ========== 版权与变现 — 平台特有 ========== */}
            <LabeledField label="版权与变现" labelWidth="w-[110px]" topPadding="pt-1">
              <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" className="w-4 h-4 rounded-sm" style={{ accentColor: ACCENT }}
                    checked={noReprint} onChange={e => set('noReprint', e.target.checked)} />
                  未经作者允许 禁止转载
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" className="w-4 h-4 rounded-sm" style={{ accentColor: ACCENT }}
                    checked={allowRecreate} onChange={e => set('allowRecreate', e.target.checked)} />
                  允许二创
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" className="w-4 h-4 rounded-sm" style={{ accentColor: ACCENT }}
                    checked={enableCharge} onChange={e => set('enableCharge', e.target.checked)} />
                  <span className="flex items-center gap-1">启用充电面板 <span className="text-gray-400 text-xs">（需加入计划）</span></span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" className="w-4 h-4 rounded-sm" style={{ accentColor: ACCENT }}
                    checked={commercial} onChange={e => set('commercial', e.target.checked)} />
                  增加商业推广信息
                </label>
                <div className="col-span-2 mt-3 space-y-3">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">创作声明</div>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#FB7299] transition-colors shadow-sm focus:border-[#FB7299] focus:ring-2 focus:ring-pink-100 outline-none text-sm"
                      value={declaration}
                      onChange={e => set('declaration', e.target.value)}
                    >
                      <option value="">必选声明</option>
                      {DECLARATION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    <select
                      className="h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer hover:border-[#FB7299] transition-colors shadow-sm focus:border-[#FB7299] focus:ring-2 focus:ring-pink-100 outline-none text-sm"
                      value={supplementaryDeclaration}
                      onChange={e => set('supplementaryDeclaration', e.target.value)}
                    >
                      <option value="无">补充声明（可选）</option>
                      {SUPPLEMENTARY_DECLARATIONS.filter(d => d !== '无').map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </LabeledField>

            {/* ========== 视听与互动 — 平台特有 ========== */}
            <LabeledField label="视听与互动" labelWidth="w-[110px]" topPadding="pt-1">
              <div className="bg-gray-50/80 p-4 rounded-lg border border-gray-200">
                <div className="text-xs font-bold text-gray-500 mb-3 tracking-wider">高级音效设定</div>
                <div className="flex gap-6 mb-4 pb-4 border-b border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 font-medium hover:text-[#FB7299] transition-colors">
                    <input type="checkbox" className="w-4 h-4 rounded-sm" style={{ accentColor: ACCENT }}
                      checked={dolbyAudio} onChange={e => set('dolbyAudio', e.target.checked)} /> 杜比音效
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 font-medium hover:text-[#FB7299] transition-colors">
                    <input type="checkbox" className="w-4 h-4 rounded-sm" style={{ accentColor: ACCENT }}
                      checked={hifiAudio} onChange={e => set('hifiAudio', e.target.checked)} /> Hi-Res无损音质
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 ml-auto">
                    <input type="checkbox" className="w-4 h-4 rounded-sm" style={{ accentColor: ACCENT }}
                      checked={watermark} onChange={e => set('watermark', e.target.checked)} /> 开启水印
                  </label>
                </div>
                <div className="text-xs font-bold text-gray-500 mb-3 tracking-wider">互动与弹幕管控</div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="checkbox" className="w-4 h-4 rounded-sm" style={{ accentColor: ACCENT }}
                      checked={closeDanmu} onChange={e => set('closeDanmu', e.target.checked)} /> 关闭弹幕
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="checkbox" className="w-4 h-4 rounded-sm" style={{ accentColor: ACCENT }}
                      checked={closeComment} onChange={e => set('closeComment', e.target.checked)} /> 关闭评论
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                    <input type="checkbox" className="w-4 h-4 rounded-sm" style={{ accentColor: ACCENT }}
                      checked={selectedComment} onChange={e => set('selectedComment', e.target.checked)} /> 开启精选评论
                  </label>
                </div>
              </div>
            </LabeledField>

            <LabeledField label="粉丝动态" labelWidth="w-[110px]">
              <CharInput value={dynamic} onChange={v => set('dynamic', v)} maxLength={233} accentColor={ACCENT} placeholder="有趣的动态描述，会增加被小编捕捉为热门动态的机会哟~" showClearButton={false} />
            </LabeledField>

            <LabeledField label="发布时间" labelWidth="w-[110px]" topPadding="pt-1">
              <div>
                <SchedulePicker
                  scheduleType={scheduleType}
                  scheduleTime={scheduleTime}
                  onScheduleTypeChange={handleScheduleChange}
                  onScheduleTimeChange={setScheduleTime}
                  accentColor={ACCENT}
                  name="bili_timing"
                />
                {scheduleType !== 'now' && (
                  <div className="text-[11px] text-gray-400 mt-1">可选择距离当前最早≥5分钟/最晚≤15天的时间</div>
                )}
              </div>
            </LabeledField>

            <LabeledField label="抢占首评" labelWidth="w-[110px]">
              <FirstComment
                value={firstComment}
                onChange={v => set('firstComment', v)}
                accentColor={ACCENT}
                pinComment={pinComment}
                onPinCommentChange={v => set('pinComment', v)}
                placeholder="作为UP主发布第一条置顶评论，引导一键三连..."
                hintText="底层机器人将在稿件发布成功且过审后，自动执行置顶神评操作。"
              />
            </LabeledField>

          </div>
        </div>

        <FooterActions
          onSaveDraft={onSaveDraft}
          onPublish={onPublish}
          accentColor={ACCENT}
          publishLabel="立即投稿"
          isPublishing={isPublishing}
        />
      </div>
    </div>
  );
}

export function validateBilibili(config) {
  const errors = [];
  if (!config.title || config.title.trim().length < 1) errors.push({ field: 'title', message: '请输入视频标题' });
  if (!config.coverUrl) errors.push({ field: 'coverUrl', message: '请上传视频封面' });
  if (!config.type) errors.push({ field: 'type', message: '请选择视频类型' });
  if (!config.category) errors.push({ field: 'category', message: '请选择视频分区' });
  if (!config.tags || config.tags.trim().length < 1) errors.push({ field: 'tags', message: '请添加视频标签' });
  if (config.scheduleType !== 'now' && !config.scheduleTime) errors.push({ field: 'scheduleTime', message: '定时发布必须设置时间' });
  return { valid: errors.length === 0, errors };
}
