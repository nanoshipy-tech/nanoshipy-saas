'use strict';

const { Shipment, Order, Tenant, NdrEvent, PickupAddress } = require('../models');
const { Op } = require('sequelize');

class CustomerLogisticsReportService {
  /**
   * Derive estimated shipping zone based on pincodes
   */
  calculateZone(pickupPincode, deliveryPincode) {
    if (!pickupPincode || !deliveryPincode) return 'Zone B (Intra-state)';
    const p1 = String(pickupPincode).substring(0, 2);
    const p2 = String(deliveryPincode).substring(0, 2);

    if (pickupPincode === deliveryPincode) return 'Zone A (Intra-city)';
    if (p1 === p2) return 'Zone B (Intra-state)';
    
    const metroCodes = ['11', '40', '70', '56', '60', '50']; // Delhi, Mumbai, Kolkata, Bangalore, Chennai, Hyderabad
    if (metroCodes.includes(p1) && metroCodes.includes(p2)) return 'Zone C (Metro to Metro)';
    
    const specialStates = ['79', '18', '19', '17']; // North-East, J&K
    if (specialStates.includes(p1) || specialStates.includes(p2)) return 'Zone E (Special Zones)';
    
    return 'Zone D (Rest of India)';
  }

  async generateReport(filters = {}) {
    const where = {};
    if (filters.tenant_id) where.tenant_id = filters.tenant_id;
    if (filters.date_from && filters.date_to) {
      where.created_at = {
        [Op.between]: [new Date(filters.date_from), new Date(filters.date_to)],
      };
    }

    const shipments = await Shipment.findAll({
      where,
      include: [
        {
          model: Order,
          as: 'order',
          attributes: ['id', 'order_reference', 'order_value', 'payment_mode'],
        },
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['id', 'company_name', 'subdomain'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: filters.limit || 5000,
    });

    const reportRows = await Promise.all(shipments.map(async (s) => {
      const order = s.order || {};
      const tenant = s.tenant || {};

      // Fetch NDR details if available
      const ndrEvents = await NdrEvent.findAll({
        where: { shipment_id: s.id },
        order: [['created_at', 'ASC']],
      }).catch(() => []);

      const firstAttempt = ndrEvents.find(e => e.attempt_number === 1) || ndrEvents[0];
      const latestNdr = ndrEvents[ndrEvents.length - 1];

      const pickupPincode = s.origin_pincode || '400001';
      const deliveryPincode = s.destination_pincode || '110001';
      const calculatedZone = this.calculateZone(pickupPincode, deliveryPincode);

      const freightCharge = parseFloat(s.freight_charge || s.shipping_charge || 0);
      const codCharge = parseFloat(s.cod_charge || 0);
      const rtoCharge = parseFloat(s.rto_charge || 0);
      const totalFreightCost = freightCharge + codCharge + rtoCharge;

      return {
        shipment_id: s.id,
        awb: s.awb_number || s.tracking_number || 'N/A',
        order_number: order.order_reference || 'N/A',
        tenant_name: tenant.company_name || 'N/A',
        status: s.status,
        pickup_date: s.created_at ? s.created_at.toISOString().split('T')[0] : 'N/A',
        declared_weight_kg: parseFloat(s.declared_weight_kg || 0.5).toFixed(3),
        actual_weight_kg: parseFloat(s.actual_weight_kg || s.charged_weight_kg || s.declared_weight_kg || 0.5).toFixed(3),
        delivery_date: s.delivered_at ? s.delivered_at.toISOString().split('T')[0] : 'N/A',
        first_attempt_date: firstAttempt?.created_at ? firstAttempt.created_at.toISOString().split('T')[0] : 'N/A',
        ndr_date: latestNdr?.created_at ? latestNdr.created_at.toISOString().split('T')[0] : 'N/A',
        ndr_reason: latestNdr?.reason || 'N/A',
        shipment_value_inr: parseFloat(order.order_value || 0).toFixed(2),
        payment_mode: (order.payment_mode || 'cod').toUpperCase(),
        freight_charge: freightCharge.toFixed(2),
        cod_charge: codCharge.toFixed(2),
        rto_charge: rtoCharge.toFixed(2),
        total_freight_cost: totalFreightCost.toFixed(2),
        zone: calculatedZone,
      };
    }));

    if (filters.format === 'csv') {
      return this.convertToCSV(reportRows);
    }
    return reportRows;
  }

  convertToCSV(rows) {
    if (!rows || rows.length === 0) return 'No data available';
    const headers = Object.keys(rows[0]).join(',');
    const csvLines = rows.map(r =>
      Object.values(r).map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(',')
    );
    return [headers, ...csvLines].join('\n');
  }
}

module.exports = new CustomerLogisticsReportService();
