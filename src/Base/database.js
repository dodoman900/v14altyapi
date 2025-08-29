const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    try {
      const dbPath = path.join(__dirname, '../../data');
      if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
      }

      this.db = new Database(path.join(dbPath, 'bot.db'));
      this.db.pragma('journal_mode = WAL');
      this.createTables();
      console.log('✅ Veritabanı başarıyla başlatıldı');
    } catch (error) {
      console.error('❌ Veritabanı başlatma hatası:', error);
      throw error;
    }
  }

  createTables() {
    // Baskın raporları tablosu
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS baskin_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        reporter_id TEXT NOT NULL,
        reporter_tag TEXT NOT NULL,
        reported_at INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        approved_by TEXT,
        approved_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Baskıncı detayları tablosu
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS baskin_raiders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT,
        reason TEXT,
        is_banned BOOLEAN DEFAULT 0,
        ban_reason TEXT,
        banned_by TEXT,
        banned_at INTEGER,
        FOREIGN KEY (report_id) REFERENCES baskin_reports (id) ON DELETE CASCADE
      )
    `);

    // Son yasaklananlar tablosu
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS recent_bans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT,
        banned_by TEXT NOT NULL,
        banned_by_tag TEXT,
        ban_reason TEXT,
        banned_at INTEGER NOT NULL,
        audit_log_id TEXT
      )
    `);

    console.log('✅ Veritabanı tabloları hazır');
  }

  // Baskın raporu oluştur
  createBaskinReport(guildId, reporterId, reporterTag) {
    const stmt = this.db.prepare(`
      INSERT INTO baskin_reports (guild_id, reporter_id, reporter_tag, reported_at)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(guildId, reporterId, reporterTag, Date.now());
    return result.lastInsertRowid;
  }

  // Baskıncı ekle
  addRaider(reportId, userId, username, reason) {
    const stmt = this.db.prepare(`
      INSERT INTO baskin_raiders (report_id, user_id, username, reason)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(reportId, userId, username, reason);
  }

  // Raporu onayla
  approveReport(reportId, approvedBy) {
    const stmt = this.db.prepare(`
      UPDATE baskin_reports 
      SET status = 'approved', approved_by = ?, approved_at = ?
      WHERE id = ?
    `);
    return stmt.run(approvedBy, Date.now(), reportId);
  }

  // Raporu reddet
  rejectReport(reportId, rejectedBy) {
    const stmt = this.db.prepare(`
      UPDATE baskin_reports 
      SET status = 'rejected', approved_by = ?, approved_at = ?
      WHERE id = ?
    `);
    return stmt.run(rejectedBy, Date.now(), reportId);
  }

  // Son yasaklananları ekle
  addRecentBan(guildId, userId, username, bannedBy, bannedByTag, banReason, bannedAt, auditLogId = null) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO recent_bans 
      (guild_id, user_id, username, banned_by, banned_by_tag, ban_reason, banned_at, audit_log_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(guildId, userId, username, bannedBy, bannedByTag, banReason, bannedAt, auditLogId);
  }

  // Son yasaklananları getir (6 saat)
  getRecentBans(guildId, hoursAgo = 6) {
    const timeAgo = Date.now() - (hoursAgo * 60 * 60 * 1000);
    const stmt = this.db.prepare(`
      SELECT * FROM recent_bans 
      WHERE guild_id = ? AND banned_at > ?
      ORDER BY banned_at DESC
    `);
    return stmt.all(guildId, timeAgo);
  }

  // Rapor detaylarını getir
  getReportDetails(reportId) {
    const reportStmt = this.db.prepare(`
      SELECT * FROM baskin_reports WHERE id = ?
    `);
    const raidersStmt = this.db.prepare(`
      SELECT * FROM baskin_raiders WHERE report_id = ?
    `);
    
    const report = reportStmt.get(reportId);
    const raiders = raidersStmt.all(reportId);
    
    return { report, raiders };
  }

  // Tüm onaylanmış raporları getir
  getApprovedReports(guildId) {
    const stmt = this.db.prepare(`
      SELECT br.*, GROUP_CONCAT(bra.username || ' (' || bra.user_id || ')') as raiders
      FROM baskin_reports br
      LEFT JOIN baskin_raiders bra ON br.id = bra.report_id
      WHERE br.guild_id = ? AND br.status = 'approved'
      GROUP BY br.id
      ORDER BY br.reported_at DESC
    `);
    return stmt.all(guildId);
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = DatabaseManager;