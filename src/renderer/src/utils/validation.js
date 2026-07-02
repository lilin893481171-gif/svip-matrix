import { validateBaijiahao } from '../components/BaijiahaoPanel';
import { validateWechatChannels } from '../components/WechatChannelsPanel';
import { validateDouyin } from '../components/DouyinPanel';
import { validateKuaishou } from '../components/KuaishouPanel';
import { validateBilibili } from '../components/BilibiliPanel';

const VALIDATORS = {
  '百家号': validateBaijiahao,
  '微信视频号': validateWechatChannels,
  '抖音': validateDouyin,
  '快手': validateKuaishou,
  'B站': validateBilibili,
};

export function validatePlatform(config, platformName) {
  const validator = VALIDATORS[platformName];
  if (!validator) return { valid: true, errors: [] };
  return validator(config);
}

export function getValidationErrorMessages(result) {
  if (result.valid) return [];
  return result.errors.map(e => e.message);
}
