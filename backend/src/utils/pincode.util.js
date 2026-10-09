/**
 * Validates if the given pincode is a valid 6-digit Indian PIN code.
 * @param {string} pincode
 * @returns {boolean}
 */
const isValidIndianPincode = (pincode) => {
  const regex = /^[1-9][0-9]{5}$/;
  return regex.test(pincode);
};

module.exports = {
  isValidIndianPincode,
};
