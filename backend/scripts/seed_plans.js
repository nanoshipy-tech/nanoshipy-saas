'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { v4: uuidv4 } = require('uuid');
const { SubscriptionPlan } = require('../src/models');

const plansToSync = [
  {
    name: 'Starter',
    slug: 'starter',
    price_monthly: 0.00,
    price_yearly: 0.00,
    max_orders_per_month: 500,
    courier_access_tier: 'basic',
    support_tier: 'email',
    is_active: true,
    is_default: true,
    sort_order: 0,
  },
  {
    name: 'Growth',
    slug: 'growth',
    price_monthly: 1999.00,
    price_yearly: 19188.00,
    max_orders_per_month: 10000,
    courier_access_tier: 'all',
    support_tier: 'priority',
    is_active: true,
    is_default: false,
    sort_order: 1,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    price_monthly: 5999.00,
    price_yearly: 57588.00,
    max_orders_per_month: null,
    courier_access_tier: 'all',
    support_tier: 'dedicated',
    is_active: true,
    is_default: false,
    sort_order: 2,
  },
];

async function seed() {
  console.log('Seeding subscription plans into nanoshipy_db...');
  for (const p of plansToSync) {
    let existing = await SubscriptionPlan.findOne({ where: { slug: p.slug } });
    if (existing) {
      await existing.update(p);
      console.log(`Updated plan: ${p.name} (${p.slug})`);
    } else {
      const created = await SubscriptionPlan.create({ id: uuidv4(), ...p });
      console.log(`Created plan: ${p.name} (${p.slug}, id: ${created.id}, is_default: ${p.is_default})`);
    }
  }
  console.log('✅ Subscription plans successfully seeded!');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
