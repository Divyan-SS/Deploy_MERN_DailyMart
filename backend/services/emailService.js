import Order from '../models/Order.js';
import User from '../models/User.js';
import { transporter, getSenderEmail } from '../config/mail.js';
import { generateLinkSignature } from './cryptoService.js';

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:5001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

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

/**
 * Main Orchestration Layer: Timed Demo Order Flow System
 * Executes strict timeout state transitions: T+10s Placed, T+30s Dispatched, T+45s Completed
 * @param {String} orderId - ID of the order document
 */
export const runDemoWorkflowEngine = async (orderId) => {
  console.log(`[Demo Workflow Engine] Initializing for Order #${orderId}`);
  
  // ----------------------------------------------------
  // T + 10 SECONDS: Send Customer Placed Email
  // ----------------------------------------------------
  setTimeout(async () => {
    try {
      const order = await Order.findById(orderId).populate('user', 'name email');
      if (!order || order.isCancelled) {
        console.log(`[Demo Workflow Engine] T+10s check: Order #${orderId} is cancelled or deleted. Aborting workflow.`);
        return;
      }
      console.log(`[Demo Workflow Engine] T+10s event: Sending confirmation email for Order #${orderId}`);
      await sendDemoOrderPlacedEmail(order);
    } catch (err) {
      console.error(`[Demo Workflow Engine] T+10s error:`, err.message);
    }
  }, 10000);

  // ----------------------------------------------------
  // T + 30 SECONDS: Dispatch Order (DB Update + Customer Email)
  // ----------------------------------------------------
  setTimeout(async () => {
    try {
      const order = await Order.findById(orderId).populate('user', 'name email');
      if (!order || order.isCancelled) {
        console.log(`[Demo Workflow Engine] T+30s check: Order #${orderId} is cancelled. Aborting workflow.`);
        return;
      }
      
      console.log(`[Demo Workflow Engine] T+30s event: Transitioning Order #${orderId} to Out for Delivery.`);
      order.isOutForDelivery = true;
      order.outForDeliveryAt = Date.now();
      await order.save();

      await sendDemoOrderDispatchedEmail(order);
    } catch (err) {
      console.error(`[Demo Workflow Engine] T+30s error:`, err.message);
    }
  }, 30000);

  // ----------------------------------------------------
  // T + 45 SECONDS: Complete Order (DB Update + Customer + Admin + Developer emails)
  // ----------------------------------------------------
  setTimeout(async () => {
    try {
      const order = await Order.findById(orderId).populate('user', 'name email');
      if (!order || order.isCancelled) {
        console.log(`[Demo Workflow Engine] T+45s check: Order #${orderId} is cancelled. Aborting workflow.`);
        return;
      }

      console.log(`[Demo Workflow Engine] T+45s event: Transitioning Order #${orderId} to Delivered.`);
      order.isDelivered = true;
      order.deliveredAt = Date.now();
      await order.save();

      await sendDemoOrderCompletedEmails(order);
    } catch (err) {
      console.error(`[Demo Workflow Engine] T+45s error:`, err.message);
    }
  }, 45000);
};

/**
 * T+10s Customer Placed Email
 */
