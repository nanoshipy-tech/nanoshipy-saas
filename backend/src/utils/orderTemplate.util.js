/**
 * Generate CSV template content for order bulk uploads
 * @returns {string} The CSV template as a string
 */
const generateCsvTemplate = () => {
  const headers = [
    'order_reference',
    'pickup_address_id',
    'customer_name',
    'customer_phone',
    'customer_email',
    'shipping_address_line1',
    'shipping_address_line2',
    'shipping_city',
    'shipping_state',
    'shipping_pincode',
    'shipping_country',
    'order_value',
    'payment_mode',
    'cod_amount',
    'weight_kg',
    'length_cm',
    'width_cm',
    'height_cm',
    'product_name',
    'sku',
    'quantity',
    'unit_price'
  ];

  const exampleRow = [
    'ORD-2026-001',
    '00000000-0000-0000-0000-000000000000', // Example placeholder UUID
    'Rahul Sharma',
    '+919876543210',
    'rahul@example.com',
    'Flat 101, Sunrise Apartments',
    'Sector 56',
    'Gurugram',
    'Haryana',
    '122011',
    'India',
    '1499.00',
    'prepaid',
    '0.00',
    '1.2',
    '30',
    '20',
    '15',
    'Running Shoes',
    'SHO-RUN-10',
    '1',
    '1499.00'
  ];

  return `${headers.join(',')}\n${exampleRow.join(',')}\n`;
};

module.exports = {
  generateCsvTemplate,
};
