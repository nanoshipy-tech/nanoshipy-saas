'use strict';

/**
 * Abstract Notification Channel interface.
 * All notification delivery channels must subclass and implement send.
 */
class NotificationChannel {
  /**
   * Dispatches a rendered notification template to the target recipient.
   * @param {Object} options
   * @param {string} options.recipient - Target email, phone number, user_id, etc.
   * @param {string} [options.subject] - Optional subject (used primarily by email channel)
   * @param {string} options.body - Rendered template body text or HTML
   * @param {Object} [options.metadata] - Extra metadata (tenant_id, user_id, meta_template_name, etc.)
   * @returns {Promise<{success: boolean, providerMessageId: string|null, error: string|null}>}
   */
  async send({ recipient, subject, body, metadata }) {
    throw new Error('NotificationChannel.send method must be implemented by subclass.');
  }
}

module.exports = NotificationChannel;
