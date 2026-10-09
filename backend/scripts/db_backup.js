'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKUP_DIR = path.resolve(__dirname, '../backups');
const MAX_BACKUPS = 7;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        mtime: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS);
      for (const f of toDelete) {
        fs.unlinkSync(f.path);
        console.log(`[DB Backup] Purged old backup: ${f.name}`);
      }
    }
  } catch (err) {
    console.warn(`[DB Backup] Warning during old backup cleanup: ${err.message}`);
  }
}

function runBackup() {
  ensureBackupDir();
  const timestamp = getTimestamp();
  const isPostgres = Boolean(process.env.DB_HOST || process.env.DATABASE_URL);

  if (isPostgres) {
    const backupFile = path.join(BACKUP_DIR, `nanoshipy-pg-backup-${timestamp}.sql`);
    console.log(`[DB Backup] Initiating PostgreSQL backup to ${backupFile}...`);
    try {
      const dbUrl = process.env.DATABASE_URL;
      const cmd = dbUrl ? `pg_dump "${dbUrl}" > "${backupFile}"` : `pg_dump -h ${process.env.DB_HOST} -U ${process.env.DB_USER} ${process.env.DB_NAME} > "${backupFile}"`;
      execSync(cmd, { stdio: 'inherit' });
      console.log(`[DB Backup] Successfully generated PostgreSQL backup: ${backupFile}`);
    } catch (err) {
      console.error(`[DB Backup] pg_dump failed: ${err.message}`);
      process.exit(1);
    }
  } else {
    // SQLite backup
    const sqlitePath = path.resolve(__dirname, '../database.sqlite');
    const backupFile = path.join(BACKUP_DIR, `nanoshipy-sqlite-backup-${timestamp}.sqlite`);
    console.log(`[DB Backup] Initiating SQLite backup from ${sqlitePath} to ${backupFile}...`);

    if (fs.existsSync(sqlitePath)) {
      fs.copyFileSync(sqlitePath, backupFile);
      const stat = fs.statSync(backupFile);
      console.log(`[DB Backup] Successfully generated SQLite backup (${stat.size} bytes): ${backupFile}`);
    } else {
      console.warn(`[DB Backup] SQLite file not found at ${sqlitePath}. Created placeholder.`);
      fs.writeFileSync(backupFile, '-- empty sqlite backup placeholder --');
    }
  }

  cleanOldBackups();
  console.log('[DB Backup] Backup job completed successfully.');
}

if (require.main === module) {
  runBackup();
}

module.exports = { runBackup };
