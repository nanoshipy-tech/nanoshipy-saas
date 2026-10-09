'use strict';

const { PDFDocument } = require('pdf-lib');
const axios = require('axios');
const { Shipment } = require('../models');
const labelGenerationService = require('./labelGeneration.service');
const fileUploadService = require('./fileUpload.service');
const logger = require('../utils/logger');
const { BadRequestError, NotFoundError } = require('../utils/errors');

class BulkLabelService {
  /**
   * Merges multiple PDF buffers into a single PDF document.
   *
   * @param {Array<Buffer>} pdfBuffers
   * @returns {Promise<Buffer>} Merged PDF document buffer
   */
  async mergePDFs(pdfBuffers) {
    const mergedPdf = await PDFDocument.create();

    for (const buffer of pdfBuffers) {
      try {
        const doc = await PDFDocument.load(buffer);
        const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } catch (err) {
        logger.error(`Error copying pages from PDF buffer: ${err.message}`);
        // Skip corrupted PDFs rather than failing the entire batch
      }
    }

    const mergedBytes = await mergedPdf.save();
    return Buffer.from(mergedBytes);
  }

  /**
   * Generates and merges shipping labels for multiple shipments.
   *
   * @param {Array<string>} shipmentIds - Array of Shipment UUIDs
   * @param {string} [format='4x6'] - '4x6' or 'a4'
   * @returns {Promise<string>} URL of the merged PDF file
   */
  async generateBulkLabelPDF(shipmentIds, format = '4x6') {
    if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      throw new BadRequestError('Shipment IDs must be a non-empty array.');
    }

    if (shipmentIds.length > 100) {
      throw new BadRequestError('Cannot merge more than 100 labels in a single batch to protect system memory limits.');
    }

    const pdfBuffers = [];
    const shipments = await Shipment.findAll({
      where: { id: shipmentIds }
    });

    // Create a quick lookup map to preserve input order
    const shipmentMap = {};
    shipments.forEach(s => {
      shipmentMap[s.id] = s;
    });

    for (const id of shipmentIds) {
      const shipment = shipmentMap[id];
      if (!shipment) {
        throw new NotFoundError(`Shipment with ID ${id} not found`);
      }

      let labelBuffer = null;
      let labelUrl = shipment.label_url;

      // If format was explicitly requested or label is not generated yet, generate or retrieve
      const formatRequested = format || '4x6';
      // Check if existing labelUrl matches requested format (e.g. "_a4.pdf" vs "_4x6.pdf")
      const matchesFormat = labelUrl && labelUrl.includes(`_${formatRequested}.pdf`);

      if (!labelUrl || !matchesFormat) {
        try {
          labelUrl = await labelGenerationService.generateLabelForShipment(shipment.id, formatRequested);
        } catch (err) {
          logger.warn(`Could not generate formatted label for shipment ${shipment.id}: ${err.message}. Attempting existing fallback.`);
        }
      }

      // Download / read the PDF label buffer
      if (labelUrl) {
        try {
          const config = require('../config/env');
          const uploadPrefix = `/${config.storage.uploadDir}/`;
          
          if (labelUrl.includes(uploadPrefix)) {
            // Local path or URL containing upload prefix - read directly from local storage avoiding network latency/failures
            const path = require('path');
            const fs = require('fs/promises');
            const uploadIndex = labelUrl.indexOf(uploadPrefix);
            const relPath = labelUrl.slice(uploadIndex + uploadPrefix.length);
            const targetPath = path.join(__dirname, '..', '..', config.storage.uploadDir, relPath);
            labelBuffer = await fs.readFile(targetPath);
          } else if (labelUrl.startsWith('http')) {
            const response = await axios.get(labelUrl, { responseType: 'arraybuffer' });
            labelBuffer = Buffer.from(response.data);
          }
        } catch (err) {
          logger.error(`Failed to load label buffer from ${labelUrl} for bulk merging: ${err.message}`);
        }
      }

      if (labelBuffer) {
        pdfBuffers.push(labelBuffer);
      }
    }

    if (pdfBuffers.length === 0) {
      throw new BadRequestError('None of the requested shipments produced a valid PDF label.');
    }

    logger.info(`Merging ${pdfBuffers.length} label PDFs into a single file.`);
    const mergedBuffer = await this.mergePDFs(pdfBuffers);

    // Save the merged PDF to file storage
    const destinationPath = 'shipments/bulk_labels';
    const batchId = require('crypto').randomBytes(8).toString('hex');
    const originalName = `merged_labels_${batchId}.pdf`;
    const mimeType = 'application/pdf';

    const mergedUrl = await fileUploadService.uploadFile(mergedBuffer, destinationPath, originalName, mimeType);
    logger.info(`Bulk label generated successfully. Uploaded location: ${mergedUrl}`);

    return mergedUrl;
  }
}

module.exports = new BulkLabelService();
