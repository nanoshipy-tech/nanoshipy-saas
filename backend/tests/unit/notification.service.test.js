'use strict';

const notificationService = require('../../src/services/notification.service');
const { NotificationTemplate, NotificationPreference, NotificationLog, User, Tenant } = require('../../src/models');
const { notificationDispatchQueue } = require('../../src/queue/queues/notificationDispatch.queue');

jest.mock('../../src/models', () => {
  return {
    NotificationTemplate: {
      findAll: jest.fn(),
    },
    NotificationPreference: {
      findOne: jest.fn(),
    },
    NotificationLog: {
      create: jest.fn().mockResolvedValue({ id: 'log-123' }),
    },
    User: {
      findOne: jest.fn(),
    },
    Tenant: {
      findByPk: jest.fn(),
    },
  };
});

jest.mock('../../src/queue/queues/notificationDispatch.queue', () => ({
  notificationDispatchQueue: {
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
  },
}));

describe('NotificationService - Unit Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should successfully perform simple and nested placeholder variables interpolation', () => {
    const payload = {
      order_reference: 'ORD-9876',
      customer: {
        name: 'Jane Doe',
      },
    };

    const templateSubject = 'Order {{order_reference}} is ready';
    const templateBody = 'Hello {{customer.name}}, order {{order_reference}} details inside.';

    const renderedSubject = notificationService.renderString(templateSubject, payload);
    const renderedBody = notificationService.renderString(templateBody, payload);

    expect(renderedSubject).toBe('Order ORD-9876 is ready');
    expect(renderedBody).toBe('Hello Jane Doe, order ORD-9876 details inside.');
  });

  test('should resolve preferences resolved in correct override chain', async () => {
    // 1. If user pref exists -> returns user value
    NotificationPreference.findOne.mockResolvedValueOnce({ is_enabled: false }); // User level
    let isEnabled = await notificationService.resolvePreference('tenant-1', 'user-1', 'order.created', 'sms');
    expect(isEnabled).toBe(false);

    // 2. If user pref missing, but tenant default exists -> returns tenant default
    NotificationPreference.findOne
      .mockResolvedValueOnce(null) // User level
      .mockResolvedValueOnce({ is_enabled: true }); // Tenant level
    isEnabled = await notificationService.resolvePreference('tenant-1', 'user-1', 'order.created', 'sms');
    expect(isEnabled).toBe(true);

    // 3. Fallback to true if no preference config registered
    NotificationPreference.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    isEnabled = await notificationService.resolvePreference('tenant-1', 'user-1', 'order.created', 'sms');
    expect(isEnabled).toBe(true);
  });

  test('should skip intermediate non-milestone tracking status updates for SMS/WhatsApp', async () => {
    // Ingesting a noisy non-milestone status scan
    const payload = {
      tenant_id: 'tenant-123',
      awb_number: 'AWB-5555',
      tracking_status: 'in_transit', // Not on allowlist
    };

    const mockTemplate = {
      event_key: 'tracking.status_changed',
      channel: 'sms',
      body_template: 'AWB {{awb_number}} is {{tracking_status}}',
      is_active: true,
    };

    NotificationTemplate.findAll.mockResolvedValue([mockTemplate]);
    
    await notificationService.dispatch('tracking.status_changed', payload);

    // SMS is bypassed because in_transit is a noisy intermediate status
    expect(notificationDispatchQueue.add).not.toHaveBeenCalled();
  });

  test('should allow milestone tracking status updates to be dispatched', async () => {
    // milestone status update
    const payload = {
      tenant_id: 'tenant-123',
      awb_number: 'AWB-5555',
      tracking_status: 'out_for_delivery', // Allowlisted milestone
      phone: '919876543210',
    };

    const mockTemplate = {
      event_key: 'tracking.status_changed',
      channel: 'sms',
      body_template: 'AWB {{awb_number}} is {{tracking_status}}',
      is_active: true,
    };

    NotificationTemplate.findAll.mockResolvedValue([mockTemplate]);
    NotificationPreference.findOne.mockResolvedValue({ is_enabled: true }); // enabled
    
    await notificationService.dispatch('tracking.status_changed', payload);

    expect(notificationDispatchQueue.add).toHaveBeenCalled();
  });

});
