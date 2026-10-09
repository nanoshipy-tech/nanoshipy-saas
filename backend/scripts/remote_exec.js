'use strict';

const { Client } = require('ssh2');
const fs = require('fs');

const cmd = process.argv.slice(2).join(' ');
if (!cmd) {
  console.error('Usage: node remote_exec.js "<command>"');
  process.exit(1);
}

const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('EXEC ERROR:', err.message);
      conn.end();
      return;
    }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', (code) => {
      conn.end();
      process.exit(code || 0);
    });
  });
});

conn.on('error', err => {
  console.error('SSH CONNECTION ERROR:', err.message);
  process.exit(1);
});

conn.connect({
  host: '34.93.11.164',
  port: 22,
  username: 'care',
  privateKey: fs.readFileSync('C:/Users/dines/.ssh/id_rsa'),
  readyTimeout: 30000,
});
