'use strict';

const db = require('../src/config/db.config');
const { CourierProvider, Tenant, TenantCourierAccess } = require('../src/models');
const providerCredentialService = require('../src/services/providerCredential.service');

async function seed() {
  console.log('Seeding mock courier provider...');
  await db.authenticate();

  // Find or create Mock Provider
  const [provider, created] = await CourierProvider.findOrCreate({
    where: { provider_key: 'mock' },
    defaults: {
      display_name: 'Mock Courier (Test)',
      logo_url: null,
      is_active: true,
      credentials_encrypted: providerCredentialService.encrypt({
        api_key: 'test-key-123',
        api_secret: 'test-secret',
      }),
      config: {
        base_url: 'https://mock.internal',
        timeout_ms: 5000,
      },
      supports_cod: true,
      supports_prepaid: true,
      max_weight_kg: 30.00,
      service_types: ['surface', 'express'],
      priority: 100,
    },
  });

  if (created) {
    console.log('Created Mock Courier Provider.');
  } else {
    console.log('Mock Courier Provider already exists.');
  }

  // Grant access to Acme Corp tenant
  const acme = await Tenant.findOne({ where: { subdomain: 'acme' } });
  if (acme) {
    const [access, accessCreated] = await TenantCourierAccess.findOrCreate({
      where: {
        tenant_id: acme.id,
        courier_provider_id: provider.id,
      },
      defaults: {
        is_enabled: true,
      },
    });

    if (accessCreated) {
      console.log(`Granted Mock Courier access to Acme Corp tenant (${acme.id}).`);
    } else {
      console.log('Acme Corp already has access to Mock Courier.');
    }
  } else {
    console.warn('Acme Corp tenant not found. Skipping auto-grant.');
  }

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Failed to seed mock courier provider:', err);
  process.exit(1);
});
