// src/main/database.js
import Database from 'better-sqlite3';
import { app, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs'; // 显式导入fs，避免动态导入异常
import { format } from 'date-fns'; // 引入date-fns处理日期兼容性（需安装：npm i date-fns）

/** 全局数据库实例 */
let db = null;

/**
 * 安全获取格式化日期（兼容不同环境）
 * @param {Date} date 日期对象
 * @returns {string} YYYY-MM-DD 格式日期
 */
function getFormattedDate(date) {
  try {
    return format(date, 'yyyy-MM-dd');
  } catch (e) {
    // 降级方案
    return date.toISOString().split('T')[0];
  }
}

/**
 * 安全添加表字段（避免重复执行报错）
 * @param {Database} db 数据库实例
 * @param {string} table 表名
 * @param {string} column 字段名
 * @param {string} type 字段类型
 * @param {string} defaultValue 默认值
 */
function safeAddColumn(db, table, column, type, defaultValue = '') {
  try {
    // 先查询字段是否存在
    const columnExists = db.prepare(`
      SELECT name FROM pragma_table_info(?) WHERE name = ?
    `).get(table, column);
    
    if (!columnExists) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT ${defaultValue};`);
      console.log(`✅ 成功为${table}表添加${column}字段`);
    }
  } catch (e) {
    console.warn(`⚠️ 添加${table}.${column}字段失败：`, e.message);
  }
}

/**
 * 初始化数据库 + 建表 + 注入测试灵魂数据
 */
export function initDatabase() {
  try {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'nikola_standalone_v1.db');

    // 确保目录存在
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    db = new Database(dbPath, { 
      verbose: process.env.NODE_ENV === 'development' ? console.log : null, // 生产环境关闭日志
      fileMustExist: false 
    });

    // 强制 UTF-8 编码
    db.pragma('encoding = "UTF-8"');
    db.pragma('foreign_keys = ON'); // 开启外键约束

    // === 1. accounts 表 ===
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alias TEXT NOT NULL,
        platform TEXT NOT NULL,
        group_name TEXT DEFAULT '默认分组',
        custom_url TEXT,
        status TEXT DEFAULT '在线',
        followers INTEGER DEFAULT 0,    
        following INTEGER DEFAULT 0,
        posts INTEGER DEFAULT 0,
        total_views INTEGER DEFAULT 0, 
        real_name TEXT DEFAULT '',
        username TEXT DEFAULT '',
        user_id TEXT DEFAULT '',
        avatar TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 安全添加新字段（如果不存在）
    safeAddColumn(db, 'accounts', 'following', 'INTEGER', 0);
    safeAddColumn(db, 'accounts', 'posts', 'INTEGER', 0);
    safeAddColumn(db, 'accounts', 'username', 'TEXT', "''");
    safeAddColumn(db, 'accounts', 'user_id', 'TEXT', "''");
    safeAddColumn(db, 'accounts', 'avatar', 'TEXT', "''");

    // === 2. daily_stats ===
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        platform TEXT NOT NULL,
        date DATE NOT NULL,
        plays INTEGER DEFAULT 0,
        fans_gain INTEGER DEFAULT 0,
        interactions INTEGER DEFAULT 0,
        revenue REAL DEFAULT 0,
        conversion_rate REAL DEFAULT 0,
        UNIQUE(account_id, platform, date),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `);

    // === 3. videos ===
    db.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        account_id INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `);

    // === 4. video_metrics ===
    db.exec(`
      CREATE TABLE IF NOT EXISTS video_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL,
        record_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        velocity INTEGER DEFAULT 0,
        total_plays INTEGER DEFAULT 0,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
      );
    `);

    // === 5. messages ===
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        account_alias TEXT NOT NULL,
        username TEXT NOT NULL,
        content TEXT NOT NULL,
        time TEXT NOT NULL,
        type TEXT DEFAULT '评论',
        status TEXT DEFAULT '未回复',
        reply_content TEXT
      );
    `);

    console.log('✅ SQLite 表结构初始化完成');

    // 💥 终极数据库底层装甲：绝对禁止任何人/脚本将已有的 Base64 头像覆盖为空！
    try {
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS protect_avatar_trigger
        AFTER UPDATE OF avatar ON accounts
        FOR EACH ROW
        WHEN (NEW.avatar = '' OR NEW.avatar IS NULL) AND OLD.avatar LIKE 'data:image%'
        BEGIN
          UPDATE accounts SET avatar = OLD.avatar WHERE id = NEW.id;
        END;
      `);
      console.log('🛡️ 数据库底层装甲已部署：Base64 头像防篡改机制生效！');
    } catch (e) {
      console.log('⚠️ 装甲部署提示:', e.message);
    }

    // === 注入测试灵魂数据（仅在首次启动时执行）===
    const hasData = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get().cnt > 0;

    if (!hasData) {
      console.log('🧪 首次启动，注入测试灵魂数据...');
      const transaction = db.transaction(() => {
        // 1. accounts（使用参数化查询避免注入）
        const insertAccount = db.prepare(`
          INSERT INTO accounts (id, alias, platform, group_name, status, followers, following, posts, total_views, real_name, username, user_id, avatar)
          VALUES (@id, @alias, @platform, @group_name, @status, @followers, @following, @posts, @total_views, @real_name, @username, @user_id, @avatar)
        `);
        insertAccount.run({ id: 991, alias: 'NIKOLA官方主号', platform: '抖音', group_name: '默认分组', status: '在线', followers: 12500, following: 245, posts: 128, total_views: 856000, real_name: 'NIKOLA官方', username: 'nikola_official', user_id: '123456789', avatar: 'https://example.com/avatar.jpg' });
        insertAccount.run({ id: 992, alias: '品牌宣传号', platform: 'B站', group_name: '默认分组', status: '在线', followers: 8400, following: 156, posts: 87, total_views: 320000, real_name: 'NIKOLA品牌', username: 'nikola_brand', user_id: '987654321', avatar: 'https://example.com/avatar2.jpg' });
        insertAccount.run({ id: 993, alias: '极客好物', platform: '小红书', group_name: '默认分组', status: '在线', followers: 3200, following: 89, posts: 65, total_views: 150000, real_name: '极客好物推荐', username: 'geek_goodies', user_id: '456789123', avatar: 'https://example.com/avatar3.jpg' });

        // 2. videos
        const insertVideo = db.prepare(`
          INSERT INTO videos (id, title, account_id) VALUES (@id, @title, @account_id)
        `);
        insertVideo.run({ id: 'vid_1', title: '战损涂装改造第一集', account_id: 991 });
        insertVideo.run({ id: 'vid_2', title: '街头实测跑山', account_id: 992 });
        insertVideo.run({ id: 'vid_3', title: '桌面改造Vlog沉浸式体验', account_id: 993 });

        // 3. video_metrics
        const insertVideoMetric = db.prepare(`
          INSERT INTO video_metrics (video_id, velocity, total_plays) VALUES (@video_id, @velocity, @total_plays)
        `);
        insertVideoMetric.run({ video_id: 'vid_1', velocity: 856, total_plays: 125000 });
        insertVideoMetric.run({ video_id: 'vid_2', velocity: 125, total_plays: 32000 });
        insertVideoMetric.run({ video_id: 'vid_3', velocity: 0, total_plays: 850 });

        // 4. daily_stats
        const today = getFormattedDate(new Date());
        const yesterday = getFormattedDate(new Date(Date.now() - 86400000));
        const insertDailyStat = db.prepare(`
          INSERT INTO daily_stats 
            (account_id, platform, date, plays, fans_gain, interactions, revenue, conversion_rate)
          VALUES (@account_id, @platform, @date, @plays, @fans_gain, @interactions, @revenue, @conversion_rate)
        `);
        insertDailyStat.run({ account_id: 991, platform: '抖音', date: today, plays: 8452000, fans_gain: 8420, interactions: 35000, revenue: 85000, conversion_rate: 4.2 });
        insertDailyStat.run({ account_id: 992, platform: 'B站', date: today, plays: 320000, fans_gain: 2100, interactions: 8200, revenue: 12000, conversion_rate: 6.8 });
        insertDailyStat.run({ account_id: 993, platform: '小红书', date: today, plays: 156000, fans_gain: 1560, interactions: 4500, revenue: 8500, conversion_rate: 3.5 });
        insertDailyStat.run({ account_id: 991, platform: '抖音', date: yesterday, plays: 7200000, fans_gain: 7100, interactions: 28000, revenue: 72000, conversion_rate: 3.9 });
        insertDailyStat.run({ account_id: 992, platform: 'B站', date: yesterday, plays: 280000, fans_gain: 1800, interactions: 6500, revenue: 9800, conversion_rate: 5.5 });

        // 5. messages
        const insertMessage = db.prepare(`
          INSERT INTO messages 
            (platform, account_alias, username, content, time, type, status)
          VALUES (@platform, @account_alias, @username, @content, @time, @type, @status)
        `);
        insertMessage.run({ platform: '抖音', account_alias: 'NIKOLA官方主号', username: '赛博朋克2077', content: '这款产品什么时候补货？', time: '10分钟前', type: '评论', status: '未回复' });
      });

      transaction(); // 事务执行，确保数据一致性
      console.log('✅ 测试灵魂数据注入完成');
    } else {
      console.log('✅ 数据库已有数据，跳过测试灵魂注入');
    }

    console.log('🚀 database.js 初始化成功！');
    return db;
  } catch (err) {
    console.error('❌ database.js 初始化失败：', err);
    // 确保数据库连接关闭
    if (db) {
      db.close();
      db = null;
    }
    throw err;
  }
}

export function getDB() {
  if (!db) throw new Error("数据库尚未初始化！");
  return db;
}

/**
 * 关闭数据库连接
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('✅ 数据库连接已关闭');
  }
}

export function registerDatabaseIPC() {
  if (!db) {
    console.error('❌ 数据库未初始化，无法注册IPC');
    return;
  }

  ipcMain.handle('db-get-accounts', async () => {
    try {
      const stmt = db.prepare(`
        SELECT id, alias, platform, group_name, custom_url, status, real_name, username, user_id, followers, following, posts, total_views, avatar
        FROM accounts 
        ORDER BY created_at DESC
      `);
      return stmt.all();
    } catch (e) {
      console.error('❌ 获取账号列表失败：', e);
      return [];
    }
  });

  ipcMain.handle('db-add-account', async (_, payload) => {
    try {
      if (!payload?.alias || !payload?.platform) {
        return { success: false, message: '缺少必要参数（alias/platform）' };
      }

      const stmt = db.prepare(`
        INSERT INTO accounts (alias, platform, group_name, custom_url)
        VALUES (@alias, @platform, @group, @customUrl)
      `);
      const info = stmt.run({
        alias: payload.alias,
        platform: payload.platform,
        group: payload.group || '默认分组',
        customUrl: payload.customUrl || null
      });
      return { success: true, id: info.lastInsertRowid };
    } catch (e) {
      console.error('❌ 添加账号失败：', e);
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('db-update-account-alias', async (_, { id, newAlias }) => {
    try {
      if (!id || !newAlias) {
        return { success: false, message: '缺少必要参数（id/newAlias）' };
      }

      db.prepare('UPDATE accounts SET alias = ? WHERE id = ?').run(newAlias, id);
      return { success: true };
    } catch (e) {
      console.error('❌ 修改账号别名失败：', e);
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('db-update-account-stats', async (_, { id, followers, following, posts, total_views, real_name, username, user_id, avatar }) => {
    try {
      if (!id) {
        return { success: false, message: '缺少必要参数（id）' };
      }

      const stmt = db.prepare(`
        UPDATE accounts 
        SET followers = COALESCE(@followers, followers),
            following = COALESCE(@following, following),
            posts = COALESCE(@posts, posts),
            total_views = COALESCE(@total_views, total_views),
            real_name = COALESCE(@real_name, real_name),
            username = COALESCE(@username, username),
            user_id = COALESCE(@user_id, user_id),
            avatar = COALESCE(@avatar, avatar)
        WHERE id = @id
      `);
      stmt.run({
        id: id,
        followers: followers !== undefined ? followers : null,
        following: following !== undefined ? following : null,
        posts: posts !== undefined ? posts : null,
        total_views: total_views !== undefined ? total_views : null,
        real_name: real_name !== undefined ? real_name : null,
        username: username !== undefined ? username : null,
        user_id: user_id !== undefined ? user_id : null,
        avatar: avatar !== undefined ? avatar : null
      });

      return { success: true };
    } catch (e) {
      console.error('❌ 更新账号统计失败：', e);
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('db-delete-account', async (_, id) => {
    try {
      if (!id) {
        return { success: false, message: '缺少必要参数（id）' };
      }

      // 事务删除关联数据
      const transaction = db.transaction(() => {
        // 删除账号
        db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
        // 删除关联的每日统计
        db.prepare('DELETE FROM daily_stats WHERE account_id = ?').run(id);
        // 删除关联的视频
        const videos = db.prepare('SELECT id FROM videos WHERE account_id = ?').all(id);
        videos.forEach(video => {
          // 删除视频指标
          db.prepare('DELETE FROM video_metrics WHERE video_id = ?').run(video.id);
        });
        db.prepare('DELETE FROM videos WHERE account_id = ?').run(id);
      });
      transaction();

      // 删除playwright配置文件
      const profilePath = path.join(app.getPath('userData'), 'playwright_profiles', `chrome_data_${id}`);
      if (fs.existsSync(profilePath)) {
        fs.rmSync(profilePath, { recursive: true, force: true });
        console.log(`✅ 已删除账号${id}的playwright配置文件`);
      }

      return { success: true };
    } catch (e) {
      console.error('❌ 删除账号失败：', e);
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('db-update-account-group', async (_, { id, newGroup }) => {
    try {
      if (!id || !newGroup) {
        return { success: false, message: '缺少必要参数（id/newGroup）' };
      }

      db.prepare('UPDATE accounts SET group_name = ? WHERE id = ?').run(newGroup, id);
      return { success: true };
    } catch (e) {
      console.error('❌ 修改账号分组失败：', e);
      return { success: false, message: e.message };
    }
  });
  
  ipcMain.handle('get-account-data-history', async (_, { accountId, platform }) => {
    try {
      if (!accountId || !platform) {
        return { success: false, message: '缺少必要参数（accountId/platform）' };
      }

      const history = db.prepare(`
        SELECT date as fetch_date, fans_gain as fans, plays, interactions as likes
        FROM daily_stats 
        WHERE account_id = ? AND platform = ? 
        ORDER BY date DESC LIMIT 7
      `).all(accountId, platform);
      
      return { success: true, data: history.reverse() }; 
    } catch (err) {
      console.error('❌ 获取账号历史数据失败：', err);
      return { success: false, message: err.message };
    }
  });
}
