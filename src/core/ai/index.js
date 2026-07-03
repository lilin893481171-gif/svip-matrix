/**
 * @file src/core/ai/index.js
 * @description AI 能力统一入口 - 提供 LLM 路由和 AI 相关服务
 */

// AI 相关服务导出
export { parseUserIntent } from '../../renderer/src/services/llmRouteService.js';
export { uploadToCloudinary } from '../../renderer/src/services/cloudinaryService.js';
export { uploadToR2, isLargeAttachment, formatSize, generateDownloadCard, SIZE_THRESHOLD } from '../../renderer/src/services/r2Upload.js';

// AI 配置导出 (从 matrixConfig 迁移)
import {
  MATRIX_WORKER_URL,
  CF_API_DOMAIN,
  WORKER_ROUTES,
  PLATFORM_COPY_PROMPTS,
  COPY_STYLES
} from '../config/index.js';

export const AI_CONFIG = {
  MATRIX_WORKER_URL,
  CF_API_DOMAIN,
  WORKER_ROUTES,
  PLATFORM_COPY_PROMPTS,
  COPY_STYLES
};
