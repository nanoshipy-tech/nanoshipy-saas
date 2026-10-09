'use strict';

const ShipwayAdapter = require('../../src/providers/shipway/ShipwayAdapter');
const DelhiveryAdapter = require('../../src/providers/delhivery/DelhiveryAdapter');

describe('NDR Courier Forwarding Unit Tests (#16)', () => {
  it('ShipwayAdapter.requestReattempt sends correct request', async () => {
    const adapter = new ShipwayAdapter(
      {
        username: 'test_user',
        license_key: 'test_key',
      },
      {}
    );

    const mockPost = jest.fn().mockResolvedValue({
      data: { status: 'Success', message: 'Reattempt recorded' },
    });
    adapter.client.post = mockPost;

    const res = await adapter.requestReattempt({
      awbNumber: 'AWB998877',
      action_type: 'reschedule',
      reschedule_date: '2026-09-12',
      updated_address_line1: '123 New St',
      updated_phone: '9876543210',
      notes: 'Please call before delivery',
    });

    expect(res.success).toBe(true);
    expect(mockPost).toHaveBeenCalledWith(
      '/ndr-action',
      expect.objectContaining({
        carrier_awb: 'AWB998877',
        action: 'reattempt',
        address: '123 New St',
        phone: '9876543210',
      }),
      expect.any(Object)
    );
  });

  it('DelhiveryAdapter.requestReattempt sends correct request', async () => {
    const adapter = new DelhiveryAdapter(
      {
        api_token: 'test_delhivery_token',
        client_name: 'test_client',
      },
      {}
    );

    const mockPost = jest.fn().mockResolvedValue({
      data: { success: true, message: 'Re-attempt scheduled' },
    });
    adapter.client.post = mockPost;

    const res = await adapter.requestReattempt({
      awbNumber: 'DEL123456',
      action_type: 'reattempt',
      updated_address_line1: '456 MG Road',
      updated_phone: '9123456780',
      notes: 'Deliver afternoon',
    });

    expect(res.success).toBe(true);
    expect(mockPost).toHaveBeenCalledWith(
      '/packages/json/',
      expect.objectContaining({
        waybill: 'DEL123456',
        action: 'RE-ATTEMPT',
        address: '456 MG Road',
        phone: '9123456780',
      }),
      expect.any(Object)
    );
  });
});
