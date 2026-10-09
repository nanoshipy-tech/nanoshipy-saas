'use strict';

const { SystemSequence } = require('../models');

/**
 * Allocated sequential number row-locked sequence.
 * @param {string} sequenceKey - Unique string key for sequence
 * @param {string} prefix - Alphanumeric prefix, e.g. 'TKT'
 * @param {number} length - Number padding length, defaults to 6
 * @param {object} transaction - Sequelize transaction object (required for locking)
 */
async function generateNextSequence(sequenceKey, prefix, length = 6, transaction) {
  if (!transaction) {
    throw new Error('A database transaction is required for sequential numbering locks');
  }

  // Find or create sequence entry
  let seq = await SystemSequence.findOne({
    where: { sequence_key: sequenceKey },
    lock: transaction.LOCK.UPDATE,
    transaction,
  });

  if (!seq) {
    seq = await SystemSequence.create({
      sequence_key: sequenceKey,
      last_value: 0,
    }, { transaction });
  }

  const nextVal = seq.last_value + 1;
  await seq.update({ last_value: nextVal }, { transaction });

  const padded = nextVal.toString().padStart(length, '0');
  return `${prefix}-${padded}`;
}

module.exports = {
  generateNextSequence,
};
