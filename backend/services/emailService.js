import Order from '../models/Order.js';
import User from '../models/User.js';
import { transporter, getSenderEmail } from '../config/mail.js';
import { generateLinkSignature } from './cryptoService.js';

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:5001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const getCustomDateString = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const getCustomTimeString = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hourStr = String(hours).padStart(2, '0');
  return `${hourStr}:${minutes}:${seconds} ${ampm}`;
};

const formatCustomDate = (date) => {
  if (!date) return 'N/A';
  return `${getCustomDateString(date)} ${getCustomTimeString(date)}`;
};

const getDurationString = (start, end) => {
  if (!start || !end) return 'N/A';
  const diffMs = Math.abs(new Date(end).getTime() - new Date(start).getTime());
  const totalSecs = Math.floor(diffMs / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
};

/**
 * Helper to get user serial number registration index and format their name for admin alerts
 * e.g., 1. "John Doe", 2. "Jane Smith"
 */
export const getAdminFormattedUsername = async (user) => {
  if (!user) return 'Customer';
  try {
    let freshUser = user;
    if (!freshUser.createdAt || !freshUser._id) {
      freshUser = await User.findOne({ email: user.email });
    }
    if (!freshUser) return user.name || 'Customer';
    const serial = await User.countDocuments({ createdAt: { $lte: freshUser.createdAt } });
    return `${serial}. "${freshUser.name}"`;
  } catch (err) {
    return user.name || 'Customer';
  }
};

export const getUserRegistrationDate = async (user) => {
  if (!user) return 'N/A';
  if (user.createdAt) return new Date(user.createdAt).toLocaleString();
  try {
    let freshUser = user;
    if (!freshUser.createdAt || !freshUser._id) {
      freshUser = await User.findOne({ email: user.email });
    }
    if (!freshUser || !freshUser.createdAt) return 'N/A';
    return new Date(freshUser.createdAt).toLocaleString();
  } catch (err) {
    return 'N/A';
  }
};


// Generates HTML row mappings for order items list
const getOrderItemsHtml = (orderItems) => {
  return orderItems.map(item => `
    <tr style="border-bottom: 1px solid #f3f4f6;">
      <td style="padding: 8px 0;">
        <span style="font-weight: bold; color: #111827;">${item.name}</span><br/>
        <span style="font-size: 11px; color: #6b7280;">Variant: ${item.variantName}</span>
      </td>
      <td style="padding: 8px 0; text-align: center; color: #374151;">${item.qty}</td>
      <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #111827;">₹${(item.qty * item.price).toFixed(2)}</td>
    </tr>
  `).join('');
};

// Common CSS Styles and Layout Wrapper
const getEmailWrapperHtml = (title, contentHtml) => {
  return `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px; color: #374151; background-color: #ffffff;">
      <!-- DEMO MODE BANNER -->
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #d97706; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
        <strong style="color: #b45309; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; display: block;">⚠️ Demo Mode Notice</strong>
        <span style="font-size: 11px; color: #78350f; font-weight: 500; margin-top: 2px; display: inline-block;">
          DEMO MODE - NO REAL PURCHASE OR DELIVERY IS INVOLVED
        </span>
      </div>
      
      ${contentHtml}
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <div style="text-align: center;">
        <p style="font-size: 11px; color: #9ca3af; margin: 0 0 4px 0;">DailyMart Demo E-Commerce Platform</p>
        <p style="font-size: 10px; color: #cbd5e1; margin: 0;">This email is part of a portfolio project demonstration.</p>
      </div>
    </div>
  `;
};

/**
 * Resumes or triggers the countdown steps of the demo workflow simulation engine
 */
const scheduleWorkflowForOrder = (order, elapsedMs) => {
  const orderId = order._id.toString();

  // T+10 Seconds: Placed Email
  if (!order.get('placedEmailSent')) {
    const placedDelay = Math.max(0, 10000 - elapsedMs);
    console.log(`[Demo Workflow] Scheduling Placed email for Order #${orderId} in ${placedDelay}ms`);
    setTimeout(async () => {
      try {
        const freshOrder = await Order.findById(orderId).populate('user', 'name email');
        if (freshOrder && !freshOrder.isCancelled && !freshOrder.get('placedEmailSent')) {
          await sendDemoOrderPlacedEmail(freshOrder);
        }
      } catch (err) {
        console.error(`[Demo Workflow] Placed timeout error for Order #${orderId}:`, err.message);
      }
    }, placedDelay);
  }

  // T+55 Seconds: Dispatched Step
  if (!order.isOutForDelivery) {
    const dispatchDelay = Math.max(0, 55000 - elapsedMs);
    console.log(`[Demo Workflow] Scheduling Dispatch for Order #${orderId} in ${dispatchDelay}ms`);
    setTimeout(async () => {
      try {
        const freshOrder = await Order.findById(orderId).populate('user', 'name email');
        if (freshOrder && !freshOrder.isCancelled && !freshOrder.isOutForDelivery) {
          freshOrder.isOutForDelivery = true;
          freshOrder.outForDeliveryAt = Date.now();
          await freshOrder.save();
          await sendDemoOrderDispatchedEmail(freshOrder);
        }
      } catch (err) {
        console.error(`[Demo Workflow] Dispatch timeout error for Order #${orderId}:`, err.message);
      }
    }, dispatchDelay);
  }

  // T+100 Seconds: Completed Step
  if (!order.isDelivered) {
    const completedDelay = Math.max(0, 100000 - elapsedMs);
    console.log(`[Demo Workflow] Scheduling Completion for Order #${orderId} in ${completedDelay}ms`);
    setTimeout(async () => {
      try {
        const freshOrder = await Order.findById(orderId).populate('user', 'name email');
        if (freshOrder && !freshOrder.isCancelled && !freshOrder.isDelivered) {
          freshOrder.isDelivered = true;
          freshOrder.deliveredAt = Date.now();
          freshOrder.set('completedAt', new Date(), { strict: false });
          await freshOrder.save();
          await sendDemoOrderCompletedEmails(freshOrder);
        }
      } catch (err) {
        console.error(`[Demo Workflow] Completion timeout error for Order #${orderId}:`, err.message);
      }
    }, completedDelay);
  }
};

/**
 * Main Orchestration Layer: Timed Demo Order Flow System
 * Executes strict timeout state transitions: T+10s Placed, T+55s Dispatched, T+100s Completed
 * @param {String} orderId - ID of the order document
 */
export const runDemoWorkflowEngine = async (orderId) => {
  console.log(`[Demo Workflow Engine] Initializing for Order #${orderId}`);
  try {
    const order = await Order.findById(orderId).populate('user', 'name email');
    if (!order) {
      console.error(`[Demo Workflow Engine] Order #${orderId} not found. Aborting initialization.`);
      return;
    }
    
    // Schedule all timed stages
    scheduleWorkflowForOrder(order, 0);
  } catch (err) {
    console.error(`[Demo Workflow Engine] Launch error:`, err.message);
  }
};

/**
 * T+10 Seconds - Customer Placed Email
 */
export const sendDemoOrderPlacedEmail = async (order) => {
  // Reload order to ensure we avoid race conditions on duplicate sends
  const freshOrder = await Order.findById(order._id).populate('user', 'name email');
  if (!freshOrder || freshOrder.get('placedEmailSent')) return;

  // Persist flag to database dynamically
  freshOrder.set('placedEmailSent', true, { strict: false });
  await freshOrder.save();

  const cancelSig = generateLinkSignature(freshOrder._id.toString(), 'customer-cancel');
  const emailUser = getSenderEmail();
  const orderItemsListHtml = getOrderItemsHtml(freshOrder.orderItems);

  const contentHtml = `
    <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 16px;">
      <h2 style="color: #1e40af; margin: 0; text-transform: uppercase; font-size: 20px; letter-spacing: 0.5px;">📦 Demo Order Placed</h2>
      <p style="font-size: 13px; color: #4b5563; margin: 8px 0 0 0;">Hi ${freshOrder.user?.name || 'Customer'}, thank you for testing the DailyMart demo system!</p>
    </div>

    <!-- Highlighted Notice -->
    <div style="background-color: #eff6ff; border: 1px dashed #bfdbfe; border-radius: 8px; padding: 12px 16px; margin: 20px 0; text-align: center;">
      <strong style="color: #1d4ed8; font-size: 13px; display: block; margin-bottom: 2px;">⏳ Workflow Started</strong>
      <span style="font-size: 12px; color: #1e40af; font-weight: 500;">You will receive additional status updates shortly.</span>
    </div>

    <div style="margin: 20px 0; background-color: #f9fafb; padding: 16px; border-radius: 12px; font-size: 12px; border: 1px solid #f3f4f6; color: #4b5563;">
      <strong style="color: #111827; display: block; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Simulation Information</strong>
      <p style="margin: 0 0 6px 0;">• No real payments or financial transactions were processed.</p>
      <p style="margin: 0 0 6px 0;">• No products will be shipped or delivered.</p>
      <p style="margin: 0 0 10px 0;">• Monitor your registered email address and the <strong>Profile page</strong> in DailyMart for automated workflow progress updates.</p>
      <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-left: 4px solid #7c3aed; padding: 10px; border-radius: 6px; margin-top: 10px;">
        <strong style="color: #6d28d9; display: block; font-size: 11px; text-transform: uppercase;">📧 Next Scheduled Update:</strong>
        <span style="font-size: 11px; color: #5b21b6; font-weight: 500;">
          In approximately <strong>45 seconds</strong> you will receive the <strong>Demo Order Dispatched</strong> status update.
        </span>
      </div>
    </div>

    <div style="margin: 20px 0;">
      <h3 style="font-size: 13px; text-transform: uppercase; color: #111827; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px; margin-bottom: 12px; font-weight: bold;">Order Summary</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="border-bottom: 1px solid #e5e7eb; text-align: left; color: #9ca3af; font-size: 10px; text-transform: uppercase;">
            <th style="padding: 6px 0;">Item Details</th>
            <th style="padding: 6px 0; text-align: center;">Qty</th>
            <th style="padding: 6px 0; text-align: right;">Total Price</th>
          </tr>
        </thead>
        <tbody>
          ${orderItemsListHtml}
        </tbody>
      </table>
    </div>
    
    <div style="margin: 20px 0; background-color: #f9fafb; padding: 16px; border-radius: 12px; font-size: 12px; border: 1px solid #f3f4f6;">
      <table style="width: 100%; border-collapse: collapse; color: #4b5563;">
        <tr>
          <td style="padding: 4px 0;">Items Subtotal:</td>
          <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #111827;">₹${freshOrder.itemsPrice.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">Tax Price (GST):</td>
          <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #111827;">₹${freshOrder.taxPrice.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">Shipping Fee:</td>
          <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #111827;">₹${freshOrder.shippingPrice.toFixed(2)}</td>
        </tr>
        <tr style="border-top: 1px solid #e5e7eb;">
          <td style="padding: 10px 0 0 0; font-size: 14px; font-weight: bold; color: #111827;">Total Paid:</td>
          <td style="padding: 10px 0 0 0; text-align: right; font-size: 14px; font-weight: bold; color: #2563eb;">₹${freshOrder.totalPrice.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <div style="margin: 20px 0; font-size: 12px; line-height: 1.5; background-color: #f9fafb; padding: 16px; border-radius: 12px; border: 1px solid #f3f4f6;">
      <h3 style="font-size: 12px; text-transform: uppercase; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin: 0 0 8px 0; font-weight: bold;">Shipping Destination</h3>
      <p style="margin: 0; font-weight: bold; color: #374151;">${freshOrder.shippingAddress.address}, ${freshOrder.shippingAddress.city}</p>
      <p style="margin: 2px 0 0 0; color: #6b7280;">Postal Code: ${freshOrder.shippingAddress.postalCode}</p>
      
      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="margin: 0 0 10px 0; font-size: 11px; color: #6b7280; line-height: 1.5;">
          You can cancel your order directly during the simulation countdown.
        </p>
        <a href="${BACKEND_API_URL}/api/orders/${freshOrder._id}/customer-cancel?signature=${cancelSig}" style="display: inline-block; background-color: #ef4444; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 12px;">Cancel Order</a>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"DailyMart Demo" <${emailUser}>`,
      to: freshOrder.user?.email,
      subject: `📦 Demo Order Placed – DailyMart`,
      html: getEmailWrapperHtml('Demo Order Placed', contentHtml),
    });
  } catch (err) {
    console.error(`[Email Service] Demo Order Placed email failed for Order #${freshOrder._id}:`, err.message);
  }
};

