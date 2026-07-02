/**
 * @file PayloadTransformer.js
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Cloud-Rules Driven AST Payload Transformer
 * 云端规则驱动的AST级JSON变形引擎
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ═══════════════════════════════════════════
// 规则路径解析器 (支持 nested.path, array[0].field 等)
// ═══════════════════════════════════════════

/**
 * 解析路径字符串为可操作的路径段数组
 * 支持: a.b.c, a[0].b, a[0][1].c, videos[0].cid
 * @param {string} path - 路径字符串
 * @returns {Array<string|number>} 路径段数组
 */
function parsePath(path) {
  const segments = [];
  if (!path || typeof path !== 'string') return segments;

  // 匹配 a.b[0].c[1].d 或 a.b.c 或 a[0][1]
  const regex = /([a-zA-Z0-9_]+)|\[(\d+)\]/g;
  let match;

  while ((match = regex.exec(path)) !== null) {
    if (match[1]) {
      segments.push(match[1]);
    } else if (match[2]) {
      segments.push(parseInt(match[2], 10));
    }
  }

  return segments;
}

/**
 * 获取路径对应的值和父对象
 * @param {object} obj - 目标对象
 * @param {Array<string|number>} pathSegments - 路径段数组
 * @returns {{value: any, parent: object|null, key: string|number|null, found: boolean}}
 */
function getValueAtPath(obj, pathSegments) {
  if (!obj || pathSegments.length === 0) {
    return { value: obj, parent: null, key: null, found: !!obj };
  }

  let current = obj;
  for (let i = 0; i < pathSegments.length - 1; i++) {
    const segment = pathSegments[i];
    if (current === null || current === undefined || typeof current !== 'object') {
      return { value: undefined, parent: null, key: null, found: false };
    }
    current = current[segment];
  }

  const lastKey = pathSegments[pathSegments.length - 1];
  if (current === null || current === undefined) {
    return { value: undefined, parent: null, key: null, found: false };
  }

  return {
    value: current[lastKey],
    parent: current,
    key: lastKey,
    found: lastKey in current,
  };
}

// ═══════════════════════════════════════════
// 变形操作执行器
// ═══════════════════════════════════════════

/**
 * REPLACE: 替换目标路径的值
 * @param {object} obj - 目标对象（已克隆）
 * @param {Array<string|number>} pathSegments - 路径段数组
 * @param {any} newValue - 新值
 * @returns {boolean} 是否成功
 */
function applyReplace(obj, pathSegments, newValue) {
  const { parent, key, found } = getValueAtPath(obj, pathSegments);
  if (!found || parent === null) {
    console.warn(`[Transformer] REPLACE 路径不存在: ${pathSegments.join('.')}`);
    return false;
  }
  parent[key] = newValue;
  return true;
}

/**
 * DELETE: 删除目标路径的值
 * @param {object} obj - 目标对象
 * @param {Array<string|number>} pathSegments - 路径段数组
 * @returns {boolean} 是否成功
 */
function applyDelete(obj, pathSegments) {
  const { parent, key, found } = getValueAtPath(obj, pathSegments);
  if (!found || parent === null) {
    console.warn(`[Transformer] DELETE 路径不存在: ${pathSegments.join('.')}`);
    return false;
  }
  delete parent[key];
  return true;
}

/**
 * DELETE_IF_ZERO: 如果值为 0 或 "0"，则删除
 * @param {object} obj - 目标对象
 * @param {Array<string|number>} pathSegments - 路径段数组
 * @returns {boolean} 是否删除了字段
 */