export const sendDemoOrderPlacedEmail = async (order) => {
  const cancelSig = generateLinkSignature(order._id.toString(), 'customer-cancel');
  const emailUser = getSenderEmail();
  const orderItemsListHtml = getOrderItemsHtml(order.orderItems);

  const customerHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; color: #374151; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px;">
        <span style="background-color: #fef3c7; border: 1px solid #fcd34d; color: #d97706; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px;">THIS IS A DEMO ORDER</span>
        <h2 style="color: #3b82f6; margin: 0; text-transform: uppercase; letter-spacing: 1px;">📦 Demo Order Placed</h2>
        <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0;">Hi ${order.user?.name || 'Valued Customer'}, your order has entered the system workflow simulation.</p>
        <p style="font-size: 12px; color: #3b82f6; font-weight: bold; margin: 8px 0 0;">E-Bill (Demo Invoice) is available in your profile page.</p>
      </div>

      <div style="margin: 20px 0;">
        <h3 style="font-size: 13px; text-transform: uppercase; color: #111827; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px; margin-bottom: 10px; font-weight: bold;">Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="border-bottom: 1px solid #e5e7eb; text-align: left; color: #9ca3af; font-size: 11px; text-transform: uppercase;">
              <th style="padding: 8px 0;">Item Details</th>
              <th style="padding: 8px 0; text-align: center;">Qty</th>
              <th style="padding: 8px 0; text-align: right;">Total Price</th>
            </tr>
          </thead>
          <tbody>
            ${orderItemsListHtml}
          </tbody>
        </table>
      </div>
      
      <div style="margin: 20px 0; background-color: #f9fafb; padding: 15px; border-radius: 12px; font-size: 13px; border: 1px solid #f3f4f6;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Items Subtotal:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #374151;">₹${order.itemsPrice.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Tax Price:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #374151;">₹${order.taxPrice.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6b7280;">Shipping Fee:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #374151;">₹${order.shippingPrice.toFixed(2)}</td>
          </tr>
          <tr style="border-top: 1px solid #e5e7eb;">
            <td style="padding: 8px 0; font-size: 15px; font-weight: bold; color: #111827;">Total Paid:</td>
            <td style="padding: 8px 0; text-align: right; font-size: 15px; font-weight: bold; color: #3b82f6;">₹${order.totalPrice.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div style="margin: 20px 0; font-size: 12px; line-height: 1.5; background-color: #f9fafb; padding: 15px; border-radius: 12px; border: 1px solid #f3f4f6;">
        <h3 style="font-size: 13px; text-transform: uppercase; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin: 0 0 8px; font-weight: bold;">Shipping Destination</h3>
        <p style="margin: 0; font-weight: bold; color: #374151;">${order.shippingAddress.address}, ${order.shippingAddress.city}</p>
        <p style="margin: 2px 0 0; color: #6b7280;">Postal Code: ${order.shippingAddress.postalCode}</p>
        ${order.deliveryLocation && order.deliveryLocation.lat && order.deliveryLocation.lng ? `<p style="margin: 8px 0 0; font-size: 12px;"><strong>📍 Pinpoint Location:</strong> <a href="https://www.google.com/maps/search/?api=1&query=${order.deliveryLocation.lat},${order.deliveryLocation.lng}" target="_blank" style="color: #3b82f6; text-decoration: underline; font-weight: bold;">View on Google Maps</a></p>` : ''}
        
        <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="margin: 0 0 10px; font-size: 11px; color: #4b5563; line-height: 1.5;">
            Need to change your mind? You can cancel your order directly using the link below. Cancellation refund terms apply dynamically.
          </p>
          <a href="${BACKEND_API_URL}/api/orders/${order._id}/customer-cancel?signature=${cancelSig}" style="display: inline-block; background-color: #ef4444; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 12px;">Cancel Order</a>
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 11px; text-align: center; color: #9ca3af; margin: 0;">This is an automated order simulation alert from DailyMart.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"DailyMart Demo" <${emailUser}>`,
      to: order.user?.email,
      subject: `📦 Demo Order Placed – DailyMart`,
      html: customerHtml,
    });
  } catch (err) {
    console.error('[Email Audit] Demo Order Placed email failed:', err.message);
  }
};

/**
 * T+30s Customer Dispatched Email
 */
