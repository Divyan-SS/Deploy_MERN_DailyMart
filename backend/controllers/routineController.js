// backend/controllers/routineController.js
import Routine from '../models/Routine.js';
import Product from '../models/Product.js';

// Helper validator for routine items
const validateRoutineItems = async (items) => {
  if (!items) return [];
  if (!Array.isArray(items)) {
    throw new Error('Items list must be an array');
  }

  const validatedItems = [];
  for (const item of items) {
    if (!item.product) {
      throw new Error('Product identity reference is required for each routine item');
    }
    const product = await Product.findById(item.product);
    if (!product) {
      throw new Error(`Product with ID ${item.product} does not exist`);
    }

    if (!item.variantName) {
      throw new Error(`Variant name is required for product ${product.name}`);
    }
    const variant = product.variants.find(v => v.name === item.variantName);
    if (!variant) {
      throw new Error(`Variant "${item.variantName}" does not exist for product "${product.name}"`);
    }

    const qty = parseInt(item.qty, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new Error(`Quantity for product "${product.name}" must be a positive integer`);
    }

    validatedItems.push({
      product: product._id,
      variantName: variant.name,
      qty: qty,
      price: variant.price, // Override/ensure price matches the database variant price
    });
  }
  return validatedItems;
};

// @desc    Get logged in user routines
// @route   GET /api/routines
// @access  Private
const getMyRoutines = async (req, res, next) => {
  try {
    const routines = await Routine.find({ user: req.user._id }).populate('items.product');
    res.json(routines);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new custom organizational routine group
// @route   POST /api/routines
// @access  Private
const createRoutine = async (req, res, next) => {
  const { name, items } = req.body;

  try {
    if (!name || name.trim() === '') {
      res.status(400);
      throw new Error('Validation failure: Routine name tag identity is required');
    }

    const validatedItems = await validateRoutineItems(items);

    // MULTI-USER CHECK: Verify if this specific user already has a routine folder with this exact name
    let routine = await Routine.findOne({ user: req.user._id, name: name.trim() });

    if (routine) {
      // If the workspace folder already exists for this login profile, merge or append items cleanly
      routine.items = validatedItems;
      await routine.save();
    } else {
      // Create a pristine custom container matching exclusively this account context token
      routine = new Routine({
        user: req.user._id,
        name: name.trim(),
        items: validatedItems,
      });
      await routine.save();
    }

    const populatedRoutine = await Routine.findById(routine._id).populate('items.product');
    res.status(201).json(populatedRoutine);
  } catch (error) {
    if (res.statusCode === 200) {
      res.status(400);
    }
    next(error);
  }
};

// @desc    Update a custom routine grouping
// @route   PUT /api/routines/:id
// @access  Private
const updateRoutine = async (req, res, next) => {
  const { name, items, isActive } = req.body;

  try {
    const routine = await Routine.findById(req.params.id);

    if (routine) {
      if (routine.user.toString() !== req.user._id.toString()) {
        res.status(401);
        throw new Error('Security restriction: Not authorized to alter this routine map data block');
      }

      if (name) {
        routine.name = name.trim();
      }
      if (items) {
        routine.items = await validateRoutineItems(items);
      }
      routine.isActive = typeof isActive !== 'undefined' ? isActive : routine.isActive;

      const updatedRoutine = await routine.save();
      const populatedRoutine = await Routine.findById(updatedRoutine._id).populate('items.product');
      res.json(populatedRoutine);
    } else {
      res.status(404);
      throw new Error('Routine document map entry not found');
    }
  } catch (error) {
    if (res.statusCode === 200) {
      res.status(400);
    }
    next(error);
  }
};

// @desc    Delete an entire custom routine group reference completely
// @route   DELETE /api/routines/:id
// @access  Private
const deleteRoutine = async (req, res, next) => {
  try {
    const routine = await Routine.findById(req.params.id);

    if (routine) {
      if (routine.user.toString() !== req.user._id.toString()) {
        res.status(401);
        throw new Error('Security exception: Core token context cannot delete this file node path');
      }

      await Routine.deleteOne({ _id: req.params.id });
      res.json({ message: 'Routine macro mapping completely purged from data array' });
    } else {
      res.status(404);
      throw new Error('Routine document reference not found');
    }
  } catch (error) {
    next(error);
  }
};

export { getMyRoutines, createRoutine, updateRoutine, deleteRoutine };