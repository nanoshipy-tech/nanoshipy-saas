export interface OrderItemInput {
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
}

export interface OrderInput {
  order_reference: string;
  pickup_address_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  shipping_address_line1: string;
  shipping_address_line2?: string;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  shipping_country: string;
  payment_mode: 'prepaid' | 'cod';
  cod_amount?: number;
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  items: OrderItemInput[];
}

export const validateOrder = (data: Partial<OrderInput>) => {
  const errors: Record<string, string> = {};

  if (!data.order_reference || data.order_reference.trim().length < 3) {
    errors.order_reference = 'Order reference must be at least 3 characters long';
  } else if (!/^[a-zA-Z0-9\-_]+$/.test(data.order_reference)) {
    errors.order_reference = 'Alphanumeric and hyphens/underscores only';
  }

  if (!data.pickup_address_id) {
    errors.pickup_address_id = 'Pickup address is required';
  }

  if (!data.customer_name || data.customer_name.trim().length === 0) {
    errors.customer_name = 'Customer name is required';
  }

  if (!data.customer_phone) {
    errors.customer_phone = 'Phone number is required';
  } else if (!/^\+?[1-9]\d{1,14}$/.test(data.customer_phone)) {
    errors.customer_phone = 'Invalid E.164 phone number format (e.g. +919876543210)';
  }

  if (data.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customer_email)) {
    errors.customer_email = 'Invalid email address';
  }

  if (!data.shipping_address_line1 || data.shipping_address_line1.trim().length === 0) {
    errors.shipping_address_line1 = 'Shipping address is required';
  }

  if (!data.shipping_city || data.shipping_city.trim().length === 0) {
    errors.shipping_city = 'City is required';
  }

  if (!data.shipping_state || data.shipping_state.trim().length === 0) {
    errors.shipping_state = 'State is required';
  }

  if (!data.shipping_pincode) {
    errors.shipping_pincode = 'Pincode is required';
  } else if (!/^[1-9][0-9]{5}$/.test(data.shipping_pincode)) {
    errors.shipping_pincode = 'Must be a valid 6-digit Indian PIN code';
  }

  if (!data.weight_kg || isNaN(data.weight_kg) || Number(data.weight_kg) <= 0) {
    errors.weight_kg = 'Weight must be greater than 0';
  } else if (Number(data.weight_kg) > 50) {
    errors.weight_kg = 'Weight cannot exceed 50 kg';
  }

  if (!data.length_cm || isNaN(data.length_cm) || Number(data.length_cm) <= 0) {
    errors.length_cm = 'Length is required';
  }

  if (!data.width_cm || isNaN(data.width_cm) || Number(data.width_cm) <= 0) {
    errors.width_cm = 'Width is required';
  }

  if (!data.height_cm || isNaN(data.height_cm) || Number(data.height_cm) <= 0) {
    errors.height_cm = 'Height is required';
  }

  if (data.payment_mode === 'cod') {
    if (data.cod_amount === undefined || isNaN(data.cod_amount) || Number(data.cod_amount) < 0) {
      errors.cod_amount = 'COD amount is required for COD payments';
    }
  }

  if (!data.items || data.items.length === 0) {
    errors.items = 'At least one item line is required';
  } else {
    data.items.forEach((item, idx) => {
      if (!item.product_name || item.product_name.trim().length === 0) {
        errors[`items.${idx}.product_name`] = 'Required';
      }
      if (item.quantity === undefined || isNaN(item.quantity) || item.quantity < 1) {
        errors[`items.${idx}.quantity`] = 'Min 1';
      }
      if (item.unit_price === undefined || isNaN(item.unit_price) || item.unit_price < 0) {
        errors[`items.${idx}.unit_price`] = 'Min 0';
      }
    });
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
