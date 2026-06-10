/**
 * @file interactions-interface.js
 * @title 浏览器交互接口定义
 * @desc 定义 RPA 脚本与浏览器后端之间的契约。
 *       当前实现：NativeInteractions (Electron webContents + CDP)
 *       未来实现：ChromeInteractions (Puppeteer 连接真实 Chrome)
 *
 * 切换方式：修改 BrowserController 创建的 interactions 实例类型即可，
 *          RPA 脚本零改动。
 */

/**
 * @interface BrowserInteractions
 *
 * 所有 RPA 脚本通过此接口与浏览器交互。
 * 任何新实现必须实现以下所有方法。
 */
export const INTERFACE_METHODS = {

  // ═══════════════════════════════════════════════
  // 页面操作
  // ═══════════════════════════════════════════════

  /** 在页面中执行 JavaScript 并返回结果 */
  evaluate: 'async (script: string) => any',

  /** 导航到指定 URL */
  navigate: 'async (url: string) => void',

  /** 等待 URL 匹配正则 */
  waitForUrl: 'async (regex: RegExp, timeout?: number) => void',

  /** 关闭页面上的遮罩层/弹窗 */
  gentleCloseOverlays: 'async () => void',

  // ═══════════════════════════════════════════════
  // 文件注入
  // ═══════════════════════════════════════════════

  /** 智能文件注入（优先 OS 级，降级 CDP） */
  smartInjectFile: 'async (filePath: string, opts?: object) => boolean',

  /** CDP 直注文件（降级方案） */
  injectFileDirect: 'async (filePath: string, opts?: object) => boolean',

  // ═══════════════════════════════════════════════
  // 鼠标操作
  // ═══════════════════════════════════════════════

  /** 人类鼠标移动（贝塞尔曲线 + 随机偏移） */
  humanMouseMove: 'async (x: number, y: number) => void',

  /** 在指定坐标点击（完整序列：移动 → down → up） */
  humanClickAtCoordinates: 'async (x: number, y: number) => void',

  /** 按文字查找元素并点击 */
  humanClickByText: 'async (text: string) => boolean',

  /** 多关键词弹性点击 */
  flexibleClick: 'async (texts: string[], timeout?: number) => boolean',

  /**
   * 在指定坐标执行原生鼠标点击（底层操作，仅用于需要精确控制的场景）。
   * 封装了 mouseDown + mouseUp，不包含 mouseMove。
   * 实现时应生成 isTrusted=true 的事件。
   */
  nativeClickAt: 'async (x: number, y: number) => void',

  // ═══════════════════════════════════════════════
  // 键盘操作
  // ═══════════════════════════════════════════════

  /** 人类打字（逐字 + 随机延迟） */
  humanTypeText: 'async (text: string) => void',

  /** CDP 级文本插入（快速，不模拟人类节奏） */
  insertTextViaCDP: 'async (text: string) => void',

  /** 按键 */
  pressKey: 'async (key: string) => void',

  /** AX 树打字（回退方案） */
  humanTypeByAX: 'async (opts: object, text: string) => void',

  // ═══════════════════════════════════════════════
  // 查询 / 截图
  // ═══════════════════════════════════════════════

  /** 查找自定义元素的边界框 */
  findCustomElementBox: 'async (tagName: string) => object | null',

  /** 截图 */
  captureScreenshotBase64: 'async (quality?: number) => string',

  // ═══════════════════════════════════════════════
  // 防检测
  // ═══════════════════════════════════════════════

  /** 注入指纹伪装脚本 */
  applyFingerprintHardening: 'async () => void',
};

/**
 * 已实现的后端：
 *   1. NativeInteractions  — src/main/native-interactions.js (Electron + CDP)
 *   2. ChromeInteractions  — src/main/chrome-interactions.js (Puppeteer + 真实 Chrome，待实现)
 *
 * 切换入口：src/main/rpa/browser-controller.js
 *   当前：this.nativeInteractions = new NativeInteractions(wc, mainWindow)
 *   未来：根据配置选择 backend
 *     if (config.backend === 'chrome') {
 *       this.interactions = new ChromeInteractions(chromeInstance)
 *     } else {
 *       this.interactions = new NativeInteractions(wc, mainWindow)
 *     }
 *
 * RPA 脚本始终只使用 this.i（BrowserInteractions 接口），不关心底层实现。
 */
