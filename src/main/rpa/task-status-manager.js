/**
 * @file task-status-manager.js
 * 任务状态管理器 - 实时状态反馈和用户引导
 */
import { checkXHSSessionValidity, refreshXHSSession } from '../session-store.js';

export class TaskStatusManager {
  constructor(taskId, platform) {
    this.taskId = taskId;
    this.platform = platform;
    this.status = 'pending'; // pending, checking_login, need_qr_code, uploading, filling_form, completed, error
    this.messages = [];
    this.callbacks = [];
    this.startTime = Date.now();
    this.lastUpdate = Date.now();
    this.sessionCheckCount = 0; // 会话检查计数器
  }

  /**
   * 注册状态变更回调
   */
  onStatusChange(callback) {
    this.callbacks.push(callback);
    return this;
  }

  /**
   * 广播状态更新
   */
  broadcast(message, status = this.status) {
    const statusUpdate = {
      taskId: this.taskId,
      platform: this.platform,
      status: status,
      message: message,
      timestamp: Date.now(),
      elapsed: Date.now() - this.startTime,
      messages: [...this.messages]
    };

    this.lastUpdate = Date.now();
    this.messages.push({
      message,
      status,
      timestamp: Date.now()
    });

    // 触发所有回调
    this.callbacks.forEach(callback => {
      try {
        callback(statusUpdate);
      } catch (e) {
        console.error('[TaskStatusManager] 回调错误:', e.message);
      }
    });

    return statusUpdate;
  }

  /**
   * 检查是否需要登录
   */
  async checkLoginStatus(interactions) {
    try {
      this.broadcast('检查登录状态...', 'checking_login');

      // 对于小红书平台，先检查会话有效性
      if (this.platform === '小红书') {
        const session = interactions.wc.session;
        const accountId = this.taskId.split('_')[0]; // 假设taskId格式为accountId_timestamp

        const sessionCheck = await checkXHSSessionValidity(session, accountId);
        if (!sessionCheck.isValid) {
          this.broadcast(`⚠️ 会话失效: ${sessionCheck.reason}`, 'session_expired');

          // 尝试刷新会话
          this.broadcast('🔄 尝试刷新会话...', 'refreshing_session');
          const refreshed = await refreshXHSSession(interactions.wc, accountId);
          if (refreshed) {
            this.broadcast('✅ 会话刷新成功', 'session_refreshed');
          } else {
            this.broadcast('❌ 会话刷新失败，需要重新登录', 'need_login');
          }
        }
      }

      // 检查页面是否显示登录界面
      const isLoginPage = await interactions.evaluate(`
        !!document.querySelector('.login, .signin, [class*="login"], [class*="signin"], .signin-btn, .login-btn') ||
        document.location.href.includes('login') ||
        document.location.href.includes('signin') ||
        document.querySelector('.qr-code') ||
        document.querySelector('.scan-login')
      `);

      if (isLoginPage) {
        // 进一步检查是否有扫码界面
        const hasQRCode = await interactions.evaluate(`
          !!document.querySelector('.qr-code, .scan-code, [class*="qr"], [class*="scan"], .wx-code, .wechat-code, [alt*="二维码"], [src*="qr"], [src*="code"]')
        `);

        if (hasQRCode) {
          this.broadcast('检测到扫码登录界面！请使用小红书App扫描二维码登录', 'need_qr_code');
          return 'need_qr_code';
        } else {
          this.broadcast('检测到登录界面，请手动登录后继续', 'need_login');
          return 'need_login';
        }
      } else {
        // 检查是否已经登录
        const isLoggedIn = await interactions.evaluate(`
          !!document.querySelector('.avatar, .user-profile, [class*="user"], .account-btn, .profile-btn') &&
          !document.querySelector('.login, .signin, [class*="login"], [class*="signin"]')
        `);

        if (isLoggedIn) {
          this.broadcast('✅ 账号已登录，准备上传', 'ready');
          return 'ready';
        } else {
          this.broadcast('❓ 无法确定登录状态，尝试继续', 'unknown');
          return 'unknown';
        }
      }
    } catch (e) {
      this.broadcast(`检查登录状态时出错: ${e.message}`, 'error');
      return 'error';
    }
  }

