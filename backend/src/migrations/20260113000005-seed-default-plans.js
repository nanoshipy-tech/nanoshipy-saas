'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert('subscription_plans', [
      {
        id: uuidv4(),
        name: 'Free',
        slug: 'free',
        price_monthly: 0.00,
        price_yearly: 0.00,
        max_orders_per_month: 50,
        max_users: 2,
        max_pickup_addresses: 1,
        courier_access_tier: 'basic',
        support_tier: 'email',
        is_active: true,
        is_default: true,
        sort_order: 0,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Growth',
        slug: 'growth',
        price_monthly: 999.00,
        price_yearly: 9999.00,
        max_orders_per_month: 500,
        max_users: 5,
        max_pickup_addresses: 3,
        courier_access_tier: 'standard',
        support_tier: 'priority',
        is_active: true,
        is_default: false,
        sort_order: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Pro',
        slug: 'pro',
        price_monthly: 4999.00,
        price_yearly: 49999.00,
        max_orders_per_month: 5000,
        max_users: 20,
        max_pickup_addresses: 10,
        courier_access_tier: 'all',
        support_tier: 'dedicated',
        is_active: true,
        is_default: false,
        sort_order: 2,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Enterprise',
        slug: 'enterprise',
        price_monthly: 15000.00,
        price_yearly: 150000.00,
        max_orders_per_month: null, // Unlimited
        max_users: null, // Unlimited
        max_pickup_addresses: null, // Unlimited
        courier_access_tier: 'all',
        support_tier: 'dedicated',
        is_active: true,
        is_default: false,
        sort_order: 3,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('subscription_plans', null, {});
  },
};
