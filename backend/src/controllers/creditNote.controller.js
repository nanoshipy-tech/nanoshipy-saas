'use strict';

const { CreditNote, Invoice } = require('../models');
const { success } = require('../utils/apiResponse');
const { NotFoundError } = require('../utils/errors');
const path = require('path');
const fs = require('fs/promises');
const config = require('../config/env');
const { Op } = require('sequelize');

/**
 * List tenant credit notes.
 */
async function listCreditNotes(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    const { page = 1, limit = 20 } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows } = await CreditNote.findAndCountAll({
      where: { tenant_id: tenantId },
      limit: parseInt(limit, 10),
      offset,
      order: [['created_at', 'DESC']],
      include: [{ model: Invoice, as: 'originalInvoice' }],
    });

    return success(res, {
      rows,
      pagination: {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(count / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Detailed credit note view.
 */
async function getCreditNoteDetail(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    const creditNote = await CreditNote.findOne({
      where: { id, tenant_id: tenantId },
      include: [{ model: Invoice, as: 'originalInvoice' }],
    });

    if (!creditNote) {
      throw new NotFoundError('Credit Note not found');
    }

    return success(res, creditNote);
  } catch (err) {
    next(err);
  }
}

/**
 * Stream secure credit note PDF file.
 */
async function getCreditNotePdfStream(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    const { id } = req.params;

    const creditNote = await CreditNote.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!creditNote) {
      throw new NotFoundError('Credit Note not found');
    }

    if (!creditNote.pdf_url) {
      throw new NotFoundError('Credit Note PDF document has not been generated yet');
    }

    if (creditNote.pdf_url.startsWith('http')) {
      return res.redirect(creditNote.pdf_url);
    } else {
      const relPath = creditNote.pdf_url.replace(`/${config.storage.uploadDir}/`, '');
      const targetPath = path.join(__dirname, '..', '..', config.storage.uploadDir, relPath);

      const fileBuffer = await fs.readFile(targetPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="credit-note-${creditNote.credit_note_number.replace(/\//g, '-')}.pdf"`);
      return res.send(fileBuffer);
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCreditNotes,
  getCreditNoteDetail,
  getCreditNotePdfStream,
};