  /**
   * 等待用户扫码
   */
  async waitForQRCode(interactions, maxWait = 60000) {
    this.broadcast('等待用户扫码...', 'waiting_for_qr');

    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      // 检查登录状态
      const loginStatus = await this.checkLoginStatus(interactions);

      if (loginStatus === 'ready') {
        this.broadcast('✅ 扫码完成，账号已登录', 'logged_in');
        return true;
      }

      if (loginStatus === 'error') {
        return false;
      }

      // 检查是否取消或超时
      const stillWaitingForQR = await interactions.evaluate(`
        !!document.querySelector('.qr-code, .scan-code, [class*="qr"], [class*="scan"], .wx-code, .wechat-code')
      `);

      if (!stillWaitingForQR) {
        this.broadcast('二维码界面已消失', 'qr_disappeared');
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const elapsed = Date.now() - startTime;
    if (elapsed >= maxWait) {
      this.broadcast('⏰ 等待扫码超时', 'qr_timeout');
      return false;
    }

    return true;
  }

  /**
   * 开始上传流程
   */
  async startUpload(interactions, videoPath) {
    try {
      this.broadcast('📁 开始上传视频文件...', 'uploading');

      // 这里会调用原有的上传逻辑
      const uploadResult = await interactions.safeUpload(videoPath, ['点击上传', '拖拽', '拖拽视频', '上传文件']);

      if (uploadResult) {
        this.broadcast('✅ 视频上传成功', 'upload_success');
        return true;
      } else {
        this.broadcast('❌ 视频上传失败', 'upload_failed');
        return false;
      }
    } catch (e) {
      this.broadcast(`🚫 上传失败: ${e.message}`, 'upload_error');
      return false;
    }
  }

  /**
   * 开始填表流程
   */
  async startFormFill(interactions, task) {
    try {
      this.broadcast('📝 开始填写发布信息...', 'filling_form');

      // 填写标题
      if (task.title) {
        this.broadcast('📝 填写标题...', 'filling_title');
        await interactions.humanType('div.publish-page-content-base input, input[placeholder*="标题"], input.title-input', task.title);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 填写描述
      if (task.desc) {
        this.broadcast('📝 填写描述...', 'filling_desc');
        await interactions.humanType('div.editor-content > div > div, .ql-editor, [contenteditable="true"]', task.desc);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 填写标签
      if (task.tags) {
        this.broadcast('🏷️ 添加标签...', 'filling_tags');
        await interactions.clickElement('div.editor-content > div > div, .ql-editor, [contenteditable="true"]');
        await interactions.pressKey('End');

        for (const tag of task.tags.split(/[\s,，]+/).filter(Boolean).slice(0, 6)) {
          await interactions.typeText(`#${tag}`, { delay: 90 });
          await new Promise(resolve => setTimeout(resolve, 1500));

          const capsuleBox = await interactions.getBoundingBox('div.is-selected > span.name, .tag-item');
          if (capsuleBox) {
            await interactions.mouseClick(capsuleBox.x + capsuleBox.width / 2, capsuleBox.y + capsuleBox.height / 2);
          } else {
            await interactions.pressKey('Enter');
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // 设置封面
      if (task.coverPath) {
        this.broadcast('🖼️ 设置封面...', 'setting_cover');
        try {
          if (await interactions.flexibleClick(['修改封面', '设置封面'])) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await interactions.flexibleClick(['上传封面']);
            await interactions.setFileInput(task.coverPath);
            await new Promise(resolve => setTimeout(resolve, 2500));
            await interactions.flexibleClick(['确定', '完成', '确认']);
          }
        } catch (e) {
          this.broadcast(`⚠️ 封面设置失败: ${e.message}`, 'cover_error');
        }
      }

      this.broadcast('✅ 信息填写完成', 'form_completed');
      return true;
    } catch (e) {
      this.broadcast(`❌ 填表失败: ${e.message}`, 'form_error');
      return false;
    }
  }

  /**
   * 完成任务
   */
  complete(success = true, message = '任务完成') {
    const status = success ? 'completed' : 'error';
    this.broadcast(message, status);

    const duration = Date.now() - this.startTime;
    console.log(`[TaskStatusManager] 任务完成 - 状态: ${status}, 耗时: ${duration}ms, 消息数: ${this.messages.length}`);
  }

  /**
   * 获取状态统计
   */
  getStats() {
    return {
      taskId: this.taskId,
      platform: this.platform,
      status: this.status,
      message: this.messages[this.messages.length - 1]?.message || '',
      totalMessages: this.messages.length,
      elapsed: Date.now() - this.startTime,
      lastUpdate: this.lastUpdate,
      startTime: this.startTime
    };
  }
}