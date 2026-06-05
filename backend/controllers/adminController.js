// backend/controllers/adminController.js
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { generateLinkSignature } from '../services/cryptoService.js';
import { adjustStockBulk } from '../services/inventoryService.js';
import { 
  sendOrderOutForDeliveryEmails, 
  sendOrderCancellationEmail, 
  sendOrderSuccessEmails 
} from '../services/emailService.js';

const extractRealImageUrl = (url) => {
  if (!url) return '';
  let trimmed = String(url).trim();
  
  // Check if it is a Google Image Search URL containing "google.com/imgres"
  if (trimmed.includes('google.com/imgres')) {
    try {
      const urlObj = new URL(trimmed);
      const imgurlParam = urlObj.searchParams.get('imgurl');
      if (imgurlParam) {
        return decodeURIComponent(imgurlParam);
      }
    } catch (e) {
      const match = trimmed.match(/[?&]imgurl=([^&]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
  }
  return trimmed;
};

// @desc    Get dashboard metrics and sales summary aggregates
// @route   GET /api/admin/analytics
// @access  Private/Admin
const getAnalytics = async (req, res, next) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalUsers = await User.countDocuments();

    // Sums aggregated totals across both regular and routine order items seamlessly
    const salesData = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, totalSales: { $sum: { $subtract: ['$totalPrice', { $ifNull: ['$refundAmount', 0] }] } } } },
    ]);

    const totalSales = salesData.length > 0 ? salesData[0].totalSales : 0;

    // 1. Sales and Order Trends for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // past 7 days including today
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const rawTrends = await Order.aggregate([
      { 
        $match: { 
          isPaid: true, 
          createdAt: { $gte: sevenDaysAgo } 
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          sales: { $sum: { $subtract: ['$totalPrice', { $ifNull: ['$refundAmount', 0] }] } },
          orders: { $sum: { $cond: [{ $eq: ['$isCancelled', true] }, 0, 1] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in missing days so the chart always displays exactly 7 days
    const trends = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const match = rawTrends.find(t => t._id === dateStr);
      trends.push({
        date: dateStr,
        sales: match ? match.sales : 0,
        orders: match ? match.orders : 0
      });
    }

    // 2. Low Stock Products (any product with a variant having countInStock < 10)
    const lowStockProducts = await Product.find({
      'variants.countInStock': { $lt: 10 }
    }).select('name image variants');

    // 3. Top-selling products
    const topSelling = await Order.aggregate([
      { $match: { isPaid: true, isCancelled: { $ne: true } } },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: '$orderItems.product',
          name: { $first: '$orderItems.name' },
          image: { $first: '$orderItems.image' },
          totalQty: { $sum: '$orderItems.qty' },
          totalSales: { $sum: { $multiply: ['$orderItems.qty', '$orderItems.price'] } }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 }
    ]);

    // 4. Top spending customers
    const topCustomers = await Order.aggregate([
      { $match: { isPaid: true } },
      {
        $group: {
          _id: '$user',
          totalSpend: { $sum: { $subtract: ['$totalPrice', { $ifNull: ['$refundAmount', 0] }] } },
          totalOrders: { $sum: { $cond: [{ $eq: ['$isCancelled', true] }, 0, 1] } }
        }
      },
      { $sort: { totalSpend: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $project: {
          name: '$userInfo.name',
          email: '$userInfo.email',
          totalSpend: 1,
          totalOrders: 1
        }
      }
    ]);

    res.json({
      totalOrders,
      totalProducts,
      totalUsers,
      totalSales,
      trends,
      lowStockProducts,
      topSelling,
      topCustomers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a fresh product document entry
// @route   POST /api/admin/products
// @access  Private/Admin
// @desc    Create a fresh product document entry
// @route   POST /api/admin/products
// @access  Private/Admin
const createProduct = async (req, res, next) => {
  const { name, description, image, brand, category, rating, gst, variants } = req.body;

  try {
    const nameRegex = /^[a-zA-Z][a-zA-Z0-9\s'\-&\[\]\(\)\{\}]*$/;
    const categoryRegex = /^[a-zA-Z\s&]+$/;

    // Name Validation
    if (!name || name.trim() === '') {
      res.status(400);
      return next(new Error('Product Name is required.'));
    }
    if (!/^[a-zA-Z]/.test(name.trim())) {
      res.status(400);
      return next(new Error('Product Name must start with an alphabet.'));
    }
    if (!nameRegex.test(name.trim())) {
      res.status(400);
      return next(new Error("Product Name contains invalid characters. Only letters, numbers, spaces, hyphens, ampersands, apostrophes, and brackets are allowed."));
    }

    // Brand Validation
    if (!brand || brand.trim() === '') {
      res.status(400);
      return next(new Error('Brand Name is required.'));
    }
    if (!/^[a-zA-Z]/.test(brand.trim())) {
      res.status(400);
      return next(new Error('Brand Name must start with an alphabet.'));
    }
    if (!nameRegex.test(brand.trim())) {
      res.status(400);
      return next(new Error("Brand Name contains invalid characters. Only letters, numbers, spaces, hyphens, ampersands, apostrophes, and brackets are allowed."));
    }

    // Category Validation
    if (!category || category.trim() === '') {
      res.status(400);
      return next(new Error('Category is required.'));
    }
    if (!categoryRegex.test(category.trim())) {
      res.status(400);
      return next(new Error('Category must contain only alphabets, spaces, and ampersands.'));
    }

    // GST Validation
    const allowedGsts = [0, 5, 12, 18, 28];
    if (gst === undefined || isNaN(Number(gst)) || !allowedGsts.includes(Number(gst))) {
      res.status(400);
      return next(new Error('GST Rate must be one of [0, 5, 12, 18, 28].'));
    }

    // Rating Validation
    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 0.0 || numRating > 5.0) {
      res.status(400);
      return next(new Error('Catalog Display Rating must be a number between 0.0 and 5.0.'));
    }

    // Variants Validation
    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      res.status(400);
      return next(new Error('Please add at least one pack size.'));
    }

    // Validate each variant
    for (const v of variants) {
      if (!v.name || String(v.name).trim() === '') {
        res.status(400);
        return next(new Error('Pack Size is required for all variants.'));
      }
      const sPrice = Number(v.price);
      if (isNaN(sPrice) || sPrice <= 0) {
        res.status(400);
        return next(new Error('Selling Price must be a number greater than 0.'));
      }
      if (v.originalPrice !== undefined && v.originalPrice !== null && String(v.originalPrice).trim() !== '') {
        const oPrice = Number(v.originalPrice);
        if (isNaN(oPrice) || oPrice < sPrice) {
          res.status(400);
          return next(new Error('Original Price must be greater than or equal to Selling Price.'));
        }
      }
      const stock = Number(v.countInStock);
      if (isNaN(stock) || !Number.isInteger(stock) || stock < 0) {
        res.status(400);
        return next(new Error('Stock Quantity must be a non-negative integer.'));
      }
    }

    const product = new Product({
      name: name.trim(),
      image: extractRealImageUrl(image) || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600',
      brand: brand.trim(),
      category: category.trim(),
      description: description || 'No description provided.',
      rating: numRating,
      gst: Number(gst),
      variants,
      uploadSource: 'manual',
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    next(error);
  }
};

// @desc    Modify parameters on an existing catalog document
// @route   PUT /api/admin/products/:id
// @access  Private/Admin
const updateProduct = async (req, res, next) => {
  const { name, description, image, brand, category, rating, gst, variants } = req.body;

  try {
    const nameRegex = /^[a-zA-Z][a-zA-Z0-9\s'\-&\[\]\(\)\{\}]*$/;
    const categoryRegex = /^[a-zA-Z\s&]+$/;

    // Optional fields validation if passed
    if (name !== undefined) {
      if (name.trim() === '') {
        res.status(400);
        return next(new Error('Product Name is required.'));
      }
      if (!/^[a-zA-Z]/.test(name.trim())) {
        res.status(400);
        return next(new Error('Product Name must start with an alphabet.'));
      }
      if (!nameRegex.test(name.trim())) {
        res.status(400);
        return next(new Error("Product Name contains invalid characters. Only letters, numbers, spaces, hyphens, ampersands, apostrophes, and brackets are allowed."));
      }
    }

    if (brand !== undefined) {
      if (brand.trim() === '') {
        res.status(400);
        return next(new Error('Brand Name is required.'));
      }
      if (!/^[a-zA-Z]/.test(brand.trim())) {
        res.status(400);
        return next(new Error('Brand Name must start with an alphabet.'));
      }
      if (!nameRegex.test(brand.trim())) {
        res.status(400);
        return next(new Error("Brand Name contains invalid characters. Only letters, numbers, spaces, hyphens, ampersands, apostrophes, and brackets are allowed."));
      }
    }

    if (category !== undefined) {
      if (category.trim() === '') {
        res.status(400);
        return next(new Error('Category is required.'));
      }
      if (!categoryRegex.test(category.trim())) {
        res.status(400);
        return next(new Error('Category must contain only alphabets, spaces, and ampersands.'));
      }
    }

    if (gst !== undefined) {
      const allowedGsts = [0, 5, 12, 18, 28];
      if (isNaN(Number(gst)) || !allowedGsts.includes(Number(gst))) {
        res.status(400);
        return next(new Error('GST Rate must be one of [0, 5, 12, 18, 28].'));
      }
    }

    if (rating !== undefined) {
      const numRating = Number(rating);
      if (isNaN(numRating) || numRating < 0.0 || numRating > 5.0) {
        res.status(400);
        return next(new Error('Catalog Display Rating must be a number between 0.0 and 5.0.'));
      }
    }

    if (variants !== undefined) {
      if (!Array.isArray(variants) || variants.length === 0) {
        res.status(400);
        return next(new Error('Please add at least one pack size.'));
      }
      for (const v of variants) {
        if (!v.name || String(v.name).trim() === '') {
          res.status(400);
          return next(new Error('Pack Size is required for all variants.'));
        }
        const sPrice = Number(v.price);
        if (isNaN(sPrice) || sPrice <= 0) {
          res.status(400);
          return next(new Error('Selling Price must be a number greater than 0.'));
        }
        if (v.originalPrice !== undefined && v.originalPrice !== null && String(v.originalPrice).trim() !== '') {
          const oPrice = Number(v.originalPrice);
          if (isNaN(oPrice) || oPrice < sPrice) {
            res.status(400);
            return next(new Error('Original Price must be greater than or equal to Selling Price.'));
          }
        }
        const stock = Number(v.countInStock);
        if (isNaN(stock) || !Number.isInteger(stock) || stock < 0) {
          res.status(400);
          return next(new Error('Stock Quantity must be a non-negative integer.'));
        }
      }
    }

    const product = await Product.findById(req.params.id);

    if (product) {
      product.name = name !== undefined ? name.trim() : product.name;
      product.description = description !== undefined ? description : product.description;
      product.image = image !== undefined ? extractRealImageUrl(image) : product.image;
      product.brand = brand !== undefined ? brand.trim() : product.brand;
      product.category = category !== undefined ? category.trim() : product.category;
      product.rating = rating !== undefined ? Number(rating) : product.rating;
      product.gst = gst !== undefined ? Number(gst) : product.gst;
      product.variants = variants !== undefined ? variants : product.variants;

      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } else {
      res.status(404);
      throw new Error('Product document mapping not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Purge an entry from the global index ledger
// @route   DELETE /api/admin/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      await Product.deleteOne({ _id: req.params.id });
      res.json({ message: 'Product successfully removed from global database ledger' });
    } else {
      res.status(404);
      throw new Error('Product document mapping not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Fetch all transaction logs with owner profiles attached
// @route   GET /api/admin/orders
// @access  Private/Admin
const getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({}).populate('user', 'id name').sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle shipment completion flag
// @route   PUT /api/admin/orders/:id/deliver
// @access  Private/Admin
const updateOrderToDelivered = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      order.isDelivered = true;
      order.deliveredAt = Date.now();

      const updatedOrder = await order.save();
      
      // Send simulation success and developer reveal emails
      sendOrderSuccessEmails(updatedOrder);
      res.json(updatedOrder);
    } else {
      res.status(404);
      throw new Error('Order transaction row not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Fetch all registered application profiles
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    next(error);
  }
};

// @desc    Restock a product variant
// @route   PUT /api/admin/products/:id/restock
// @access  Private/Admin
const restockProductVariant = async (req, res, next) => {
  const { variantId, countInStock } = req.body;

  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      const variant = product.variants.id(variantId);
      if (variant) {
        variant.countInStock = Number(countInStock);
        const updatedProduct = await product.save();
        res.json(updatedProduct);
      } else {
        res.status(404);
        throw new Error('Product variant not found');
      }
    } else {
      res.status(404);
      throw new Error('Product not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update order to out for delivery
// @route   PUT /api/admin/orders/:id/out-for-delivery
// @access  Private/Admin
const updateOrderToOutForDelivery = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (order) {
      order.isOutForDelivery = true;
      order.outForDeliveryAt = Date.now();
      const updatedOrder = await order.save();

      // Trigger Out for Delivery dispatches via shared emailService
      await sendOrderOutForDeliveryEmails(order);

      res.json(updatedOrder);
    } else {
      res.status(404);
      throw new Error('Order not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Manually update order details
// @route   PUT /api/admin/orders/:id
// @access  Private/Admin
const updateOrder = async (req, res, next) => {
  const { isPaid, isDelivered, isOutForDelivery, isCancelled, refundStatus, refundAmount } = req.body;

  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      // Manage product inventory stock levels during manual cancellation state changes
      if (isCancelled && !order.isCancelled) {
        // Cancelled: Restore inventory stock counts
        await adjustStockBulk(order.orderItems, 1);
        order.cancelledAt = Date.now();
      } else if (!isCancelled && order.isCancelled) {
        // Restored from cancellation: Reduce stock counts again
        await adjustStockBulk(order.orderItems, -1);
        order.cancelledAt = undefined;
      }

      const wasCancelled = order.isCancelled;
      const wasDelivered = order.isDelivered;

      order.isPaid = isPaid !== undefined ? isPaid : order.isPaid;
      order.isDelivered = isDelivered !== undefined ? isDelivered : order.isDelivered;
      order.isOutForDelivery = isOutForDelivery !== undefined ? isOutForDelivery : order.isOutForDelivery;
      order.isCancelled = isCancelled !== undefined ? isCancelled : order.isCancelled;

      if (order.isPaid && !order.paidAt) {
        order.paidAt = Date.now();
      }
      if (order.isDelivered && !order.deliveredAt) {
        order.deliveredAt = Date.now();
      }
      if (order.isOutForDelivery && !order.outForDeliveryAt) {
        order.outForDeliveryAt = Date.now();
      }

      order.refundStatus = refundStatus !== undefined ? refundStatus : order.refundStatus;
      order.refundAmount = refundAmount !== undefined ? Number(refundAmount) : order.refundAmount;

      const updatedOrder = await order.save();

      // Trigger simulation emails if status changes
      if (updatedOrder.isCancelled && !wasCancelled) {
        sendOrderCancellationEmail(updatedOrder);
      }
      if (updatedOrder.isDelivered && !wasDelivered) {
        sendOrderSuccessEmails(updatedOrder);
      }

      res.json(updatedOrder);
    } else {
      res.status(404);
      throw new Error('Order not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk Upload Products from CSV/Excel data
// @route   POST /api/admin/products/bulk
// @access  Private/Admin
const bulkUploadProducts = async (req, res, next) => {
  const { headers, rows } = req.body;

  if (!headers || !rows || !Array.isArray(rows)) {
    res.status(400);
    return next(new Error('Invalid payload formatting. Missing headers or rows array.'));
  }

  const requiredCols = [
    'Product Name',
    'Brand Name',
    'Category',
    'Catalog Display Rating',
    'GST Rate',
    'Pack Size',
    'Selling Price',
    'Stock Quantity'
  ];

  const allowedCols = [
    'Product Name',
    'Brand Name',
    'Category',
    'Catalog Display Rating',
    'GST Rate',
    'Product Image URL',
    'Product Description',
    'Pack Size',
    'Original Price',
    'Selling Price',
    'Stock Quantity'
  ];

  // 1. Column Structure Verification
  const missingCols = requiredCols.filter(col => !headers.includes(col));
  if (missingCols.length > 0) {
    res.status(400);
    return next(new Error(`Missing required columns: ${missingCols.join(', ')}`));
  }

  const unsupportedCols = headers.filter(col => !allowedCols.includes(col));
  if (unsupportedCols.length > 0) {
    res.status(400);
    return next(new Error(`Unsupported columns found: ${unsupportedCols.join(', ')}`));
  }

  try {
    const sanitizeString = (val) => {
      if (val === undefined || val === null) return '';
      let str = String(val).trim();
      // CSV injection prevention: escape leading =, +, -, @
      if (/^[=\+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      return str;
    };

    const isUrlEmpty = (url) => {
      if (!url) return true;
      const lowerUrl = url.toLowerCase();
      return lowerUrl === '' || lowerUrl.includes('placeholder') || lowerUrl.includes('unsplash.com/photo-1542838132-92c53300491e');
    };

    const failedRows = [];
    const validRows = [];

    // URL validation regex
    const urlRegex = /^https?:\/\/.+/i;
    const nameRegex = /^[a-zA-Z][a-zA-Z0-9\s'\-&\[\]\(\)\{\}]*$/;
    const categoryRegex = /^[a-zA-Z\s&]+$/;

    // 3. Row-by-row Validation
    rows.forEach((row, index) => {
      const rowErrors = [];

      // Validate Product Name
      const pName = row['Product Name'];
      if (pName === undefined || pName === null || String(pName).trim() === '') {
        rowErrors.push({ column: 'Product Name', error: 'Product Name is required.' });
      } else {
        const pNameStr = String(pName).trim();
        if (!/^[a-zA-Z]/.test(pNameStr)) {
          rowErrors.push({ column: 'Product Name', error: 'Product Name must start with an alphabet.' });
        } else if (!nameRegex.test(pNameStr)) {
          rowErrors.push({ column: 'Product Name', error: 'Product Name contains invalid characters. Only letters, numbers, spaces, hyphens, ampersands, apostrophes, and brackets are allowed.' });
        }
      }

      // Validate Brand Name
      const brand = row['Brand Name'];
      if (brand === undefined || brand === null || String(brand).trim() === '') {
        rowErrors.push({ column: 'Brand Name', error: 'Brand Name is required.' });
      } else {
        const brandStr = String(brand).trim();
        if (!/^[a-zA-Z]/.test(brandStr)) {
          rowErrors.push({ column: 'Brand Name', error: 'Brand Name must start with an alphabet.' });
        } else if (!nameRegex.test(brandStr)) {
          rowErrors.push({ column: 'Brand Name', error: 'Brand Name contains invalid characters. Only letters, numbers, spaces, hyphens, ampersands, apostrophes, and brackets are allowed.' });
        }
      }

      // Validate Category
      const cat = row['Category'];
      if (cat === undefined || cat === null || String(cat).trim() === '') {
        rowErrors.push({ column: 'Category', error: 'Category is required.' });
      } else {
        const catStr = String(cat).trim();
        if (!categoryRegex.test(catStr)) {
          rowErrors.push({ column: 'Category', error: 'Category must contain only alphabets, spaces, and ampersands.' });
        }
      }

      // Validate Catalog Display Rating
      const rating = row['Catalog Display Rating'];
      if (rating === undefined || rating === null || String(rating).trim() === '') {
        rowErrors.push({ column: 'Catalog Display Rating', error: 'Catalog Display Rating is required.' });
      } else {
        const numRating = Number(rating);
        if (isNaN(numRating) || numRating < 0.0 || numRating > 5.0) {
          rowErrors.push({ column: 'Catalog Display Rating', error: 'Catalog Display Rating must be a number between 0.0 and 5.0.' });
        }
      }

      // Validate GST Rate
      const gst = row['GST Rate'];
      if (gst === undefined || gst === null || String(gst).trim() === '') {
        rowErrors.push({ column: 'GST Rate', error: 'GST Rate is required.' });
      } else {
        const numGst = Number(gst);
        const allowedGsts = [0, 5, 12, 18, 28];
        if (isNaN(numGst) || !allowedGsts.includes(numGst)) {
          rowErrors.push({ column: 'GST Rate', error: 'GST Rate must be one of [0, 5, 12, 18, 28].' });
        }
      }

      // Validate Product Image URL (Optional)

      // Validate Pack Size
      const pSize = row['Pack Size'];
      if (pSize === undefined || pSize === null || String(pSize).trim() === '') {
        rowErrors.push({ column: 'Pack Size', error: 'Pack Size is required.' });
      }

      // Validate Selling Price
      const sPrice = row['Selling Price'];
      let numSPrice;
      if (sPrice === undefined || sPrice === null || String(sPrice).trim() === '') {
        rowErrors.push({ column: 'Selling Price', error: 'Selling Price is required.' });
      } else {
        numSPrice = Number(sPrice);
        if (isNaN(numSPrice) || numSPrice <= 0) {
          rowErrors.push({ column: 'Selling Price', error: 'Selling Price must be a number greater than 0.' });
        }
      }

      // Validate Original Price
      const oPrice = row['Original Price'];
      if (oPrice !== undefined && oPrice !== null && String(oPrice).trim() !== '') {
        const numOPrice = Number(oPrice);
        if (isNaN(numOPrice)) {
          rowErrors.push({ column: 'Original Price', error: 'Original Price must be numeric if provided.' });
        } else if (numSPrice !== undefined && numOPrice < numSPrice) {
          rowErrors.push({ column: 'Original Price', error: 'Original Price must be greater than or equal to Selling Price.' });
        }
      }

      // Validate Stock Quantity
      const stock = row['Stock Quantity'];
      if (stock === undefined || stock === null || String(stock).trim() === '') {
        rowErrors.push({ column: 'Stock Quantity', error: 'Stock Quantity is required.' });
      } else {
        const numStock = Number(stock);
        if (isNaN(numStock) || !Number.isInteger(numStock) || numStock < 0) {
          rowErrors.push({ column: 'Stock Quantity', error: 'Stock Quantity must be a non-negative integer.' });
        }
      }

      if (rowErrors.length > 0) {
        failedRows.push({
          rowIndex: index,
          row: row,
          errors: rowErrors
        });
      } else {
        validRows.push(row);
      }
    });

    // 4. Duplicate Check & Merge Logic
    const names = validRows.map(r => String(r['Product Name']).trim());
    const brands = validRows.map(r => String(r['Brand Name']).trim());

    // Load matching products from DB
    const existingProducts = await Product.find({
      name: { $in: names },
      brand: { $in: brands }
    });

    const productsMap = new Map();
    existingProducts.forEach(p => {
      const key = `${p.name.trim()}||${p.brand.trim()}`.toLowerCase();
      productsMap.set(key, p);
    });

    const updateOps = [];
    const insertDocsMap = new Map();

    validRows.forEach((row) => {
      const name = String(row['Product Name']).trim();
      const brand = String(row['Brand Name']).trim();
      const packSize = String(row['Pack Size']).trim();
      const key = `${name}||${brand}`.toLowerCase();
      
      const sellingPrice = Number(row['Selling Price']) || 0;
      const originalPrice = row['Original Price'] !== undefined && row['Original Price'] !== null && String(row['Original Price']).trim() !== ''
        ? Number(row['Original Price'])
        : sellingPrice;
      const stockQuantity = Math.floor(Number(row['Stock Quantity'])) || 0;

      const newVariant = {
        name: packSize,
        price: sellingPrice,
        originalPrice: originalPrice,
        countInStock: stockQuantity
      };

      // Find non-empty fields in the CSV row that can update the database/batch record
      const rawImage = sanitizeString(row['Product Image URL']);
      const cleanedImage = rawImage ? extractRealImageUrl(rawImage) : '';
      const desc = sanitizeString(row['Product Description'] || '');
      const cat = sanitizeString(row['Category']);
      const rating = Number(row['Catalog Display Rating']);
      const gst = Number(row['GST Rate']);

      const setFields = {};
      if (cleanedImage && !isUrlEmpty(cleanedImage)) {
        setFields.image = cleanedImage;
      }
      if (desc) {
        setFields.description = desc;
      }
      if (cat) {
        setFields.category = cat;
      }
      if (!isNaN(rating)) {
        setFields.rating = rating;
      }
      if (!isNaN(gst)) {
        setFields.gst = gst;
      }

      if (productsMap.has(key)) {
        const dbProduct = productsMap.get(key);

        // Also update local copy in map in case subsequent rows of the same product are processed
        if (setFields.image) dbProduct.image = setFields.image;
        if (setFields.description) dbProduct.description = setFields.description;
        if (setFields.category) dbProduct.category = setFields.category;
        if (setFields.rating !== undefined) dbProduct.rating = setFields.rating;
        if (setFields.gst !== undefined) dbProduct.gst = setFields.gst;

        const existingVariant = dbProduct.variants.find(v => (v.name || '').trim().toLowerCase() === packSize.toLowerCase());

        if (existingVariant) {
          const updateQuery = {
            $inc: { "variants.$.countInStock": stockQuantity }
          };
          if (Object.keys(setFields).length > 0) {
            updateQuery.$set = setFields;
          }
          updateOps.push({
            updateOne: {
              filter: {
                _id: dbProduct._id,
                "variants.name": existingVariant.name
              },
              update: updateQuery
            }
          });
          existingVariant.countInStock += stockQuantity;
        } else {
          const updateQuery = {
            $push: { variants: newVariant }
          };
          if (Object.keys(setFields).length > 0) {
            updateQuery.$set = setFields;
          }
          updateOps.push({
            updateOne: {
              filter: { _id: dbProduct._id },
              update: updateQuery
            }
          });
          dbProduct.variants.push(newVariant);
        }
      } else if (insertDocsMap.has(key)) {
        const batchProduct = insertDocsMap.get(key);

        // If current row has non-empty fields, update batchProduct fields if they are currently empty/placeholder
        if (cleanedImage && !isUrlEmpty(cleanedImage) && (isUrlEmpty(batchProduct.image) || batchProduct.image === 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600')) {
          batchProduct.image = cleanedImage;
        }
        if (desc && !batchProduct.description) {
          batchProduct.description = desc;
        }
        if (cat && !batchProduct.category) {
          batchProduct.category = cat;
        }
        if (!isNaN(rating) && !batchProduct.rating) {
          batchProduct.rating = rating;
        }
        if (!isNaN(gst) && !batchProduct.gst) {
          batchProduct.gst = gst;
        }

        const existingVariant = batchProduct.variants.find(v => (v.name || '').trim().toLowerCase() === packSize.toLowerCase());
        if (existingVariant) {
          existingVariant.countInStock += stockQuantity;
        } else {
          batchProduct.variants.push(newVariant);
        }
      } else {
        const category = sanitizeString(row['Category']);
        const description = sanitizeString(row['Product Description'] || '');
        const rating = Number(row['Catalog Display Rating']) || 0;
        const gst = Number(row['GST Rate']) || 0;

        const rawImage = sanitizeString(row['Product Image URL']);
        const image = rawImage ? extractRealImageUrl(rawImage) : 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600';

        insertDocsMap.set(key, {
          name,
          brand,
          category,
          description,
          image,
          rating,
          gst,
          uploadSource: 'bulk',
          variants: [newVariant]
        });
      }
    });

    let insertedCount = 0;
    if (insertDocsMap.size > 0) {
      const docsToInsert = Array.from(insertDocsMap.values());
      const result = await Product.insertMany(docsToInsert);
      insertedCount = result.length;
    }

    let updatedCount = 0;
    if (updateOps.length > 0) {
      await Product.bulkWrite(updateOps);
      updatedCount = updateOps.length;
    }

    res.json({
      success: true,
      totalRows: rows.length,
      importedCount: insertedCount,
      updatedCount: updatedCount,
      duplicateCount: 0,
      failedCount: failedRows.length,
      failedRows,
      duplicateRows: []
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get paginated, sorted, and searched products with statistics for admin console
// @route   GET /api/admin/products
// @access  Private/Admin
const getAdminProducts = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};

    // 1. Tab filtering
    if (req.query.tab === 'manual') {
      filter.uploadSource = 'manual';
    } else if (req.query.tab === 'bulk') {
      filter.uploadSource = 'bulk';
    }

    // 2. Search filtering (Product Name, Brand, Category Name)
    if (req.query.search && req.query.search.trim() !== '') {
      const searchRegex = { $regex: req.query.search.trim(), $options: 'i' };
      filter.$or = [
        { name: searchRegex },
        { brand: searchRegex },
        { category: searchRegex }
      ];
    }

    // 3. Sorting Options Mapping
    let sortOption = {};
    let collationEnabled = false;

    switch (req.query.sort) {
      case '2': // Oldest Upload First
        sortOption = { createdAt: 1 };
        break;
      case '3': // Stock Low -> High
        sortOption = { 'variants.countInStock': 1 };
        break;
      case '4': // Stock High -> Low
        sortOption = { 'variants.countInStock': -1 };
        break;
      case '5': // Price Low -> High
        sortOption = { 'variants.price': 1 };
        break;
      case '6': // Price High -> Low
        sortOption = { 'variants.price': -1 };
        break;
      case '7': // Product Name (A -> Z)
        sortOption = { name: 1 };
        collationEnabled = true;
        break;
      case '8': // Product Name (Z -> A)
        sortOption = { name: -1 };
        collationEnabled = true;
        break;
      case '9': // Brand Name (A -> Z)
        sortOption = { brand: 1 };
        collationEnabled = true;
        break;
      case '10': // Brand Name (Z -> A)
        sortOption = { brand: -1 };
        collationEnabled = true;
        break;
      case '11': // Category Name (A -> Z)
        sortOption = { category: 1 };
        collationEnabled = true;
        break;
      case '12': // Category Name (Z -> A)
        sortOption = { category: -1 };
        collationEnabled = true;
        break;
      case '13': // Rating High -> Low
        sortOption = { rating: -1 };
        break;
      case '14': // Rating Low -> High
        sortOption = { rating: 1 };
        break;
      case '1': // Latest Upload First
      default:
        sortOption = { createdAt: -1 };
        break;
    }

    // 4. Counts Statistics (Full database sizes for All, Manual, Bulk)
    const allCount = await Product.countDocuments({});
    const manualCount = await Product.countDocuments({ uploadSource: 'manual' });
    const bulkCount = await Product.countDocuments({ uploadSource: 'bulk' });

    // 5. Total count for this specific filter (to compute page numbers)
    const totalFilteredProducts = await Product.countDocuments(filter);

    let query = Product.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    if (collationEnabled) {
      query = query.collation({ locale: 'en', strength: 2 });
    }

    const products = await query;

    res.json({
      products,
      page,
      pages: Math.ceil(totalFilteredProducts / limit),
      totalFilteredProducts,
      allCount,
      manualCount,
      bulkCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Convert category of all matching products and remove unused category names
// @route   POST /api/admin/products/convert-category
// @access  Private/Admin
const convertCategory = async (req, res, next) => {
  try {
    const { sourceCategory, targetCategory } = req.body;
    if (!sourceCategory || !targetCategory) {
      res.status(400);
      throw new Error('Both source and target categories are required.');
    }

    const categoryRegex = /^[a-zA-Z\s&]+$/;
    if (!categoryRegex.test(targetCategory.trim())) {
      res.status(400);
      throw new Error('Target category contains invalid characters. Only alphabets, spaces, and ampersands are allowed.');
    }

    const result = await Product.updateMany(
      { category: sourceCategory.trim() },
      { category: targetCategory.trim() }
    );

    res.json({
      success: true,
      modifiedCount: result.modifiedCount,
      message: `Successfully converted ${result.modifiedCount} products from "${sourceCategory}" to "${targetCategory}".`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update only the image URL of a specific product
// @route   PUT /api/admin/products/:id/image
// @access  Private/Admin
const updateProductImage = async (req, res, next) => {
  try {
    const { image } = req.body;
    if (image === undefined || image === null || image.trim() === '') {
      res.status(400);
      throw new Error('Image URL is required.');
    }

    const product = await Product.findById(req.params.id);
    if (product) {
      product.image = extractRealImageUrl(image);
      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } else {
      res.status(404);
      throw new Error('Product not found.');
    }
  } catch (error) {
    next(error);
  }
};

export {
  getAnalytics,
  createProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  updateOrderToDelivered,
  getUsers,
  restockProductVariant,
  updateOrderToOutForDelivery,
  updateOrder,
  bulkUploadProducts,
  getAdminProducts,
  convertCategory,
  updateProductImage,
};