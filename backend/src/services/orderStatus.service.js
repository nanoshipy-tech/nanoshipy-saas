const { OrderStatusHistory } = require('../models');

class InvalidStatusTransitionError extends Error {
  constructor(oldStatus, newStatus) {
    super(`Invalid status transition from ${oldStatus} to ${newStatus}`);
    this.name = 'InvalidStatusTransitionError';
    this.code = 'INVALID_STATUS_TRANSITION';
    this.status = 422;
  }
}

class OrderStatusService {
  constructor() {
    this.validTransitions = {
      pending: ['processing', 'cancelled'],
      processing: ['ready_to_ship', 'cancelled'],
      ready_to_ship: ['shipped', 'processing'],
      shipped: ['ready_to_ship'],
      cancelled: [],
    };
  }

  /**
   * Validate if status transition is allowed
   * @param {string} oldStatus 
   * @param {string} newStatus 
   * @throws {InvalidStatusTransitionError}
   */
  validateTransition(oldStatus, newStatus) {
    if (oldStatus === newStatus) return;

    const allowed = this.validTransitions[oldStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new InvalidStatusTransitionError(oldStatus, newStatus);
    }
  }

  /**
   * Log status transition in history
   * @param {string} orderId 
   * @param {string} oldStatus 
   * @param {string} newStatus 
   * @param {string} userId 
   * @param {string} [note] 
   * @param {object} [transaction] 
   */
  async logHistory(orderId, oldStatus, newStatus, userId, note = null, transaction = null) {
    await OrderStatusHistory.create({
      order_id: orderId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: userId || null,
      note,
    }, { transaction });
  }
}

module.exports = new OrderStatusService();
module.exports.InvalidStatusTransitionError = InvalidStatusTransitionError;
