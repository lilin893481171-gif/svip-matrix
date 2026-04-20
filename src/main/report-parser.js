import fs from 'fs';

/**
 * 全域报表中央解析中枢 (支持 6 大平台完美解析)
 * @param {string} filePath - 下载到本地的 CSV/TSV 临时文件路径
 * @param {string} platform - 平台名称
 * @returns {Array} - 清洗后的标准 30 天数据数组
 */
export function parseReportFile(filePath, platform) {
  try {
    // 1. 读取文件内容
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l);
    
    if (lines.length < 2) return [];

    const parsedData = [];
    let startIndex = 1;

    // 💥 视频号防具：动态嗅探真实表头，跳过前两行的“服务器缓存误差”等废话
    if (platform === '微信视频号') {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('时间') && lines[i].includes('播放')) {
          startIndex = i + 1;
          break;
        }
      }
    }

    // 2. 逐行剥离
    for (let i = startIndex; i < lines.length; i++) {
      const rawLine = lines[i].replace(/"/g, '');
      
      // 💥 百度防具 1：同时支持逗号 (CSV) 和 制表符 (TSV) 
      const cols = rawLine.split(/,|\t/);
      if (cols.length < 2) continue;

      let dateStr = cols[0];

      // 过滤废话行
      if (dateStr.includes('累计') || dateStr.includes('总计') || dateStr.includes('指标') || dateStr.includes('日期')) continue;

      // 💥 百度防具 2：连体数字日期刺客破译 (如 20260302 -> 2026-03-02)
      if (/^\d{8}$/.test(dateStr)) {
        dateStr = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      } else {
        // 其他平台的常规万能清洗
        dateStr = dateStr.replace(/年|月/g, '-').replace(/日/g, '').replace(/\//g, '-');
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else {
          continue; 
        }
      }

      let plays = 0, fans_gain = 0, interactions = 0;

      // 🎯 ================= 各平台专属字段精确狙击 ================= 🎯
      if (platform === '抖音') {
        plays = parseInt(cols[1]) || 0;
      } 
      else if (platform === '快手') {
        plays = parseInt(cols[1]) || 0;
        fans_gain = parseInt(cols[3]) || 0;
        interactions = (parseInt(cols[4]) || 0) + (parseInt(cols[5]) || 0) + (parseInt(cols[6]) || 0);
      } 
      else if (platform === 'B站') {
        plays = parseInt(cols[1]) || 0;
        fans_gain = parseInt(cols[3]) || 0;
        interactions = (parseInt(cols[4]) || 0) + (parseInt(cols[5]) || 0) + (parseInt(cols[6]) || 0) + 
                       (parseInt(cols[7]) || 0) + (parseInt(cols[8]) || 0) + (parseInt(cols[9]) || 0);
      }
      else if (platform === '微信视频号') {
        plays = parseInt(cols[1]) || 0;
        fans_gain = parseInt(cols[6]) || 0; 
        interactions = (parseInt(cols[3]) || 0) + (parseInt(cols[4]) || 0) + (parseInt(cols[5]) || 0); 
      }
      else if (platform === '百家号') {
        // 百家号长坐标系：1阅读, 4评论, 6点赞, 8收藏, 10分享, 12涨粉
        plays = parseInt(cols[1]) || 0; 
        fans_gain = parseInt(cols[12]) || 0;
        interactions = (parseInt(cols[4]) || 0) + (parseInt(cols[6]) || 0) + (parseInt(cols[8]) || 0) + (parseInt(cols[10]) || 0);
      }
      else if (platform === '小红书') {
        plays = parseInt(cols[1]) || 0;
        fans_gain = 0; 
        interactions = 0;
      }

      parsedData.push({ date: dateStr, plays, fans_gain, interactions });
    }

    return parsedData;

  } catch (error) {
    console.error(`[报表解析引擎] 解析 ${platform} 表格致命失败:`, error);
    return [];
  }
}