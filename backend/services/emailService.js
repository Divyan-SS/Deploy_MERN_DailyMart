import Order from '../models/Order.js';
import { transporter, getSenderEmail } from '../config/mail.js';
import { generateLinkSignature } from './cryptoService.js';

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:5001';

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
 * Sends order confirmation email to customer and schedules admin order receipt alert.
 * @param {Object} order - Order document
 * @param {Object} user - Authenticated user details
 */
export const sendOrderPlacementEmails = async (order, user) => {
  const cancelSig = generateLinkSignature(order._id.toString(), 'customer-cancel');
  const emailUser = getSenderEmail();
  const orderItemsListHtml = getOrderItemsHtml(order.orderItems);

  // 1. Customer Confirmation Email HTML
  const customerHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; color: #374151; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 15px;">
        <h2 style="color: #10b981; margin: 0; text-transform: uppercase; letter-spacing: 1px;">DailyMart Order Confirmed</h2>
        <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0;">Hi ${user.name || 'Valued Customer'}, your order has been received and is being processed.</p>
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
            <td style="padding: 8px 0; text-align: right; font-size: 15px; font-weight: bold; color: #10b981;">₹${order.totalPrice.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div style="margin: 20px 0; font-size: 12px; line-height: 1.5; background-color: #f9fafb; padding: 15px; border-radius: 12px; border: 1px solid #f3f4f6;">
        <h3 style="font-size: 13px; text-transform: uppercase; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin: 0 0 8px; font-weight: bold;">Shipping Destination</h3>
        <p style="margin: 0; font-weight: bold; color: #374151;">${order.shippingAddress.address}, ${order.shippingAddress.city}</p>
        <p style="margin: 2px 0 0; color: #6b7280;">Postal Code: ${order.shippingAddress.postalCode}</p>
        ${order.deliveryLocation && order.deliveryLocation.lat && order.deliveryLocation.lng ? `<p style="margin: 8px 0 0; font-size: 12px;"><strong>📍 Pinpoint Location:</strong> <a href="https://www.google.com/maps/search/?api=1&query=${order.deliveryLocation.lat},${order.deliveryLocation.lng}" target="_blank" style="color: #10b981; text-decoration: underline; font-weight: bold;">View on Google Maps</a></p>` : ''}
        <p style="margin: 8px 0 0; color: #374151;"><span style="font-weight: bold; color: #6b7280;">Payment Method:</span> ${order.paymentMethod}</p>
        
        <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="margin: 0 0 10px; font-size: 11px; color: #4b5563; line-height: 1.5;">
            Need to change your mind? You can cancel your order directly using the link below. Cancellation refund terms apply dynamically based on elapsed time and delivery status.
          </p>
          <a href="${BACKEND_API_URL}/api/orders/${order._id}/customer-cancel?signature=${cancelSig}" style="display: inline-block; background-color: #ef4444; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 12px;">Cancel Order</a>
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 11px; text-align: center; color: #9ca3af; margin: 0;">This is an automated order confirmation from DailyMart Store.</p>
    </div>
  `;

  // Send confirmation to customer
  try {
    await transporter.sendMail({
      from: `"DailyMart Store" <${emailUser}>`,
      to: user.email,
      subject: `DailyMart - Order Confirmation #${order._id.toString().slice(-8)}`,
      html: customerHtml,
    });
  } catch (err) {
    console.error('Customer email failed to send:', err.message);
  }

  // Send alert to Admin after 1-minute delay
  setTimeout(async () => {
    try {
      const freshOrder = await Order.findById(order._id).populate('user', 'name email');
      if (freshOrder && !freshOrder.isCancelled) {
        const outForDeliverySig = generateLinkSignature(freshOrder._id.toString(), 'email-out-for-delivery');
        const adminHtmlWithBtn = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; color: #374151; background-color: #ffffff;">
            <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px;">
              <h2 style="color: #3b82f6; margin: 0; text-transform: uppercase; letter-spacing: 1px;">New Order Received</h2>
              <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0;">An order has been placed by <strong>${freshOrder.user?.name || 'Customer'}</strong> (${freshOrder.user?.email}).</p>
            </div>
            
            <div style="margin: 20px 0;">
              <h3 style="font-size: 13px; text-transform: uppercase; color: #111827; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px; margin-bottom: 10px; font-weight: bold;">Order Details</h3>
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
                  <td style="padding: 4px 0; color: #6b7280;">Subtotal:</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #374151;">₹${freshOrder.itemsPrice.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280;">Tax:</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #374151;">₹${freshOrder.taxPrice.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #6b7280;">Shipping:</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #374151;">₹${freshOrder.shippingPrice.toFixed(2)}</td>
                </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; font-size: 15px; font-weight: bold; color: #111827;">Grand Total:</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 15px; font-weight: bold; color: #3b82f6;">₹${freshOrder.totalPrice.toFixed(2)}</td>
                </tr>
              </table>
            </div>

            <div style="margin: 20px 0; font-size: 12px; line-height: 1.5; background-color: #f9fafb; padding: 15px; border-radius: 12px; border: 1px solid #f3f4f6;">
              <h3 style="font-size: 13px; text-transform: uppercase; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin: 0 0 8px; font-weight: bold;">Shipping Destination</h3>
              <p style="margin: 0; font-weight: bold; color: #374151;">${freshOrder.shippingAddress.address}, ${freshOrder.shippingAddress.city}</p>
              <p style="margin: 2px 0 0; color: #6b7280;">Postal Code: ${freshOrder.shippingAddress.postalCode}</p>
              ${freshOrder.deliveryLocation && freshOrder.deliveryLocation.lat && freshOrder.deliveryLocation.lng ? `<p style="margin: 8px 0 0; font-size: 12px;"><strong>📍 Pinpoint Location:</strong> <a href="https://www.google.com/maps/search/?api=1&query=${freshOrder.deliveryLocation.lat},${freshOrder.deliveryLocation.lng}" target="_blank" style="color: #3b82f6; text-decoration: underline; font-weight: bold;">View on Google Maps</a></p>` : ''}
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />

            <div style="text-align: center; margin: 25px 0;">
              <p style="font-size: 14px; font-weight: bold; color: #111827; margin-bottom: 15px;">Fulfillment Dispatch Options:</p>
              <a href="${BACKEND_API_URL}/api/orders/${freshOrder._id}/email-out-for-delivery?signature=${outForDeliverySig}" style="background-color: #7c3aed; color: white; padding: 10px 18px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; margin: 5px; display: inline-block;">🚚 OUT FOR DELIVERY</a>
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: `"DailyMart Order Alert" <${emailUser}>`,
          to: 'dailymartadmin@gmail.com',
          replyTo: freshOrder.user?.email,
          subject: `${freshOrder.user?.name || 'Customer'} - New Order Received - DailyMart #${freshOrder._id.toString().slice(-8)}`,
          html: adminHtmlWithBtn,
        });
      }
    } catch (err) {
      console.error('Delayed admin alert email failed to send:', err.message);
    }
  }, 60000);
};

