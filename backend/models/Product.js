// backend/models/Product.js
import mongoose from 'mongoose';

const variantSchema = mongoose.Schema({
  name: { type: String, required: true }, 
  price: { type: Number, required: true, default: 0 },
  originalPrice: { type: Number, default: 0 }, 
  countInStock: { type: Number, required: true, default: 0 },
});

const productSchema = mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    image: { type: String, required: true },
    brand: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    description: { type: String, required: true },
    variants: [variantSchema],
    rating: { type: Number, required: true, default: 0 },
    numReviews: { type: Number, required: true, default: 0 },
    gst: { type: Number, required: true, default: 0 },
    uploadSource: { type: String, required: true, enum: ['manual', 'bulk'], default: 'manual', index: true },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model('Product', productSchema);

export default Product;