export const sendDemoOrderDispatchedEmail = async (order) => {
  const cancelSig = generateLinkSignature(order._id.toString(), 'customer-cancel');
  const emailUser = getSenderEmail();

  const customerHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; color: #374151; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 15px;">
        <span style="background-color: #fef3c7; border: 1px solid #fcd34d; color: #d97706; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px;">THIS IS A DEMO ORDER</span>
        <h2 style="color: #7c3aed; margin: 0; text-transform: uppercase; letter-spacing: 1px;">🚚 Demo Order Dispatched</h2>
        <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0;">Status: OUT FOR DELIVERY (DEMO)</p>
        <p style="font-size: 13px; color: #7c3aed; font-weight: bold; margin: 8px 0 0;">Please check your profile page for live status updates.</p>
      </div>

      <div style="margin: 20px 0; font-size: 13px; line-height: 1.6; color: #374151;">
        <p>Hello <strong>${order.user?.name || 'Customer'}</strong>,</p>
        <p>Your simulated order <strong>#${order._id.toString().slice(-8)}</strong> is out for delivery today!</p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 12px; border-left: 4px solid #7c3aed; font-style: italic; border: 1px solid #f3f4f6; margin-bottom: 15px;">
          ${order.shippingAddress.address}, ${order.shippingAddress.city}
        </div>
        ${order.deliveryLocation && order.deliveryLocation.lat && order.deliveryLocation.lng ? `
          <p style="margin: 0 0 15px 0; font-size: 12px;">
            <strong>📍 View Delivery Spot:</strong> 
            <a href="https://www.google.com/maps/search/?api=1&query=${order.deliveryLocation.lat},${order.deliveryLocation.lng}" target="_blank" style="color: #7c3aed; text-decoration: underline; font-weight: bold;">
              Click here to view on Google Maps
            </a>
          </p>
        ` : ''}

        <div style="padding: 15px; background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px;">
          <p style="margin: 0; font-weight: bold; color: #ef4444;">⏱️ Simulated Transit Cancellation Option</p>
          <p style="margin: 4px 0 10px; font-size: 11px; color: #7f1d1d;">
            This is a simulated dispatch workflow for demonstration purposes. If you choose to cancel, no real transaction occurs.
          </p>
          <a href="${BACKEND_API_URL}/api/orders/${order._id}/customer-cancel?signature=${cancelSig}" style="display: inline-block; background-color: #ef4444; color: white; padding: 8px 14px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 12px;">Cancel Order (No Refund)</a>
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 11px; text-align: center; color: #9ca3af; margin: 0;">DailyMart Customer Operations</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"DailyMart Logistics" <${emailUser}>`,
      to: order.user?.email,
      subject: `🚚 Demo Order Dispatched – DailyMart`,
      html: customerHtml,
    });
  } catch (err) {
    console.error('[Email Audit] Demo Order Dispatched email failed:', err.message);
  }
};

/**
 * T+45s Customer + Admin + Developer emails
 */
