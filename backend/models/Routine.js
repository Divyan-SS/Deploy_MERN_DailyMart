// backend/models/Routine.js
import mongoose from 'mongoose';

const routineItemSchema = mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Product',
  },
  variantName: {
    type: String,
    required: true,
  },
  qty: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
});

const routineSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    // This now flexibly holds whatever custom organizational tag name the client typed
    name: {
      type: String,
      required: true,
    },
    items: [routineItemSchema],
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// REAL-WORLD APPLICATION PROTECTION: Compound unique configuration locks names strictly within an account context
routineSchema.index({ user: 1, name: 1 }, { unique: true });

const Routine = mongoose.model('Routine', routineSchema);

export default Routine;