/**
 * T+55 Seconds - Customer Dispatched Email + Admin Alert
 */
export const sendDemoOrderDispatchedEmail = async (order) => {
  const freshOrder = await Order.findById(order._id).populate('user', 'name email createdAt');
  if (!freshOrder || freshOrder.get('dispatchAlertSent')) return;

  freshOrder.set('dispatchAlertSent', true, { strict: false });
  await freshOrder.save();

  const cancelSig = generateLinkSignature(freshOrder._id.toString(), 'customer-cancel');
  const emailUser = getSenderEmail();
  const orderItemsListHtml = getOrderItemsHtml(freshOrder.orderItems);

  // Customer Dispatched Email HTML
  const contentHtml = `
    <div style="text-align: center; border-bottom: 2px solid #f59e0b; padding-bottom: 16px;">
      <h2 style="color: #d97706; margin: 0; text-transform: uppercase; font-size: 20px; letter-spacing: 0.5px;">🚚 Demo Order Dispatched</h2>
      <p style="font-size: 13px; color: #4b5563; margin: 8px 0 0 0;">Status: OUT FOR DELIVERY (Simulated)</p>
    </div>

    <!-- Highlighted Notice -->
    <div style="background-color: #fffbeb; border: 1px dashed #fde68a; border-radius: 8px; padding: 12px 16px; margin: 20px 0; text-align: center;">
      <strong style="color: #d97706; font-size: 13px; display: block; margin-bottom: 2px;">✅ In approximately 45 seconds you will receive:</strong>
      <span style="font-size: 12px; color: #b45309; font-weight: bold; text-transform: uppercase;">Demo Order Completed</span>
    </div>

    <div style="font-size: 13px; line-height: 1.6; color: #374151; margin: 20px 0;">
      <p>Hello <strong>${freshOrder.user?.name || 'Customer'}</strong>,</p>
      <p>Your mock order <strong>#${freshOrder._id.toString().slice(-8)}</strong> has been dispatched for delivery.</p>
      
      <div style="background-color: #f9fafb; padding: 14px; border-radius: 12px; border-left: 4px solid #f59e0b; border: 1px solid #f3f4f6; margin: 15px 0;">
        <span style="font-size: 11px; text-transform: uppercase; color: #844d16; font-weight: bold; display: block; margin-bottom: 2px;">Delivery Destination:</span>
        <span style="font-size: 12px; font-weight: bold; color: #1e293b;">${freshOrder.shippingAddress.address}, ${freshOrder.shippingAddress.city}</span>
      </div>

      ${freshOrder.deliveryLocation && freshOrder.deliveryLocation.lat && freshOrder.deliveryLocation.lng ? `
        <p style="margin: 15px 0; font-size: 12px;">
          <strong>📍 Pinpoint Coordinate Tracking:</strong> <br/>
          <a href="https://www.google.com/maps/search/?api=1&query=${freshOrder.deliveryLocation.lat},${freshOrder.deliveryLocation.lng}" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: bold;">
            Track live dispatch spot on Google Maps
          </a>
        </p>
      ` : ''}

      <div style="padding: 14px; background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; margin-top: 20px;">
        <strong style="margin: 0; font-size: 12px; color: #ef4444; display: block;">⏱️ Simulated Transit Cancellation</strong>
        <p style="margin: 2px 0 10px 0; font-size: 11px; color: #991b1b; line-height: 1.4;">
          The order has reached transit dispatch. You may still cancel, but since shipping is active, the shipping fee refund is restricted.
        </p>
        <a href="${BACKEND_API_URL}/api/orders/${freshOrder._id}/customer-cancel?signature=${cancelSig}" style="display: inline-block; background-color: #ef4444; color: white; padding: 8px 14px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 12px;">Cancel Order (No Refund)</a>
      </div>
    </div>
  `;

  // Admin Dispatch Alert HTML
  const adminFormattedName = await getAdminFormattedUsername(freshOrder.user);
  const userRegDate = await getUserRegistrationDate(freshOrder.user);
  const adminHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; color: #334155; background-color: #f8fafc;">
      <div style="border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-bottom: 16px;">
        <h3 style="color: #d97706; margin: 0; text-transform: uppercase; font-size: 16px; letter-spacing: 0.5px;">🧠 Demo Order Dispatched – System Alert</h3>
        <p style="font-size: 11px; color: #64748b; margin: 4px 0 0 0;">Workflow Engine Status Update Alert</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; line-height: 1.8; margin-bottom: 16px;">
        <tr>
          <td style="font-weight: bold; width: 30%; color: #64748b;">User Name:</td>
          <td style="color: #1e293b;">${adminFormattedName}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #64748b;">User Email:</td>
          <td style="color: #1e293b;">${freshOrder.user?.email || 'N/A'}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #64748b;">User Registration Date:</td>
          <td style="color: #1e293b;">${userRegDate}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #64748b;">Order ID:</td>
          <td style="color: #1e293b; font-family: monospace;">#${freshOrder._id}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #64748b;">Dispatch Time:</td>
          <td style="color: #1e293b;">${new Date().toLocaleString()}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #64748b;">Current Status:</td>
          <td style="color: #d97706; font-weight: bold;">OUT FOR DELIVERY (SIMULATION)</td>
        </tr>
      </table>

      <h4 style="color: #1e293b; margin-top: 20px; margin-bottom: 8px; font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Demo Order Bill List</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px;">
        <thead>
          <tr style="border-bottom: 1px solid #e2e8f0; text-align: left; color: #64748b; font-size: 10px; text-transform: uppercase;">
            <th style="padding: 6px 0;">Item Details</th>
            <th style="padding: 6px 0; text-align: center;">Qty</th>
            <th style="padding: 6px 0; text-align: right;">Total Price</th>
          </tr>
        </thead>
        <tbody>
          ${orderItemsListHtml}
        </tbody>
      </table>

      <table style="width: 100%; border-collapse: collapse; font-size: 11px; color: #4b5563; border-top: 1px solid #e2e8f0; padding-top: 8px; line-height: 1.6;">
        <tr>
          <td style="padding: 4px 0; color: #64748b;">Subtotal:</td>
          <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #1e293b;">₹${freshOrder.itemsPrice.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;">Shipping Fee:</td>
          <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #1e293b;">₹${freshOrder.shippingPrice.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;">GST / Tax:</td>
          <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #1e293b;">₹${freshOrder.taxPrice.toFixed(2)}</td>
        </tr>
        <tr style="font-weight: bold; font-size: 12px; color: #1e293b;">
          <td style="padding: 6px 0; border-top: 1px solid #e2e8f0; text-transform: uppercase;">Total Bill Amount:</td>
          <td style="padding: 6px 0; text-align: right; border-top: 1px solid #e2e8f0; color: #10b981;">₹${freshOrder.totalPrice.toFixed(2)}</td>
        </tr>
      </table>
    </div>
  `;

  // Send Customer Dispatched Email
  try {
    await transporter.sendMail({
      from: `"DailyMart Logistics" <${emailUser}>`,
      to: freshOrder.user?.email,
      subject: `🚚 Demo Order Dispatched – DailyMart`,
      html: getEmailWrapperHtml('Demo Order Dispatched', contentHtml),
    });
  } catch (err) {
    console.error(`[Email Service] Customer dispatched email failed for Order #${freshOrder._id}:`, err.message);
  }

  // Send Admin Alert
  try {
    await transporter.sendMail({
      from: `"DailyMart System Alert" <${emailUser}>`,
      to: 'dailymartadmin@gmail.com',
      subject: `🧠 ${adminFormattedName} Demo Order Dispatched – System Alert`,
      html: adminHtml,
    });
  } catch (err) {
    console.error(`[Email Service] Admin dispatch alert failed for Order #${freshOrder._id}:`, err.message);
  }
};

