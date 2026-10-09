import React from 'react';
import { Plus, Trash } from 'lucide-react';
import { OrderItemInput } from '../../lib/orderValidators';

interface OrderItemsEditorProps {
  items: OrderItemInput[];
  onChange: (items: OrderItemInput[]) => void;
  errors: Record<string, string>;
}

export const OrderItemsEditor: React.FC<OrderItemsEditorProps> = ({ items, onChange, errors }) => {
  const handleAddItem = () => {
    onChange([
      ...items,
      { product_name: '', sku: '', quantity: 1, unit_price: 0 }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    const next = [...items];
    next.splice(index, 1);
    onChange(next);
  };

  const handleFieldChange = (index: number, field: keyof OrderItemInput, val: any) => {
    const next = [...items];
    next[index] = {
      ...next[index],
      [field]: val,
    };
    onChange(next);
  };

  const computedTotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] pb-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Order Items</h3>
        <button
          type="button"
          onClick={handleAddItem}
          className="flex items-center text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-semibold space-x-1 outline-none cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Item</span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-6 text-sm text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-white/[0.08] rounded-lg">
          No items added. Click 'Add Item' to insert a product.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 bg-slate-50 dark:bg-[#0f1117] p-3 rounded-lg border border-slate-100 dark:border-white/[0.04] relative group">
              {/* Product Name */}
              <div className="flex-1 w-full">
                <input
                  type="text"
                  value={item.product_name}
                  onChange={(e) => handleFieldChange(idx, 'product_name', e.target.value)}
                  placeholder="Product Name"
                  className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#131620] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2 border outline-none ${errors[`items.${idx}.product_name`] ? 'border-red-500 dark:border-red-500/50' : ''}`}
                />
              </div>

              {/* SKU */}
              <div className="w-full sm:w-36">
                <input
                  type="text"
                  value={item.sku}
                  onChange={(e) => handleFieldChange(idx, 'sku', e.target.value)}
                  placeholder="SKU (optional)"
                  className="w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#131620] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2 border outline-none"
                />
              </div>

              {/* Quantity */}
              <div className="w-24 flex items-center space-x-1">
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => handleFieldChange(idx, 'quantity', parseInt(e.target.value, 10) || 0)}
                  placeholder="Qty"
                  className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#131620] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2 border outline-none ${errors[`items.${idx}.quantity`] ? 'border-red-500 dark:border-red-500/50' : ''}`}
                />
              </div>

              {/* Unit Price */}
              <div className="w-32 flex items-center space-x-1">
                <span className="text-slate-400 dark:text-slate-500 text-xs">₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => handleFieldChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                  placeholder="Price"
                  className={`w-full text-sm rounded-lg border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#131620] text-slate-900 dark:text-white shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2 border outline-none ${errors[`items.${idx}.unit_price`] ? 'border-red-500 dark:border-red-500/50' : ''}`}
                />
              </div>

              {/* Action delete */}
              <button
                type="button"
                onClick={() => handleRemoveItem(idx)}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition sm:opacity-0 group-hover:opacity-100 focus:opacity-100 outline-none cursor-pointer"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>
          ))}

          {/* Subtotal block */}
          <div className="flex items-center justify-end text-sm text-slate-600 dark:text-slate-400 space-x-2 pt-2 pr-10">
            <span>Estimated Order Value:</span>
            <span className="font-semibold text-slate-900 dark:text-white">₹{computedTotal.toFixed(2)}</span>
          </div>
        </div>
      )}

      {errors.items && (
        <p className="text-xs text-red-500 dark:text-red-400 font-medium mt-1">{errors.items}</p>
      )}
    </div>
  );
};
