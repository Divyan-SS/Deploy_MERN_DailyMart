import Product from '../models/Product.js';

/**
 * Adjust stock quantities for a batch of items (increment or decrement).
 * Uses bulkWrite to process all updates in a single network round-trip.
 * @param {Array} items - List of items, each having product, variantName, and qty
 * @param {Number} direction - 1 for restocking (increment), -1 for decrementing
 */
export const adjustStockBulk = async (items, direction = 1) => {
  if (!items || !Array.isArray(items) || items.length === 0) return null;
  const bulkOps = items.map(item => ({
    updateOne: {
      filter: { _id: item.product, "variants.name": item.variantName },
      update: { $inc: { "variants.$.countInStock": direction * item.qty } }
    }
  }));
  return await Product.bulkWrite(bulkOps);
};

/**
 * Reservese stock atomically for a single item by checking the stock limit.
 * @param {Object} item - Item object containing product, variantName, and qty
 */
export const reserveStockItemAtomic = async (item) => {
  return await Product.updateOne(
    {
      _id: item.product,
      variants: {
        $elemMatch: {
          name: item.variantName,
          countInStock: { $gte: item.qty }
        }
      }
    },
    {
      $inc: { "variants.$.countInStock": -item.qty }
    }
  );
};
