// frontend/src/pages/EBill.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';

const EBill = () => {
  const { id } = useParams();
  const { userInfo } = useContext(AuthContext);
  const { showConfirm } = useContext(ToastContext);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const downloadPDFHandler = async () => {
    setPdfLoading(true);
    try {
      // Load html2pdf from cdnjs dynamically if it isn't already loaded
      const html2pdfLib = await new Promise((resolve, reject) => {
        if (window.html2pdf) {
          resolve(window.html2pdf);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => resolve(window.html2pdf);
        script.onerror = () => reject(new Error('Failed to load PDF library. Falling back to native print.'));
        document.body.appendChild(script);
      });

      const element = document.getElementById('bill-receipt-card');
      const opt = {
        margin: [0.3, 0.3, 0.3, 0.3],
        filename: `dailymart_invoice_${order._id.slice(-8)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdfLib().from(element).set(opt).save();
    } catch (err) {
      console.error('PDF Generation Error:', err);
      // Fallback: Trigger native browser print which has Save as PDF
      window.print();
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    const fetchPaidOrder = async () => {
      try {
        setLoading(true);
        setError(null);

        const config = {
          headers: {
            Authorization: `Bearer ${userInfo.token}`,
          },
        };

        const { data } = await axios.get(`/api/orders/${id}`, config);
        setOrder(data);
        setLoading(false);

        setTimeout(() => setMounted(true), 80);
      } catch (err) {
        setError(
          err.response?.data?.message || err.message
        );
        setLoading(false);
      }
    };

    if (userInfo) fetchPaidOrder();
  }, [id, userInfo]);

  useEffect(() => {
    if (!order || !order.isPaid || order.isCancelled) return;

    const paidTime = new Date(order.paidAt).getTime();
    const calculateTime = () => {
      const elapsed = Date.now() - paidTime;
      const totalWindow = 10 * 1000;
      const left = Math.max(0, totalWindow - elapsed);
      setTimeRemaining(left);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [order]);

  useEffect(() => {
    if (order && order.isPaid && !order.isDelivered && !order.isCancelled && userInfo) {
      const interval = setInterval(async () => {
        try {
          const config = {
            headers: {
              Authorization: `Bearer ${userInfo.token}`,
            },
          };
          const { data } = await axios.get(`/api/orders/${id}`, config);
          setOrder(data);
        } catch (err) {
          console.error('Simulated order polling error:', err);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [order, id, userInfo]);

  const cancelOrderHandler = async () => {
    const paidTime = order.paidAt ? new Date(order.paidAt).getTime() : 0;
    const elapsed = Date.now() - paidTime;
    const isWithinWindow = order.isPaid && elapsed <= 10 * 1000;
    
    let confirmMsg = '';
    if (isWithinWindow) {
      confirmMsg = `Are you sure you want to cancel this order? You are within the 10-second grace period, so you will receive a FULL refund of ₹${order.totalPrice.toFixed(0)}.`;
    } else {
      confirmMsg = `Are you sure you want to cancel this order? The 10-second window has elapsed, so you will receive a refund of ₹${(order.itemsPrice + order.taxPrice).toFixed(2)} (the delivery fee of ₹${order.shippingPrice.toFixed(2)} will be retained by the store).`;
    }

    const isConfirmed = await showConfirm(confirmMsg);
    if (!isConfirmed) return;
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      await axios.put(`/api/orders/${order._id}/cancel`, {}, config);
      alert("Order cancelled successfully!");
      
      const { data } = await axios.get(`/api/orders/${id}`, config);
      setOrder(data);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  if (loading)
    return (
      <p className="text-center py-12 text-sm text-gray-400 animate-pulse font-medium">
        🧾 Generating secure receipt...
      </p>
    );

  if (error)
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-medium max-w-2xl mx-auto mt-6 animate-pulse">
        ⚠️ {error}
      </div>
    );

  if (order && order.isCancelled) {
    return (
      <div
        className="max-w-xl mx-auto bg-white border border-gray-300 rounded-2xl shadow-md p-4 md:p-8 my-4 md:my-12 text-center space-y-6 font-sans text-gray-700 transition-all duration-500 opacity-100 translate-y-0"
      >
        <div>
          <span className="text-4xl inline-block animate-bounce">❌</span>
          <h1 className="text-xl font-bold text-red-650 uppercase tracking-tight mt-3">
            Order Cancelled
          </h1>
          <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wider font-mono">
            Order ID: #{order._id}
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-left text-xs leading-relaxed space-y-2.5 font-medium text-red-950">
          <p className="font-bold text-red-900 uppercase tracking-wide">Order Status: Cancelled</p>
          <p>This order has been cancelled. Catalog inventory stock has been restored.</p>
          <p><strong>Refund Status:</strong> {order.refundStatus === 'Full Refund' ? 'Full Refund Provided' : 'Refund Provided (Except Shipping)'}</p>
          <p><strong>Refund Amount:</strong> ₹{(order.refundAmount || 0).toFixed(2)}</p>
          {order.refundStatus === 'Refunded (Except Shipping)' && (
            <p className="text-[10px] text-red-750 italic">* The shipping/delivery fee of ₹{order.shippingPrice.toFixed(2)} was retained by the store.</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Link
            to={`/cancellation-receipt/${order._id}`}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer text-center block animate-pulse"
          >
            📄 View Cancellation Receipt
          </Link>
          <Link
            to="/"
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-lg text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer text-center block"
          >
            🏠 Back to Home
          </Link>
          <Link
            to="/profile"
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-lg text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer text-center block"
          >
            👤 Go to Profile
          </Link>
        </div>
      </div>
    );
  }

  if (order && order.isPaid && !order.isCancelled && timeRemaining > 0) {
    const mins = Math.floor(timeRemaining / 60000);
    const secs = Math.floor((timeRemaining % 60000) / 1000);
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    return (
      <div
        className={`max-w-xl mx-auto bg-white border border-gray-300 rounded-2xl shadow-md p-4 md:p-8 my-4 md:my-12 text-center space-y-6 font-sans text-gray-700 transition-all duration-500 opacity-100 translate-y-0`}
      >
        <div>
          <span className="text-4xl animate-bounce inline-block">⏱️</span>
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight mt-3">
            Order Cancellation Window Active
          </h1>
          <p className="text-xs text-red-500 font-bold mt-1 uppercase tracking-wider">
            Time Remaining: {timeStr}
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-left text-xs leading-relaxed space-y-2.5 font-medium text-amber-900">
          <p className="font-bold text-amber-955">⚠️ Important Notice:</p>
          <p>Your order has been paid successfully, but is currently in the <strong>10-second modification window</strong>. You have {timeStr} left to cancel it.</p>
          <p>If you cancel the order, a refund will be provided (excluding the ₹{order.shippingPrice.toFixed(2)} delivery fee).</p>
          <p>If no action is taken, the order will be automatically confirmed. <strong>No refunds are provided after confirmation</strong> unless the mistake is from our side.</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={cancelOrderHandler}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            ❌ Cancel Order (Refund Provided)
          </button>
          <Link
            to="/"
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-lg text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer text-center block"
          >
            🏠 Back to Home
          </Link>
        </div>

        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider italic">
          * Your downloadable E-Bill receipt will become accessible once this window expires.
        </p>
      </div>
    );
  }

  if (order && order.isPaid && !order.isCancelled && !order.isDelivered) {
    return (
      <div
        className="max-w-xl mx-auto bg-white border border-gray-300 rounded-2xl shadow-md p-4 md:p-8 my-4 md:my-12 text-center space-y-6 font-sans text-gray-700 transition-all duration-500 opacity-100 translate-y-0"
      >
        <div>
          <span className="text-4xl inline-block animate-pulse">📦</span>
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight mt-3">
            Order Confirmed & Preparing
          </h1>
          <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wider font-mono">
            Order ID: #{order._id}
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-250 rounded-xl p-5 text-left text-xs leading-relaxed space-y-2.5 font-medium text-emerald-955">
          <p className="font-bold text-emerald-900 uppercase tracking-wide">Fulfillment Status: Processing</p>
          <p>Your order has been successfully confirmed and is currently being packed at our store.</p>
          <p className="text-red-650 font-bold">⚠️ Notice: No refunds are provided unless the mistake is from our side.</p>
          <p>Your downloadable E-Bill receipt will become accessible here once the order is delivered.</p>
        </div>

        {/* Simple Unverified Demo Bill */}
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 text-left text-xs text-gray-600 space-y-3 font-normal">
          <div className="border-b border-gray-250 pb-2 flex justify-between items-center">
            <span className="font-bold text-gray-800 uppercase tracking-wide">📋 Pre-Delivery Items Summary (Unverified)</span>
            <span className="bg-amber-100 text-amber-800 text-[9px] px-2 py-0.5 rounded font-bold uppercase">Demo Receipt</span>
          </div>
          <div className="divide-y divide-gray-200">
            {order.orderItems.map((item) => (
              <div key={`${item.product}-${item.variantName}`} className="py-2 flex justify-between">
                <div>
                  <span className="font-semibold text-gray-800">{item.name}</span>
                  <span className="text-[10px] text-gray-400 block">Size: {item.variantName}</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-500">x{item.qty}</span>
                  <span className="block font-semibold text-gray-850">₹{(item.price * item.qty).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-850">
            <span>Estimated Total:</span>
            <span>₹{order.totalPrice.toFixed(0)}</span>
          </div>
          <p className="text-[9px] text-amber-600 font-medium italic text-center pt-1.5">
            * This summary is for reference only. The official downloadable PDF and invoice options will unlock upon delivery.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            to="/"
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-lg text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer text-center block"
          >
            🏠 Keep Shopping
          </Link>
          <Link
            to="/profile"
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-lg text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer text-center block"
          >
            👤 Go to Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      id="bill-receipt-card"
      className={`max-w-2xl mx-auto bg-white border border-gray-300 shadow-xs rounded-2xl overflow-hidden my-4 md:my-8 p-4 md:p-8 space-y-6 relative font-sans text-gray-700 transition-all duration-500 ${
        mounted
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-3'
      } hover:shadow-md`}
    >
      <style>{`
        @media print {
          /* Hide navigation panels and interactive buttons during PDF compilation or printing */
          nav, header, footer, [data-html2pdf-ignore] {
            display: none !important;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #bill-receipt-card {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 20px !important;
            max-width: 100% !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      {/* Top Accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600"></div>

      {/* Header */}
      <div className="text-center space-y-1">
        <span className="bg-amber-100 text-amber-800 border border-amber-300 font-extrabold text-[10px] tracking-wider px-2 py-0.5 rounded uppercase inline-block mb-1">
          DEMO MODE - NOT A REAL INVOICE
        </span>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight uppercase">
          🧾 DailyMart Order Receipt (Simulated)
        </h1>
        <p className="text-gray-500 text-xs font-semibold">
          This transaction was simulated under demo mode. No real payments or shipments were made. 💚
        </p>
        <p className="text-gray-400 text-xs font-mono">
          Date: {new Date(order.createdAt).toLocaleString()}
        </p>
      </div>

      {/* Order Info */}
      <div className="border-y border-dashed border-gray-200 py-4 space-y-2 text-xs font-normal">
        <div>
          <span className="text-gray-900 font-medium">
            Order ID:
          </span>{' '}
          <span className="font-mono text-gray-600">
            {order._id}
          </span>
        </div>

        <div>
          <span className="text-gray-900 font-medium">
            Customer:
          </span>{' '}
          <span className="text-gray-600">
            {order.user.name} ({order.user.email})
          </span>
        </div>

        <div>
          <span className="text-gray-900 font-medium">
            Address:
          </span>{' '}
          <span className="text-gray-600">
            {order.shippingAddress.address},{' '}
            {order.shippingAddress.city},{' '}
            {order.shippingAddress.postalCode}
          </span>
        </div>

        {order.deliveryLocation && (
          <>
            <div>
              <span className="text-gray-900 font-medium">
                Delivery Coordinates:
              </span>{' '}
              <span className="font-mono text-gray-600">
                {order.deliveryLocation.lat.toFixed(6)}, {order.deliveryLocation.lng.toFixed(6)}
              </span>
            </div>
            <div>
              <span className="text-gray-900 font-medium">
                Delivery Distance:
              </span>{' '}
              <span className="text-gray-600">
                {Number(order.deliveryLocation.distance).toFixed(2)} km
              </span>
            </div>
          </>
        )}

        <div>
          <span className="text-gray-900 font-medium">
            Payment:
          </span>{' '}
          <span className="text-gray-600">
            {order.paymentMethod}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-900 font-medium">
            Status:
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[9px] font-medium tracking-wide ${
              order.isPaid
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                : 'bg-red-50 border border-red-200 text-red-500'
            }`}
          >
            {order.isPaid ? 'PAID' : 'PENDING'}
          </span>
        </div>

        {order.isPaid && (
          <div>
            <span className="text-gray-900 font-medium">
              Transaction ID:
            </span>{' '}
            <span className="font-mono text-gray-600">
              {order.paymentResult?.id}
            </span>
          </div>
        )}
      </div>

      {/* Items Table */}
      <div>
        <h3 className="text-gray-900 text-xs font-medium mb-3 uppercase tracking-wider">
          📦 Items Ordered
        </h3>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-200 text-[11px] text-gray-400 uppercase tracking-wider">
                <th className="pb-2">Item</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Price</th>
                <th className="pb-2 text-center">GST Rate</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {order.orderItems.map((item) => (
                <tr
                  key={`${item.product}-${item.variantName}`}
                  className="hover:bg-gray-50/50 transition"
                >
                  <td className="py-3">
                    {/* FIXED: Added Brand Ledger display for consistency in checkout/receipt layouts */}
                    {item.brand && (
                      <span className="block font-semibold text-[10px] text-emerald-600 uppercase tracking-wider mb-0.5">
                        {item.brand}
                      </span>
                    )}
                    <span className="text-gray-900 font-medium block">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      Size: {item.variantName}
                    </span>
                  </td>

                  <td className="py-3 text-center text-gray-500">
                    {item.qty}
                  </td>

                  <td className="py-3 text-right text-gray-500">
                    ₹{item.price.toFixed(2)}
                  </td>

                  <td className="py-3 text-center text-gray-500 font-bold">
                    {item.gst || 0}%
                  </td>

                  <td className="py-3 text-right text-gray-900 font-medium">
                    ₹{(item.price * item.qty).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="border-t border-dashed border-gray-200 pt-4 max-w-xs ml-auto space-y-2 text-xs">
        <div className="flex justify-between">
          <span>Items:</span>
          <span className="text-gray-700 font-medium">
            ₹{order.itemsPrice.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Delivery:</span>
          <span className="text-gray-700 font-medium">
            ₹{order.shippingPrice.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between">
          <span>GST (Calculated):</span>
          <span className="text-gray-700 font-medium">
            ₹{order.taxPrice.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between border-t border-gray-200 pt-2">
          <span className="text-emerald-600 font-medium uppercase tracking-wider">
            Total
          </span>
          <span className="text-green-600 font-semibold text-base">
            ₹{order.totalPrice.toFixed(0)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pt-4 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-2">
          *** DEMO INVOICE - NOT A REAL TRANSACTION ***
        </p>
        <p className="text-[9px] text-gray-400 font-semibold mb-4 leading-relaxed">
          DailyMart E-Commerce timed workflow simulation system showcase.
        </p>

        <div className="flex justify-center gap-4" data-html2pdf-ignore="true">
          <Link
            to="/"
            className="inline-block bg-gray-900 hover:bg-gray-800 text-white font-medium text-xs uppercase tracking-widest px-5 py-2.5 rounded-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            🏠 Back to Home
          </Link>
          <button
            onClick={downloadPDFHandler}
            disabled={pdfLoading}
            className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs uppercase tracking-widest px-5 py-2.5 rounded-lg transition-all hover:scale-105 active:scale-95 disabled:bg-gray-300 cursor-pointer"
          >
            {pdfLoading ? '⏳ Generating...' : '📥 Download PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EBill;