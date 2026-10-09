/**
 * storefrontOrderMapper.service.js
 * Maps Shopify / WooCommerce order payloads into Nanoshipy's order creation schema.
 */

/**
 * Map a Shopify order to Nanoshipy order schema.
 */
/**
 * Map a Shopify order to Nanoshipy order schema.
 */
const fromShopify = (shopifyOrder, connectionId = null) => {
  const addr = shopifyOrder.shipping_address || shopifyOrder.billing_address || {};
  const isPaid = shopifyOrder.financial_status === 'paid';
  const weightKg = shopifyOrder.total_weight ? Math.max(parseFloat(shopifyOrder.total_weight) / 1000, 0.1) : 0.5;
  const totalPrice = parseFloat(shopifyOrder.current_total_price || shopifyOrder.total_price || 0);

  const items = (shopifyOrder.line_items || []).map(item => ({
    name: item.title || 'Item',
    product_name: item.title || 'Item',
    sku: item.sku || (item.product_id ? String(item.product_id) : 'SKU-UNKNOWN'),
    unit_price: parseFloat(item.price) || 0,
    price: parseFloat(item.price) || 0,
    quantity: parseInt(item.quantity, 10) || 1,
    qty: parseInt(item.quantity, 10) || 1,
    weight: item.grams ? Math.max(item.grams / 1000, 0.05) : 0.25,
  }));

  const customerName = addr.name || `${addr.first_name || ''} ${addr.last_name || ''}`.trim() || 'Customer';
  const customerPhone = addr.phone || shopifyOrder.phone || '9999999999';

  return {
    order_reference: shopifyOrder.name ? String(shopifyOrder.name) : `SHP-${shopifyOrder.id}`,
    order_id: `SHP-${shopifyOrder.id}`,
    order_date: shopifyOrder.created_at || new Date().toISOString(),
    customer_name: customerName,
    consignee_name: customerName,
    customer_phone: customerPhone,
    consignee_phone: customerPhone,
    customer_email: shopifyOrder.email || addr.email || null,
    shipping_address_line1: addr.address1 || 'Address Line 1',
    shipping_address_line2: addr.address2 || null,
    consignee_address: [addr.address1, addr.address2].filter(Boolean).join(', ') || 'Address Line 1',
    shipping_city: addr.city || 'City',
    consignee_city: addr.city || 'City',
    shipping_pincode: addr.zip || '110001',
    consignee_pincode: addr.zip || '110001',
    shipping_state: addr.province || 'State',
    consignee_state: addr.province || 'State',
    shipping_country: addr.country || addr.country_code || 'India',
    consignee_country: addr.country_code || 'IN',
    payment_mode: isPaid ? 'prepaid' : 'cod',
    payment_type: isPaid ? 'P' : 'C',
    cod_amount: isPaid ? 0 : totalPrice,
    order_value: totalPrice,
    weight_kg: weightKg,
    order_weight: weightKg,
    length_cm: 10,
    width_cm: 10,
    height_cm: 10,
    status: 'created',
    source: 'api',
    storefront_connection_id: connectionId,
    external_order_id: String(shopifyOrder.id),
    items,
    products: items,
    _store_order_id: String(shopifyOrder.id),
    _store_order_number: shopifyOrder.name,
    _platform: 'shopify',
  };
};

/**
 * Map a WooCommerce order to Nanoshipy order schema.
 */
const fromWooCommerce = (wooOrder, connectionId = null) => {
  const addr = wooOrder.shipping || wooOrder.billing || {};
  const isCod = wooOrder.payment_method === 'cod';
  const weightVal = wooOrder.meta_data?.find(m => m.key === '_weight')?.value || 0.5;
  const weightKg = Math.max(parseFloat(weightVal) || 0.5, 0.1);
  const totalPrice = parseFloat(wooOrder.total || 0);

  const items = (wooOrder.line_items || []).map(item => ({
    name: item.name || 'Item',
    product_name: item.name || 'Item',
    sku: item.sku || (item.product_id ? String(item.product_id) : 'SKU-UNKNOWN'),
    unit_price: parseFloat(item.price) || 0,
    price: parseFloat(item.price) || 0,
    quantity: parseInt(item.quantity, 10) || 1,
    qty: parseInt(item.quantity, 10) || 1,
    weight: 0.25,
  }));

  const customerName = `${addr.first_name || ''} ${addr.last_name || ''}`.trim() || 'Customer';
  const customerPhone = addr.phone || wooOrder.billing?.phone || '9999999999';

  return {
    order_reference: wooOrder.number ? `WOO-${wooOrder.number}` : `WOO-${wooOrder.id}`,
    order_id: `WOO-${wooOrder.id}`,
    order_date: wooOrder.date_created || new Date().toISOString(),
    customer_name: customerName,
    consignee_name: customerName,
    customer_phone: customerPhone,
    consignee_phone: customerPhone,
    customer_email: addr.email || wooOrder.billing?.email || null,
    shipping_address_line1: addr.address_1 || 'Address Line 1',
    shipping_address_line2: addr.address_2 || null,
    consignee_address: [addr.address_1, addr.address_2].filter(Boolean).join(', ') || 'Address Line 1',
    shipping_city: addr.city || 'City',
    consignee_city: addr.city || 'City',
    shipping_pincode: addr.postcode || '110001',
    consignee_pincode: addr.postcode || '110001',
    shipping_state: addr.state || 'State',
    consignee_state: addr.state || 'State',
    shipping_country: addr.country || 'India',
    consignee_country: addr.country || 'IN',
    payment_mode: isCod ? 'cod' : 'prepaid',
    payment_type: isCod ? 'C' : 'P',
    cod_amount: isCod ? totalPrice : 0,
    order_value: totalPrice,
    weight_kg: weightKg,
    order_weight: weightKg,
    length_cm: 10,
    width_cm: 10,
    height_cm: 10,
    status: 'created',
    source: 'api',
    storefront_connection_id: connectionId,
    external_order_id: String(wooOrder.id),
    items,
    products: items,
    _store_order_id: String(wooOrder.id),
    _store_order_number: wooOrder.number?.toString(),
    _platform: 'woocommerce',
  };
};

/**
 * Generic dispatcher.
 */
const mapOrder = (platform, storeOrder, connectionId = null) => {
  if (platform === 'shopify') return fromShopify(storeOrder, connectionId);
  if (platform === 'woocommerce') return fromWooCommerce(storeOrder, connectionId);
  throw new Error(`Unsupported platform for order mapping: ${platform}`);
};

module.exports = { mapOrder, fromShopify, fromWooCommerce };
