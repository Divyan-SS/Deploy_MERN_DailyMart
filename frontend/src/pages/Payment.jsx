// frontend/src/pages/Payment.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

const Payment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useContext(AuthContext);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [countdown, setCountdown] = useState(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 80);
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      executeSimulatedPayment();
      return;
    }
    const interval = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(interval);
  }, [countdown]);

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
      } catch (err) {
        setError(err.response && err.response.data.message ? err.response.data.message : err.message);
        setLoading(false);
      }
    };

    if (userInfo) {
      fetchOrderDetails();
    }
  }, [id, userInfo]);

  const executeSimulatedPayment = async () => {
    try {
      setProcessing(true);

      const config = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      const mockPaymentResult = {
        id: `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        status: 'COMPLETED',
        update_time: new Date().toISOString(),
        email_address: userInfo.email,
      };

      await axios.put(`/api/orders/${id}/pay`, mockPaymentResult, config);

      setProcessing(false);
      navigate(`/ebill/${id}`);
    } catch (err) {
      setProcessing(false);
      setError(err.response && err.response.data.message ? err.response.data.message : err.message);
    }
  };

  if (loading)
    return (
      <p className="text-center py-12 text-sm text-gray-400 animate-pulse font-medium">
        ⏳ Loading order details...
      </p>
    );

  if (error)
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-medium max-w-xl mx-auto mt-6">
        ⚠️ {error}
      </div>
    );

  return (
    <div
      className={`max-w-xl mx-auto bg-white border border-gray-300 rounded-2xl shadow-xs p-4 md:p-8 my-4 md:my-12 text-center space-y-6 font-sans text-gray-700 transition-all duration-500 ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      } hover:shadow-md`}
    >
      {/* Header */}
      <div>
        <span className="text-3xl">💳</span>
        <h1 className="text-xl font-semibold text-gray-900 uppercase tracking-tight mt-2">
          Payment
        </h1>
        <p className="text-xs text-gray-500 mt-1 font-medium">
          Order ID: <span className="font-mono text-gray-700">{order._id}</span>
        </p>
      </div>

      {/* Order Summary */}
      <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 text-left space-y-3 text-xs font-medium">
        <div className="flex justify-between">
          <span className="text-gray-500">Name:</span>
          <span className="text-gray-800 font-medium">{order.user.name}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-500">Delivery Address:</span>
          <span className="text-gray-800 truncate max-w-[250px] font-medium">
            {order.shippingAddress.address}, {order.shippingAddress.city}
          </span>
        </div>

        {order.deliveryLocation && (
          <>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-gray-500">Delivery Area / Spot:</span>
              <span className="text-gray-800 font-medium">
                {order.deliveryLocation.area || 'Map Locked'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Map Coordinates:</span>
              <span className="text-gray-800 font-mono font-medium">
                {order.deliveryLocation.lat.toFixed(6)}, {order.deliveryLocation.lng.toFixed(6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Distance from Mart:</span>
              <span className="text-gray-800 font-medium">
                {Number(order.deliveryLocation.distance).toFixed(2)} km
              </span>
            </div>
          </>
        )}

        <div className="flex justify-between items-center">
          <span className="text-gray-500">Order Type:</span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
              order.orderType === 'Routine'
                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                : 'bg-blue-50 text-blue-600 border border-blue-200'
            }`}
          >
            {order.orderType === 'Routine' ? 'Automatic Delivery' : 'One-Time Delivery'}
          </span>
        </div>

        {/* Transaction Breakdown: Added hover transparency for enhanced UX */}
        <div className="border-t border-gray-200 pt-3 space-y-2 group cursor-default">
          <div className="flex justify-between text-[10px] text-gray-400 group-hover:text-gray-600 transition-colors">
            <span>Subtotal: ₹{order.itemsPrice.toFixed(2)}</span>
            <span>GST: ₹{order.taxPrice.toFixed(2)}</span>
            <span>Shipping: ₹{order.shippingPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-900 font-semibold uppercase tracking-wider">
              Total Amount:
            </span>
            <span className="text-xl font-bold text-green-600">
              ₹{order.totalPrice.toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {/* Security Badge */}
      <div className="p-2.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-lg text-[10px] uppercase tracking-wider text-center font-medium animate-pulse">
        🔒 Secure Demo Payment Gateway — No real funds will be charged.
      </div>

      {/* Simulation / Payment Action */}
      {countdown !== null ? (
        <div className="bg-emerald-50 border border-emerald-250 rounded-xl p-5 space-y-3 text-center">
          <div className="text-2xl animate-spin inline-block">⏳</div>
          <h2 className="text-sm font-bold text-emerald-800 uppercase">Order Session Started ⏳</h2>
          <p className="text-xs text-emerald-600 font-semibold">
            Preparing your demo order...<br/>
            {countdown > 0 ? `Confirmation will be generated in approximately ${countdown} seconds.` : 'Processing backend workflow...'}
          </p>
          <div className="w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-600 h-full transition-all duration-1000" 
              style={{ width: `${((10 - countdown) / 10) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-500 italic mt-2">
            Please wait while the simulation workflow starts.
          </p>
        </div>
      ) : (
        /* Payment Button */
        <button
          onClick={() => {
            if (!order.isPaid && !processing) {
              setCountdown(10);
            }
          }}
          disabled={processing || order.isPaid}
          className={`w-full font-bold py-3 rounded-lg text-xs uppercase tracking-widest transition-all shadow-sm active:scale-95 cursor-pointer ${
            processing
              ? 'bg-emerald-400 text-white animate-pulse'
              : order.isPaid
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {processing
            ? '⏳ Processing payment...'
            : order.isPaid
            ? '✅ Paid Successfully'
            : '🚀 Place Order (Demo)'}
        </button>
      )}
    </div>
  );
};

export default Payment;