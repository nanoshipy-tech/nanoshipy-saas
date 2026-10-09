'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('tenant_webhooks');
    if (!tableDesc.secret_visible_once) {
      await queryInterface.addColumn('tenant_webhooks', 'secret_visible_once', {
        type: Sequelize.TEXT, allowNull: true,
      });
    }
    if (!tableDesc.hmac_algorithm) {
      await queryInterface.addColumn('tenant_webhooks', 'hmac_algorithm', {
        type: Sequelize.STRING(20), allowNull: false, defaultValue: 'sha256',
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('tenant_webhooks', 'secret_visible_once');
    await queryInterface.removeColumn('tenant_webhooks', 'hmac_algorithm');
  },
};
