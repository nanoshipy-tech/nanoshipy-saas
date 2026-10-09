'use strict';

const { Tenant, User, PickupAddress, Invoice, TenantIntegrationConfig, PlatformIntegration } = require('../models');
const { Op } = require('sequelize');

class CustomerDatabaseReportService {
  async generateReport(options = {}) {
    const tenants = await Tenant.findAll({
      include: [
        {
          model: User,
          as: 'users',
          attributes: ['id', 'name', 'email', 'phone', 'role_id'],
        },
        {
          model: TenantIntegrationConfig,
          as: 'integrations',
          include: [{ model: PlatformIntegration, as: 'integration', attributes: ['display_name', 'integration_key'] }],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const reportRows = await Promise.all(tenants.map(async (t) => {
      const primaryUser = t.users?.[0] || {};
      const pickupAddressCount = await PickupAddress.count({ where: { tenant_id: t.id } }).catch(() => 0);

      // Calculate total invoiced revenue
      const totalRevenueResult = await Invoice.sum('total_amount', { where: { tenant_id: t.id, status: 'paid' } }).catch(() => 0);
      const totalRevenue = parseFloat(totalRevenueResult || 0);

      const activeIntegrations = (t.integrations || [])
        .filter(i => i.is_active)
        .map(i => i.integration?.display_name || i.integration?.integration_key)
        .join(', ') || 'None';

      return {
        tenant_id: t.id,
        company_name: t.company_name,
        subdomain: t.subdomain,
        kyc_status: t.kyc_status || 'not_started',
        status: t.status,
        contact_name: primaryUser.name || 'N/A',
        contact_email: primaryUser.email || 'N/A',
        contact_phone: primaryUser.phone || 'N/A',
        pickup_address_count: pickupAddressCount,
        incorporation_date: t.created_at ? t.created_at.toISOString().split('T')[0] : 'N/A',
        total_revenue_inr: totalRevenue.toFixed(2),
        connected_integrations: activeIntegrations,
      };
    }));

    if (options.format === 'csv') {
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

module.exports = new CustomerDatabaseReportService();