/**
 * T+100 Seconds - Customer Completed Email + Admin Completion Alert + Fallback Scheduling
 */
export const sendDemoOrderCompletedEmails = async (order) => {
  const freshOrder = await Order.findById(order._id).populate('user', 'name email createdAt');
  if (!freshOrder || freshOrder.get('completionAlertSent')) return;

  freshOrder.set('completionAlertSent', true, { strict: false });
  freshOrder.set('completedAt', new Date(), { strict: false });
  await freshOrder.save();

  const devRevealSig = generateLinkSignature(freshOrder._id.toString(), 'email-action', { status: 'developer-reveal' });
  const emailUser = getSenderEmail();

  // Customer Completed Email HTML
  const contentHtml = `
    <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 16px;">
      <h2 style="color: #047857; margin: 0; text-transform: uppercase; font-size: 20px; letter-spacing: 0.5px;">✅ Demo Order Completed</h2>
      <p style="font-size: 13px; color: #4b5563; margin: 8px 0 0 0;">Hi ${freshOrder.user?.name || 'Customer'}, your mock order simulation lifecycle is complete!</p>
    </div>

    <div style="margin: 20px 0; background-color: #f0fdf4; border: 1px solid #a7f3d0; padding: 16px; border-radius: 12px; font-size: 13px; color: #065f46; line-height: 1.6;">
      <strong style="display: block; margin-bottom: 4px; font-size: 14px;">🎉 Full Lifecycle Completed Successfully</strong>
      <p style="margin: 0 0 12px 0;">This complete flow demonstrates event-driven MERN backend automation:</p>
      
      <table style="width: 100%; text-align: center; font-size: 11px; margin-top: 10px;">
        <tr>
          <td style="background-color: #dcfce7; padding: 6px; border-radius: 6px; font-weight: bold; width: 30%; color: #15803d;">Placed</td>
          <td style="color: #047857; font-weight: bold;">➔</td>
          <td style="background-color: #dcfce7; padding: 6px; border-radius: 6px; font-weight: bold; width: 30%; color: #15803d;">Dispatched</td>
          <td style="color: #047857; font-weight: bold;">➔</td>
          <td style="background-color: #059669; color: white; padding: 6px; border-radius: 6px; font-weight: bold; width: 30%;">Delivered</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 12px; color: #475569; text-align: center;">
      <strong style="color: #1e293b; display: block; margin-bottom: 4px;">Simulated Records Saved</strong>
      Please visit your <strong>Profile Page</strong> and the <strong>E-Bill Page</strong> to inspect final simulated invoice details.
    </div>

    <!-- Developer CTA Section -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 24px 0; text-align: center;">
      <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #1e293b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">👨💻 Developer Information</h4>
      <p style="margin: 0 0 16px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
        Curious about the engineer behind this system? Reveal technical stack details and developer contacts instantly.
      </p>
      <a href="${BACKEND_API_URL}/api/orders/${freshOrder._id}/email-action?status=developer-reveal&signature=${devRevealSig}" 
         style="display: inline-block; background-color: #6d28d9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 12px; border: 1px solid #5b21b6;">
        👨💻 View Developer Information
      </a>
    </div>
  `;

  // Admin Completion Alert HTML
  const adminFormattedName = await getAdminFormattedUsername(freshOrder.user);
  const userRegDate = await getUserRegistrationDate(freshOrder.user);
  const adminHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; color: #334155; background-color: #f8fafc;">
      <div style="border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 16px;">
        <h3 style="color: #059669; margin: 0; text-transform: uppercase; font-size: 16px; letter-spacing: 0.5px;">📊 Demo Order Lifecycle Completed</h3>
        <p style="font-size: 11px; color: #64748b; margin: 4px 0 0 0;">Workflow Engine Status Update Alert</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; line-height: 1.8;">
        <tr>
          <td style="font-weight: bold; width: 35%; color: #64748b;">User Name:</td>
          <td style="color: #1e293b;">${adminFormattedName}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #64748b;">User Email:</td>
          <td style="color: #1e293b;">${freshOrder.user?.email || 'N/A'}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #64748b;">User Registration Date:</td>
          <td style="color: #1e293b;">${userRegDate}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #64748b;">Order ID:</td>
          <td style="color: #1e293b; font-family: monospace;">#${freshOrder._id}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #64748b;">Timeline Summary:</td>
          <td style="color: #1e293b; font-weight: bold;">Placed ➔ Dispatched ➔ Delivered</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #64748b;">Completion Time:</td>
          <td style="color: #1e293b;">${new Date().toLocaleString()}</td>
        </tr>
      </table>
    </div>
  `;

  // Send Customer Completed Email
  try {
    await transporter.sendMail({
      from: `"DailyMart Demo" <${emailUser}>`,
      to: freshOrder.user?.email,
      subject: `✅ Demo Order Completed – DailyMart`,
      html: getEmailWrapperHtml('Demo Order Completed', contentHtml),
    });
  } catch (err) {
    console.error(`[Email Service] Customer completed email failed for Order #${freshOrder._id}:`, err.message);
  }

  // Send Admin Completion Alert
  try {
    await transporter.sendMail({
      from: `"DailyMart Admin Report" <${emailUser}>`,
      to: 'dailymartadmin@gmail.com',
      subject: `📊 ${adminFormattedName} Demo Order Lifecycle Completed`,
      html: adminHtml,
    });
  } catch (err) {
    console.error(`[Email Service] Admin completed alert failed for Order #${freshOrder._id}:`, err.message);
  }

  // Schedule the 90-second automatic fallback Developer Insight email
  console.log(`[Demo Workflow] Scheduling 90-second Developer Insight fallback for Order #${freshOrder._id}`);
  setTimeout(async () => {
    try {
      const fallbackOrder = await Order.findById(freshOrder._id).populate('user', 'name email createdAt');
      if (fallbackOrder && !fallbackOrder.isCancelled && !fallbackOrder.get('developerEmailSent')) {
        console.log(`[Demo Workflow] Fallback trigger: User did not click CTA within 90s. Dispatching Developer Insight for Order #${fallbackOrder._id}`);
        await sendDeveloperInsightEmail(fallbackOrder, true);
      }
    } catch (err) {
      console.error(`[Demo Workflow] Fallback timeout error for Order #${freshOrder._id}:`, err.message);
    }
  }, 90000);
};

