'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ALTER TYPE ADD VALUE cannot run inside a transaction in PostgreSQL
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'shipped';`,
      { raw: true }
    );
  },

  async down(queryInterface, Sequelize) {
    // PostgreSQL does not support removing values from ENUMs easily.
    // Since this is a development/production extension, we leave the ENUM value.
  },
};
