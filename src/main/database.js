// src/main/database.js
import Database from 'better-sqlite3';
import { app, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs'; 
import { format } from 'date-fns'; 

let db = null;

function getFormattedDate(date) {
  try {
    return format(date, 'yyyy-MM-dd');
  } catch (e) {
    return date.toISOString().split('T')[0];
  }
}

function safeAddColumn(db, table, column, type, defaultValue = '') {
  try {
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

export function initDatabase() {
  try {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'nikola_standalone_v1.db');

    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    db = new Database(dbPath, { 
      verbose: process.env.NODE_ENV === 'development' ? console.log : null, 
      fileMustExist: false 
    });

    db.pragma('encoding = "UTF-8"');
    db.pragma('foreign_keys = ON'); 

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
        trend_data TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    safeAddColumn(db, 'accounts', 'following', 'INTEGER', 0);
    safeAddColumn(db, 'accounts', 'posts', 'INTEGER', 0);
    safeAddColumn(db, 'accounts', 'username', 'TEXT', "''");
    safeAddColumn(db, 'accounts', 'user_id', 'TEXT', "''");
    safeAddColumn(db, 'accounts', 'avatar', 'TEXT', "''");
    safeAddColumn(db, 'accounts', 'trend_data', 'TEXT', "'{}'");

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
        avatar TEXT,          
        video_cover TEXT,     
        content TEXT NOT NULL,
        time TEXT NOT NULL,
        type TEXT DEFAULT '评论',
        status TEXT DEFAULT '未回复',
        reply_content TEXT
      );
    `);

    console.log('✅ SQLite 表结构初始化完成');

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
    } catch (e) {}

    const hasData = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get().cnt > 0;

    if (!hasData) {
      console.log('🧪 首次启动，注入测试灵魂数据...');
      const transaction = db.transaction(() => {
        const insertAccount = db.prepare(`
          INSERT INTO accounts (id, alias, platform, group_name, status, followers, following, posts, total_views, real_name, username, user_id, avatar, trend_data)
          VALUES (@id, @alias, @platform, @group_name, @status, @followers, @following, @posts, @total_views, @real_name, @username, @user_id, @avatar, '{}')
        `);
        insertAccount.run({ id: 991, alias: 'NIKOLA官方主号', platform: '抖音', group_name: '默认分组', status: '在线', followers: 12500, following: 245, posts: 128, total_views: 856000, real_name: 'NIKOLA官方', username: 'nikola_official', user_id: '123456789', avatar: 'https://example.com/avatar.jpg' });
      });
      transaction();
    }

    return db;
  } catch (err) {
    if (db) { db.close(); db = null; }
    throw err;
  }
}

export function getDB() {
  if (!db) throw new Error("数据库尚未初始化！");
  return db;
}

export function closeDatabase() {
  if (db) { db.close(); db = null; }
}

export function registerDatabaseIPC() {
  if (!db) return;

  ipcMain.handle('db-get-accounts', async () => {
    try {
      const stmt = db.prepare(`
        SELECT id, alias, platform, group_name, custom_url, status, real_name, username, user_id, followers, following, posts, total_views, avatar, trend_data 
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
        return { success: false, message: '缺少必要参数' };
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
      db.prepare('UPDATE accounts SET alias = ? WHERE id = ?').run(newAlias, id);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('db-update-account-stats', async (_, { id, followers, following, posts, total_views, real_name, username, user_id, avatar }) => {
    try {
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
      return { success: false, message: e.message };
    }
  });

  // 🌟 修复关键点：满血归来的删除功能
  ipcMain.handle('db-delete-account', async (_, id) => {
    try {
      if (!id) return { success: false, message: '缺少参数' };
      
      // 事务删除关联数据
      const transaction = db.transaction(() => {
        db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
        db.prepare('DELETE FROM daily_stats WHERE account_id = ?').run(id);
        const videos = db.prepare('SELECT id FROM videos WHERE account_id = ?').all(id);
        videos.forEach(video => {
          db.prepare('DELETE FROM video_metrics WHERE video_id = ?').run(video.id);
        });
        db.prepare('DELETE FROM videos WHERE account_id = ?').run(id);
      });
      transaction();

      // 删除playwright对应的缓存文件夹，做到真正“毁尸灭迹”
      const profilePath = path.join(app.getPath('userData'), 'playwright_profiles', `chrome_data_${id}`);
      if (fs.existsSync(profilePath)) {
        fs.rmSync(profilePath, { recursive: true, force: true });
        console.log(`✅ 已连带删除账号${id}的浏览器沙盒缓存！`);
      }

      return { success: true };
    } catch (e) {
      console.error('❌ 删除账号失败：', e);
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('db-update-account-group', async (_, { id, newGroup }) => {
    try {
      db.prepare('UPDATE accounts SET group_name = ? WHERE id = ?').run(newGroup, id);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });
  
  ipcMain.handle('get-account-data-history', async (_, { accountId, platform }) => {
    try {
      const history = db.prepare(`
        SELECT date as fetch_date, fans_gain as fans, plays, interactions as likes
        FROM daily_stats 
        WHERE account_id = ? AND platform = ? 
        ORDER BY date DESC LIMIT 7
      `).all(accountId, platform);
      return { success: true, data: history.reverse() }; 
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
}