export const sendDemoOrderCompletedEmails = async (order) => {
  const emailUser = getSenderEmail();
  const orderItemsListHtml = getOrderItemsHtml(order.orderItems);

  // A. Customer Completion Email
  const customerHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; color: #374151; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 15px;">
        <span style="background-color: #fef3c7; border: 1px solid #fcd34d; color: #d97706; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px;">THIS IS A DEMO ORDER</span>
        <h2 style="color: #10b981; margin: 0; text-transform: uppercase; letter-spacing: 1px;">✅ Demo Order Completed</h2>
        <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0;">Hello ${order.user?.name || 'Valued Customer'}, your mock order simulation lifecycle is complete!</p>
      </div>

      <div style="margin: 20px 0; background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 12px; font-size: 13px; color: #166534; line-height: 1.6;">
        <p style="margin: 0; font-weight: bold;">🎉 Workflow execution completed successfully</p>
        <p style="margin: 8px 0 0;">This demonstrates event-driven backend architecture using Node.js + MongoDB.</p>
        
        <div style="margin: 15px 0; border-top: 1px solid #dcfce7; padding-top: 10px;">
          <strong style="display: block; margin-bottom: 8px; font-size: 11px; text-transform: uppercase; color: #14532d; letter-spacing: 0.5px;">Order Lifecycle Stages:</strong>
          <table style="width: 100%; text-align: center; font-size: 11px;">
            <tr>
              <td style="background-color: #dcfce7; padding: 6px; border-radius: 6px; font-weight: bold; width: 30%; color: #15803d;">Placed</td>
              <td style="color: #166534; font-weight: bold;">➔</td>
              <td style="background-color: #dcfce7; padding: 6px; border-radius: 6px; font-weight: bold; width: 30%; color: #15803d;">Dispatched</td>
              <td style="color: #166534; font-weight: bold;">➔</td>
              <td style="background-color: #15803d; color: white; padding: 6px; border-radius: 6px; font-weight: bold; width: 30%;">Delivered</td>
            </tr>
          </table>
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 11px; text-align: center; color: #9ca3af; margin: 0;">DailyMart E-Commerce System Simulation</p>
    </div>
  `;

  // B. Admin Report Email
  const adminHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; color: #374151; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #475569; padding-bottom: 15px;">
        <span style="background-color: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px;">DEMO SYSTEM EVENT</span>
        <h2 style="color: #475569; margin: 0; text-transform: uppercase; letter-spacing: 1px;">📊 Demo Order Lifecycle Completed</h2>
        <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0;">System report for Order #${order._id.toString().slice(-8)}</p>
      </div>

      <div style="margin: 20px 0;">
        <h3 style="font-size: 13px; text-transform: uppercase; color: #111827; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px; margin-bottom: 10px; font-weight: bold;">Lifecycle History</h3>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-size: 12px; font-weight: bold; color: #334155; text-align: center;">
          Placed ➔ Dispatched ➔ Delivered
        </div>
      </div>

      <div style="margin: 20px 0;">
        <h3 style="font-size: 13px; text-transform: uppercase; color: #111827; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px; margin-bottom: 10px; font-weight: bold;">Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="border-bottom: 1px solid #e5e7eb; text-align: left; color: #9ca3af; font-size: 11px; text-transform: uppercase;">
              <th style="padding: 8px 0;">Item Details</th>
              <th style="padding: 8px 0; text-align: center;">Qty</th>
              <th style="padding: 8px 0; text-align: right;">Total Price</th>
            </tr>
          </thead>
          <tbody>
            ${orderItemsListHtml}
          </tbody>
        </table>
        
        <div style="margin: 15px 0; background-color: #f9fafb; padding: 15px; border-radius: 12px; font-size: 13px; border: 1px solid #f3f4f6;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #6b7280;">Subtotal:</td>
              <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #374151;">₹${order.itemsPrice.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;">Tax:</td>
              <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #374151;">₹${order.taxPrice.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6b7280;">Shipping:</td>
              <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #374151;">₹${order.shippingPrice.toFixed(2)}</td>
            </tr>
            <tr style="border-top: 1px solid #e5e7eb;">
              <td style="padding: 8px 0; font-size: 15px; font-weight: bold; color: #111827;">Grand Total:</td>
              <td style="padding: 8px 0; text-align: right; font-size: 15px; font-weight: bold; color: #475569;">₹${order.totalPrice.toFixed(2)}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  `;

  // Send customer email
  try {
    await transporter.sendMail({
      from: `"DailyMart Demo" <${emailUser}>`,
      to: order.user?.email,
      subject: `✅ Demo Order Completed – DailyMart`,
      html: customerHtml,
    });
  } catch (err) {
    console.error('[Email Audit] Demo Order Completed customer email failed:', err.message);
  }

  // Send admin email
  try {
    await transporter.sendMail({
      from: `"DailyMart System Report" <${emailUser}>`,
      to: 'dailymartadmin@gmail.com',
      replyTo: order.user?.email,
      subject: `📊 Demo Order Lifecycle Completed – System Report`,
      html: adminHtml,
    });
  } catch (err) {
    console.error('[Email Audit] Demo Order Completed admin report email failed:', err.message);
  }

  // Trigger Developer Insight Email
  if (order.user?.email) {
    await sendDeveloperInsightEmail(order.user.email, order.user.name);
  }
};

