export const meta = { platform: '小红书', version: 20, minAppVersion: '3.0.0' };

// 模拟睡眠函数
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function execute(api) {
  const { broadcast, interactions, task } = api;
  
  broadcast('🚀 启动全新v20小红书发布脚本...');
  broadcast('📋 任务信息: ' + task.title);
  
  try {
    // 模拟导航到创作者中心
    broadcast('🧭 导航到创作者中心...');
    await sleep(1000);
    
    // 模拟点击发布按钮 - 使用增强的选择器
    broadcast('🖱️ 寻找发布按钮...');
    const publishFound = await interactions.flexibleClick([
      '发布笔记', '发布视频', '发布内容', '新建笔记', '创作中心', '发布', 
      '.publish-btn', '.create-btn', '.publish-button', '[data-testid="publish-button"]'
    ], 15000);
    
    if (!publishFound) {
      throw new Error('❌ 无法找到发布按钮，请检查页面状态');
    }
    
    broadcast('✅ 成功点击发布按钮!');
    await sleep(2000);
    
    // 模拟等待发布页面加载
    broadcast('⏳ 等待发布页面加载...');
    const pageReady = await interactions.waitForSelector(
      '.title-wrap, .note-title, input[placeholder*="标题"], .title-input, [data-testid="title-input"]', 
      30000
    );
    
    if (!pageReady) {
      throw new Error('❌ 发布页面加载超时');
    }
    
    broadcast('✅ 发布页面已就绪!');
    
    // 模拟成功完成
    broadcast('🎉 全新v20脚本执行成功!');
    broadcast('💡 此为测试版本，验证脚本加载机制');
    
    return { 
      success: true, 
      message: '全新v20脚本执行成功',
      version: 20,
      test: true
    };
    
  } catch (error) {
    broadcast('❌ 执行出错: ' + error.message);
    throw error;
  }
}