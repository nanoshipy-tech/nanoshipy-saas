const orderStatusService = require('../../src/services/orderStatus.service');
const { InvalidStatusTransitionError } = require('../../src/services/orderStatus.service');
const orderService = require('../../src/services/order.service');
const { DuplicateOrderReferenceError, OrderNotEditableError } = require('../../src/services/order.service');
const orderRepository = require('../../src/repositories/order.repository');
const auditService = require('../../src/services/audit.service');

jest.mock('../../src/repositories/order.repository', () => ({
  checkDuplicate: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findAndCountAll: jest.fn(),
}));

jest.mock('../../src/services/audit.service', () => ({
  log: jest.fn(),
}));

describe('OrderStatusService (State Machine) Unit Tests', () => {
  describe('validateTransition', () => {
    it('should allow valid transitions', () => {
      expect(() => orderStatusService.validateTransition('pending', 'processing')).not.toThrow();
      expect(() => orderStatusService.validateTransition('processing', 'ready_to_ship')).not.toThrow();
      expect(() => orderStatusService.validateTransition('pending', 'cancelled')).not.toThrow();
      expect(() => orderStatusService.validateTransition('processing', 'cancelled')).not.toThrow();
    });

    it('should throw InvalidStatusTransitionError for invalid transitions', () => {
      expect(() => orderStatusService.validateTransition('processing', 'pending')).toThrow(InvalidStatusTransitionError);
      expect(() => orderStatusService.validateTransition('ready_to_ship', 'cancelled')).toThrow(InvalidStatusTransitionError);
      expect(() => orderStatusService.validateTransition('cancelled', 'pending')).toThrow(InvalidStatusTransitionError);
    });
  });
});

describe('OrderService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should throw DuplicateOrderReferenceError when order reference already exists', async () => {
      orderRepository.checkDuplicate.mockResolvedValue({ id: 'existing-ord-id' });

      await expect(
        orderService.createOrder('tenant123', { order_reference: 'ORD-REF-001' }, 'user123')
      ).rejects.toThrow(DuplicateOrderReferenceError);
    });

    it('should create order successfully when reference is unique', async () => {
      orderRepository.checkDuplicate.mockResolvedValue(null);
      orderRepository.create.mockResolvedValue({ id: 'new-ord-id', order_reference: 'ORD-REF-001' });

      const data = {
        order_reference: 'ORD-REF-001',
        items: [{ product_name: 'Item A', quantity: 2, unit_price: 100 }]
      };

      const result = await orderService.createOrder('tenant123', data, 'user123');

      expect(orderRepository.create).toHaveBeenCalledWith(
        'tenant123',
        expect.objectContaining({ order_value: 200 }),
        data.items,
        'user123'
      );
      expect(result.id).toBe('new-ord-id');
    });
  });

  describe('updateOrder', () => {
    it('should throw OrderNotEditableError if status is cancelled or ready_to_ship', async () => {
      orderRepository.findById.mockResolvedValue({
        id: 'ord123',
        status: 'cancelled',
        order_reference: 'REF-1',
      });

      await expect(
        orderService.updateOrder('tenant123', 'ord123', { customer_name: 'John' }, 'user123')
      ).rejects.toThrow(OrderNotEditableError);
    });
  });
});
