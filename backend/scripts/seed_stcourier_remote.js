'use strict';

const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  const sql = `
    INSERT INTO courier_providers (
      id, provider_key, display_name, is_active, credentials_encrypted, config,
      supports_cod, supports_prepaid, priority, sandbox_mode, circuit_breaker_state,
      consecutive_failures, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), 'stcourier', 'ST Courier (Tamil Nadu Express)', true,
      '{}', '{"base_rate":30.00,"additional_slab_rate":15.00,"cod_min_fee":30.00,"cod_percent":2.0}'::json,
      true, true, 1, false, 'closed', 0, NOW(), NOW()
    )
    ON CONFLICT (provider_key) DO UPDATE
    SET is_active = true,
        sandbox_mode = false,
        display_name = 'ST Courier (Tamil Nadu Express)',
        config = '{"base_rate":30.00,"additional_slab_rate":15.00,"cod_min_fee":30.00,"cod_percent":2.0}'::json,
        updated_at = NOW();

    INSERT INTO tenant_courier_access (id, tenant_id, courier_provider_id, is_enabled, created_at, updated_at)
    SELECT gen_random_uuid(), t.id, cp.id, true, NOW(), NOW()
    FROM tenants t, courier_providers cp
    WHERE cp.provider_key = 'stcourier'
    AND NOT EXISTS (
      SELECT 1 FROM tenant_courier_access tca WHERE tca.tenant_id = t.id AND tca.courier_provider_id = cp.id
    );
  `;

  // Write sql to a temporary file on remote and execute via psql -f
  const remoteCmd = `sudo -u postgres psql -d nanoshipy_db << 'EOF'
${sql}
EOF`;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      process.exit(1);
    }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', (code) => {
      console.log('Seed finished with code:', code);
      conn.end();
      process.exit(code);
    });
  });
}).on('error', err => {
  console.error('SSH error:', err);
  process.exit(1);
}).connect({
  host: '34.93.11.164',
  port: 22,
  username: 'care',
  privateKey: fs.readFileSync('C:\\Users\\dines\\.ssh\\id_rsa'),
});