function applyDeleteIfZero(obj, pathSegments) {
  const { value, parent, key, found } = getValueAtPath(obj, pathSegments);
  if (!found || parent === null) {
    console.warn(`[Transformer] DELETE_IF_ZERO 路径不存在: ${pathSegments.join('.')}`);
    return false;
  }
  if (value === 0 || value === '0') {
    delete parent[key];
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════
// 核心变形引擎
// ═══════════════════════════════════════════

/**
 * 深度克隆对象（避免修改原对象）
 * @param {*} obj - 任意值
 * @returns {*} 克隆后的值
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = deepClone(value);
  }
  return result;
}

/**
 * 应用单条规则
 * @param {object} obj - 目标对象（会修改此对象）
 * @param {{path: string, op: string, value?: any}} rule - 规则对象
 * @returns {boolean} 是否成功应用
 */
function applyRule(obj, rule) {
  if (!rule || typeof rule !== 'object') {
    console.warn('[Transformer] 无效规则:', rule);
    return false;
  }

  const { path, op } = rule;
  if (!path || !op) {
    console.warn('[Transformer] 规则缺少 path 或 op:', rule);
    return false;
  }

  const pathSegments = parsePath(path);

  switch (op.toUpperCase()) {
    case 'REPLACE':
      if (rule.value === undefined) {
        console.warn('[Transformer] REPLACE 规则缺少 value:', rule);
        return false;
      }
      return applyReplace(obj, pathSegments, rule.value);

    case 'DELETE':
      return applyDelete(obj, pathSegments);

    case 'DELETE_IF_ZERO':
      return applyDeleteIfZero(obj, pathSegments);

    default:
      console.warn(`[Transformer] 不支持的操作: ${op}`);
      return false;
  }
}

/**
 * 主函数：根据云端规则变形 Payload
 * @param {object} rawPayload - 原始拦截到的 JSON Payload
 * @param {Array<{path: string, op: 'REPLACE'|'DELETE'|'DELETE_IF_ZERO', value?: any}>} mappings - 规则数组
 * @returns {object} 变形后的 JSON 对象
 */
export function transformPayloadByCloudRules(rawPayload, mappings) {
  if (!rawPayload || typeof rawPayload !== 'object') {
    console.error('[Transformer] 原始 Payload 无效:', rawPayload);
    return {};
  }

  // 深度克隆，避免修改原对象
  const payload = deepClone(rawPayload);

  // 逐条应用规则
  if (Array.isArray(mappings) && mappings.length > 0) {
    for (let i = 0; i < mappings.length; i++) {
      try {
        applyRule(payload, mappings[i]);
      } catch (e) {
        console.error(`[Transformer] 规则 ${i} 执行异常:`, e.message, mappings[i]);
      }
    }
  }

  return payload;
}

// ═══════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════

/**
 * 验证规则数组的有效性
 * @param {Array} mappings - 规则数组
 * @returns {{valid: boolean, error?: string, index?: number}}
 */
export function validateMappings(mappings) {
  if (!Array.isArray(mappings)) {
    return { valid: false, error: 'mappings 必须是数组' };
  }

  const validOps = ['REPLACE', 'DELETE', 'DELETE_IF_ZERO'];

  for (let i = 0; i < mappings.length; i++) {
    const rule = mappings[i];
    if (!rule || typeof rule !== 'object') {
      return { valid: false, error: `规则 ${i} 无效`, index: i };
    }
    if (!rule.path) {
      return { valid: false, error: `规则 ${i} 缺少 path`, index: i };
    }
    if (!rule.op) {
      return { valid: false, error: `规则 ${i} 缺少 op`, index: i };
    }
    if (!validOps.includes(rule.op.toUpperCase())) {
      return { valid: false, error: `规则 ${i} 不支持的操作: ${rule.op}`, index: i };
    }
    if (rule.op.toUpperCase() === 'REPLACE' && rule.value === undefined) {
      return { valid: false, error: `规则 ${i} REPLACE 缺少 value`, index: i };
    }
  }

  return { valid: true };
}

/**
 * 打印规则执行报告
 * @param {object} rawPayload - 原始 payload
 * @param {object} transformedPayload - 变形后 payload
 * @param {Array} mappings - 应用的规则
 * @returns {{rawFieldCount: number, transformedFieldCount: number, rulesApplied: number, fieldsChanged: number}}
 */
export function getTransformReport(rawPayload, transformedPayload, mappings) {
  return {
    rawFieldCount: Object.keys(rawPayload).length,
    transformedFieldCount: Object.keys(transformedPayload).length,
    rulesApplied: mappings ? mappings.length : 0,
    fieldsChanged: Object.keys(rawPayload).length - Object.keys(transformedPayload).length,
  };
}

/**
 * 从云端规则中提取映射配置
 * @param {{mappings?: Array}} rule - 云端规则对象
 * @returns {Array} 映射规则数组
 */
export function extractMappingsFromRule(rule) {
  if (!rule || !Array.isArray(rule.mappings)) {
    return [];
  }
  return rule.mappings;
}
