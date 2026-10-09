'use strict';

const {
  isTamilNaduPincode,
  determineAssignedCourier,
  getRoutingRules,
} = require('../../src/services/courierRouting.service');

describe('Courier Geo-Routing Service (Tamil Nadu Local vs Shipway)', () => {
  describe('isTamilNaduPincode', () => {
    it('should identify Tamil Nadu pincodes correctly', () => {
      expect(isTamilNaduPincode('600001')).toBe(true); // Chennai
      expect(isTamilNaduPincode('641001')).toBe(true); // Coimbatore
      expect(isTamilNaduPincode('625001')).toBe(true); // Madurai
      expect(isTamilNaduPincode('636001')).toBe(true); // Salem
      expect(isTamilNaduPincode('643001')).toBe(true); // Ooty / Nilgiris
    });

    it('should identify Tamil Nadu by state string', () => {
      expect(isTamilNaduPincode('110001', 'Tamil Nadu')).toBe(true);
      expect(isTamilNaduPincode('110001', 'TN')).toBe(true);
      expect(isTamilNaduPincode('110001', 'tamilnadu')).toBe(true);
    });

    it('should identify non-Tamil Nadu pincodes as false', () => {
      expect(isTamilNaduPincode('110001')).toBe(false); // Delhi
      expect(isTamilNaduPincode('500081')).toBe(false); // Hyderabad
      expect(isTamilNaduPincode('400001')).toBe(false); // Mumbai
      expect(isTamilNaduPincode('560001')).toBe(false); // Bangalore
      expect(isTamilNaduPincode('700001')).toBe(false); // Kolkata
    });
  });

  describe('determineAssignedCourier', () => {
    it('should assign ST Courier for intra-Tamil Nadu orders (both origin and dest in TN)', async () => {
      const result = await determineAssignedCourier('600028', 'Tamil Nadu', '641001', 'Tamil Nadu');
      expect(result.providerKey).toBe('stcourier');
      expect(result.isLocal).toBe(true);
      expect(result.region).toBe('Tamil Nadu');
      expect(result.routingReason).toContain('ST Courier');
    });

    it('should assign ST Courier for Tamil Nadu pincodes without explicit pickup', async () => {
      const result = await determineAssignedCourier('600028', 'Tamil Nadu');
      expect(result.providerKey).toBe('stcourier');
      expect(result.isLocal).toBe(true);
      expect(result.region).toBe('Tamil Nadu');
      expect(result.routingReason).toContain('ST Courier');
    });

    it('should assign National network when origin is outside Tamil Nadu even if dest is in TN', async () => {
      const result = await determineAssignedCourier('600028', 'Tamil Nadu', '110001', 'Delhi');
      expect(result.providerKey).toBe('shipway');
      expect(result.isLocal).toBe(false);
      expect(result.routingReason).toContain('outside Tamil Nadu');
    });

    it('should assign National network for non-Tamil Nadu destination pincodes', async () => {
      const result = await determineAssignedCourier('500081', 'Telangana');
      expect(result.providerKey).toBe('shipway');
      expect(result.isLocal).toBe(false);
      expect(result.region).toBe('Telangana');
      expect(result.routingReason).toContain('National Express Network');
    });

    it('should assign National network for Delhi pincodes', async () => {
      const result = await determineAssignedCourier('110001', 'Delhi');
      expect(result.providerKey).toBe('shipway');
      expect(result.isLocal).toBe(false);
    });
  });

  describe('getRoutingRules', () => {
    it('should return routing rules configuration for Admin', () => {
      const config = getRoutingRules();
      expect(config.rules).toBeDefined();
      expect(config.rules.length).toBe(2);

      const tnRule = config.rules.find(r => r.id === 'RULE-TN-INTRA-STCOURIER');
      expect(tnRule).toBeDefined();
      expect(tnRule.assignedCourier).toBe('stcourier');

      const roiRule = config.rules.find(r => r.id === 'RULE-ROI-NATIONAL');
      expect(roiRule).toBeDefined();
      expect(roiRule.assignedCourier).toBe('shipway');
    });
  });
});
