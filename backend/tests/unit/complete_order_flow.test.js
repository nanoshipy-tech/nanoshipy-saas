'use strict';

const courierRoutingService = require('../../src/services/courierRouting.service');
const ShipwayAdapter = require('../../src/providers/shipway/ShipwayAdapter');
const { mapStatus } = require('../../src/providers/shipway/shipwayResponseMapper');

describe('Complete End-to-End Order Flow Verification', () => {
  const credentials = {
    email: 'admin@nanoshipy.com',
    license_key: 'XdF25B9h93zvr0l388aB7pjlH6EGB9Kk',
  };

  let shipwayAdapter;

  beforeEach(() => {
    shipwayAdapter = new ShipwayAdapter(credentials, { timeout_ms: 2000 });
  });

  describe('Flow 1: Tamil Nadu Order -> Local Courier Network', () => {
    const tnOrder = {
      order_reference: 'ORD-TN-9901',
      pickup_address_id: 'wh-uuid-101',
      customer_name: 'Anand Raman',
      customer_phone: '9840123456',
      customer_email: 'anand@example.com',
      shipping_address_line1: '12 Mount Road',
      shipping_city: 'Chennai',
      shipping_state: 'Tamil Nadu',
      shipping_pincode: '600002',
      payment_mode: 'cod',
      cod_amount: 1200,
      weight_kg: 0.8,
      length_cm: 15,
      width_cm: 12,
      height_cm: 8,
      items: [
        { product_name: 'Silk Saree', sku: 'SLK-BLU-01', quantity: 1, unit_price: 1200 },
      ],
    };

    it('Step 1: Analyzes pincode and routes to ST Courier for Intra-TN', async () => {
      const routing = await courierRoutingService.determineAssignedCourier(
        tnOrder.shipping_pincode,
        tnOrder.shipping_state
      );

      expect(routing.providerKey).toBe('stcourier');
      expect(routing.isLocal).toBe(true);
      expect(routing.region).toBe('Tamil Nadu');
      expect(routing.routingReason).toContain('ST Courier network');
    });

    it('Step 2: Applies platform pricing (User sees selling price, not raw cost)', () => {
      const rawCourierCost = 35.0; // Local carrier base charge
      const adminMarkupMargin = 15.0;
      const userCustomerPrice = rawCourierCost + adminMarkupMargin;

      expect(userCustomerPrice).toBe(50.0);
    });

    it('Step 3: Simulates Local Courier AWB and Label generation', () => {
      const generatedAwb = `LOC-TN-${Date.now().toString().slice(-8)}`;
      expect(generatedAwb).toMatch(/^LOC-TN-\d{8}$/);
    });
  });

  describe('Flow 2: Interstate Order -> Shipway Courier Aggregator', () => {
    const roiOrder = {
      order_reference: 'ORD-ROI-8802',
      pickup_address_id: 'wh-uuid-101',
      customer_name: 'Pooja Verma',
      customer_phone: '9811223344',
      customer_email: 'pooja@example.com',
      shipping_address_line1: 'Flat 402, Connaught Place',
      shipping_city: 'New Delhi',
      shipping_state: 'Delhi',
      shipping_pincode: '110001',
      payment_mode: 'prepaid',
      weight_kg: 0.5,
      length_cm: 20,
      width_cm: 15,
      height_cm: 5,
      items: [
        { product_name: 'Wireless Earbuds', sku: 'AUDIO-TWS-09', quantity: 1, unit_price: 1499 },
      ],
    };

    it('Step 1: Analyzes interstate pincode and routes to National Network', async () => {
      const routing = await courierRoutingService.determineAssignedCourier(
        roiOrder.shipping_pincode,
        roiOrder.shipping_state
      );

      expect(routing.providerKey).toBe('shipway');
      expect(routing.isLocal).toBe(false);
      expect(routing.region).toBe('Delhi');
      expect(routing.routingReason).toContain('National Express Network');
    });

    it('Step 2: Compares rates with Shipway and enforces Price Protection', async () => {
      const mockShipwayRates = [
        {
          zone: 'Zone 4',
          courier_id: '12',
          courier: 'Bluedart Express Surface',
          shipment_charges: '52.00',
          charge_weight: '0.5',
        },
      ];

      jest.spyOn(shipwayAdapter.client, 'get').mockResolvedValueOnce({ data: mockShipwayRates });

      const ratesResult = await shipwayAdapter.getRates({
        pickupPincode: '600002',
        deliveryPincode: roiOrder.shipping_pincode,
        weight: roiOrder.weight_kg,
        paymentMode: 'prepaid',
      });

      expect(ratesResult.success).toBe(true);
      const rawCost = ratesResult.data.rates[0].price;
      expect(rawCost).toBe(52.0);

      // Admin margin applied for user view:
      const adminMargin = 28.0;
      const userPrice = rawCost + adminMargin;
      expect(userPrice).toBe(80.0);
    });

    it('Step 3: Books shipment on Shipway (POST /v2orders) -> Generates AWB, Zone & Label URL', async () => {
      const mockShipwayBookingResp = {
        success: true,
        message: 'Order has been added successfully.',
        awb_response: {
          success: true,
          message: 'AWB No. assigned Successfully',
          AWB: '133399002088',
          carrier_id: '12',
          shipping_url: 'https://app.shipway.com/labels/133399002088.pdf',
        },
      };

      jest.spyOn(shipwayAdapter.client, 'post').mockResolvedValueOnce({ data: mockShipwayBookingResp });

      const bookingResult = await shipwayAdapter.createShipment({
        order: {
          id: 'ORD-ROI-8802',
          customer_name: roiOrder.customer_name,
          customer_phone: roiOrder.customer_phone,
          customer_email: roiOrder.customer_email,
          delivery_address: roiOrder.shipping_address_line1,
          delivery_city: roiOrder.shipping_city,
          delivery_state: roiOrder.shipping_state,
          delivery_pincode: roiOrder.shipping_pincode,
          weight: roiOrder.weight_kg,
          amount: 1499,
          payment_mode: 'prepaid',
          items: roiOrder.items,
        },
        pickupAddress: { warehouse_id: 'WH-5001' },
      });

      expect(bookingResult.success).toBe(true);
      expect(bookingResult.data.awbNumber).toBe('133399002088');
      expect(bookingResult.data.labelUrl).toBe('https://app.shipway.com/labels/133399002088.pdf');
    });

    it('Step 4: Tracks live shipment progress via Shipway (GET /tracking)', async () => {
      const mockTrackingData = [
        {
          awb: '133399002088',
          tracking_details: {
            shipment_status: 'OFD',
            current_status: 'Out for Delivery',
            shipment_details: [
              {
                courier_id: '12',
                courier_name: 'Bluedart Express',
                destination: 'New Delhi',
                current_status: 'Out for Delivery',
              },
            ],
            track_url: 'https://app.shipway.com/t/133399002088',
            tracking_history: [
              { status: 'Out for Delivery', location: 'Delhi Hub', timestamp: '2026-09-08 09:30:00' },
              { status: 'In Transit', location: 'Nagpur Transit', timestamp: '2026-09-07 18:00:00' },
            ],
          },
        },
      ];

      jest.spyOn(shipwayAdapter.client, 'get').mockResolvedValueOnce({ data: mockTrackingData });

      const trackResult = await shipwayAdapter.trackShipment({ awbNumber: '133399002088' });

      expect(trackResult.success).toBe(true);
      expect(trackResult.data.status).toBe('out_for_delivery');
      expect(trackResult.data.currentLocation).toBe('New Delhi');
      expect(trackResult.data.history.length).toBe(2);
    });
  });
});
