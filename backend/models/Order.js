// backend/models/Order.js
import mongoose from 'mongoose';

const orderItemSchema = mongoose.Schema({
  name: { type: String, required: true },
  qty: { type: Number, required: true },
  image: { type: String, required: true },
  price: { type: Number, required: true },
  variantName: { type: String, required: true },
  gst: { type: Number, required: true, default: 0 },
  // UPDATED: Captures the custom routine name ("Kids Products", "Office Snacks", or "Normal")
  routineGroupLabel: { type: String, required: true, default: 'Normal' }, 
  product: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Product',
  },
});

const orderSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    orderItems: [orderItemSchema],
    shippingAddress: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String },
    },
    deliveryLocation: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String },
      area: { type: String },
      distance: { type: Number }
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    paymentResult: {
      id: { type: String },
      status: { type: String },
      update_time: { type: String },
      email_address: { type: String },
    },
    itemsPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    taxPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    shippingPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    totalPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    isPaid: {
      type: Boolean,
      required: true,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    isDelivered: {
      type: Boolean,
      required: true,
      default: false,
    },
    deliveredAt: {
      type: Date,
    },
    isOutForDelivery: {
      type: Boolean,
      required: true,
      default: false,
    },
    outForDeliveryAt: {
      type: Date,
    },
    isCancelled: {
      type: Boolean,
      required: true,
      default: false,
    },
    cancelledAt: {
      type: Date,
    },
    refundStatus: {
      type: String,
      required: true,
      default: 'Pending',
    },
    refundAmount: {
      type: Number,
      required: true,
      default: 0.0,
    },
    orderType: {
      type: String,
      required: true,
      default: 'Regular', // Can dynamically log 'OrganizedGroceryGrid' from frontend payload
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model('Order', orderSchema);

export default Order;