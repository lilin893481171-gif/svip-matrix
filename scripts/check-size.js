import fs from 'fs';
import path from 'path';

// 读取刚刚打包出来的文件
const filePath = path.resolve('repomix-output.xml');

if (!fs.existsSync(filePath)) {
  console.log('⚠️ 找不到 repomix-output.xml 文件');
  process.exit(1);
}

const stats = fs.statSync(filePath);
const fileSizeInKB = stats.size / 1024;

console.log(`\n📦 当前打包文件大小: ${fileSizeInKB.toFixed(2)} KB`);

// Claude 3.5 Sonnet 大约能处理 600KB - 800KB 的纯文本
if (fileSizeInKB > 800) {
  console.log('❌❌❌ [拦截警告] 文件太大了！超过了 600KB！');
  console.log('❌❌❌ 发给 Claude 百分之百会报 400 Token 超载错误。');
  console.log('❌❌❌ 请检查是否打包了无用的 .enc 加密文件或前端静态资源！\n');
} else {
  console.log('✅✅✅ [安检通过] 文件很小，上下文完全安全，可以放心发给 Claude！\n');
}