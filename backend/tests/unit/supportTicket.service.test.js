'use strict';

jest.mock('../../src/models', () => {
  const mockTransaction = jest.fn((cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
  return {
    sequelize: {
      transaction: mockTransaction,
    },
    SupportTicket: {
      create: jest.fn(),
      findByPk: jest.fn(),
    },
    TicketMessage: {
      create: jest.fn(),
    },
    TicketAttachment: {
      create: jest.fn(),
    },
    Order: {
      findByPk: jest.fn(),
    },
    Shipment: {
      findByPk: jest.fn(),
      findOne: jest.fn(),
    },
    PlatformAdmin: {
      findByPk: jest.fn(),
    },
    SystemSequence: {
      findOne: jest.fn(),
      create: jest.fn(),
    }
  };
});

const supportTicketService = require('../../src/services/supportTicket.service');

describe('SupportTicketService - Unit Tests', () => {
  let mockTicket;
  let mockShipment;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTicket = {
      id: 'ticket-uuid-123',
      tenant_id: 'tenant-uuid-abc',
      ticket_number: 'TKT-000001',
      subject: 'NDR Dispute',
      status: 'open',
      priority: 'medium',
      first_response_at: null,
      resolved_at: null,
      update: jest.fn().mockImplementation(function (data) {
        Object.assign(this, data);
        return this;
      }),
    };
    mockShipment = {
      id: 'shipment-uuid-123',
      awb_number: 'AWB-TEST-001',
      tenant_id: 'tenant-uuid-abc',
      order_id: 'order-uuid-001',
    };
  });

  describe('createTicket', () => {
    test('should create ticket successfully when given a valid shipment UUID', async () => {
      const { SupportTicket, TicketMessage, SystemSequence, Shipment } = require('../../src/models');

      Shipment.findOne.mockResolvedValue(mockShipment);
      SystemSequence.findOne.mockResolvedValue({
        last_value: 0,
        update: jest.fn(),
      });
      SupportTicket.create.mockResolvedValue(mockTicket);
      TicketMessage.create.mockResolvedValue({ id: 'msg-1' });

      const result = await supportTicketService.createTicket('tenant-uuid-abc', 'user-1', {
        subject: 'Invoice Issue',
        category: 'billing',
        priority: 'high',
        message: 'There is a billing mismatch.',
        related_shipment_id: 'shipment-uuid-123',
      });

      expect(result.id).toBe('ticket-uuid-123');
      expect(SupportTicket.create).toHaveBeenCalled();
      expect(TicketMessage.create).toHaveBeenCalled();
      // Verify shipment was looked up by Op.or (UUID + AWB)
      expect(Shipment.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: 'tenant-uuid-abc' }),
        })
      );
    });

    test('should create ticket successfully when given an AWB number instead of UUID', async () => {
      const { SupportTicket, TicketMessage, SystemSequence, Shipment } = require('../../src/models');

      Shipment.findOne.mockResolvedValue(mockShipment);
      SystemSequence.findOne.mockResolvedValue({
        last_value: 1,
        update: jest.fn(),
      });
      SupportTicket.create.mockResolvedValue(mockTicket);
      TicketMessage.create.mockResolvedValue({ id: 'msg-1' });

      const result = await supportTicketService.createTicket('tenant-uuid-abc', 'user-1', {
        subject: 'AWB Tracking Issue',
        category: 'shipment_issue',
        priority: 'high',
        message: 'My shipment has not moved in 4 days.',
        related_shipment_id: 'AWB-TEST-001', // AWB number instead of UUID
      });

      expect(result.id).toBe('ticket-uuid-123');
      expect(Shipment.findOne).toHaveBeenCalled();
      expect(SupportTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({ related_shipment_id: 'shipment-uuid-123' }), // should store canonical UUID
        expect.anything()
      );
    });

    test('should throw NotFoundError when related_shipment_id is missing', async () => {
      await expect(
        supportTicketService.createTicket('tenant-uuid-abc', 'user-1', {
          subject: 'Billing Issue',
          category: 'billing',
          message: 'There is a billing mismatch.',
          // related_shipment_id intentionally omitted
        })
      ).rejects.toThrow('Linked Shipment ID is mandatory');
    });

    test('should throw NotFoundError when related_shipment_id is empty string', async () => {
      await expect(
        supportTicketService.createTicket('tenant-uuid-abc', 'user-1', {
          subject: 'Billing Issue',
          category: 'billing',
          message: 'There is a billing mismatch.',
          related_shipment_id: '   ', // whitespace only
        })
      ).rejects.toThrow('Linked Shipment ID is mandatory');
    });

    test('should throw NotFoundError if shipment not found or belongs to another tenant', async () => {
      const { Shipment } = require('../../src/models');
      Shipment.findOne.mockResolvedValue(null); // Not found

      await expect(
        supportTicketService.createTicket('tenant-uuid-abc', 'user-1', {
          subject: 'Shipment Issue',
          category: 'shipment_issue',
          message: 'My shipment is missing.',
          related_shipment_id: 'nonexistent-awb-999',
        })
      ).rejects.toThrow('Referenced shipment was not found for your account.');
    });

    test('should throw CrossTenantReferenceError if explicitly linked order belongs to another tenant', async () => {
      const { Order, Shipment } = require('../../src/models');
      Shipment.findOne.mockResolvedValue(mockShipment);
      Order.findByPk.mockResolvedValue({ id: 'order-123', tenant_id: 'other-tenant-xyz' });

      await expect(
        supportTicketService.createTicket('tenant-uuid-abc', 'user-1', {
          subject: 'Order Issue',
          category: 'shipment_issue',
          message: 'My order did not arrive.',
          related_shipment_id: 'AWB-TEST-001',
          related_order_id: 'order-123', // explicitly provided — wrong tenant
        })
      ).rejects.toThrow('The referenced order does not belong to this tenant.');
    });

    test('should auto-link order_id from shipment when not explicitly provided', async () => {
      const { SupportTicket, TicketMessage, SystemSequence, Shipment } = require('../../src/models');

      Shipment.findOne.mockResolvedValue(mockShipment); // mockShipment.order_id = 'order-uuid-001'
      SystemSequence.findOne.mockResolvedValue({ last_value: 0, update: jest.fn() });
      SupportTicket.create.mockResolvedValue(mockTicket);
      TicketMessage.create.mockResolvedValue({ id: 'msg-1' });

      await supportTicketService.createTicket('tenant-uuid-abc', 'user-1', {
        subject: 'Delivery Issue',
        category: 'shipment_issue',
        message: 'Package not delivered.',
        related_shipment_id: 'AWB-TEST-001',
      });

      expect(SupportTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({ related_order_id: 'order-uuid-001' }),
        expect.anything()
      );
    });
  });

  describe('replyToTicket', () => {
    test('should allow replying to an open ticket and link attachments', async () => {
      const { SupportTicket, TicketMessage } = require('../../src/models');
      SupportTicket.findByPk.mockResolvedValue(mockTicket);
      TicketMessage.create.mockResolvedValue({ id: 'msg-reply' });

      const result = await supportTicketService.replyToTicket(
        'ticket-uuid-123',
        'tenant_user',
        'user-1',
        { message: 'Still waiting on help.' }
      );

      expect(result.id).toBe('msg-reply');
      expect(TicketMessage.create).toHaveBeenCalled();
    });

    test('should reopen a resolved ticket to in_progress if tenant user replies', async () => {
      const { SupportTicket } = require('../../src/models');
      mockTicket.status = 'resolved';
      mockTicket.resolved_at = new Date();
      SupportTicket.findByPk.mockResolvedValue(mockTicket);

      await supportTicketService.replyToTicket(
        'ticket-uuid-123',
        'tenant_user',
        'user-1',
        { message: 'No, this is not resolved yet!' }
      );

      expect(mockTicket.status).toBe('in_progress');
      expect(mockTicket.resolved_at).toBeNull();
    });

    test('should reject replies if the ticket is already closed', async () => {
      const { SupportTicket } = require('../../src/models');
      mockTicket.status = 'closed';
      SupportTicket.findByPk.mockResolvedValue(mockTicket);

      await expect(
        supportTicketService.replyToTicket(
          'ticket-uuid-123',
          'tenant_user',
          'user-1',
          { message: 'Trying to reply to closed ticket.' }
        )
      ).rejects.toThrow('Cannot reply to a closed support ticket.');
    });
  });

  describe('closeTicket', () => {
    test('should allow a tenant to close a ticket that is resolved', async () => {
      const { SupportTicket } = require('../../src/models');
      mockTicket.status = 'resolved';
      SupportTicket.findByPk.mockResolvedValue(mockTicket);

      const result = await supportTicketService.closeTicket('ticket-uuid-123', 'tenant-uuid-abc');
      expect(result.status).toBe('closed');
    });

    test('should throw TicketNotResolvedError if tenant attempts to close unresolved ticket', async () => {
      const { SupportTicket } = require('../../src/models');
      mockTicket.status = 'in_progress';
      SupportTicket.findByPk.mockResolvedValue(mockTicket);

      await expect(
        supportTicketService.closeTicket('ticket-uuid-123', 'tenant-uuid-abc')
      ).rejects.toThrow('Only resolved support tickets can be closed by tenants.');
    });
  });
});
