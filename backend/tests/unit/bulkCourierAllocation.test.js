'use strict';

const bulkCourierAllocationService = require('../../src/services/bulkCourierAllocation.service');
const courierRoutingService = require('../../src/services/courierRouting.service');
const pricingService = require('../../src/services/pricing.service');
const shipmentService = require('../../src/services/shipment.service');
const stCourierDistrictRateRepo = require('../../src/repositories/stCourierDistrictRate.repository');
const {
  Order,
  PickupAddress,
  CourierProvider,
  Shipment,
  ShipmentRateQuote,
} = require('../../src/models');

describe('BulkCourierAllocationService', () => {
  const tenantId = 'tenant-test-123';
  const userId = 'user-test-456';

  const mockStProvider = {
    id: 'prov-st-1',
    provider_key: 'stcourier',
    display_name: 'ST Courier',
    is_active: true,
  };

  const mockShipwayProvider = {
    id: 'prov-sw-2',
    provider_key: 'shipway',
    display_name: 'Shipway',
    is_active: true,
  };

  const mockPickupAddress = {
    id: 'addr-pickup-1',
    pincode: '600001',
    state: 'Tamil Nadu',
    shipway_location_id: 'WH-TN-01',
    label: 'Chennai Central Hub',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Validation', () => {
    it('should throw BadRequestError if orderIds is empty or not an array', async () => {
      await expect(
        bulkCourierAllocationService.bulkAllocateCouriers([], tenantId, userId)
      ).rejects.toThrow('order_ids must be a non-empty array of order IDs.');

      await expect(
        bulkCourierAllocationService.bulkAllocateCouriers(null, tenantId, userId)
      ).rejects.toThrow('order_ids must be a non-empty array of order IDs.');
    });

    it('should throw BadRequestError if orderIds exceeds 100', async () => {
      const largeBatch = Array(101).fill('order-id');
      await expect(
        bulkCourierAllocationService.bulkAllocateCouriers(largeBatch, tenantId, userId)
      ).rejects.toThrow('Cannot process more than 100 orders');
    });
  });

  describe('Routing & Dispatch Execution', () => {
    it('should route intra-Tamil Nadu order to ST Courier with district-wise rate rules', async () => {
      const orderTn = {
        id: 'order-tn-1',
        order_reference: 'ORD-TN-001',
        status: 'ready_to_ship',
        shipping_pincode: '641001',
        shipping_city: 'Coimbatore',
        shipping_state: 'Tamil Nadu',
        weight_kg: '1.2',
        payment_mode: 'prepaid',
        pickupAddress: mockPickupAddress,
        update: jest.fn(),
      };

      jest.spyOn(CourierProvider, 'findOne').mockImplementation(({ where }) => {
        if (where.provider_key === 'stcourier') return Promise.resolve(mockStProvider);
        if (where.provider_key === 'shipway') return Promise.resolve(mockShipwayProvider);
        return Promise.resolve(null);
      });

      jest.spyOn(PickupAddress, 'findOne').mockResolvedValue(mockPickupAddress);
      jest.spyOn(Order, 'findAll').mockResolvedValue([orderTn]);
      jest.spyOn(Shipment, 'findOne').mockResolvedValue(null);
      jest.spyOn(ShipmentRateQuote, 'create').mockResolvedValue({ id: 'quote-1' });

      jest.spyOn(courierRoutingService, 'determineAssignedCourier').mockResolvedValue({
        providerKey: 'stcourier',
        region: 'Tamil Nadu',
        isLocal: true,
        zoneName: 'Intra-State / Tamil Nadu',
        routingReason: 'Intra-Tamil Nadu shipment allocated to ST Courier network',
      });

      jest.spyOn(stCourierDistrictRateRepo, 'findByDistrict').mockResolvedValue({
        destination_district: 'Coimbatore',
        first_500g_rate: '35.00',
        additional_500g_rate: '18.00',
        above_10kg_per_kg_rate: '28.00',
      });

      const mockCreatedShipment = {
        id: 'shipment-st-1',
        awb_number: 'ST99887766',
        label_url: '/uploads/labels/st-label.pdf',
        status: 'awb_generated',
      };
      jest.spyOn(shipmentService, 'createShipment').mockResolvedValue(mockCreatedShipment);

      const result = await bulkCourierAllocationService.bulkAllocateCouriers(['order-tn-1'], tenantId, userId);

      expect(result.total).toBe(1);
      expect(result.allocated_count).toBe(1);
      expect(result.breakdown.st_courier).toBe(1);
      expect(result.breakdown.shipway).toBe(0);
      expect(result.successful[0].awb_number).toBe('ST99887766');
      expect(result.successful[0].provider_key).toBe('stcourier');
      expect(shipmentService.createShipment).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: 'order-tn-1',
          courier_provider_id: mockStProvider.id,
          service_type: 'st_courier_surface',
        }),
        tenantId,
        userId,
        null
      );
    });

    it('should route interstate order to Shipway as per Shipway courier rules', async () => {
      const orderRoi = {
        id: 'order-roi-2',
        order_reference: 'ORD-ROI-002',
        status: 'pending',
        shipping_pincode: '110001',
        shipping_city: 'New Delhi',
        shipping_state: 'Delhi',
        weight_kg: '0.8',
        payment_mode: 'prepaid',
        pickupAddress: mockPickupAddress,
        update: jest.fn(),
      };

      jest.spyOn(CourierProvider, 'findOne').mockImplementation(({ where }) => {
        if (where.provider_key === 'stcourier') return Promise.resolve(mockStProvider);
        if (where.provider_key === 'shipway') return Promise.resolve(mockShipwayProvider);
        return Promise.resolve(null);
      });

      jest.spyOn(PickupAddress, 'findOne').mockResolvedValue(mockPickupAddress);
      jest.spyOn(Order, 'findAll').mockResolvedValue([orderRoi]);
      jest.spyOn(Shipment, 'findOne').mockResolvedValue(null);

      jest.spyOn(courierRoutingService, 'determineAssignedCourier').mockResolvedValue({
        providerKey: 'shipway',
        region: 'Delhi',
        isLocal: false,
        zoneName: 'National Express Network',
        routingReason: 'Interstate shipment allocated to Shipway',
      });

      jest.spyOn(pricingService, 'getTenantRates').mockResolvedValue({
        order_id: 'order-roi-2',
        rates: [
          {
            courier_provider_id: mockShipwayProvider.id,
            display_name: 'Delhivery Surface',
            service_type: '80622',
            price: 68.50,
            cod_charge: 0,
            is_allocated: true,
          },
        ],
      });

      const mockCreatedShipment = {
        id: 'shipment-sw-2',
        awb_number: 'DL123456789IN',
        label_url: '/uploads/labels/dl-label.pdf',
        status: 'awb_generated',
      };
      jest.spyOn(shipmentService, 'createShipment').mockResolvedValue(mockCreatedShipment);

      const result = await bulkCourierAllocationService.bulkAllocateCouriers(['order-roi-2'], tenantId, userId);

      expect(result.total).toBe(1);
      expect(result.allocated_count).toBe(1);
      expect(result.breakdown.st_courier).toBe(0);
      expect(result.breakdown.shipway).toBe(1);
      expect(result.successful[0].awb_number).toBe('DL123456789IN');
      expect(result.successful[0].provider_key).toBe('shipway');
      expect(shipmentService.createShipment).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: 'order-roi-2',
          courier_provider_id: mockShipwayProvider.id,
          service_type: '80622',
        }),
        tenantId,
        userId,
        null
      );
    });

    it('should skip orders that already have an active shipment with AWB', async () => {
      const orderAlreadyShipped = {
        id: 'order-shipped-3',
        order_reference: 'ORD-SHP-003',
        status: 'ready_to_ship',
        pickupAddress: mockPickupAddress,
      };

      jest.spyOn(Order, 'findAll').mockResolvedValue([orderAlreadyShipped]);
      jest.spyOn(Shipment, 'findOne').mockResolvedValue({
        id: 'shipment-existing',
        awb_number: 'AWB999',
        status: 'awb_generated',
      });

      const result = await bulkCourierAllocationService.bulkAllocateCouriers(['order-shipped-3'], tenantId, userId);

      expect(result.total).toBe(1);
      expect(result.allocated_count).toBe(0);
      expect(result.skipped_count).toBe(1);
      expect(result.skipped[0].awb_number).toBe('AWB999');
    });

    it('should gracefully handle partial batch failures without aborting successful orders', async () => {
      const orderFail = {
        id: 'order-fail-4',
        order_reference: 'ORD-FAIL-004',
        status: 'ready_to_ship',
        shipping_pincode: '110001',
        pickupAddress: { pincode: '600001', shipway_location_id: null }, // Missing warehouse ID
        update: jest.fn(),
      };

      const orderPass = {
        id: 'order-pass-5',
        order_reference: 'ORD-PASS-005',
        status: 'ready_to_ship',
        shipping_pincode: '600002',
        shipping_city: 'Chennai',
        shipping_state: 'Tamil Nadu',
        weight_kg: '0.5',
        pickupAddress: mockPickupAddress,
        update: jest.fn(),
      };

      jest.spyOn(CourierProvider, 'findOne').mockImplementation(({ where }) => {
        if (where.provider_key === 'stcourier') return Promise.resolve(mockStProvider);
        if (where.provider_key === 'shipway') return Promise.resolve(mockShipwayProvider);
        return Promise.resolve(null);
      });

      jest.spyOn(Order, 'findAll').mockResolvedValue([orderFail, orderPass]);
      jest.spyOn(Shipment, 'findOne').mockResolvedValue(null);
      jest.spyOn(ShipmentRateQuote, 'create').mockResolvedValue({ id: 'quote-pass' });

      jest.spyOn(courierRoutingService, 'determineAssignedCourier')
        .mockResolvedValueOnce({
          providerKey: 'shipway',
          isLocal: false,
        })
        .mockResolvedValueOnce({
          providerKey: 'stcourier',
          isLocal: true,
        });

      jest.spyOn(stCourierDistrictRateRepo, 'findByDistrict').mockResolvedValue(null);
      jest.spyOn(shipmentService, 'createShipment').mockResolvedValue({
        id: 'shipment-pass-5',
        awb_number: 'ST555555',
        status: 'awb_generated',
      });

      const result = await bulkCourierAllocationService.bulkAllocateCouriers(['order-fail-4', 'order-pass-5'], tenantId, userId);

      expect(result.total).toBe(2);
      expect(result.allocated_count).toBe(1);
      expect(result.failed_count).toBe(1);
      expect(result.failed[0].order_reference).toBe('ORD-FAIL-004');
      expect(result.successful[0].order_reference).toBe('ORD-PASS-005');
    });
  });
});