/**
 * Developer Insight / Showcase Email
 */
export const sendDeveloperInsightEmail = async (order, autoTriggered = false) => {
  const orderId = order._id.toString();
  // Reload order to ensure we avoid race conditions on duplicate sends
  const freshOrder = await Order.findById(orderId).populate('user', 'name email createdAt');
  if (!freshOrder || freshOrder.get('developerEmailSent')) return;

  // Set developerEmailSent = true and record sending timestamp
  freshOrder.set('developerEmailSent', true, { strict: false });
  freshOrder.set('developerInsightSentAt', new Date(), { strict: false });
  
  if (autoTriggered) {
    freshOrder.set('developerEmailAutoTriggered', true, { strict: false });
  }
  await freshOrder.save();

  const emailUser = getSenderEmail();
  const likeSig = generateLinkSignature(orderId, 'email-action', { status: 'feedback', type: 'like' });
  const dislikeSig = generateLinkSignature(orderId, 'email-action', { status: 'feedback', type: 'dislike' });

  const githubSig = generateLinkSignature(orderId, 'email-action', { status: 'platform-click', platform: 'github' });
  const linkedinSig = generateLinkSignature(orderId, 'email-action', { status: 'platform-click', platform: 'linkedin' });

  const developerHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; color: #374151; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #7c3aed; margin: 0; text-transform: uppercase; font-size: 20px; letter-spacing: 1px;">👨💻 Developer Insight</h2>
        <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0 0;">DailyMart Demo System Insights & Developer Information</p>
      </div>

      <div style="font-size: 13px; line-height: 1.6; color: #374151;">
        <p>Hello,</p>
        <p>Thank you for exploring my project!</p>
        <p>This platform was developed as a portfolio and learning project demonstrating key technical layers:</p>
        
        <ul style="padding-left: 20px; font-size: 12px; color: #4b5563; line-height: 1.6;">
          <li style="margin-bottom: 4px;"><strong>MERN Stack Architecture:</strong> Custom MongoDB integrations and Express.js REST API patterns.</li>
          <li style="margin-bottom: 4px;"><strong>Secure Email Automation:</strong> Transporter setup utilizing Gmail REST API email transmission using OAuth2 over HTTPS.</li>
          <li style="margin-bottom: 4px;"><strong>MongoDB Data Management:</strong> Fine-grained transactions and inventory stock state preservation.</li>
          <li style="margin-bottom: 4px;"><strong>Workflow Scheduling:</strong> Precise simulation timeouts and self-healing startup routines.</li>
          <li style="margin-bottom: 4px;"><strong>Inventory Management:</strong> Concurrency safeguards preventing double-booking collision anomalies.</li>
          <li style="margin-bottom: 4px;"><strong>Geolocation Features:</strong> Dynamic map coordinate extraction and routing options.</li>
          <li style="margin-bottom: 4px;"><strong>Security Controls:</strong> Cryptographic URL signature validation to prevent parameter tampering.</li>
        </ul>

        <div style="background-color: #f3e8ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 16px; margin: 20px 0;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #6b21a8;">👤 Developer Details</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #581c87; width: 30%;">Name:</td>
              <td style="padding: 4px 0; color: #1e293b;">Divyan S</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #581c87;">GitHub:</td>
              <td style="padding: 4px 0;"><a href="${BACKEND_API_URL}/api/orders/${orderId}/email-action?status=platform-click&platform=github&signature=${githubSig}" target="_blank" style="color: #7c3aed; font-weight: bold; text-decoration: underline;">github.com/Divyan-SS</a></td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #581c87;">LinkedIn:</td>
              <td style="padding: 4px 0;"><a href="${BACKEND_API_URL}/api/orders/${orderId}/email-action?status=platform-click&platform=linkedin&signature=${linkedinSig}" target="_blank" style="color: #7c3aed; font-weight: bold; text-decoration: underline;">linkedin.com/in/divyan-s</a></td>
            </tr>
          </table>
        </div>

        <!-- Feedback Section -->
        <div style="text-align: center; margin: 25px 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <p style="font-size: 13px; font-weight: bold; color: #111827; margin-bottom: 12px;">Did you like this demonstration?</p>
          <a href="${BACKEND_API_URL}/api/orders/${orderId}/email-action?status=feedback&type=like&signature=${likeSig}" 
             style="background-color: #10b981; color: white; padding: 10px 18px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 12px; margin: 5px; display: inline-block; border: 1px solid #059669;">
            👍 Like
          </a>
          <a href="${FRONTEND_URL}/profile?feedback=dislike&orderId=${orderId}&signature=${dislikeSig}" 
             style="background-color: #f1f5f9; color: #475569; padding: 10px 18px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 12px; margin: 5px; display: inline-block; border: 1px solid #cbd5e1;">
            👎 Dislike
          </a>
        </div>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"DailyMart Developer Insight" <${emailUser}>`,
      to: freshOrder.user?.email,
      subject: `👨💻 Developer Insight – DailyMart Demo System`,
      html: developerHtml,
    });

    console.log(`[Developer Insight] Email sent to customer ${freshOrder.user?.email} for Order #${orderId}`);
    startEngagementTimer(orderId);

  } catch (err) {
    console.error(`[Email Service] Developer Insight email failed to send for Order #${orderId}:`, err.message);
  }
};

