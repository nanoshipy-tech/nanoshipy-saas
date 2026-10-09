'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert('notification_templates', [
      // 1. order.created
      {
        id: uuidv4(),
        event_key: 'order.created',
        channel: 'inapp',
        subject: null,
        body_template: 'New order #{{order_reference}} has been imported/created.',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        event_key: 'order.created',
        channel: 'email',
        subject: 'Order #{{order_reference}} Imported Successfully',
        body_template: '<p>Hello,</p><p>Your order <strong>#{{order_reference}}</strong> for customer <strong>{{customer_name}}</strong> has been imported/created in the system and is ready to ship.</p>',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },

      // 2. order.status_changed
      {
        id: uuidv4(),
        event_key: 'order.status_changed',
        channel: 'inapp',
        subject: null,
        body_template: 'Order #{{order_reference}} status changed to {{status}}.',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },

      // 3. shipment.created
      {
        id: uuidv4(),
        event_key: 'shipment.created',
        channel: 'inapp',
        subject: null,
        body_template: 'Consignment shipment booked successfully with AWB {{awb_number}}.',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        event_key: 'shipment.created',
        channel: 'email',
        subject: 'Shipment Booked for AWB: {{awb_number}}',
        body_template: '<p>Hello,</p><p>Your consignment shipment for order <strong>#{{order_reference}}</strong> has been booked with <strong>{{provider_name}}</strong>. AWB: <strong>{{awb_number}}</strong>.</p>',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        event_key: 'shipment.created',
        channel: 'sms',
        subject: null,
        body_template: 'Shipment booked. AWB: {{awb_number}}, Courier: {{provider_name}}. Track on your portal.',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },

      // 4. shipment.cancelled
      {
        id: uuidv4(),
        event_key: 'shipment.cancelled',
        channel: 'inapp',
        subject: null,
        body_template: 'Shipment with AWB {{awb_number}} has been cancelled.',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        event_key: 'shipment.cancelled',
        channel: 'email',
        subject: 'Shipment Cancellation: AWB {{awb_number}}',
        body_template: '<p>Hello,</p><p>The shipment with AWB <strong>{{awb_number}}</strong> has been cancelled. A refund of <strong>Rs. {{refund_amount}}</strong> has been credited to your prepaid wallet.</p>',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },

      // 5. tracking.status_changed
      {
        id: uuidv4(),
        event_key: 'tracking.status_changed',
        channel: 'inapp',
        subject: null,
        body_template: 'Tracking milestone updated for AWB {{awb_number}}: {{tracking_status}} ({{location}}).',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        event_key: 'tracking.status_changed',
        channel: 'sms',
        subject: null,
        body_template: 'AWB {{awb_number}} is now {{tracking_status}}.',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },

      // 6. ndr.created
      {
        id: uuidv4(),
        event_key: 'ndr.created',
        channel: 'inapp',
        subject: null,
        body_template: 'NDR Alert for AWB {{awb_number}}: Delivery failed due to {{reason_code}}.',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        event_key: 'ndr.created',
        channel: 'email',
        subject: 'Urgent: NDR Action Required for AWB {{awb_number}}',
        body_template: '<p>Hello,</p><p>The delivery for AWB <strong>{{awb_number}}</strong> failed. Reason given: <strong>{{courier_reason}}</strong>. Please take action on your dashboard exception panel.</p>',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },

      // 7. ndr.action_taken
      {
        id: uuidv4(),
        event_key: 'ndr.action_taken',
        channel: 'inapp',
        subject: null,
        body_template: 'NDR Action ({{action_type}}) taken successfully for AWB {{awb_number}}.',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },

      // 8. rto.initiated
      {
        id: uuidv4(),
        event_key: 'rto.initiated',
        channel: 'inapp',
        subject: null,
        body_template: 'Shipment with AWB {{awb_number}} marked as RTO (Return to Origin).',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        event_key: 'rto.initiated',
        channel: 'email',
        subject: 'RTO Initiated: AWB {{awb_number}} returning to origin',
        body_template: '<p>Hello,</p><p>We wish to inform you that AWB <strong>{{awb_number}}</strong> is returning to your warehouse due to unsuccessful delivery attempts.</p>',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },

      // 9. wallet.low_balance
      {
        id: uuidv4(),
        event_key: 'wallet.low_balance',
        channel: 'inapp',
        subject: null,
        body_template: 'Low Wallet Balance! Current balance is Rs. {{balance}} (threshold Rs. {{threshold}}).',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        event_key: 'wallet.low_balance',
        channel: 'email',
        subject: 'Urgent: Low Wallet Balance Alert',
        body_template: '<p>Hello,</p><p>Your prepaid shipping wallet balance has dropped below the threshold. Balance: <strong>Rs. {{balance}}</strong> (Threshold: Rs. {{threshold}}).</p>',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('notification_templates', null, {});
  },
};
