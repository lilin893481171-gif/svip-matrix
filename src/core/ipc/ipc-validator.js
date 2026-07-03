/**
 * @file src/core/ipc/ipc-validator.js
 * @description IPC 验证器 - 通道验证和请求参数验证
 */

import { IPC_CHANNELS, IPC_CHANNEL_VALIDATION } from './ipc-registry.js';

export class IPCValidator {
  /**
   * 验证 IPC 通道名称格式
   */
  validateChannel(channel) {
    // 通道名必须是字符串
    if (typeof channel !== 'string') {
      return false;
    }

    // 通道名不能为空
    if (channel.length === 0) {
      return false;
    }

    // 通道名不能包含危险字符
    if (/[<>'"&]/.test(channel)) {
      return false;
    }

    // 通道名应该在预定义的通道列表中
    return Object.values(IPC_CHANNELS).includes(channel);
  }

  /**
   * 验证请求参数
   */
  validateRequest(channel, args) {
    // 获取通道的验证规则
    const validationRules = IPC_CHANNEL_VALIDATION[channel];

    // 如果没有验证规则，认为是有效的
    if (!validationRules) {
      return { valid: true };
    }

    // 如果没有参数但有必需参数，返回错误
    if (!args || args.length === 0) {
      if (validationRules.required && validationRules.required.length > 0) {
        return {
          valid: false,
          error: `Missing required parameters: ${validationRules.required.join(', ')}`
        };
      }
      return { valid: true };
    }

    // 获取第一个参数（通常是对象）
    const payload = args[0];

    // 如果必需参数存在，验证它们
    if (validationRules.required) {
      for (const requiredParam of validationRules.required) {
        if (payload[requiredParam] === undefined || payload[requiredParam] === null) {
          return {
            valid: false,
            error: `Missing required parameter: ${requiredParam}`
          };
        }
      }
    }

    // 验证可选参数（如果存在）
    if (validationRules.optional && payload && typeof payload === 'object') {
      const allAllowedParams = [...(validationRules.required || []), ...validationRules.optional];
      for (const param in payload) {
        if (!allAllowedParams.includes(param)) {
          return {
            valid: false,
            error: `Unexpected parameter: ${param}`
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * 验证发送事件的通道
   */
  validateSendChannel(channel) {
    // 发送事件的通道验证可以更宽松一些
    if (typeof channel !== 'string') {
      return false;
    }

    if (channel.length === 0) {
      return false;
    }

    if (/[<>'"&]/.test(channel)) {
      return false;
    }

    return true;
  }

  /**
   * 验证接收事件的通道
   */
  validateReceiveChannel(channel) {
    // 接收事件的通道验证可以更宽松一些
    if (typeof channel !== 'string') {
      return false;
    }

    if (channel.length === 0) {
      return false;
    }

    if (/[<>'"&]/.test(channel)) {
      return false;
    }

    return true;
  }
}