/**
 * Sends the Admin Engagement Report (CASE 1 to CASE 5)
 */
export const sendAdminEngagementReport = async (orderOrId, caseNum) => {
  try {
    const orderId = typeof orderOrId === 'object' ? orderOrId._id : orderOrId;
    const freshOrder = await Order.findById(orderId).populate('user', 'name email createdAt');
    if (!freshOrder) return;

    // Only block Case 1 and Case 4 if a report has already been sent
    if ((caseNum === 1 || caseNum === 4) && freshOrder.get('devInfoEngagementReportSent') === true) {
      return;
    }

    // Persist sent flag to database immediately to prevent duplicate sends of Case 1/4
    freshOrder.set('devInfoEngagementReportSent', true, { strict: false });
    await freshOrder.save();

    if (caseNum === 1 || caseNum === 4) {
      return; // Do not send email to admin for Case 1 or Case 4 (No Feedback)
    }

    const adminFormattedName = await getAdminFormattedUsername(freshOrder.user);

    const emailUser = getSenderEmail();
    const userName = freshOrder.user?.name || 'Customer';
    const userEmail = freshOrder.user?.email || 'N/A';
    const regDate = await getUserRegistrationDate(freshOrder.user);
    const orderIdStr = freshOrder._id.toString();
    const sentAt = freshOrder.get('developerInsightSentAt');
    const sentTimeStr = sentAt ? formatCustomDate(sentAt) : 'N/A';
    const selectedPlatform = freshOrder.get('selectedPlatform') || 'N/A';
    const dialogResponse = freshOrder.get('dialogResponse') || 'N/A';
    const dialogRespondedAt = freshOrder.get('dialogRespondedAt');
    const dialogResponseTimeStr = dialogRespondedAt ? formatCustomDate(dialogRespondedAt) : 'N/A';
    const feedbackType = freshOrder.get('feedbackType') || 'N/A';
    const feedbackSubmittedAt = freshOrder.get('feedbackSubmittedAt');
    const feedbackSubmittedTimeStr = feedbackSubmittedAt ? formatCustomDate(feedbackSubmittedAt) : 'N/A';
    const feedbackReason = freshOrder.get('feedbackReason') || 'N/A';

    let responseDuration = 'N/A';
    if (sentAt) {
      if (feedbackSubmittedAt) {
        responseDuration = getDurationString(sentAt, feedbackSubmittedAt);
      } else if (dialogRespondedAt) {
        responseDuration = getDurationString(sentAt, dialogRespondedAt);
      }
    }

    let subject = '';
    let caseDesc = '';
    switch (caseNum) {
      case 2:
        subject = `👨💻 ${adminFormattedName} - Developer Feedback Received`;
        caseDesc = 'CASE 2: User clicked OK. Profile opened. Feedback submitted within 5 minutes.';
        break;
      case 3:
        subject = `👨💻 ${adminFormattedName} - Developer Feedback Received`;
        caseDesc = 'CASE 3: User clicked OK. Profile opened. Feedback submitted after 5 minutes.';
        break;
      case 5:
        subject = `👨💻 ${adminFormattedName} - Developer Feedback Received After Dismissal`;
        caseDesc = 'CASE 5: User clicked Cancel. Feedback submitted after 5 minutes.';
        break;
      case 6:
        subject = `👨💻 ${adminFormattedName} - Developer Feedback Received After Dismissal`;
        caseDesc = 'CASE 6: User clicked Cancel. Feedback submitted within 5 minutes.';
        break;
      default:
        subject = `👨💻 ${adminFormattedName} - Developer Feedback Received`;
        caseDesc = `CASE ${caseNum}: Feedback Submitted.`;
    }

    const reportHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; color: #334155; background-color: #ffffff;">
        <div style="border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 16px; text-align: center;">
          <span style="background-color: #e0e7ff; color: #4338ca; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">ENGAGEMENT REPORT</span>
          <h3 style="color: #312e81; margin: 0; text-transform: uppercase; font-size: 16px; letter-spacing: 0.5px;">Developer Information Engagement Report</h3>
        </div>

        <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 12px 16px; border-radius: 6px; margin: 15px 0; font-size: 12px; color: #334155; line-height: 1.6;">
          <strong style="display: block; margin-bottom: 4px;">Engagement Case: CASE ${caseNum}</strong>
          <span>${caseDesc}</span>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; line-height: 1.8; margin-bottom: 15px;">
          <tr>
            <td style="font-weight: bold; width: 45%; color: #64748b;">User Name:</td>
            <td style="color: #1e293b;">${userName}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; width: 45%; color: #64748b;">User Email:</td>
            <td style="color: #1e293b;">${userEmail}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; width: 45%; color: #64748b;">Registration Date:</td>
            <td style="color: #1e293b;">${regDate}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; width: 45%; color: #64748b;">Order ID:</td>
            <td style="color: #1e293b; font-family: monospace;">#${orderIdStr}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; width: 45%; color: #64748b;">Developer Information Email Sent Time:</td>
            <td style="color: #1e293b;">${sentTimeStr}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; width: 45%; color: #64748b;">Selected Platform:</td>
            <td style="color: #1e293b; text-transform: uppercase; font-weight: bold;">${selectedPlatform}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; width: 45%; color: #64748b;">Dialog Response (OK / Cancel):</td>
            <td style="color: #1e293b; text-transform: uppercase;">${dialogResponse}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; width: 45%; color: #64748b;">Dialog Response Time:</td>
            <td style="color: #1e293b;">${dialogResponseTimeStr}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; width: 45%; color: #64748b;">Feedback Type:</td>
            <td style="color: #1e293b; text-transform: uppercase; font-weight: bold;">${feedbackType}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; width: 45%; color: #64748b;">Feedback Submitted Time:</td>
            <td style="color: #1e293b;">${feedbackSubmittedTimeStr}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; width: 45%; color: #64748b;">Response Duration:</td>
            <td style="color: #1e293b;">${responseDuration}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; width: 45%; color: #64748b;">Optional Feedback Reason:</td>
            <td style="color: #1e293b;">${feedbackReason}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; width: 45%; color: #64748b;">Engagement Case:</td>
            <td style="color: #1e293b; font-weight: bold;">CASE ${caseNum}</td>
          </tr>
        </table>
      </div>
    `;

    await transporter.sendMail({
      from: `"DailyMart System Report" <${emailUser}>`,
      to: 'dailymartadmin@gmail.com',
      subject: subject,
      html: reportHtml,
    });

    console.log(`[Admin Report] Engagement report sent for Order #${orderIdStr} - ${subject}`);
  } catch (err) {
    console.error(`[Email Service] Final Admin engagement report failed for Order #${orderId}:`, err.message);
  }
};

