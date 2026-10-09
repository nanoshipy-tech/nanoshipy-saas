'use strict';

const ShipwayAdapter = require('../../src/providers/shipway/ShipwayAdapter');

describe('Shipway Complete OMS End-to-End API Flow', () => {
  const credentials = {
    email: 'warehouse@yourcompany.com',
    license_key: 'XdF25B9h93zvr0l388aB7pjlH6EGB9Kk',
  };

  let adapter;

  beforeEach(() => {
    adapter = new ShipwayAdapter(credentials, { timeout_ms: 3000 });
  });

  // Step 1: Carrier Discovery
  test('Step 1: GET /api/getcarrier -> Discovers carrier IDs', async () => {
    const mockCarrierResp = {
      success: 1,
      error: '',
      message: [
        {
          id: '12',
          name: 'Bluedart',
          reverse_status: true,
          ndr_status: true,
          aggregator_carrier: false,
          carrier_title: 'Bluedart Production',
        },
        {
          id: '345',
          name: 'Xpressbees',
          reverse_status: true,
          ndr_status: false,
          aggregator_carrier: false,
          carrier_title: 'Xpressbees Main',
        },
      ],
    };

    const getSpy = jest.spyOn(adapter.client, 'get').mockResolvedValueOnce({ data: mockCarrierResp });
    const res = await adapter.getCarriers();

    expect(res.success).toBe(true);
    expect(res.data.message.length).toBe(2);
    expect(getSpy).toHaveBeenCalledWith(
      '/getcarrier',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
        }),
      })
    );
  });

  // Step 2: Warehouse Setup
  test('Step 2: POST /api/warehouse/ & GET /api/getwarehouses -> Manages pickup addresses', async () => {
    const mockCreateWarehouseResp = {
      success: true,
      error: false,
      message: 'Warehouse Created Successfully',
      warehouse_response: { warehouse_id: 'WH-5001' },
    };

    const postSpy = jest.spyOn(adapter.client, 'post').mockResolvedValueOnce({ data: mockCreateWarehouseResp });
    const createRes = await adapter.createWarehouse({
      title: 'Main Warehouse - Hyderabad',
      company: 'Your Company Name',
      contact_person_name: 'Rajesh Kumar',
      email: 'warehouse@yourcompany.com',
      phone: '+91-9999999999',
      address_1: 'Plot 45, HITEC City',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'IN',
      pincode: 500081,
    });

    expect(createRes.success).toBe(true);
    expect(createRes.data.warehouse_response.warehouse_id).toBe('WH-5001');

    const mockGetWarehouseResp = {
      success: true,
      data: [{ warehouse_id: 'WH-5001', title: 'Main Warehouse - Hyderabad' }],
    };
    jest.spyOn(adapter.client, 'get').mockResolvedValueOnce({ data: mockGetWarehouseResp });
    const getRes = await adapter.getWarehouses('WH-5001');
    expect(getRes.success).toBe(true);
  });

  // Step 3: Pincode Serviceability
  test('Step 3: GET /api/pincodeserviceable -> Validates pincode for Prepaid & COD', async () => {
    const mockServiceabilityResp = {
      success: 1,
      error: '',
      message: [
        { carrier_id: '345', name: 'Xpressbees', carrier_title: 'Xpressbees Main', payment_type: 'P' },
        { carrier_id: '345', name: 'Xpressbees', carrier_title: 'Xpressbees Main', payment_type: 'C' },
      ],
    };

    const getSpy = jest.spyOn(adapter.client, 'get').mockResolvedValueOnce({ data: mockServiceabilityResp });
    const res = await adapter.checkServiceability({
      deliveryPincode: '500081',
      paymentMode: 'prepaid',
    });

    expect(res.success).toBe(true);
    expect(res.data.serviceable).toBe(true);
    expect(res.data.serviceableCarriers.length).toBe(2);
    expect(getSpy).toHaveBeenCalledWith(
      '/pincodeserviceable',
      expect.objectContaining({
        params: { pincode: '500081', payment_type: 'P' },
      })
    );
  });

  // Step 4: Rate Comparison
  test('Step 4: GET /api/getshipwaycarrierrates -> Fetches and maps courier charges', async () => {
    const mockRatesResp = [
      {
        zone: 'Zone 3',
        courier_id: '345',
        courier: 'Shipway Delhivery Express (0.5kg)',
        shipment_charges: '65.50',
        charge_weight: '0.5',
      },
    ];

    const getSpy = jest.spyOn(adapter.client, 'get').mockResolvedValueOnce({ data: mockRatesResp });
    const res = await adapter.getRates({
      pickupPincode: '500081',
      deliveryPincode: '110001',
      weight: 0.5,
      paymentMode: 'prepaid',
    });

    expect(res.success).toBe(true);
    expect(res.data.rates[0].price).toBe(65.5);
    expect(res.data.rates[0].zone).toBe('Zone 3');
    expect(getSpy).toHaveBeenCalledWith(
      '/getshipwaycarrierrates',
      expect.objectContaining({
        params: expect.objectContaining({
          fromPincode: '500081',
          toPincode: '110001',
          paymentType: 'prepaid',
          weight: 0.5,
        }),
      })
    );
  });

  // Step 5: Push Order with Label Generation
  test('Step 5: POST /api/v2orders -> Generates AWB and shipping label PDF URL in one call', async () => {
    const mockOrderResp = {
      success: true,
      message: 'Order has been added successfully.',
      awb_response: {
        success: true,
        message: 'AWB No. assigned Successfully',
        AWB: '1333110020164',
        carrier_id: '345',
        shipping_url: 'https://app.shipway.com/labels/1333110020164.pdf',
      },
    };

    const postSpy = jest.spyOn(adapter.client, 'post').mockResolvedValueOnce({ data: mockOrderResp });
    const res = await adapter.createShipment({
      order: {
        id: 'OMS-10002',
        customer_name: 'Priya Sharma',
        customer_phone: '9876543210',
        customer_email: 'priya@example.com',
        delivery_address: 'Flat 12, Green Park',
        delivery_city: 'Hyderabad',
        delivery_state: 'Telangana',
        delivery_pincode: '500081',
        weight: 0.35, // in kg -> must convert to 350 grams
        amount: 699,
        payment_mode: 'prepaid',
        items: [
          {
            name: 'Blue Kurta',
            price: '699',
            sku: 'KRT-BL-M',
            quantity: 1,
            tax_rate: 5,
            tax_title: 'IGST',
          },
        ],
      },
      pickupAddress: {
        warehouse_id: 'WH-5001',
        return_warehouse_id: 'WH-5001',
      },
      serviceType: '345',
    });

    expect(res.success).toBe(true);
    expect(res.data.awbNumber).toBe('1333110020164');
    expect(res.data.labelUrl).toBe('https://app.shipway.com/labels/1333110020164.pdf');

    expect(postSpy).toHaveBeenCalledWith(
      '/v2orders',
      expect.objectContaining({
        order_id: 'OMS-10002',
        order_weight: 350,
        warehouse_id: 'WH-5001',
        payment_type: 'P',
        carrier_id: 345,
      }),
      expect.any(Object)
    );
  });

  // Step 6: Create Manifest
  test('Step 6: POST /api/Createmanifest/ -> Creates handover manifest document', async () => {
    const mockManifestResp = {
      status: true,
      message: 'Manifest created successfully.',
      'manifest ids': 'MNF-9901',
      error_response: [],
    };

    const postSpy = jest.spyOn(adapter.client, 'post').mockResolvedValueOnce({ data: mockManifestResp });
    const res = await adapter.createManifest({ orderIds: ['OMS-10002'] });

    expect(res.success).toBe(true);
    expect(res.data['manifest ids']).toBe('MNF-9901');
    expect(postSpy).toHaveBeenCalledWith(
      '/Createmanifest/',
      { order_ids: ['OMS-10002'] },
      expect.any(Object)
    );
  });

  // Step 7: Real-Time Tracking
  test('Step 7: GET /api/tracking -> Real-time status, scan history, and branded tracking page', async () => {
    const mockTrackingResp = [
      {
        awb: '1333110020164',
        tracking_details: {
          shipment_status: 'DEL',
          current_status: 'Delivered',
          shipment_details: [
            {
              courier_id: '345',
              courier_name: 'Shipway Delhivery Express (0.5kg)',
              order_id: 'OMS-10002',
              pickup_date: '2026-03-17',
              delivered_date: '2026-03-19',
              current_status: 'Delivered',
              delivered_to: 'Priya Sharma',
              destination: 'Hyderabad',
            },
          ],
          track_url: 'https://yourstore.shipway.com/t/1333110020164',
          tracking_history: [
            {
              status: 'Delivered',
              location: 'Hyderabad',
              timestamp: '2026-03-19 14:30:00',
              remarks: 'Delivered to consignee',
            },
          ],
        },
      },
    ];

    const getSpy = jest.spyOn(adapter.client, 'get').mockResolvedValueOnce({ data: mockTrackingResp });
    const res = await adapter.trackShipment({ awbNumber: '1333110020164' });

    expect(res.success).toBe(true);
    expect(res.data.status).toBe('delivered');
    expect(res.data.deliveredTo).toBe('Priya Sharma');
    expect(res.data.trackUrl).toBe('https://yourstore.shipway.com/t/1333110020164');
    expect(getSpy).toHaveBeenCalledWith(
      '/tracking',
      expect.objectContaining({
        params: { awb_numbers: '1333110020164', tracking_history: 1 },
      })
    );
  });

  // Step 8: Hold Order
  test('Step 8: POST /api/Onholdorders/ -> Puts order on hold', async () => {
    const mockHoldResp = [
      {
        order_id: 'OMS-10002',
        error: false,
        success: true,
        message: 'Order has marked Onhold successfully.',
      },
    ];

    const postSpy = jest.spyOn(adapter.client, 'post').mockResolvedValueOnce({ data: mockHoldResp });
    const res = await adapter.putOnHold({ orderIds: ['OMS-10002'] });

    expect(res.success).toBe(true);
    expect(postSpy).toHaveBeenCalledWith(
      '/Onholdorders/',
      { order_ids: ['OMS-10002'] },
      expect.any(Object)
    );
  });

  // Step 9: Cancel Order
  test('Step 9: POST /api/cancelorders/ -> Cancels order', async () => {
    const mockCancelResp = {
      success: true,
      message: 'Order cancelled successfully',
    };

    const postSpy = jest.spyOn(adapter.client, 'post').mockResolvedValueOnce({ data: mockCancelResp });
    const res = await adapter.cancelShipment({ orderId: 'OMS-10002' });

    expect(res.success).toBe(true);
    expect(res.data.cancelled).toBe(true);
    expect(postSpy).toHaveBeenCalledWith(
      '/cancelorders/',
      { order_ids: ['OMS-10002'] },
      expect.any(Object)
    );
  });

  // Step 10: Returns & Reverse Pickup
  test('Step 10: POST /api/Createreturns -> Creates return / exchange reverse pickup', async () => {
    const mockReturnResp = {
      success: 0,
      error: 1,
      message: 'Order has been created already.',
      create_return_response: {
        success: 1,
        error: 0,
        rma_no: 'RMA-8841',
        message: 'Return is created successfully',
      },
    };

    const postSpy = jest.spyOn(adapter.client, 'post').mockResolvedValueOnce({ data: mockReturnResp });
    const res = await adapter.createReturn({
      order_id: 'OMS-10002',
      return_order_status: 'E',
      payment_type: 'P',
      order_total: '699',
      shipping_firstname: 'Priya',
      shipping_lastname: 'Sharma',
      shipping_phone: '9876543210',
      shipping_country: 'IN',
      shipping_zipcode: '500081',
      products: [
        {
          product: 'Blue Kurta',
          price: '699',
          product_code: 'KRT-BL-M',
          amount: '1',
          discount: '0',
          tax_rate: '5',
          tax_title: 'IGST',
          customer_notes: 'Wrong size',
          variants: 'Blue, Medium',
        },
      ],
    });

    expect(res.success).toBe(true);
    expect(res.data.create_return_response.rma_no).toBe('RMA-8841');
    expect(postSpy).toHaveBeenCalledWith(
      '/Createreturns',
      expect.objectContaining({
        order_id: 'OMS-10002',
        return_order_status: 'E',
      }),
      expect.any(Object)
    );
  });
});
