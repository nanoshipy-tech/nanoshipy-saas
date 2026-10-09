'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('tenants');

    // Make kyc_status a string field to allow all needed states cleanly
    // Make kyc_status a string field to allow all needed states cleanly
    if (tableInfo.kyc_status) {
      await queryInterface.sequelize.query('ALTER TABLE tenants ALTER COLUMN kyc_status DROP DEFAULT;');
      await queryInterface.sequelize.query('ALTER TABLE tenants ALTER COLUMN kyc_status TYPE VARCHAR(50) USING kyc_status::varchar;');
      await queryInterface.sequelize.query("ALTER TABLE tenants ALTER COLUMN kyc_status SET DEFAULT 'not_started';");
      await queryInterface.sequelize.query("UPDATE tenants SET kyc_status = 'not_started' WHERE kyc_status IS NULL;");
    } else {
      await queryInterface.addColumn('tenants', 'kyc_status', {
        type: Sequelize.STRING(50),
        defaultValue: 'not_started',
        allowNull: false,
      });
    }

    // Additive columns
    if (!tableInfo.legal_business_name) {
      await queryInterface.addColumn('tenants', 'legal_business_name', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!tableInfo.pan_number) {
      await queryInterface.addColumn('tenants', 'pan_number', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }
    if (!tableInfo.gst_number) {
      await queryInterface.addColumn('tenants', 'gst_number', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }
    if (!tableInfo.gst_registered) {
      await queryInterface.addColumn('tenants', 'gst_registered', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
    }
    if (!tableInfo.bank_account_number_encrypted) {
      await queryInterface.addColumn('tenants', 'bank_account_number_encrypted', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!tableInfo.bank_ifsc) {
      await queryInterface.addColumn('tenants', 'bank_ifsc', {
        type: Sequelize.STRING(15),
        allowNull: true,
      });
    }
    if (!tableInfo.bank_account_holder_name) {
      await queryInterface.addColumn('tenants', 'bank_account_holder_name', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!tableInfo.bank_verified) {
      await queryInterface.addColumn('tenants', 'bank_verified', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
    }
    if (!tableInfo.authorized_signatory_name) {
      await queryInterface.addColumn('tenants', 'authorized_signatory_name', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!tableInfo.aadhaar_last4) {
      await queryInterface.addColumn('tenants', 'aadhaar_last4', {
        type: Sequelize.CHAR(4),
        allowNull: true,
      });
    }
    if (!tableInfo.kyc_rejection_reason) {
      await queryInterface.addColumn('tenants', 'kyc_rejection_reason', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!tableInfo.kyc_submitted_at) {
      await queryInterface.addColumn('tenants', 'kyc_submitted_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!tableInfo.kyc_approved_at) {
      await queryInterface.addColumn('tenants', 'kyc_approved_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!tableInfo.tracking_page_logo_s3_key) {
      await queryInterface.addColumn('tenants', 'tracking_page_logo_s3_key', {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }
    if (!tableInfo.tracking_page_color) {
      await queryInterface.addColumn('tenants', 'tracking_page_color', {
        type: Sequelize.STRING(7),
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Gracefully revert columns
    await queryInterface.removeColumn('tenants', 'legal_business_name');
    await queryInterface.removeColumn('tenants', 'pan_number');
    await queryInterface.removeColumn('tenants', 'gst_number');
    await queryInterface.removeColumn('tenants', 'gst_registered');
    await queryInterface.removeColumn('tenants', 'bank_account_number_encrypted');
    await queryInterface.removeColumn('tenants', 'bank_ifsc');
    await queryInterface.removeColumn('tenants', 'bank_account_holder_name');
    await queryInterface.removeColumn('tenants', 'bank_verified');
    await queryInterface.removeColumn('tenants', 'authorized_signatory_name');
    await queryInterface.removeColumn('tenants', 'aadhaar_last4');
    await queryInterface.removeColumn('tenants', 'kyc_rejection_reason');
    await queryInterface.removeColumn('tenants', 'kyc_submitted_at');
    await queryInterface.removeColumn('tenants', 'kyc_approved_at');
    await queryInterface.removeColumn('tenants', 'tracking_page_logo_s3_key');
    await queryInterface.removeColumn('tenants', 'tracking_page_color');
  },
};