export const sendPendingEngagementReport = async (orderId) => {
  try {
    const freshOrder = await Order.findById(orderId);
    if (freshOrder && freshOrder.get('devInfoEngagementReportSent') !== true) {
      if (freshOrder.get('feedbackSubmitted') !== true) {
        const response = freshOrder.get('dialogResponse');
        if (response === 'ok') {
          await sendAdminEngagementReport(freshOrder._id, 1);
        } else if (response === 'cancel') {
          await sendAdminEngagementReport(freshOrder._id, 4);
        }
      }
    }
  } catch (err) {
    console.error(`[Email Service] Pending engagement report failed for Order #${orderId}:`, err.message);
  }
};

export const startEngagementTimer = (orderId) => {
  console.log(`[Developer Insight] Starting 5-minute observation timer for Order #${orderId}`);
  setTimeout(() => sendPendingEngagementReport(orderId), 300000);
};

/**
 * Sends the immediate Feedback Audit Email to the admin upon 👍 Like or 👎 Dislike submission
 */
export const sendFeedbackAuditEmail = async (orderId, type, reason = '') => {
  try {
    const order = await Order.findById(orderId).populate('user', 'name email createdAt');
    if (!order) return;

    const adminFormattedName = await getAdminFormattedUsername(order.user);

    const emailUser = getSenderEmail();
    const sentAt = order.get('developerInsightSentAt') || new Date();
    const feedbackSubAt = order.get('feedbackSubmittedAt') || new Date();

    const devSentDate = getCustomDateString(sentAt);
    const devSentTime = getCustomTimeString(sentAt);
    const feedbackSubDate = getCustomDateString(feedbackSubAt);
    const feedbackSubTime = getCustomTimeString(feedbackSubAt);
    const responseDuration = getDurationString(sentAt, feedbackSubAt);

    let feedbackDetailsHtml = `
      <li><strong>Feedback Type:</strong> ${type.toUpperCase()}</li>
      <li><strong>Feedback Submitted Date:</strong> ${feedbackSubDate}</li>
      <li><strong>Feedback Submitted Time:</strong> ${feedbackSubTime}</li>
    `;

    if (type === 'dislike') {
      const reasonText = reason.trim() ? reason : 'Not provided.';
      feedbackDetailsHtml += `<li><strong>Reason:</strong> ${reasonText}</li>`;
    }

        const userRegDate = await getUserRegistrationDate(order.user);
        const auditHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; color: #334155; background-color: #ffffff;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px;">
          <h3 style="color: #2563eb; margin: 0; text-transform: uppercase; font-size: 16px; letter-spacing: 0.5px;">📊 Feedback Audit – DailyMart</h3>
          <p style="font-size: 11px; color: #64748b; margin: 4px 0 0 0;">Demo System Admin Audit Log</p>
        </div>

        <h4 style="color: #1e293b; margin-top: 16px; margin-bottom: 4px; font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">User Details</h4>
        <ul style="padding-left: 20px; font-size: 12px; margin: 0 0 16px 0; line-height: 1.6; list-style-type: square;">
          <li><strong>User Name:</strong> ${adminFormattedName}</li>
          <li><strong>User Email:</strong> ${order.user?.email || 'N/A'}</li>
          <li><strong>User Registration Date:</strong> ${userRegDate}</li>
        </ul>

        <h4 style="color: #1e293b; margin-top: 16px; margin-bottom: 4px; font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">Developer Insight Details</h4>
        <ul style="padding-left: 20px; font-size: 12px; margin: 0 0 16px 0; line-height: 1.6; list-style-type: square;">
          <li><strong>Developer Insight Sent Date:</strong> ${devSentDate}</li>
          <li><strong>Developer Insight Sent Time:</strong> ${devSentTime}</li>
        </ul>

        <h4 style="color: #1e293b; margin-top: 16px; margin-bottom: 4px; font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">Feedback Details</h4>
        <ul style="padding-left: 20px; font-size: 12px; margin: 0 0 16px 0; line-height: 1.6; list-style-type: square;">
          ${feedbackDetailsHtml}
        </ul>

        <h4 style="color: #1e293b; margin-top: 16px; margin-bottom: 4px; font-size: 13px; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">Response Analysis</h4>
        <p style="font-size: 12px; line-height: 1.6; margin: 0;">
          <strong>Total response duration between developer email sent and feedback received:</strong><br/>
          ${responseDuration}
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"DailyMart Audit Alert" <${emailUser}>`,
      to: 'dailymartadmin@gmail.com',
      subject: `📊 ${adminFormattedName} Feedback Audit – DailyMart`,
      html: auditHtml,
    });
    console.log(`[Feedback Audit] Audit email sent for Order #${orderId}`);
  } catch (err) {
    console.error(`[Feedback Audit] Error sending feedback audit email:`, err.message);
  }
};

