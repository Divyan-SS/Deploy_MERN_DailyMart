// frontend/src/pages/CancellationReceipt.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

const CancellationReceipt = () => {
  const { id } = useParams();
  const { userInfo } = useContext(AuthContext);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

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

      const element = document.getElementById('cancel-receipt-card');
      const opt = {
        margin: [0.3, 0.3, 0.3, 0.3],
        filename: `dailymart_cancellation_${order._id.slice(-8)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          scrollY: 0,
          scrollX: 0,
          onclone: (clonedDoc) => {
            const clonedEl = clonedDoc.getElementById('cancel-receipt-card');
            if (clonedEl) {
              clonedEl.style.margin = '0';
              clonedEl.style.transform = 'none';
              clonedEl.style.boxShadow = 'none';
              clonedEl.style.opacity = '1';
            }
            const ignoreList = clonedDoc.querySelectorAll('[data-html2pdf-ignore="true"]');
            ignoreList.forEach(el => {
              el.style.display = 'none';
            });
          }
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      await html2pdfLib().from(element).set(opt).save();
    } catch (err) {
      console.error('PDF Generation Error:', err);
      window.print();
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    const fetchOrderDetails = async () => {
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
        setError(err.response?.data?.message || err.message);
        setLoading(false);
      }
    };

    if (userInfo) fetchOrderDetails();
  }, [id, userInfo]);

  if (loading)
    return (
      <p className="text-center py-12 text-sm text-gray-400 animate-pulse font-medium">
        🧾 Generating cancellation receipt...
      </p>
    );

  if (error)
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-medium max-w-2xl mx-auto mt-6 animate-pulse">
        ⚠️ {error}
      </div>
    );

  if (!order || !order.isCancelled) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-gray-300 rounded-2xl p-6 text-center my-12 space-y-4">
        <span className="text-3xl">⚠️</span>
        <h2 className="text-lg font-bold text-gray-900">Order Not Cancelled</h2>
        <p className="text-xs text-gray-500">This order is not cancelled and does not have a cancellation receipt.</p>
        <Link to="/profile" className="inline-block bg-gray-900 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase">
          Go to Profile
        </Link>
      </div>
    );
  }

  const workflowStage = order.isDelivered ? 'Completed' : order.isOutForDelivery ? 'Dispatched' : 'Placed';

  return (
    <div
      id="cancel-receipt-card"
      className={`max-w-2xl mx-auto bg-white border border-red-200 shadow-xs rounded-2xl overflow-hidden my-4 md:my-8 p-4 md:p-8 space-y-6 relative font-sans text-gray-700 transition-all duration-500 ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      } hover:shadow-md`}
    >
      <style>{`
        @media print {
          nav, header, footer, [data-html2pdf-ignore] {
            display: none !important;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #cancel-receipt-card {
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

      {/* Top red accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-rose-500 to-red-650"></div>

      {/* Header */}
      <div className="text-center space-y-1">
        <span className="bg-red-100 text-red-800 border border-red-300 font-extrabold text-[10px] tracking-wider px-2 py-0.5 rounded uppercase inline-block mb-1">
          [DEMO MODE - NOT A REAL TRANSACTION]
        </span>
        <h1 className="text-xl font-bold text-red-650 tracking-tight uppercase">
          ❌ Order Cancelled By User
        </h1>
        <p className="text-gray-500 text-xs font-semibold">
          System Cancellation Alert
        </p>
        <p className="text-gray-400 text-xs font-mono">
          Cancelled Date: {new Date(order.cancelledAt || order.updatedAt).toLocaleString()}
        </p>
      </div>

      {/* Information Section */}
      <div className="border-y border-dashed border-red-200 py-4 space-y-2 text-xs font-normal bg-red-50/20 px-3 rounded-lg">
        <div>
          <span className="text-gray-900 font-bold uppercase tracking-wider text-[10px] block mb-1">Information Section</span>
        </div>
        <div>
          <span className="text-gray-500 font-medium">User Name:</span>{' '}
          <span className="text-gray-900 font-semibold">{order.user?.name || 'Customer'}</span>
        </div>
        <div>
          <span className="text-gray-500 font-medium">User Email:</span>{' '}
          <span className="text-gray-900 font-semibold">{order.user?.email || 'N/A'}</span>
        </div>
        <div>
          <span className="text-gray-500 font-medium">Order ID:</span>{' '}
          <span className="font-mono text-gray-900 font-semibold">#{order._id}</span>
        </div>
        <div>
          <span className="text-gray-500 font-medium">Cancellation Time:</span>{' '}
          <span className="text-gray-900 font-semibold">{new Date(order.cancelledAt || order.updatedAt).toLocaleString()}</span>
        </div>
        <div>
          <span className="text-gray-500 font-medium">Workflow Stage:</span>{' '}
          <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold uppercase text-[9px] inline-block tracking-wide">
            {workflowStage}
          </span>
        </div>
      </div>

      {/* Refund details summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs space-y-2">
        <strong className="text-gray-800 font-bold uppercase tracking-wide text-[10px] block border-b pb-1">Simulated Refund Ledger</strong>
        <div className="flex justify-between">
          <span className="text-gray-500">Refund Status:</span>
          <span className="font-bold text-gray-800">{order.refundStatus || 'Refunded'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Refund Amount:</span>
          <span className="font-extrabold text-red-650 text-sm">₹{(order.refundAmount || 0).toFixed(2)}</span>
        </div>
        {order.refundStatus === 'Refunded (Except Shipping)' && (
          <p className="text-[10px] text-gray-400 italic pt-1 border-t">* The delivery/shipping fee of ₹{order.shippingPrice.toFixed(2)} was retained by the store.</p>
        )}
      </div>

      {/* Items Summary list */}
      <div>
        <h3 className="text-gray-900 text-xs font-bold mb-2 uppercase tracking-wider">
          📦 Cancelled Items List
        </h3>
        <div className="divide-y divide-gray-100">
          {order.orderItems.map((item) => (
            <div key={`${item.product}-${item.variantName}`} className="py-2.5 flex justify-between text-xs">
              <div>
                <span className="font-semibold text-gray-850 block">{item.name}</span>
                <span className="text-[10px] text-gray-400">Size/Variant: {item.variantName}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-500 block">x{item.qty}</span>
                <span className="font-bold text-gray-700">₹{(item.price * item.qty).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Demo Notice */}
      <div className="bg-red-50 border border-red-200 text-red-950 p-4 rounded-xl text-xs space-y-2 leading-relaxed font-medium">
        <strong className="text-red-900 block font-bold text-center uppercase tracking-wider">[DEMO MODE - NOT A REAL TRANSACTION]</strong>
        <p>This cancellation occurred within the DailyMart demonstration workflow.</p>
        <p>No real payment was processed.</p>
        <p>No physical shipment was initiated.</p>
        <p>This cancellation record was generated solely for portfolio, workflow, and system demonstration purposes.</p>
      </div>

      {/* Footer & download triggers */}
      <div className="text-center pt-4 border-t border-gray-100">
        <p className="text-[10px] text-gray-450 uppercase font-black tracking-widest mb-4">
          *** DEMO CANCELLATION RECEIPT ***
        </p>

        <div className="flex justify-center gap-4" data-html2pdf-ignore="true">
          <Link
            to="/profile"
            className="inline-block bg-gray-900 hover:bg-gray-800 text-white font-medium text-xs uppercase tracking-widest px-5 py-2.5 rounded-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            👤 Go to Profile
          </Link>
          <button
            onClick={downloadPDFHandler}
            disabled={pdfLoading}
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-medium text-xs uppercase tracking-widest px-5 py-2.5 rounded-lg transition-all hover:scale-105 active:scale-95 disabled:bg-gray-300 cursor-pointer"
          >
            {pdfLoading ? '⏳ Generating...' : '📥 Download PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancellationReceipt;
