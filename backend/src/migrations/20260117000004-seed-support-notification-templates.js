'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert('notification_templates', [
      // 1. ticket.created
      {
        id: uuidv4(),
        event_key: 'ticket.created',
        channel: 'inapp',
        subject: null,
        body_template: 'A new support ticket #{{ticket_number}} has been created: {{subject}}.',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        event_key: 'ticket.created',
        channel: 'email',
        subject: 'Support Ticket #{{ticket_number}} Raised Successfully',
        body_template: '<p>Hello,</p><p>A new support ticket has been raised in your account.</p><p><strong>Ticket Number:</strong> #{{ticket_number}}</p><p><strong>Subject:</strong> {{subject}}</p><p><strong>Category:</strong> {{category}}</p><p><strong>Priority:</strong> {{priority}}</p><p>Our support team will inspect and respond to it shortly.</p>',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },

      // 2. ticket.replied
      {
        id: uuidv4(),
        event_key: 'ticket.replied',
        channel: 'inapp',
        subject: null,
        body_template: 'New reply received on support ticket #{{ticket_number}}.',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        event_key: 'ticket.replied',
        channel: 'email',
        subject: 'New Reply on Support Ticket #{{ticket_number}}',
        body_template: '<p>Hello,</p><p>A new reply has been added to support ticket <strong>#{{ticket_number}}</strong>.</p><p><strong>Message Snippet:</strong></p><blockquote>{{message}}</blockquote><p>Please log in to your dashboard to view the full discussion thread.</p>',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },

      // 3. ticket.resolved
      {
        id: uuidv4(),
        event_key: 'ticket.resolved',
        channel: 'inapp',
        subject: null,
        body_template: 'Support ticket #{{ticket_number}} has been marked as resolved.',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        event_key: 'ticket.resolved',
        channel: 'email',
        subject: 'Support Ticket #{{ticket_number}} Resolved',
        body_template: '<p>Hello,</p><p>Support ticket <strong>#{{ticket_number}}</strong> ("{{subject}}") has been resolved by our support team.</p><p>Please review and confirm the resolution by closing the ticket. If you have further issues, replying to the ticket will reopen it automatically.</p>',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },

      // 4. ticket.sla_breach_warning
      {
        id: uuidv4(),
        event_key: 'ticket.sla_breach_warning',
        channel: 'inapp',
        subject: null,
        body_template: 'WARNING: Support ticket #{{ticket_number}} is breaching its SLA deadline!',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        event_key: 'ticket.sla_breach_warning',
        channel: 'email',
        subject: 'CRITICAL: SLA Breach Warning for Ticket #{{ticket_number}}',
        body_template: '<p>Hello Support Team,</p><p>The support ticket <strong>#{{ticket_number}}</strong> with priority <strong>{{priority}}</strong> has breached its SLA response limit.</p><p><strong>SLA Due Time:</strong> {{sla_due_at}}</p><p>Please assign or respond to this ticket immediately.</p>',
        is_active: true,
        version: 1,
        meta_template_name: null,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('notification_templates', {
      event_key: ['ticket.created', 'ticket.replied', 'ticket.resolved', 'ticket.sla_breach_warning'],
    });
  },
};
