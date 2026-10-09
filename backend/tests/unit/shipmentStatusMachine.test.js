'use strict';

const shipmentStatusService = require('../../src/services/shipmentStatus.service');
const { InvalidShipmentStatusTransitionError } = require('../../src/services/shipmentStatus.service');

describe('Shipment Status State Machine Tests', () => {
  describe('Valid forward progressions', () => {
    it('allows created -> awb_generated', () => {
      expect(() => shipmentStatusService.validateTransition('created', 'awb_generated')).not.toThrow();
    });

    it('allows awb_generated -> in_transit', () => {
      expect(() => shipmentStatusService.validateTransition('awb_generated', 'in_transit')).not.toThrow();
    });

    it('allows in_transit -> out_for_delivery', () => {
      expect(() => shipmentStatusService.validateTransition('in_transit', 'out_for_delivery')).not.toThrow();
    });

    it('allows out_for_delivery -> delivered', () => {
      expect(() => shipmentStatusService.validateTransition('out_for_delivery', 'delivered')).not.toThrow();
    });

    it('allows in_transit -> ndr_initiated -> out_for_delivery -> delivered', () => {
      expect(() => shipmentStatusService.validateTransition('in_transit', 'ndr_initiated')).not.toThrow();
      expect(() => shipmentStatusService.validateTransition('ndr_initiated', 'out_for_delivery')).not.toThrow();
      expect(() => shipmentStatusService.validateTransition('out_for_delivery', 'delivered')).not.toThrow();
    });

    it('allows in_transit -> rto_initiated -> rto_in_transit -> rto_delivered', () => {
      expect(() => shipmentStatusService.validateTransition('in_transit', 'rto_initiated')).not.toThrow();
      expect(() => shipmentStatusService.validateTransition('rto_initiated', 'rto_in_transit')).not.toThrow();
      expect(() => shipmentStatusService.validateTransition('rto_in_transit', 'rto_delivered')).not.toThrow();
    });
  });

  describe('Idempotent status updates', () => {
    it('safely handles same-status events without error', () => {
      expect(() => shipmentStatusService.validateTransition('in_transit', 'in_transit')).not.toThrow();
      expect(() => shipmentStatusService.validateTransition('delivered', 'delivered')).not.toThrow();
      expect(() => shipmentStatusService.validateTransition('cancelled', 'cancelled')).not.toThrow();
    });
  });

  describe('Terminal state immutability', () => {
    it('blocks delivered from transitioning to any state', () => {
      expect(() => shipmentStatusService.validateTransition('delivered', 'in_transit'))
        .toThrow(InvalidShipmentStatusTransitionError);
      expect(() => shipmentStatusService.validateTransition('delivered', 'cancelled'))
        .toThrow(InvalidShipmentStatusTransitionError);
      expect(() => shipmentStatusService.validateTransition('delivered', 'out_for_delivery'))
        .toThrow(InvalidShipmentStatusTransitionError);
    });

    it('blocks cancelled from transitioning to any state', () => {
      expect(() => shipmentStatusService.validateTransition('cancelled', 'picked_up'))
        .toThrow(InvalidShipmentStatusTransitionError);
      expect(() => shipmentStatusService.validateTransition('cancelled', 'delivered'))
        .toThrow(InvalidShipmentStatusTransitionError);
    });

    it('blocks failed from transitioning to any state', () => {
      expect(() => shipmentStatusService.validateTransition('failed', 'in_transit'))
        .toThrow(InvalidShipmentStatusTransitionError);
      expect(() => shipmentStatusService.validateTransition('failed', 'delivered'))
        .toThrow(InvalidShipmentStatusTransitionError);
    });
  });

  describe('Invalid or out-of-order carrier events', () => {
    it('rejects skipping from created to rto_delivered', () => {
      expect(() => shipmentStatusService.validateTransition('created', 'rto_delivered'))
        .toThrow(InvalidShipmentStatusTransitionError);
    });

    it('rejects backwards transition from out_for_delivery to booked', () => {
      expect(() => shipmentStatusService.validateTransition('out_for_delivery', 'booked'))
        .toThrow(InvalidShipmentStatusTransitionError);
    });
  });
});
