'use strict';

describe('WhatsApp Opt-In DPDP Act Compliance Unit Test (#20)', () => {
  let notificationDispatcher;
  let mockWhatsappSend;
  let mockSmsSend;
  let mockEmailSend;

  beforeEach(() => {
    jest.resetModules();
    mockWhatsappSend = jest.fn().mockResolvedValue({ success: true });
    mockSmsSend = jest.fn().mockResolvedValue({ success: true });
    mockEmailSend = jest.fn().mockResolvedValue({ success: true });

    jest.doMock('../../src/services/whatsappAdapter.service', () => ({
      sendTemplateMessage: mockWhatsappSend,
    }));
    jest.doMock('../../src/services/sms.service', () => ({
      sendSMS: mockSmsSend,
    }));
    jest.doMock('../../src/services/email.service', () => ({
      sendEmail: mockEmailSend,
    }));
    jest.doMock('../../src/models', () => ({
      NotificationLog: { create: jest.fn().mockResolvedValue({}) },
      Order: {},
    }));

    notificationDispatcher = require('../../src/services/notificationDispatcher.service');
  });

  it('skips WhatsApp when whatsapp_opted_in is false and falls back to SMS', async () => {
    const result = await notificationDispatcher.dispatch({
      tenantId: 'tenant-1',
      recipientPhone: '+919999999999',
      recipientEmail: 'test@example.com',
      event: 'shipment_dispatched',
      data: {
        whatsapp_opted_in: false,
        customerName: 'Aarav',
      },
    });

    expect(mockWhatsappSend).not.toHaveBeenCalled();
    expect(mockSmsSend).toHaveBeenCalledWith(
      '+919999999999',
      expect.stringContaining('Shipping Update')
    );
    expect(result.channel).toBe('sms');
  });

  it('attempts WhatsApp when whatsapp_opted_in is true', async () => {
    const result = await notificationDispatcher.dispatch({
      tenantId: 'tenant-1',
      recipientPhone: '+919999999999',
      recipientEmail: 'test@example.com',
      event: 'shipment_dispatched',
      data: {
        whatsapp_opted_in: true,
        customerName: 'Aarav',
      },
    });

    expect(mockWhatsappSend).toHaveBeenCalled();
    expect(result.channel).toBe('whatsapp');
  });
});
