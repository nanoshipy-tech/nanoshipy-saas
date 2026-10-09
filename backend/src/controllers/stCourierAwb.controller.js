'use strict';

const { StCourierAwbInventory, Shipment } = require('../models');
const { Op, fn, col } = require('sequelize');
const logger = require('../utils/logger');

/**
 * List AWBs with pagination and filtering
 * GET /platform/st-courier-awb
 */
async function listAwbs(req, res, next) {
  try {
    const {
      page = 1,
      limit = 50,
      status = 'all',
      origin_district,
      payment_mode,
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (origin_district && origin_district !== 'all') {
      where.origin_district = { [Op.iLike]: origin_district.trim() };
    }

    if (payment_mode && payment_mode !== 'all') {
      where.payment_mode = payment_mode;
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      where[Op.or] = [
        { awb_number: { [Op.iLike]: q } },
        { batch_id: { [Op.iLike]: q } },
        { notes: { [Op.iLike]: q } },
      ];
    }

    const { count, rows } = await StCourierAwbInventory.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Shipment,
          as: 'shipment',
          attributes: ['id', 'awb_number', 'status', 'created_at'],
          required: false,
        },
      ],
    });

    return res.status(200).json({
      success: true,
      data: {
        awbs: rows,
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    });
  } catch (err) {
    logger.error(`[StCourierAwbController] listAwbs error: ${err.message}`);
    return next(err);
  }
}

/**
 * Get AWB inventory statistics and low-stock alerts
 * GET /platform/st-courier-awb/stats
 */
async function getStats(req, res, next) {
  try {
    const total = await StCourierAwbInventory.count();
    const available = await StCourierAwbInventory.count({ where: { status: 'available' } });
    const assigned = await StCourierAwbInventory.count({ where: { status: 'assigned' } });
    const cancelled = await StCourierAwbInventory.count({ where: { status: 'cancelled' } });

    // District-level breakdown of available inventory
    const districtStats = await StCourierAwbInventory.findAll({
      attributes: [
        'origin_district',
        [fn('COUNT', col('id')), 'count'],
      ],
      where: { status: 'available' },
      group: ['origin_district'],
      order: [[fn('COUNT', col('id')), 'ASC']],
      raw: true,
    });

    // Alert if any district or general pool has < 20 available AWBs
    const lowStockAlerts = districtStats.filter(d => parseInt(d.count, 10) < 20);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          total,
          available,
          assigned,
          cancelled,
        },
        districtBreakdown: districtStats,
        lowStockAlerts,
        isLowStock: available < 50,
      },
    });
  } catch (err) {
    logger.error(`[StCourierAwbController] getStats error: ${err.message}`);
    return next(err);
  }
}

/**
 * Bulk upload AWBs (via array or text)
 * POST /platform/st-courier-awb/upload
 */
async function uploadAwbs(req, res, next) {
  try {
    const {
      awb_numbers,
      awb_text,
      origin_district = 'All',
      payment_mode = 'both',
      batch_id,
      notes,
    } = req.body;

    let rawList = [];

    if (Array.isArray(awb_numbers)) {
      rawList = awb_numbers;
    } else if (typeof awb_text === 'string') {
      // Split by comma, newline, or whitespace
      rawList = awb_text.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
    } else if (typeof awb_numbers === 'string') {
      rawList = awb_numbers.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
    }

    // Clean and deduplicate within the payload
    const cleaned = [...new Set(rawList.map(s => String(s).trim()).filter(s => s.length > 2))];

    if (cleaned.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid AWB numbers provided. Please supply at least one AWB number.',
      });
    }

    const assignedBatchId = batch_id || `BATCH-${Date.now()}`;
    const district = origin_district ? origin_district.trim() : 'All';
    const mode = ['prepaid', 'cod', 'both'].includes(payment_mode) ? payment_mode : 'both';

    // Find existing to avoid conflict
    const existing = await StCourierAwbInventory.findAll({
      where: {
        awb_number: { [Op.in]: cleaned },
      },
      attributes: ['awb_number'],
      raw: true,
    });

    const existingSet = new Set(existing.map(e => e.awb_number));
    const toInsert = cleaned
      .filter(num => !existingSet.has(num))
      .map(num => ({
        awb_number: num,
        origin_district: district,
        payment_mode: mode,
        status: 'available',
        batch_id: assignedBatchId,
        notes: notes || `Bulk upload batch ${assignedBatchId}`,
      }));

    if (toInsert.length > 0) {
      await StCourierAwbInventory.bulkCreate(toInsert, { ignoreDuplicates: true });
    }

    logger.info(`[StCourierAwbController] Uploaded ${toInsert.length} new AWBs for ${district} (Batch: ${assignedBatchId})`);

    return res.status(201).json({
      success: true,
      message: `Successfully added ${toInsert.length} AWBs to the pool. (${existingSet.size} duplicates skipped).`,
      data: {
        totalReceived: cleaned.length,
        insertedCount: toInsert.length,
        duplicateCount: existingSet.size,
        batchId: assignedBatchId,
        district,
        paymentMode: mode,
      },
    });
  } catch (err) {
    logger.error(`[StCourierAwbController] uploadAwbs error: ${err.message}`);
    return next(err);
  }
}

/**
 * Delete an unassigned AWB
 * DELETE /platform/st-courier-awb/:id
 */
async function deleteAwb(req, res, next) {
  try {
    const { id } = req.params;
    const awb = await StCourierAwbInventory.findByPk(id);

    if (!awb) {
      return res.status(404).json({
        success: false,
        message: 'AWB record not found.',
      });
    }

    if (awb.status === 'assigned') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete an AWB that has already been assigned to an active shipment.',
      });
    }

    await awb.destroy();

    return res.status(200).json({
      success: true,
      message: `AWB ${awb.awb_number} deleted successfully.`,
    });
  } catch (err) {
    logger.error(`[StCourierAwbController] deleteAwb error: ${err.message}`);
    return next(err);
  }
}

module.exports = {
  listAwbs,
  getStats,
  uploadAwbs,
  deleteAwb,
};
