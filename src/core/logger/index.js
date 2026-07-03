/**
 * @file src/core/logger/index.js
 * @description 统一日志系统
 */

// 日志级别
export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  SILENT: 'SILENT'
};

// 默认配置
const DEFAULT_CONFIG = {
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  format: 'timestamp | level | [module] | message',
  prefix: '[YuMatrix]'
};

// 内部状态
let currentLevel = DEFAULT_CONFIG.level;
let modulePrefix = 'core';

/**
 * 格式化日志消息
 */
function formatMessage(level, message, args) {
  const timestamp = new Date().toISOString();
  const argsStr = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
  return `${timestamp} | ${level} | [${modulePrefix}] | ${message}${argsStr}`;
}

/**
 * 设置当前模块前缀
 */
export function setModule(moduleName) {
  modulePrefix = moduleName;
}

/**
 * 设置日志级别
 */
export function setLogLevel(level) {
  currentLevel = level;
}

/**
 * 检查级别是否启用
 */
function isLevelEnabled(level) {
  const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
  return levels.indexOf(level) >= levels.indexOf(currentLevel);
}

/**
 * 核心日志函数
 */
function log(level, message, ...args) {
  if (!isLevelEnabled(level)) return;

  const formatted = formatMessage(level, message, args);

  switch (level) {
    case LogLevel.DEBUG:
      console.log(formatted);
      break;
    case LogLevel.INFO:
      console.info(formatted);
      break;
    case LogLevel.WARN:
      console.warn(formatted);
      break;
    case LogLevel.ERROR:
      console.error(formatted);
      break;
    default:
      console.log(formatted);
  }
}

// 导出日志方法
export const logger = {
  debug: (message, ...args) => log(LogLevel.DEBUG, message, args),
  info: (message, ...args) => log(LogLevel.INFO, message, args),
  warn: (message, ...args) => log(LogLevel.WARN, message, args),
  error: (message, ...args) => log(LogLevel.ERROR, message, args),
  success: (message, ...args) => {
    const timestamp = new Date().toISOString();
    const msg = `${timestamp} | SUCCESS | [${modulePrefix}] | ${message}`;
    console.log(`\x1b[32m${msg}\x1b[0m`);
  },
  fatal: (message, ...args) => {
    const timestamp = new Date().toISOString();
    const msg = `${timestamp} | FATAL | [${modulePrefix}] | ${message}`;
    console.error(`\x1b[31;1m${msg}\x1b[0m`);
    process.exit(1);
  },
  // 重置模块前缀
  resetModule: () => { modulePrefix = 'core'; }
};

// 快捷导出
export const debug = logger.debug;
export const info = logger.info;
export const warn = logger.warn;
export const error = logger.error;
export const success = logger.success;
export const fatal = logger.fatal;

// 导出配置
export { DEFAULT_CONFIG };