/**
 * Split Cancellation Email: triggers both Customer and Admin cancel emails
 * @param {Object} order - Order document
 */
export const sendOrderCancellationEmail = async (order) => {
  const freshOrder = await Order.findById(order._id).populate('user', 'name email');
  if (!freshOrder || freshOrder.get('cancellationAlertSent')) return;

  // Persist cancellation flag immediately to prevent duplicate sends
  freshOrder.set('cancellationAlertSent', true, { strict: false });
  await freshOrder.save();

  const emailUser = getSenderEmail();
  const recipientEmail = freshOrder.user?.email;
  const recipientName = freshOrder.user?.name;
  
  // Determine workflow stage for admin report
  const workflowStage = freshOrder.isOutForDelivery ? 'Dispatched' : 'Placed';

  // Customer Cancellation Email HTML
  const customerHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; color: #374151; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #ef4444; margin: 0; text-transform: uppercase; font-size: 20px; letter-spacing: 1px;">❌ Demo Order Cancelled</h2>
        <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0 0;">Hi ${recipientName || 'Customer'}, your mock order cancellation is complete.</p>
      </div>

      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; padding: 16px; border-radius: 12px; font-size: 13px; color: #991b1b; line-height: 1.6;">
        <p style="margin: 0; font-weight: bold;">Session Status: Cancelled Successfully</p>
        <p style="margin: 8px 0 0 0;">• No real payment was processed.</p>
        <p style="margin: 6px 0 0 0;">• No real delivery was scheduled.</p>
        <p style="margin: 6px 0 0 0;">• No charges were made.</p>
        <p style="margin: 6px 0 0 0;">• All simulated catalog stock holdings have been restored.</p>
      </div>

      <!-- Highlighted Retry Experience Notice -->
      <div style="background-color: #fffbeb; border: 1px solid #ddd6fe; border-left: 4px solid #7c3aed; padding: 16px; border-radius: 12px; margin: 20px 0; text-align: center;">
        <strong style="color: #6d28d9; display: block; font-size: 13px; text-transform: uppercase; margin-bottom: 4px;">ℹ️ Simulated Experience</strong>
        <span style="font-size: 12px; color: #5b21b6; font-weight: 500; line-height: 1.5; display: block;">
          This transaction exists solely for demonstration purposes and no real charges occurred. If you wish, you can place another order to retry and experience the full workflow simulation from the beginning!
        </span>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${FRONTEND_URL}" style="display: inline-block; background-color: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 12px; border: 1px solid #6d28d9;">Go Back to Store</a>
      </div>
    </div>
  `;

      const userRegDate = await getUserRegistrationDate(freshOrder.user);
      const adminHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; color: #334155; background-color: #fef2f2;">
      <div style="border-bottom: 2px solid #ef4444; padding-bottom: 12px; margin-bottom: 16px;">
        <h3 style="color: #b91c1c; margin: 0; text-transform: uppercase; font-size: 16px; letter-spacing: 0.5px;">❌ Order Cancelled By User</h3>
        <p style="font-size: 11px; color: #991b1b; margin: 4px 0 0 0;">System Cancellation Alert</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; line-height: 1.8;">
        <tr>
          <td style="font-weight: bold; width: 35%; color: #7f1d1d;">User Name:</td>
          <td style="color: #1e293b;">${adminFormattedName}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #7f1d1d;">User Email:</td>
          <td style="color: #1e293b;">${recipientEmail || 'N/A'}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #7f1d1d;">User Registration Date:</td>
          <td style="color: #1e293b;">${userRegDate}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #7f1d1d;">Order ID:</td>
          <td style="color: #1e293b; font-family: monospace;">#${freshOrder._id}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #7f1d1d;">Cancellation Time:</td>
          <td style="color: #1e293b;">${new Date().toLocaleString()}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #7f1d1d;">Workflow Stage:</td>
          <td style="color: #b91c1c; font-weight: bold; text-transform: uppercase;">${workflowStage}</td>
        </tr>
      </table>
    </div>
  `;

  // Send Customer cancellation email
  if (recipientEmail) {
    try {
      await transporter.sendMail({
        from: `"DailyMart Demo" <${emailUser}>`,
        to: recipientEmail,
        subject: `❌ Demo Order Cancelled – DailyMart`,
        html: customerHtml,
      });
    } catch (err) {
      console.error(`[Email Service] Customer cancellation email failed for Order #${freshOrder._id}:`, err.message);
    }
  }

  // Send Admin Cancellation Alert
  try {
    await transporter.sendMail({
      from: `"DailyMart System Alert" <${emailUser}>`,
      to: 'dailymartadmin@gmail.com',
      subject: `❌ ${adminFormattedName} Order Cancelled By User`,
      html: adminHtml,
    });
  } catch (err) {
    console.error(`[Email Service] Admin cancellation alert failed for Order #${freshOrder._id}:`, err.message);
  }
};