/**
 * Developer Reveal / Insight Email
 */
export const sendDeveloperInsightEmail = async (recipientEmail, recipientName) => {
  const emailUser = getSenderEmail();
  
  const gitUrl = 'https://github.com/Divyan-SS/Deploy_MERN_DailyMart';
  const dislikeUrl = `${FRONTEND_URL}/profile?feedback=dislike`;

  const developerHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; color: #374151; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 15px;">
        <h2 style="color: #7c3aed; margin: 0; text-transform: uppercase; letter-spacing: 1px;">👨💻 Developer Insight</h2>
        <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0;">DailyMart Demo System Insights & Portfolio Showcase</p>
      </div>

      <div style="margin: 20px 0; font-size: 13px; line-height: 1.6; color: #374151;">
        <p>Hello ${recipientName || 'Visitor'},</p>
        <p>Thank you for testing the e-commerce simulation system! Here is a brief look at the engineering insights behind the system:</p>
        
        <div style="background-color: #f3e8ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 15px; margin-bottom: 15px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #6b21a8;">👤 Developer Profile</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #581c87; width: 30%;">Developer:</td>
              <td style="padding: 4px 0; color: #3b0764;">Divyan S</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #581c87;">GitHub:</td>
              <td style="padding: 4px 0;"><a href="https://github.com/Divyan-SS/" target="_blank" style="color: #7c3aed; font-weight: bold; text-decoration: underline;">github.com/Divyan-SS</a></td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold; color: #581c87;">LinkedIn:</td>
              <td style="padding: 4px 0;"><a href="https://www.linkedin.com/in/divyan-s" target="_blank" style="color: #7c3aed; font-weight: bold; text-decoration: underline;">linkedin.com/in/divyan-s</a></td>
            </tr>
          </table>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 15px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #334155;">🧠 Project Summary</h3>
          <p style="margin: 0; font-size: 12px; color: #475569; font-style: italic;">
            "This project demonstrates a full-stack event-driven e-commerce simulation system with timed workflows and email-based state transitions."
          </p>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #334155;">💻 Tech Stack Highlight</h3>
          <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #475569; line-height: 1.5;">
            <li style="margin-bottom: 4px;"><strong>MERN Stack:</strong> MongoDB Atlas, Express.js APIs, React frontend, and Node.js backend.</li>
            <li style="margin-bottom: 4px;"><strong>Email automation system:</strong> Custom transporter using Gmail REST API OAuth2 over HTTPS.</li>
            <li style="margin-bottom: 4px;"><strong>HMAC secured actions:</strong> Timing-safe verification of cryptographically signed action links.</li>
            <li><strong>Timer-based workflow engine:</strong> Countdown workflows and active session state tracking.</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 25px 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <p style="font-size: 13px; font-weight: bold; color: #111827; margin-bottom: 12px;">Did you like this demonstration?</p>
          <a href="${gitUrl}" target="_blank" style="background-color: #10b981; color: white; padding: 10px 18px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 12px; margin: 5px; display: inline-block; border: 1px solid #059669;">👍 LIKE THIS PROJECT</a>
          <a href="${dislikeUrl}" target="_blank" style="background-color: #f1f5f9; color: #475569; padding: 10px 18px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 12px; margin: 5px; display: inline-block; border: 1px solid #cbd5e1;">👎 DISLIKE</a>
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 11px; text-align: center; color: #9ca3af; margin: 0;">DailyMart Developer Showcase Portfolio</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"DailyMart System Insight" <${emailUser}>`,
      to: recipientEmail,
      subject: `👨💻 Developer Insight – DailyMart Demo System`,
      html: developerHtml,
    });
  } catch (err) {
    console.error('[Email Audit] Developer Insight email failed to send:', err.message);
  }
};

