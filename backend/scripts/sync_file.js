'use strict';

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node sync_file.js <local_relative_path_from_Saas-Frontend-main>');
  process.exit(1);
}

const LOCAL_ROOT = path.resolve(__dirname, '..', '..');
const REMOTE_ROOT = '/var/www/nanoshipy/Saas-Frontend-main';

const localFull = path.join(LOCAL_ROOT, filePath);
const remoteFull = path.posix.join(REMOTE_ROOT, filePath.replace(/\\/g, '/'));

if (!fs.existsSync(localFull)) {
  console.error('Local file not found:', localFull);
  process.exit(1);
}

const conn = new Client();
conn.on('ready', () => {
  console.log(`Uploading ${filePath} to ${remoteFull}...`);
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('SFTP error:', err);
      conn.end();
      process.exit(1);
    }
    sftp.fastPut(localFull, remoteFull, (putErr) => {
      if (putErr) {
        console.error('fastPut error:', putErr);
        conn.end();
        process.exit(1);
      }
      console.log('Uploaded successfully!');
      
      // If it's a backend file, reload backend
      if (filePath.startsWith('backend')) {
        conn.exec('pm2 reload nanoshipy-backend --update-env', (execErr, stream) => {
          if (execErr) {
            console.error('Reload error:', execErr);
            conn.end();
            process.exit(1);
          }
          stream.on('data', d => process.stdout.write(d.toString()));
          stream.stderr.on('data', d => process.stderr.write(d.toString()));
          stream.on('close', () => {
            conn.end();
            console.log('Backend reloaded successfully!');
          });
        });
      } else {
        conn.end();
      }
    });
  });
});

conn.on('error', err => {
  console.error('SSH connection error:', err);
  process.exit(1);
});

conn.connect({
  host: '13.239.18.131',
  port: 22,
  username: 'ubuntu',
  privateKey: fs.readFileSync('c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy (2)/nanoshipy/aws_key.pem'),
  readyTimeout: 30000,
});
