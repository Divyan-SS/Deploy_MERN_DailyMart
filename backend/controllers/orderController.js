// backend/controllers/orderController.js
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { verifyLinkSignature, generateLinkSignature } from '../services/cryptoService.js';
import { adjustStockBulk, reserveStockItemAtomic } from '../services/inventoryService.js';
import {
  runDemoWorkflowEngine,
  sendOrderOutForDeliveryEmails,
  renderActionPageHtml,
  sendOrderCancellationEmail,
  sendOrderSuccessEmails,
} from '../services/emailService.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// @desc    Create new order entries
// @route   POST /api/orders
// @access  Private
const addOrderItems = async (req, res, next) => {
  const {
    orderItems,
    shippingAddress,
    deliveryLocation,
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
    orderType,
  } = req.body;

  try {
    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      res.status(400);
      throw new Error('Fulfillment stack empty: No tracking order items provided');
    }

    // Input payload structure validations
    for (const item of orderItems) {
      if (!item.product) {
        res.status(400);
        throw new Error('Product reference is required for all order items');
      }
      const qty = parseInt(item.qty, 10);
      if (isNaN(qty) || qty <= 0) {
        res.status(400);
        throw new Error(`Invalid quantity for item "${item.name || 'product'}". Must be a positive integer.`);
      }
      if (!item.variantName) {
        res.status(400);
        throw new Error(`Variant selection is required for item "${item.name || 'product'}"`);
      }
    }

    // --- CONCURRENCY ENGINE: ATOMIC MULTI-USER TRANSACTION COMPLIANCE CHECK ---
    const reservedItems = [];
    try {
      for (const item of orderItems) {
        // Atomic update checking stock limit
        const result = await reserveStockItemAtomic(item);

        if (result.matchedCount === 0) {
          // Check if product exists at all or variant exists for descriptive error
          const dbProduct = await Product.findById(item.product);
          if (!dbProduct) {
            throw new Error(`Inventory Trace Error: Product entry "${item.name || 'Unknown'}" missing from server index.`);
          }
          const matchVariant = dbProduct.variants.find(v => v.name === item.variantName);
          if (!matchVariant) {
            throw new Error(`Variant Error: Pack size option "${item.variantName}" for product "${item.name}" does not exist.`);
          }
          throw new Error(`Multi-User Collision: Out of Stock! "${item.name} - ${item.variantName}" was just purchased by another customer. Only ${matchVariant.countInStock} items remaining.`);
        }

        // Keep track of successfully reserved item for rollback
        reservedItems.push(item);
      }
    } catch (err) {
      // Rollback logic: increment back the stock of already reserved items using bulk update
      if (reservedItems.length > 0) {
        await adjustStockBulk(reservedItems, 1);
      }
      if (res.statusCode === 200) {
        res.status(400);
      }
      throw err;
    }
    // -------------------------------------------------------------------------

    // Map parameters cleanly into your updated order collection schema
    const order = new Order({
      user: req.user._id,
      orderItems: orderItems.map(item => ({
        name: item.name,
        qty: item.qty,
        image: item.image,
        price: item.price,
        variantName: item.variantName,
        gst: item.gst || 0,
        routineGroupLabel: item.routineGroupLabel || 'Normal', 
        product: item.product
      })),
      shippingAddress,
      deliveryLocation,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
      orderType: orderType || 'Regular',
    });

    const createdOrder = await order.save();

    res.status(201).json(createdOrder);
  } catch (error) {
    next(error);
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (order) {
      // Data isolation checks
      const orderUserId = order.user._id ? order.user._id.toString() : order.user.toString();
      if (orderUserId !== req.user._id.toString() && !req.user.isAdmin) {
        res.status(401);
        throw new Error('Not authorized to view this order transaction');
      }

      res.json(order);
    } else {
      res.status(404);
      throw new Error('Order transaction index row not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      // Data isolation checks
      if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        res.status(401);
        throw new Error('Not authorized to access this order transaction');
      }

      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: req.body.id,
        status: req.body.status,
        update_time: req.body.update_time,
        email_address: req.body.email_address,
      };

      const updatedOrder = await order.save();
      
      // Trigger the timed demo workflow simulation engine
      runDemoWorkflowEngine(updatedOrder._id);

      res.json(updatedOrder);
    } else {
      res.status(404);
      throw new Error('Order link transaction not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

// @desc    Update order delivery/cancellation via email link click
// @route   GET /api/orders/:id/email-action
// @access  Public
const updateOrderFromEmailLink = async (req, res, next) => {
  const { status, refund, confirmed, aborted, signature } = req.query;

  // Verify link signature to prevent unauthorized tampering
  if (!verifyLinkSignature(req.params.id, 'email-action', signature, { status, refund })) {
    return res.status(403).send(renderActionPageHtml({
      pageTitle: 'Invalid Signature',
      icon: '⚠️',
      header: 'Invalid Signature',
      message: 'The action URL has an invalid or tampered cryptographic signature.',
      themeColor: '#ef4444',
    }));
  }

  if (aborted === 'true') {
    return res.send(renderActionPageHtml({
      pageTitle: 'Action Aborted',
      icon: '🛡️',
      header: 'Action Aborted',
      message: 'The action was cancelled. No changes have been made to the order.',
      themeColor: '#4b5563',
    }));
  }

  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (!order) {
      return res.status(404).send(renderActionPageHtml({
        pageTitle: 'Order Not Found',
        icon: '⚠️',
        header: 'Order Not Found',
        message: 'The order ID is invalid or has been removed from the database.',
        themeColor: '#ef4444',
      }));
    }

    // 1. Block action if order has already been finalized
    if (order.isDelivered || order.isCancelled) {
      const finalStatusText = order.isCancelled 
        ? `Cancelled (${order.refundStatus || 'Pending'})` 
        : 'Delivered';
      return res.send(renderActionPageHtml({
        pageTitle: 'Action Blocked',
        icon: '⚠️',
        header: 'Action Blocked',
        message: 'This order has already been finalized and cannot be modified.',
        detailBoxHtml: `<strong>Order ID:</strong> #${order._id.toString().slice(-8)}<br/><strong>Current Status:</strong> ${finalStatusText}`,
        themeColor: '#f59e0b',
      }));
    }

    // Block action if order has not yet been marked Out for Delivery
    if (!order.isOutForDelivery) {
      return res.send(renderActionPageHtml({
        pageTitle: 'Action Blocked',
        icon: '⚠️',
        header: 'Action Blocked',
        message: 'This action is disabled because the order has not been marked Out for Delivery yet.',
        detailBoxHtml: `<strong>Order ID:</strong> #${order._id.toString().slice(-8)}<br/><strong>Current Status:</strong> Preparing (Processing)`,
        themeColor: '#f59e0b',
      }));
    }

    // 2. Render confirmation page if not confirmed yet
    if (confirmed !== 'true') {
      let pageTitle = '';
      let confirmationQuestion = '';
      let detailText = '';
      let confirmButtonClass = '';
      let confirmButtonText = '';
      let themeColor = '#3b82f6';

      if (status === 'delivered') {
        themeColor = '#10b981';
        pageTitle = 'Confirm Delivery Completion';
        confirmationQuestion = `Are you sure you want to mark Order <strong>#${order._id.toString().slice(-8)}</strong> as Delivered?`;
        detailText = `<strong>Customer:</strong> ${order.user?.name || 'Customer'}<br/>
                     <strong>Total Price:</strong> ₹${order.totalPrice.toFixed(2)}<br/>
                     <strong>Shipping Address:</strong> ${order.shippingAddress.address}, ${order.shippingAddress.city}`;
        confirmButtonClass = 'btn-confirm-delivered';
        confirmButtonText = 'Yes, Mark Delivered';
      } else if (status === 'cancelled') {
        themeColor = '#ef4444';
        const isRefundYes = refund === 'yes';
        if (isRefundYes) {
          const refundAmt = order.itemsPrice + order.taxPrice;
          pageTitle = 'Confirm Cancellation & Refund';
          confirmationQuestion = `Are you sure you want to Cancel Order <strong>#${order._id.toString().slice(-8)}</strong> and issue a refund?`;
          detailText = `<strong>Refund Amount:</strong> ₹${refundAmt.toFixed(2)} (Subtotal + GST)<br/>
                       <strong>Retained Shipping Fee:</strong> ₹${order.shippingPrice.toFixed(2)}<br/>
                       <strong>Customer:</strong> ${order.user?.name || 'Customer'}<br/>
                       <em>Note: Product stock will be automatically restored to database inventory.</em>`;
        } else {
          pageTitle = 'Confirm Cancellation (No Refund)';
          confirmationQuestion = `Are you sure you want to Cancel Order <strong>#${order._id.toString().slice(-8)}</strong> with NO refund?`;
          detailText = `<strong>Retained Total Price:</strong> ₹${order.totalPrice.toFixed(2)} (goes to the store)<br/>
                       <strong>Refund Amount:</strong> ₹0.00<br/>
                       <strong>Customer:</strong> ${order.user?.name || 'Customer'}<br/>
                       <em>Note: Product stock will be automatically restored to database inventory.</em>`;
        }
        confirmButtonClass = 'btn-confirm-cancelled';
        confirmButtonText = isRefundYes ? 'Yes, Cancel & Refund' : 'Yes, Cancel (No Refund)';
      } else {
        return res.status(400).send('Invalid status request');
      }

      const confirmUrl = `/api/orders/${order._id}/email-action?status=${status || ''}&refund=${refund || ''}&confirmed=true&signature=${signature}`;
      const abortUrl = `/api/orders/${order._id}/email-action?aborted=true&signature=${signature}`;

      const buttonHtml = `
        <a href="${confirmUrl}" class="btn ${confirmButtonClass}">${confirmButtonText}</a>
        <a href="${abortUrl}" class="btn btn-cancel">No, Go Back</a>
      `;

      return res.send(renderActionPageHtml({
        pageTitle,
        icon: status === 'delivered' ? '🚚' : '❌',
        header: pageTitle,
        message: confirmationQuestion,
        detailBoxHtml: detailText,
        buttonHtml,
        themeColor,
      }));
    }

    // 3. Process the action if confirmed=true
    if (status === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
      order.isCancelled = false;
      order.isOutForDelivery = true; // Ensure transit flag matches delivered state
      await order.save();
      
      // Send simulation success and developer reveal emails
      sendOrderSuccessEmails(order);

      return res.send(renderActionPageHtml({
        pageTitle: 'Delivery Success',
        icon: '✅',
        header: 'Order Marked Delivered',
        message: `Order <strong>#${order._id.toString().slice(-8)}</strong> has been successfully updated to <strong>Delivered</strong> status.`,
        buttonHtml: `<a href="${FRONTEND_URL}/admin/orders" class="btn-go-admin">Go to Admin Orders</a>`,
        themeColor: '#10b981',
      }));
    } else if (status === 'cancelled') {
      const isRefundYes = refund === 'yes';

      // If not already cancelled, restore product stock and calculate refund
      if (!order.isCancelled) {
        await adjustStockBulk(order.orderItems, 1);
        order.isCancelled = true;
        order.cancelledAt = Date.now();
        order.isDelivered = false;

        if (isRefundYes) {
          order.refundStatus = 'Refunded (Except Shipping)';
          order.refundAmount = order.itemsPrice + order.taxPrice;
        } else {
          order.refundStatus = 'No Refund';
          order.refundAmount = 0.0;
        }
        await order.save();
      }
      
      // Send simulation cancelled email
      sendOrderCancellationEmail(order);

      const refundDetailText = isRefundYes
        ? `<strong>Refund Status:</strong> Refund Provided (Except Shipping)<br/><strong>Refund Amount:</strong> ₹${order.refundAmount.toFixed(2)} (Subtotal + GST, excluding ₹${order.shippingPrice.toFixed(2)} delivery fee)`
        : `<strong>Refund Status:</strong> No Refund<br/><strong>Refund Amount:</strong> ₹0.00 (Total user payment of ₹${order.totalPrice.toFixed(2)} goes to the store)`;

      return res.send(renderActionPageHtml({
        pageTitle: 'Cancellation Success',
        icon: '❌',
        header: 'Order Cancelled Successfully',
        message: `Order <strong>#${order._id.toString().slice(-8)}</strong> has been marked as <strong>Cancelled</strong>, and all items have been restored to catalog inventory.`,
        detailBoxHtml: refundDetailText,
        buttonHtml: `<a href="${FRONTEND_URL}/admin/orders" class="btn-go-admin">Go to Admin Orders</a>`,
        themeColor: '#ef4444',
      }));
    } else {
      return res.status(400).send('Invalid status request');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel order by user
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelOrderByUser = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }

    if (order.user.toString() !== req.user._id.toString()) {
      res.status(401);
      throw new Error('Not authorized to cancel this order');
    }

    if (!order.isPaid) {
      res.status(400);
      throw new Error('Order is not paid');
    }

    if (order.isCancelled) {
      res.status(400);
      throw new Error('Order is already cancelled');
    }

    if (order.isDelivered) {
      res.status(400);
      throw new Error('Cancellation Blocked: Order is already delivered and cannot be cancelled.');
    }

    const paidTime = new Date(order.paidAt).getTime();
    const diff = Date.now() - paidTime;
    
    // Process cancellation refunds dynamically based on time windows and dispatch status
    if (order.isOutForDelivery) {
      order.refundStatus = 'No Refund';
      order.refundAmount = 0.0;
    } else if (diff <= 30 * 1000) {
      // Within 30-second cancellation window: FULL refund (including delivery fee)
      order.refundStatus = 'Full Refund';
      order.refundAmount = order.totalPrice;
    } else {
      // After 30-second window: Partial refund (excluding delivery fee)
      order.refundStatus = 'Refunded (Except Shipping)';
      order.refundAmount = order.itemsPrice + order.taxPrice;
    }

    await adjustStockBulk(order.orderItems, 1);

    order.isCancelled = true;
    order.cancelledAt = Date.now();

    const updatedOrder = await order.save();
    
    // Send simulation cancelled email
    sendOrderCancellationEmail(updatedOrder);
    res.json(updatedOrder);
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel order by customer clicking email link
// @route   GET /api/orders/:id/customer-cancel
// @access  Public
const customerCancelFromEmailLink = async (req, res, next) => {
  const { confirmed, aborted, signature } = req.query;

  // Verify link signature to prevent unauthorized tampering
  if (!verifyLinkSignature(req.params.id, 'customer-cancel', signature)) {
    return res.status(403).send(renderActionPageHtml({
      pageTitle: 'Invalid Signature',
      icon: '⚠️',
      header: 'Invalid Signature',
      message: 'The action URL has an invalid or tampered cryptographic signature.',
      themeColor: '#ef4444',
    }));
  }

  if (aborted === 'true') {
    return res.send(renderActionPageHtml({
      pageTitle: 'Action Aborted',
      icon: '🛡️',
      header: 'Action Aborted',
      message: 'The action was cancelled. No changes have been made to the order.',
      themeColor: '#4b5563',
    }));
  }

  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (!order) {
      return res.status(404).send(renderActionPageHtml({
        pageTitle: 'Order Not Found',
        icon: '⚠️',
        header: 'Order Not Found',
        message: 'The order ID is invalid or has been removed from the database.',
        themeColor: '#ef4444',
      }));
    }

    if (order.isCancelled) {
      return res.send(renderActionPageHtml({
        pageTitle: 'Order Cancelled',
        icon: 'ℹ️',
        header: 'Already Cancelled',
        message: 'This order has already been cancelled and refunded.',
        themeColor: '#4b5563',
      }));
    }

    if (order.isDelivered) {
      return res.send(renderActionPageHtml({
        pageTitle: 'Cancellation Blocked',
        icon: '⚠️',
        header: 'Cancellation Blocked',
        message: 'This order has already been delivered and cannot be cancelled.',
        detailBoxHtml: `<strong>Order ID:</strong> #${order._id.toString().slice(-8)}<br/><strong>Current Status:</strong> Delivered`,
        themeColor: '#ef4444',
      }));
    }

    const paidTime = new Date(order.paidAt).getTime();
    const diff = Date.now() - paidTime;

    // 2. Render confirmation page if not confirmed yet
    if (confirmed !== 'true') {
      const confirmUrl = `/api/orders/${order._id}/customer-cancel?confirmed=true&signature=${signature}`;
      const abortUrl = `/api/orders/${order._id}/customer-cancel?aborted=true&signature=${signature}`;

      const buttonHtml = `
        <a href="${confirmUrl}" class="btn btn-confirm-cancelled">Yes, Cancel Order</a>
        <a href="${abortUrl}" class="btn btn-cancel">No, Go Back</a>
      `;

      const scripts = `
        const paidAtMs = ${new Date(order.paidAt).getTime()};
        const isOutForDelivery = ${order.isOutForDelivery};
        const totalPrice = ${order.totalPrice};
        const itemsPrice = ${order.itemsPrice};
        const taxPrice = ${order.taxPrice};
        const shippingPrice = ${order.shippingPrice};
        const customerName = "${order.user?.name || 'Customer'}";

        const detailBox = document.getElementById('detail-box');

        function updateDisplay() {
          if (isOutForDelivery) {
            detailBox.innerHTML = \`
              <strong style="color: #ef4444; display: block; margin-bottom: 8px; font-size: 14px;">🚨 TRANSIT CANCELLATION WARNING:</strong>
              This order is already <strong>Out for Delivery</strong>. If you cancel this order, <strong>NO REFUND will be provided</strong> (₹0.00 refund). The total payment of ₹\${totalPrice.toFixed(2)} goes to the store.<br/>
              <div style="margin-top: 8px; border-top: 1px solid #fee2e2; padding-top: 8px; font-size: 12px; color: #7f1d1d;">
                <strong>Customer:</strong> \${customerName}
              </div>
            \`;
            detailBox.style.backgroundColor = '#fef2f2';
            detailBox.style.borderColor = '#fee2e2';
            detailBox.style.color = '#991b1b';
            return;
          }

          const elapsed = Date.now() - paidAtMs;
          const remaining = 30000 - elapsed;

          if (remaining > 0) {
            const secs = Math.ceil(remaining / 1000);
            detailBox.innerHTML = \`
              <strong style="color: #d97706; display: block; margin-bottom: 8px; font-size: 14px;">⏱️ GRACE PERIOD ACTIVE: \${secs}s remaining</strong>
              You are within the 30-second cancellation window. You will receive a <strong>FULL refund</strong> of <strong>₹\${totalPrice.toFixed(2)}</strong> (including delivery fee).<br/>
              <div style="margin-top: 8px; border-top: 1px solid #fef3c7; padding-top: 8px; font-size: 12px; color: #92400e;">
                <strong>Customer:</strong> \${customerName}
              </div>
            \`;
            detailBox.style.backgroundColor = '#fffbeb';
            detailBox.style.borderColor = '#fef3c7';
            detailBox.style.color = '#92400e';
            
            setTimeout(updateDisplay, 1000);
          } else {
            const refundAmt = itemsPrice + taxPrice;
            detailBox.innerHTML = \`
              <strong style="color: #b91c1c; display: block; margin-bottom: 8px; font-size: 14px;">⏱️ GRACE PERIOD EXCEEDED</strong>
              The 30-second grace period has expired, but the order is not yet dispatched.<br/>
              <strong>Refund Status:</strong> Partial Refund Provided<br/>
              <strong>Refund Amount:</strong> ₹\${refundAmt.toFixed(2)} (Subtotal + GST)<br/>
              <strong>Retained Delivery Fee:</strong> ₹\${shippingPrice.toFixed(2)} (retained by store)<br/>
              <div style="margin-top: 8px; border-top: 1px solid #fee2e2; padding-top: 8px; font-size: 12px; color: #7f1d1d;">
                <strong>Customer:</strong> \${customerName}
              </div>
            \`;
            detailBox.style.backgroundColor = '#fef2f2';
            detailBox.style.borderColor = '#fee2e2';
            detailBox.style.color = '#991b1b';
          }
        }

        updateDisplay();
      `;

      return res.send(renderActionPageHtml({
        pageTitle: 'Confirm Cancellation',
        icon: '❌',
        header: 'Confirm Order Cancellation',
        message: `Are you sure you want to cancel Order <strong>#${order._id.toString().slice(-8)}</strong>?`,
        detailBoxHtml: 'Loading refund status evaluation...',
        buttonHtml,
        themeColor: '#ef4444',
        scripts,
      }));
    }

    // 3. Process the cancellation if confirmed=true
    let finalRefundStatus = '';
    let finalRefundAmount = 0;

    if (order.isOutForDelivery) {
      finalRefundStatus = 'No Refund';
      finalRefundAmount = 0.0;
    } else if (diff <= 30 * 1000) {
      finalRefundStatus = 'Full Refund';
      finalRefundAmount = order.totalPrice;
    } else {
      finalRefundStatus = 'Refunded (Except Shipping)';
      finalRefundAmount = order.itemsPrice + order.taxPrice;
    }

    await adjustStockBulk(order.orderItems, 1);

    order.isCancelled = true;
    order.cancelledAt = Date.now();
    order.refundStatus = finalRefundStatus;
    order.refundAmount = finalRefundAmount;

    await order.save();
    
    // Send simulation cancelled email
    sendOrderCancellationEmail(order);

    const refundMsg = finalRefundStatus === 'Full Refund' 
      ? `<strong>Refund Status:</strong> Full Refund Provided<br/><strong>Refund Amount:</strong> ₹${finalRefundAmount.toFixed(2)} (including shipping fee)` 
      : finalRefundStatus === 'No Refund' 
      ? `<strong>Refund Status:</strong> No Refund<br/><strong>Refund Amount:</strong> ₹0.00 (goes to the store)` 
      : `<strong>Refund Status:</strong> Refund Provided (Except Shipping)<br/><strong>Refund Amount:</strong> ₹${finalRefundAmount.toFixed(2)} (excluding ₹${order.shippingPrice.toFixed(2)} shipping fee)`;

    return res.send(renderActionPageHtml({
      pageTitle: 'Cancellation Success',
      icon: '❌',
      header: 'Order Cancelled Successfully',
      message: `Order <strong>#${order._id.toString().slice(-8)}</strong> has been marked as <strong>Cancelled</strong>, and all items have been restored to catalog inventory.`,
      detailBoxHtml: refundMsg,
      buttonHtml: `<a href="${FRONTEND_URL}/profile" class="btn-go-profile">Go to My Profile</a>`,
      themeColor: '#ef4444',
    }));
  } catch (error) {
    next(error);
  }
};

// @desc    Update order to out for delivery via email link click
// @route   GET /api/orders/:id/email-out-for-delivery
// @access  Public
const emailOutForDelivery = async (req, res, next) => {
  const { confirmed, aborted, signature } = req.query;

  // Verify link signature to prevent unauthorized tampering
  if (!verifyLinkSignature(req.params.id, 'email-out-for-delivery', signature)) {
    return res.status(403).send(renderActionPageHtml({
      pageTitle: 'Invalid Signature',
      icon: '⚠️',
      header: 'Invalid Signature',
      message: 'The action URL has an invalid or tampered cryptographic signature.',
      themeColor: '#ef4444',
    }));
  }

  if (aborted === 'true') {
    return res.send(renderActionPageHtml({
      pageTitle: 'Action Aborted',
      icon: '🛡️',
      header: 'Action Aborted',
      message: 'The action was cancelled. No changes have been made to the order.',
      themeColor: '#4b5563',
    }));
  }

  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (!order) {
      return res.status(404).send(renderActionPageHtml({
        pageTitle: 'Order Not Found',
        icon: '⚠️',
        header: 'Order Not Found',
        message: 'The order ID is invalid or has been removed from the database.',
        themeColor: '#ef4444',
      }));
    }

    // 1. Block if already out for delivery or delivered/cancelled
    if (order.isOutForDelivery || order.isDelivered || order.isCancelled) {
      const statusText = order.isCancelled 
        ? 'Cancelled' 
        : order.isDelivered 
        ? 'Delivered' 
        : 'already Out for Delivery';
      return res.send(renderActionPageHtml({
        pageTitle: 'Action Blocked',
        icon: '⚠️',
        header: 'Action Blocked',
        message: `This order is ${statusText} and cannot be marked Out for Delivery again.`,
        themeColor: '#f59e0b',
      }));
    }

    // 2. Render confirmation page
    if (confirmed !== 'true') {
      const confirmUrl = `/api/orders/${order._id}/email-out-for-delivery?confirmed=true&signature=${signature}`;
      const abortUrl = `/api/orders/${order._id}/email-out-for-delivery?aborted=true&signature=${signature}`;

      const buttonHtml = `
        <a href="${confirmUrl}" class="btn btn-confirm">Yes, Dispatch Order</a>
        <a href="${abortUrl}" class="btn btn-cancel">No, Go Back</a>
      `;

      return res.send(renderActionPageHtml({
        pageTitle: 'Confirm Dispatch',
        icon: '🚚',
        header: 'Confirm Dispatch',
        message: `Are you sure you want to mark Order <strong>#${order._id.toString().slice(-8)}</strong> as Out for Delivery?`,
        detailBoxHtml: `<strong>Customer:</strong> ${order.user?.name || 'Customer'}<br/>
                       <strong>Address:</strong> ${order.shippingAddress.address}, ${order.shippingAddress.city}<br/>
                       <strong>Grand Total:</strong> ₹${order.totalPrice.toFixed(2)}`,
        buttonHtml,
        themeColor: '#7c3aed',
      }));
    }

    // 3. Mark Out for Delivery & Send Emails
    order.isOutForDelivery = true;
    order.outForDeliveryAt = Date.now();
    await order.save();

    // Trigger Out for Delivery dispatches via shared emailService
    await sendOrderOutForDeliveryEmails(order);

    return res.send(renderActionPageHtml({
      pageTitle: 'Dispatch Success',
      icon: '✅',
      header: 'Order Dispatched',
      message: `Order <strong>#${order._id.toString().slice(-8)}</strong> is successfully marked as <strong>Out for Delivery</strong> and dispatch alerts have been sent.`,
      buttonHtml: `<a href="${FRONTEND_URL}/admin/orders" class="btn-go-admin">Go to Admin Orders</a>`,
      themeColor: '#10b981',
    }));
  } catch (error) {
    next(error);
  }
};

export {
  addOrderItems,
  getOrderById,
  updateOrderToPaid,
  getMyOrders,
  updateOrderFromEmailLink,
  cancelOrderByUser,
  customerCancelFromEmailLink,
  emailOutForDelivery,
};