'use strict';

const orderImportService = require('../../src/services/orderImport.service');
const orderImportRepository = require('../../src/repositories/orderImport.repository');

describe('Bulk Order Import - 500 Row Limit Tests (Fix #15)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw IMPORT_FILE_FORMAT_ERROR when CSV rows exceed 500', async () => {
    jest.spyOn(orderImportRepository, 'create').mockResolvedValue({ id: 'import-123' });
    jest.spyOn(orderImportRepository, 'update').mockResolvedValue(true);

    const headers = 'order_reference,recipient_name,recipient_phone,shipping_address_line1,shipping_city,shipping_state,shipping_pincode,payment_mode,cod_amount,order_value,weight_kg\n';
    const rowLine = 'ORD1,John Doe,9876543210,123 Street,Mumbai,Maharashtra,400001,prepaid,0,500,1\n';
    const fileContent = headers + rowLine.repeat(501);

    const mockFile = {
      originalname: 'massive_orders.csv',
      buffer: Buffer.from(fileContent),
      mimetype: 'text/csv',
    };

    await expect(
      orderImportService.importOrders('tenant-1', mockFile, 'user-1')
    ).rejects.toThrow(/exceeds the maximum limit of 500 rows/);

    expect(orderImportRepository.update).toHaveBeenCalledWith(
      'import-123',
      expect.objectContaining({ status: 'failed' })
    );
  });
});