/**
 * Standard action click layout renderer (Confirm, Aborted, Blocked, Success or Error cards).
 */
export const renderActionPageHtml = ({
  pageTitle,
  icon,
  header,
  message,
  detailBoxHtml = '',
  buttonHtml = '',
  themeColor = '#3b82f6',
  scripts = '',
}) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>DailyMart - ${pageTitle}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; background-color: #f3f4f6; color: #1f2937; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .card { background-color: #ffffff; max-width: 480px; width: 100%; margin: 20px; padding: 32px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 16px; }
        h2 { font-size: 20px; font-weight: 700; color: ${themeColor}; margin-top: 0; margin-bottom: 8px; text-transform: uppercase; }
        p { font-size: 14px; line-height: 1.6; color: #4b5563; margin-bottom: 24px; }
        .details { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; text-align: left; line-height: 1.6; color: #374151; }
        .btn-container { display: flex; flex-direction: column; gap: 10px; }
        .btn { display: block; padding: 12px 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 8px; text-decoration: none; text-align: center; transition: all 0.2s ease; cursor: pointer; }
        .btn-confirm-delivered { background-color: #10b981; color: #ffffff; border: none; }
        .btn-confirm-delivered:hover { background-color: #059669; }
        .btn-confirm-cancelled { background-color: #ef4444; color: #ffffff; border: none; }
        .btn-confirm-cancelled:hover { background-color: #dc2626; }
        .btn-confirm { background-color: #7c3aed; color: #ffffff; border: none; }
        .btn-confirm:hover { background-color: #6d28d9; }
        .btn-cancel { background-color: #f3f4f6; color: #4b5563; border: 1px solid #d1d5db; }
        .btn-cancel:hover { background-color: #e5e7eb; }
        .btn-go-admin { display: inline-block; padding: 12px 24px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 8px; text-decoration: none; color: #2563eb; background-color: #eff6ff; border: 1px solid #dbeafe; transition: all 0.2s ease; }
        .btn-go-admin:hover { background-color: #dbeafe; }
        .btn-go-profile { display: inline-block; padding: 12px 24px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 8px; text-decoration: none; color: #2563eb; background-color: #eff6ff; border: 1px solid #dbeafe; transition: all 0.2s ease; }
        .btn-go-profile:hover { background-color: #dbeafe; }
        .details-alert { background-color: #fef2f2; border-color: #fee2e2; color: #991b1b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">${icon}</div>
        <h2>${header}</h2>
        <p>${message}</p>
        ${detailBoxHtml ? `<div class="details" id="detail-box">${detailBoxHtml}</div>` : ''}
        ${buttonHtml ? `<div class="btn-container">${buttonHtml}</div>` : ''}
      </div>
      ${scripts ? `<script>${scripts}</script>` : ''}
    </body>
    </html>
  `;
};

/**
 * Timed execution self-healing loader
 * Scans for paid active demo orders on server boot/re-init and loads them back into simulation timelines
 */
export const initializeWorkflowEngine = async () => {
  console.log('[Demo Workflow Engine] Initializing self-healing loader...');
  try {
    const activeOrders = await Order.find({ isPaid: true, isCancelled: { $ne: true } }).populate('user', 'name email createdAt');
    console.log(`[Demo Workflow Engine] Found ${activeOrders.length} active simulated orders in database.`);
    
    for (const order of activeOrders) {
      const elapsedMs = Date.now() - new Date(order.paidAt).getTime();
      
      const developerEmailSent = order.get('developerEmailSent') === true;
      const selectedPlatform = order.get('selectedPlatform');
      const devInfoEngagementReportSent = order.get('devInfoEngagementReportSent') === true;

      // Restore pending 5-minute engagement report timer if platform selected
      if (selectedPlatform && !devInfoEngagementReportSent) {
        const respondedAt = order.get('dialogRespondedAt') || order.get('platformSelectedAt');
        if (respondedAt) {
          const elapsed = Date.now() - new Date(respondedAt).getTime();
          if (elapsed < 300000) {
            const remaining = 300000 - elapsed;
            console.log(`[Demo Workflow Engine] Rescheduling pending engagement timer for Order #${order._id} in ${Math.ceil(remaining / 1000)}s`);
            setTimeout(() => sendPendingEngagementReport(order._id), remaining);
          } else {
            console.log(`[Demo Workflow Engine] Recovered engagement timer already expired. Sending report immediately for Order #${order._id}`);
            sendPendingEngagementReport(order._id);
          }
        }
      }

      if (order.isDelivered) {
        if (!developerEmailSent) {
          const completedTime = order.get('completedAt') || order.deliveredAt;
          if (completedTime) {
            const elapsedCompleted = Date.now() - new Date(completedTime).getTime();
            if (elapsedCompleted < 90000) {
              const remaining = 90000 - elapsedCompleted;
              console.log(`[Demo Workflow Engine] Rescheduling Developer Insight fallback for completed Order #${order._id} in ${Math.ceil(remaining / 1000)}s`);
              setTimeout(async () => {
                try {
                  const freshOrder = await Order.findById(order._id).populate('user', 'name email');
                  if (freshOrder && !freshOrder.isCancelled && !freshOrder.get('developerEmailSent')) {
                    await sendDeveloperInsightEmail(freshOrder, true);
                  }
                } catch (err) {
                  console.error(`[Demo Workflow Engine] Fallback timeout error for Order #${order._id}:`, err.message);
                }
              }, remaining);
            } else {
              console.log(`[Demo Workflow Engine] Developer Insight fallback expired for completed Order #${order._id}. Triggering now.`);
              sendDeveloperInsightEmail(order, true);
            }
          } else {
            console.log(`[Demo Workflow Engine] Developer Insight completed time not found for Order #${order._id}. Triggering now.`);
            sendDeveloperInsightEmail(order, true);
          }
        }
        continue;
      }
      
      console.log(`[Demo Workflow Engine] Resuming workflow for Order #${order._id} (Elapsed: ${Math.ceil(elapsedMs / 1000)}s)`);
      scheduleWorkflowForOrder(order, elapsedMs);
    }
  } catch (err) {
    console.error('[Demo Workflow Engine] Self-healing initialization error:', err.message);
  }
};

export const sendOrderOutForDeliveryEmails = sendDemoOrderDispatchedEmail;
export const sendOrderSuccessEmails = sendDemoOrderCompletedEmails;
