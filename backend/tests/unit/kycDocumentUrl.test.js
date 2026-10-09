'use strict';

describe('Merchant KYC Document URL Resolution Unit Test (#21)', () => {
  it('should return fully-qualified backend domain for local uploads', async () => {
    process.env.APP_URL = 'https://app.nanoshipy.com';
    const fileUploadService = require('../../src/services/fileUpload.service');
    const url = await fileUploadService.getPresignedGetUrl('kyc/documents/pan-doc.pdf');
    expect(url).toBe('https://app.nanoshipy.com/uploads/kyc/documents/pan-doc.pdf');
    expect(url.startsWith('https://app.nanoshipy.com/uploads/')).toBe(true);
  });
});