/**
 * Sends order out-for-delivery emails to customer and admin action alert logs.
 * @param {Object} order - Order document
 */
export const sendOrderOutForDeliveryEmails = async (order) => {
  const cancelSig = generateLinkSignature(order._id.toString(), 'customer-cancel');
  const deliveredSig = generateLinkSignature(order._id.toString(), 'email-action', { status: 'delivered' });
  const cancelledNoRefundSig = generateLinkSignature(order._id.toString(), 'email-action', { status: 'cancelled', refund: 'no' });
  
  const emailUser = getSenderEmail();
  const orderItemsListHtml = getOrderItemsHtml(order.orderItems);

  // A. Customer Dispatch Email
  const customerHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; color: #374151; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px;">
        <h2 style="color: #3b82f6; margin: 0; text-transform: uppercase; letter-spacing: 1px;">🚚 Order Out For Delivery</h2>
        <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0;">Great news! Your DailyMart order is on its way to your shipping address.</p>
      </div>
      <div style="margin: 20px 0; font-size: 13px; line-height: 1.6;">
        <p>Hello <strong>${order.user?.name || 'Customer'}</strong>,</p>
        <p>Your order <strong>#${order._id.toString().slice(-8)}</strong> has been picked up by our delivery partner and is out for delivery today!</p>
        <p>Please make sure someone is available at your shipping address to receive the fresh groceries:</p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 12px; border-left: 4px solid #3b82f6; font-style: italic; border: 1px solid #f3f4f6;">
          ${order.shippingAddress.address}, ${order.shippingAddress.city}
        </div>
        ${order.deliveryLocation && order.deliveryLocation.lat && order.deliveryLocation.lng ? `
          <p style="margin: 12px 0 0; font-size: 12px;">
            <strong>📍 View Delivery Location:</strong> 
            <a href="https://www.google.com/maps/search/?api=1&query=${order.deliveryLocation.lat},${order.deliveryLocation.lng}" target="_blank" style="color: #3b82f6; text-decoration: underline; font-weight: bold;">
              Click here to view on Google Maps
            </a>
          </p>
        ` : ''}

        <div style="margin-top: 20px; padding: 15px; background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px;">
          <p style="margin: 0; font-weight: bold; color: #ef4444;">⏱️ Cancel Order in Transit Option</p>
          <p style="margin: 4px 0 10px; font-size: 11px; color: #7f1d1d;">
            If you wish to cancel this order now, please note that <strong>NO REFUND will be provided</strong> (₹0.00 refund) because the order is already in transit.
          </p>
          <a href="${BACKEND_API_URL}/api/orders/${order._id}/customer-cancel?signature=${cancelSig}" style="display: inline-block; background-color: #ef4444; color: white; padding: 8px 14px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 12px;">Cancel Order (No Refund)</a>
        </div>

        <p style="margin-top: 15px;">Thank you for shopping at DailyMart!</p>
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 11px; text-align: center; color: #9ca3af; margin: 0;">DailyMart Customer Operations</p>
    </div>
  `;

  // B. Admin Dispatch Alert HTML
  const adminDispatchHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 16px; color: #374151; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px;">
        <h2 style="color: #3b82f6; margin: 0; text-transform: uppercase; letter-spacing: 1px;">🚚 Order Dispatched & Out for Delivery</h2>
        <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0;">Order placed by <strong>${order.user?.name}</strong> (${order.user?.email}) is now in transit.</p>
      </div>
      
      <div style="margin: 20px 0;">
        <h3 style="font-size: 13px; text-transform: uppercase; color: #111827; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px; margin-bottom: 10px; font-weight: bold;">Order Details</h3>
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
            <td style="padding: 8px 0; text-align: right; font-size: 15px; font-weight: bold; color: #3b82f6;">₹${order.totalPrice.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div style="margin: 20px 0; font-size: 12px; line-height: 1.5; background-color: #f9fafb; padding: 15px; border-radius: 12px; border: 1px solid #f3f4f6;">
        <h3 style="font-size: 13px; text-transform: uppercase; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin: 0 0 8px; font-weight: bold;">Shipping Destination</h3>
        <p style="margin: 0; font-weight: bold; color: #374151;">${order.shippingAddress.address}, ${order.shippingAddress.city}</p>
        <p style="margin: 2px 0 0; color: #6b7280;">Postal Code: ${order.shippingAddress.postalCode}</p>
        ${order.deliveryLocation && order.deliveryLocation.lat && order.deliveryLocation.lng ? `<p style="margin: 8px 0 0; font-size: 12px;"><strong>📍 Pinpoint Location:</strong> <a href="https://www.google.com/maps/search/?api=1&query=${order.deliveryLocation.lat},${order.deliveryLocation.lng}" target="_blank" style="color: #3b82f6; text-decoration: underline; font-weight: bold;">View on Google Maps</a></p>` : ''}
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />

      <div style="text-align: center; margin: 25px 0;">
        <p style="font-size: 14px; font-weight: bold; color: #111827; margin-bottom: 15px;">Order Action Options:</p>
        <a href="${BACKEND_API_URL}/api/orders/${order._id}/email-action?status=delivered&signature=${deliveredSig}" style="background-color: #10b981; color: white; padding: 10px 18px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; margin: 5px; display: inline-block;">YES - DELIVERED</a>
        <a href="${BACKEND_API_URL}/api/orders/${order._id}/email-action?status=cancelled&refund=no&signature=${cancelledNoRefundSig}" style="background-color: #374151; color: white; padding: 10px 18px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; margin: 5px; display: inline-block;">❌ CANCEL (No Refund)</a>
      </div>
    </div>
  `;

  // Send customer out-for-delivery notification
  try {
    await transporter.sendMail({
      from: `"DailyMart Logistics" <${emailUser}>`,
      to: order.user?.email,
      subject: `DailyMart - Order Out For Delivery #${order._id.toString().slice(-8)}`,
      html: customerHtml,
    });
  } catch (err) {
    console.error('Customer out-for-delivery email failed to send:', err.message);
  }

  // Send admin alert notification
  try {
    await transporter.sendMail({
      from: `"DailyMart Logistics Alert" <${emailUser}>`,
      to: 'dailymartadmin@gmail.com',
      replyTo: order.user?.email,
      subject: `${order.user?.name || 'Customer'} - Order Dispatched - DailyMart #${order._id.toString().slice(-8)}`,
      html: adminDispatchHtml,
    });
  } catch (err) {
    console.error('Admin dispatch email failed to send:', err.message);
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
