/**
 * @file platform-regression-test.js
 * 平台回归测试脚本
 */

import { EngineSelector } from './engine-selector.js';
import { XiaohongshuAdapter } from '../rpa/adapters/xiaohongshu-adapter.js';
import { DouyinAdapter } from '../rpa/adapters/douyin-adapter.js';
import { WechatChannelsAdapter } from '../rpa/adapters/wechat-channels-adapter.js';
import { BilibiliAdapter } from '../rpa/adapters/bilibili-adapter.js';

// 模拟测试数据
const testVideoPath = '/path/to/test/video.mp4';
const testTask = {
  title: '测试视频标题',
  description: '测试视频描述',
  tags: ['测试', '标签'],
  scheduleTime: '',
  accountId: 'test-account-id'
};

// 测试平台配置
const testPlatforms = [
  { name: 'xiaohongshu', adapter: XiaohongshuAdapter, enabled: true },
  { name: 'douyin', adapter: DouyinAdapter, enabled: true },
  { name: 'wechat-channels', adapter: WechatChannelsAdapter, enabled: true },
  { name: 'bilibili', adapter: BilibiliAdapter, enabled: true }
];

/**
 * 运行平台回归测试
 */
export async function runPlatformRegressionTest() {
  console.log('🚀 开始全平台回归测试...\n');

  const results = [];
  const engineSelector = new EngineSelector();

  // 选择引擎（使用内嵌浏览器模式进行测试）
  const engine = await engineSelector.selectEngine();
  console.log(`🔧 测试引擎类型: ${engine.getEngineType()}\n`);

  for (const platform of testPlatforms) {
    if (!platform.enabled) {
      console.log(`⏭️ 跳过平台 ${platform.name}（未启用）\n`);
      continue;
    }

    console.log(`🧪 开始测试平台: ${platform.name}`);

    try {
      // 创建适配器实例
      const adapter = new platform.adapter();

      // 模拟初始化（在实际测试中需要真实的 browser 和 page 对象）
      // 这里只是验证适配器能够正确创建和初始化
      console.log(`✅ ${platform.name} 适配器创建成功`);

      // 验证适配器实现了所有必需的方法
      const requiredMethods = ['init', 'navigateToPublish', 'uploadAndCaptureId', 'fillForm', 'publish', 'cleanup'];
      const missingMethods = requiredMethods.filter(method => typeof adapter[method] !== 'function');

      if (missingMethods.length > 0) {
        throw new Error(`适配器缺少方法: ${missingMethods.join(', ')}`);
      }

      console.log(`✅ ${platform.name} 适配器方法验证通过`);

      // 记录成功结果
      results.push({
        platform: platform.name,
        status: 'success',
        message: '适配器创建和方法验证通过'
      });

      console.log(`✅ 平台 ${platform.name} 测试通过\n`);

    } catch (error) {
      console.error(`❌ 平台 ${platform.name} 测试失败:`, error.message);

      // 记录失败结果
      results.push({
        platform: platform.name,
        status: 'failed',
        message: error.message
      });

      console.log(`\n`);
    }
  }

  // 输出测试总结
  console.log('📋 回归测试总结:');
  console.log('================');

  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  results.forEach(result => {
    const statusIcon = result.status === 'success' ? '✅' : '❌';
    console.log(`${statusIcon} ${result.platform}: ${result.message}`);
  });

  console.log(`\n📊 测试结果: ${successCount} 成功, ${failedCount} 失败`);

  if (failedCount === 0) {
    console.log('🎉 所有平台回归测试通过！');
  } else {
    console.log('⚠️ 部分平台测试失败，请检查上述错误信息。');
  }

  return {
    success: failedCount === 0,
    results,
    summary: {
      total: results.length,
      success: successCount,
      failed: failedCount
    }
  };
}

export default runPlatformRegressionTest;