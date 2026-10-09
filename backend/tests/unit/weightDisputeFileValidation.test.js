'use strict';

const weightDisputeController = require('../../src/controllers/weightDispute.controller');

describe('Weight Dispute Evidence File Validation Unit Test (#28)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      tenant: { id: 'tenant-123' },
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('rejects files exceeding 5MB limit', async () => {
    req.body = {
      shipment_id: 'ship-1',
      file_size_bytes: 6 * 1024 * 1024, // 6MB
      mime_type: 'image/png',
    };

    await weightDisputeController.fileDispute(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'FILE_TOO_LARGE' }),
      })
    );
  });

  it('rejects unsupported MIME types (e.g. application/exe)', async () => {
    req.body = {
      shipment_id: 'ship-1',
      file_size_bytes: 1024 * 1024,
      mime_type: 'application/x-msdownload',
    };

    await weightDisputeController.fileDispute(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'INVALID_FILE_TYPE' }),
      })
    );
  });
});
