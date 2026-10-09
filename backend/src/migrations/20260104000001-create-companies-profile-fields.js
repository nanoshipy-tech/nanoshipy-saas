'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('tenants');
    const promises = [];

    if (!tableInfo.legal_name) {
      promises.push(queryInterface.addColumn('tenants', 'legal_name', {
        type: Sequelize.STRING(150),
        allowNull: true,
      }));
    }
    if (!tableInfo.gstin) {
      promises.push(queryInterface.addColumn('tenants', 'gstin', {
        type: Sequelize.STRING(15),
        allowNull: true,
      }));
    }
    if (!tableInfo.business_type) {
      promises.push(queryInterface.addColumn('tenants', 'business_type', {
        type: Sequelize.ENUM('individual', 'proprietorship', 'partnership', 'pvt_ltd', 'llp', 'other'),
        allowNull: true,
      }));
    }
    if (!tableInfo.support_email) {
      promises.push(queryInterface.addColumn('tenants', 'support_email', {
        type: Sequelize.STRING(150),
        allowNull: true,
      }));
    }
    if (!tableInfo.support_phone) {
      promises.push(queryInterface.addColumn('tenants', 'support_phone', {
        type: Sequelize.STRING(20),
        allowNull: true,
      }));
    }
    if (!tableInfo.logo_url) {
      promises.push(queryInterface.addColumn('tenants', 'logo_url', {
        type: Sequelize.STRING(500),
        allowNull: true,
      }));
    }
    if (!tableInfo.profile_completed) {
      promises.push(queryInterface.addColumn('tenants', 'profile_completed', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      }));
    }
    if (!tableInfo.kyc_status) {
      promises.push(queryInterface.addColumn('tenants', 'kyc_status', {
        type: Sequelize.ENUM('pending', 'submitted', 'verified', 'rejected'),
        defaultValue: 'pending',
      }));
    }

    await Promise.all(promises);
  },

  down: async (queryInterface, Sequelize) => {
    const promises = [
      queryInterface.removeColumn('tenants', 'legal_name'),
      queryInterface.removeColumn('tenants', 'gstin'),
      queryInterface.removeColumn('tenants', 'business_type'),
      queryInterface.removeColumn('tenants', 'support_email'),
      queryInterface.removeColumn('tenants', 'support_phone'),
      queryInterface.removeColumn('tenants', 'logo_url'),
      queryInterface.removeColumn('tenants', 'profile_completed'),
      queryInterface.removeColumn('tenants', 'kyc_status'),
    ];
    await Promise.all(promises);
  }
};