/**
 * Split Cancellation Email: triggers both Customer and Admin cancel emails
 * @param {Object} order - Order document
 */
export const sendOrderCancellationEmail = async (order) => {
  const emailUser = getSenderEmail();
  let recipientEmail = '';
  let recipientName = '';

  if (order.user && order.user.email) {
    recipientEmail = order.user.email;
    recipientName = order.user.name;
  } else {
    try {
      const dbUser = await User.findById(order.user);
      if (dbUser) {
        recipientEmail = dbUser.email;
        recipientName = dbUser.name;
      }
    } catch (err) {
      console.error('[Email Audit] Failed to lookup user for cancellation:', err.message);
    }
  }

  // A. Customer Cancel Email
  const customerHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; color: #374151; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 15px;">
        <span style="background-color: #fee2e2; border: 1px solid #fecaca; color: #dc2626; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px;">DEMO CANCEL EVENT</span>
        <h2 style="color: #ef4444; margin: 0; text-transform: uppercase; letter-spacing: 1px;">❌ Demo Order Cancelled</h2>
        <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0;">Hello ${recipientName || 'Valued Customer'}, the simulation session has been stopped.</p>
      </div>
      
      <div style="margin: 20px 0; background-color: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 12px; font-size: 13px; color: #991b1b; line-height: 1.6;">
        <p style="margin: 0; font-weight: bold;">Session Status: Cancelled</p>
        <p style="margin: 8px 0 0;">No real transaction or payment was processed. All simulated database stocks have been automatically restored to the inventory ledger.</p>
        <p style="margin: 8px 0 0;">You may restart the demo anytime.</p>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 11px; text-align: center; color: #9ca3af; margin: 0;">DailyMart Developer Simulation Portal</p>
    </div>
  `;

  // B. Admin Cancel Email
  const adminHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; color: #374151; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 15px;">
        <span style="background-color: #fee2e2; border: 1px solid #fecaca; color: #dc2626; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px;">DEMO CANCEL EVENT</span>
        <h2 style="color: #dc2626; margin: 0; text-transform: uppercase; letter-spacing: 1px;">❌ Order Cancelled by User (Demo)</h2>
        <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0;">User ${recipientName || 'Visitor'} has cancelled the demo order.</p>
      </div>
      
      <div style="margin: 20px 0; background-color: #f9fafb; padding: 15px; border-radius: 12px; font-size: 13px; border: 1px solid #f3f4f6; color: #334155; line-height: 1.6;">
        <p><strong>Order ID:</strong> #${order._id}</p>
        <p><strong>Customer Profile:</strong> ${recipientName || 'Customer'} (${recipientEmail || 'No Email'})</p>
        <p><strong>Amount:</strong> ₹${order.totalPrice.toFixed(0)}</p>
      </div>
    </div>
  `;

  // Send Customer Email
  if (recipientEmail) {
    try {
      await transporter.sendMail({
        from: `"DailyMart System" <${emailUser}>`,
        to: recipientEmail,
        subject: `❌ Demo Order Cancelled – DailyMart`,
        html: customerHtml,
      });
    } catch (err) {
      console.error('[Email Audit] Customer cancellation email failed:', err.message);
    }
  }

  // Send Admin Email
  try {
    await transporter.sendMail({
      from: `"DailyMart System Alert" <${emailUser}>`,
      to: 'dailymartadmin@gmail.com',
      replyTo: recipientEmail || undefined,
      subject: `❌ Order Cancelled by User (Demo)`,
      html: adminHtml,
    });
  } catch (err) {
    console.error('[Email Audit] Admin cancellation email failed:', err.message);
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

export const sendOrderOutForDeliveryEmails = sendDemoOrderDispatchedEmail;
export const sendOrderSuccessEmails = sendDemoOrderCompletedEmails;
