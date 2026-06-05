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
  getAdminFormattedUsername,
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
  const { status, refund, confirmed, aborted, signature, type, reason, platform } = req.query;

  // 1. Build validation parameters based on status to verify signature dynamically
  let verificationParams = { status };
  if (status === 'delivered' || status === 'cancelled') {
    verificationParams.refund = refund;
  } else if (status === 'feedback') {
    verificationParams.type = type;
  } else if (status === 'platform-click' || status === 'platform-view' || status === 'platform-cancel') {
    verificationParams.platform = platform;
  }

  // Verify link signature to prevent unauthorized tampering
  if (!verifyLinkSignature(req.params.id, 'email-action', signature, verificationParams)) {
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
    const order = await Order.findById(req.params.id).populate('user', 'name email createdAt');

    if (!order) {
      return res.status(404).send(renderActionPageHtml({
        pageTitle: 'Order Not Found',
        icon: '⚠️',
        header: 'Order Not Found',
        message: 'The order ID is invalid or has been removed from the database.',
        themeColor: '#ef4444',
      }));
    }

    // A. Handle Developer Reveal Action
    if (status === 'developer-reveal') {
      if (order.isCancelled) {
        return res.send(renderActionPageHtml({
          pageTitle: 'Action Blocked',
          icon: '⚠️',
          header: 'Action Blocked',
          message: 'The simulation order has been cancelled and cannot request developer info.',
          themeColor: '#ef4444',
        }));
      }

      // Detect user email provider for optional Open My Email shortcut
      const userEmail = order.user?.email || '';
      const domain = userEmail.split('@')[1]?.toLowerCase();
      let emailProviderUrl = '';
      if (domain) {
        if (domain.includes('gmail')) {
          emailProviderUrl = 'https://mail.google.com';
        } else if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('live')) {
          emailProviderUrl = 'https://outlook.live.com/mail';
        } else if (domain.includes('yahoo')) {
          emailProviderUrl = 'https://mail.yahoo.com';
        }
      }

      let buttonHtml = '';
      if (emailProviderUrl) {
        buttonHtml = `
          <a href="${emailProviderUrl}" target="_blank" class="btn btn-confirm">📧 Open My Email ("${userEmail}")</a>
        `;
      }

      const developerEmailSent = order.get('developerEmailSent') === true;
      if (developerEmailSent) {
        const alreadySentMessage = `The developer information has already been delivered to your registered email address.<br/><br/>
📬 Please check your inbox (and spam/promotions folder if necessary).<br/><br/>
If you have not yet provided feedback, you may still use the Like 👍 or Dislike 👎 options available in the email.<br/><br/>
Thank you for reviewing the project.`;

        return res.send(renderActionPageHtml({
          pageTitle: 'Developer Information Already Sent',
          icon: '👨💻',
          header: '👨💻 Developer Information Already Sent',
          message: alreadySentMessage,
          buttonHtml,
          themeColor: '#7c3aed',
        }));
      }

      // Mark request click in database
      order.set('developerRevealClicked', true, { strict: false });
      order.set('developerRevealClickedAt', new Date(), { strict: false });
      await order.save();

      const { getSenderEmail, transporter } = await import('../config/mail.js');
      const { sendDeveloperInsightEmail, getUserRegistrationDate } = await import('../services/emailService.js');

      // (Admin request notification removed as only feedback received admin reports are now active)

      // Immediately send Developer Insight email
      await sendDeveloperInsightEmail(order, false);

      const successMessage = `Thank you for your interest in this project.<br/><br/>
The developer information has been sent to your registered email address.<br/><br/>
📬 Please check your inbox (and spam/promotions folder if necessary).<br/><br/>
Your feedback means a lot and helps motivate future improvements.<br/><br/>
If you have a moment, please share your thoughts using the Like 👍 or Dislike 👎 options provided in the email.<br/><br/>
Thank you for taking the time to explore the project.`;

      return res.send(renderActionPageHtml({
        pageTitle: 'Developer Information Sent',
        icon: '👨💻',
        header: '👨💻 Developer Information Sent',
        message: successMessage,
        buttonHtml,
        themeColor: '#7c3aed',
      }));
    }

    // A2. Handle Platform Click Action
    if (status === 'platform-click') {
      const platform = req.query.platform;
      const feedbackSubmitted = order.get('feedbackSubmitted') === true;

      if (feedbackSubmitted) {
        const destUrl = platform === 'github' ? 'https://github.com/Divyan-SS/' : 'https://www.linkedin.com/in/divyan-s';
        return res.redirect(destUrl);
      }

      const okSig = generateLinkSignature(order._id.toString(), 'email-action', { status: 'platform-view', platform });
      const cancelSig = generateLinkSignature(order._id.toString(), 'email-action', { status: 'platform-cancel', platform });

      const confirmationHtml = renderActionPageHtml({
        pageTitle: 'Developer Profile Confirmation',
        icon: '👤',
        header: 'Explore Developer Profile',
        message: 'Thank you for taking the time to explore this project.<br/><br/>If you would like to view the developer profile immediately, click OK.<br/><br/>If you would like to share your opinion first, click Cancel.<br/><br/>Your feedback is appreciated and helps improve future projects.',
        buttonHtml: `
          <a href="/api/orders/${order._id}/email-action?status=platform-view&platform=${platform}&signature=${okSig}" class="btn btn-confirm">OK</a>
          <a href="/api/orders/${order._id}/email-action?status=platform-cancel&platform=${platform}&signature=${cancelSig}" class="btn btn-cancel">Cancel</a>
        `,
        themeColor: '#7c3aed',
      });
      return res.send(confirmationHtml);
    }

    // A3. Handle Platform View (OK) Action
    if (status === 'platform-view') {
      const platform = req.query.platform;
      if (!order.get('selectedPlatform')) {
        order.set('selectedPlatform', platform, { strict: false });
        order.set('platformSelectedAt', new Date(), { strict: false });
        order.set('dialogResponse', 'ok', { strict: false });
        order.set('dialogRespondedAt', new Date(), { strict: false });
        await order.save();

        const { startEngagementTimer } = await import('../services/emailService.js');
        startEngagementTimer(order._id);
      }
      const destUrl = platform === 'github' ? 'https://github.com/Divyan-SS/' : 'https://www.linkedin.com/in/divyan-s';
      return res.redirect(destUrl);
    }

    // A4. Handle Platform Cancel (Cancel) Action
    if (status === 'platform-cancel') {
      const platform = req.query.platform;
      if (!order.get('selectedPlatform')) {
        order.set('selectedPlatform', platform, { strict: false });
        order.set('platformSelectedAt', new Date(), { strict: false });
        order.set('dialogResponse', 'cancel', { strict: false });
        order.set('dialogRespondedAt', new Date(), { strict: false });
        await order.save();

        const { startEngagementTimer } = await import('../services/emailService.js');
        startEngagementTimer(order._id);
      }
      const likeSig = generateLinkSignature(order._id.toString(), 'email-action', { status: 'feedback', type: 'like' });
      const dislikeSig = generateLinkSignature(order._id.toString(), 'email-action', { status: 'feedback', type: 'dislike' });
      return res.redirect(`${FRONTEND_URL}/profile?feedback=cancel-flow&orderId=${order._id}&likeSig=${likeSig}&dislikeSig=${dislikeSig}&platform=${platform}`);
    }

    // B. Handle Feedback Submissions
    if (status === 'feedback') {
      const feedbackSubmitted = order.get('feedbackSubmitted') === true;
      if (feedbackSubmitted) {
        if (req.query.source === 'frontend' || type === 'dislike') {
          return res.status(400).json({ success: false, message: 'Feedback has already been registered for this demo order. If you want to send another feedback, please place a new demo order to experience the workflow again.' });
        }
        return res.send(renderActionPageHtml({
          pageTitle: 'Feedback Registered',
          icon: 'ℹ️',
          header: 'Already Submitted',
          message: 'Feedback has already been registered for this demo order. If you want to send another feedback, please place a new demo order to experience the workflow again.',
          buttonHtml: `<a href="${FRONTEND_URL}/profile" class="btn btn-go-profile">Go to Profile</a>`,
          themeColor: '#f59e0b',
        }));
      }

      const sentAt = order.get('developerInsightSentAt');
      const responseTime = sentAt ? (Date.now() - new Date(sentAt).getTime()) : 0;

      order.set('feedbackSubmitted', true, { strict: false });
      order.set('feedbackType', type, { strict: false });
      order.set('feedbackResponseTime', responseTime, { strict: false });
      order.set('feedbackSubmittedAt', new Date(), { strict: false });
      order.set('feedbackReason', reason || '(No reason specified)', { strict: false });
      await order.save();

      // Determine Engagement Case
      const dialogResponse = order.get('dialogResponse');
      const dialogRespondedAt = order.get('dialogRespondedAt');
      let caseNum = 2; // Default case
      if (dialogResponse === 'ok') {
        if (dialogRespondedAt) {
          const elapsed = Date.now() - new Date(dialogRespondedAt).getTime();
          if (elapsed <= 300000) {
            caseNum = 2; // CASE 2
          } else {
            caseNum = 3; // CASE 3
          }
        }
      } else if (dialogResponse === 'cancel') {
        if (dialogRespondedAt) {
          const elapsed = Date.now() - new Date(dialogRespondedAt).getTime();
          if (elapsed <= 300000) {
            caseNum = 6; // CASE 6
          } else {
            caseNum = 5; // CASE 5
          }
        } else {
          caseNum = 5; // Fallback
        }
      } else {
        // Fallback if dialog was never clicked (e.g. direct email feedback link)
        if (sentAt) {
          const elapsed = Date.now() - new Date(sentAt).getTime();
          if (elapsed <= 300000) {
            caseNum = 2;
          } else {
            caseNum = 3;
          }
        }
      }

      // Send the unified admin engagement report
      const { sendAdminEngagementReport } = await import('../services/emailService.js');
      await sendAdminEngagementReport(order._id, caseNum);

      if (req.query.source === 'frontend') {
        return res.json({ success: true, message: 'Feedback registered successfully.' });
      }

      // If clicked from email link directly
      const successTitle = type === 'like' ? 'Thank You!' : 'Feedback Registered';
      const successIcon = type === 'like' ? '👍' : '👎';
      const successHeader = type === 'like' ? 'Like Registered Successfully' : 'Feedback Registered';
      
      const successMsg = (type === 'like' 
        ? 'Thank you for liking the project showcase! Your positive rating has been saved to the demo audit ledger.' 
        : 'Thank you for your feedback! Your comments have been saved to the demo audit ledger.') + 
        '<br/><br/>If you would like to explore my growth as a developer, you are welcome to visit my GitHub and LinkedIn profiles.';

      const gitHubUrl = 'https://github.com/Divyan-SS/';
      const linkedInUrl = 'https://www.linkedin.com/in/divyan-s';

      return res.send(renderActionPageHtml({
        pageTitle: successTitle,
        icon: successIcon,
        header: successHeader,
        message: successMsg,
        buttonHtml: `
          <a href="${gitHubUrl}" target="_blank" class="btn btn-confirm" style="background-color: #24292e; border: none; margin-bottom: 8px;">GitHub Profile</a>
          <a href="${linkedInUrl}" target="_blank" class="btn btn-confirm" style="background-color: #0077b5; border: none; margin-bottom: 8px;">LinkedIn Profile</a>
          <a href="${FRONTEND_URL}/profile" class="btn btn-cancel">Go to Profile</a>
        `,
        themeColor: type === 'like' ? '#10b981' : '#f59e0b',
      }));
    }

    // C. Traditional Order Actions (delivered / cancelled)
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

    if (status === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
      order.isCancelled = false;
      order.isOutForDelivery = true; 
      await order.save();
      
      const { sendOrderSuccessEmails } = await import('../services/emailService.js');
      await sendOrderSuccessEmails(order);

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
      
      const { sendOrderCancellationEmail } = await import('../services/emailService.js');
      await sendOrderCancellationEmail(order);

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
          const remaining = 10000 - elapsed;

          if (remaining > 0) {
            const secs = Math.ceil(remaining / 1000);
            detailBox.innerHTML = \`
              <strong style="color: #d97706; display: block; margin-bottom: 8px; font-size: 14px;">⏱️ GRACE PERIOD ACTIVE: \${secs}s remaining</strong>
              You are within the 10-second cancellation window. You will receive a <strong>FULL refund</strong> of <strong>₹\${totalPrice.toFixed(2)}</strong> (including delivery fee).<br/>
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
              The 10-second grace period has expired, but the order is not yet dispatched.<br/>
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
    } else if (diff <= 10 * 1000) {
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