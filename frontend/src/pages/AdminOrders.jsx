// frontend/src/pages/AdminOrders.jsx
import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

const AdminOrders = () => {
  const { userInfo } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingOrder, setEditingOrder] = useState(null);
  const [editIsPaid, setEditIsPaid] = useState(false);
  const [editDeliveryStatus, setEditDeliveryStatus] = useState('Processing');
  const [editRefundStatus, setEditRefundStatus] = useState('Pending');
  const [editRefundAmount, setEditRefundAmount] = useState(0);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState('pending');

  const [showEditDeliveryStatusDropdown, setShowEditDeliveryStatusDropdown] = useState(false);
  const [showEditRefundStatusDropdown, setShowEditRefundStatusDropdown] = useState(false);

  const editDeliveryRef = useRef(null);
  const editRefundRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (editDeliveryRef.current && !editDeliveryRef.current.contains(event.target)) {
        setShowEditDeliveryStatusDropdown(false);
      }
      if (editRefundRef.current && !editRefundRef.current.contains(event.target)) {
        setShowEditRefundStatusDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchGlobalOrders = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      const { data } = await axios.get('/api/admin/orders', config);
      setOrders(data);
      setLoading(false);
    } catch (err) {
      setError(err.response && err.response.data.message ? err.response.data.message : err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userInfo) {
      fetchGlobalOrders(true);

      const interval = setInterval(() => {
        fetchGlobalOrders(false);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [userInfo]);

  const outForDeliveryHandler = async (id) => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      await axios.put(`/api/admin/orders/${id}/out-for-delivery`, {}, config);
      alert('Order status successfully marked as out for delivery.');
      fetchGlobalOrders();
    } catch (err) {
      alert(err.response && err.response.data.message ? err.response.data.message : err.message);
    }
  };

  const dispatchFulfillmentHandler = async (id) => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      await axios.put(`/api/admin/orders/${id}/deliver`, {}, config);
      alert('Order status successfully marked as delivered.');
      fetchGlobalOrders();
    } catch (err) {
      alert(err.response && err.response.data.message ? err.response.data.message : err.message);
    }
  };

  const openEditModal = (order) => {
    setEditingOrder(order);
    setEditIsPaid(order.isPaid);
    
    let status = 'Processing';
    if (order.isCancelled) status = 'Cancelled';
    else if (order.isDelivered) status = 'Delivered';
    else if (order.isOutForDelivery) status = 'Out for Delivery';
    setEditDeliveryStatus(status);
    
    setEditRefundStatus(order.refundStatus || 'Pending');
    setEditRefundAmount(order.refundAmount || 0);
  };

  const saveOrderEditHandler = async (e) => {
    e.preventDefault();
    setUpdateLoading(true);
    try {
      const config = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      const payload = {
        isPaid: editIsPaid,
        isCancelled: editDeliveryStatus === 'Cancelled',
        isDelivered: editDeliveryStatus === 'Delivered',
        isOutForDelivery: editDeliveryStatus === 'Out for Delivery' || editDeliveryStatus === 'Delivered',
        refundStatus: editRefundStatus,
        refundAmount: Number(editRefundAmount),
      };

      await axios.put(`/api/admin/orders/${editingOrder._id}`, payload, config);
      alert('Order manual overrides saved successfully.');
      setEditingOrder(null);
      fetchGlobalOrders();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setUpdateLoading(false);
    }
  };

  if (loading) return <p className="text-center py-12 text-sm font-semibold text-gray-600 animate-pulse">Loading orders dashboard...</p>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs font-semibold max-w-4xl mx-auto mt-6">⚠️ {error}</div>;

  return (
    <div className="max-w-[1400px] mx-auto py-6 px-4 md:px-6 space-y-6 font-sans text-gray-800">
      
      {/* CSS Animation for Table Rows */}
      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-row {
          animation: fadeInRow 0.4s ease-out forwards;
        }
      `}</style>

      <div className="border-b border-gray-200 pb-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight">Customer Orders</h1>
          <p className="text-xs text-gray-700 font-semibold mt-1">Review, track, and update fulfillment statuses across lifecycle tabs.</p>
        </div>
      </div>

      {/* Tabs Control Header */}
      <div className="flex border-b border-gray-300 gap-6 text-[11px] font-bold uppercase tracking-wider">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 transition-all border-b-2 outline-none flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'pending'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-gray-400 hover:text-gray-750'
          }`}
        >
          ⏳ Pending ({orders.filter(o => !o.isDelivered && !o.isCancelled && !o.isOutForDelivery).length})
        </button>
        <button
          onClick={() => setActiveTab('complete')}
          className={`pb-3 transition-all border-b-2 outline-none flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'complete'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-400 hover:text-gray-750'
          }`}
        >
          🚚 Marked as Complete ({orders.filter(o => o.isOutForDelivery && !o.isDelivered && !o.isCancelled).length})
        </button>
        <button
          onClick={() => setActiveTab('finished')}
          className={`pb-3 transition-all border-b-2 outline-none flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'finished'
              ? 'border-gray-500 text-gray-700'
              : 'border-transparent text-gray-400 hover:text-gray-750'
          }`}
        >
          ✅ Finished ({orders.filter(o => o.isDelivered || o.isCancelled).length})
        </button>
      </div>

      <div className="bg-white border border-gray-300 rounded-xl overflow-hidden shadow-sm">
        <div>
          {activeTab === 'pending' && (
            <>
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-900 font-bold uppercase tracking-wider bg-gray-100 text-[11px]">
                      <th className="p-4">Order ID</th>
                      <th className="p-4">Customer Name</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Payment</th>
                      <th className="p-4">Type</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 font-medium text-gray-805">
                    {orders.filter(o => !o.isDelivered && !o.isCancelled && !o.isOutForDelivery).length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-gray-450 font-bold italic">No pending orders waiting.</td>
                      </tr>
                    ) : (
                      orders
                        .filter(o => !o.isDelivered && !o.isCancelled && !o.isOutForDelivery)
                        .map((order, index) => {
                          const paidTime = order.paidAt ? new Date(order.paidAt).getTime() : 0;
                          const elapsed = Date.now() - paidTime;
                          const totalWindow = 1 * 60 * 1000;
                          const cancelWindowActive = order.isPaid && elapsed < totalWindow;
                          const secondsRemaining = Math.max(0, Math.ceil((totalWindow - elapsed) / 1000));

                          return (
                            <tr key={order._id} className="transition-all duration-300 animate-row bg-white hover:bg-emerald-50/50 text-gray-805" style={{ animationDelay: `${index * 50}ms` }}>
                              <td className="p-4 font-mono text-gray-900 text-[11px]">{order._id.slice(-8)}</td>
                              <td className="p-4 text-gray-955 font-bold">{order.user?.name || 'Deleted Account'}</td>
                              <td className="p-4 text-gray-700">{new Date(order.createdAt).toLocaleDateString()}</td>
                              <td className="p-4 text-gray-955 font-bold text-sm">₹{order.totalPrice.toFixed(2)}</td>
                              <td className="p-4">
                                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${order.isPaid ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-red-100 border-red-300 text-red-800'}`}>
                                  {order.isPaid ? 'Paid' : 'Awaiting'}
                                </span>
                              </td>
                              <td className="p-4">
                                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${order.orderType === 'Routine' ? 'bg-purple-100 border-purple-300 text-purple-800' : 'bg-gray-200 border-gray-300 text-gray-800'}`}>
                                  {order.orderType === 'Routine' ? 'Sub' : 'One-Time'}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center justify-center">
                                  <div className="flex flex-col items-center justify-center gap-1.5 min-w-[120px]">
                                    {!order.isPaid ? (
                                      <span className="text-red-500 font-bold text-[10px] uppercase tracking-wider text-center block">Awaiting Funds</span>
                                    ) : cancelWindowActive ? (
                                      <span 
                                        className="text-amber-600 bg-amber-50 border border-amber-200 font-bold text-[9px] uppercase px-2 py-1 rounded block mt-auto"
                                        title="Waiting for customer cancellation grace period to expire"
                                      >
                                        ⏳ Grace (00:{secondsRemaining.toString().padStart(2, '0')})
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => outForDeliveryHandler(order._id)}
                                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded transition-all shadow-sm active:scale-95 cursor-pointer w-full mb-auto"
                                      >
                                        Out for Delivery
                                      </button>
                                    )}
                                    <button
                                      onClick={() => openEditModal(order)}
                                      className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 font-bold text-[10px] uppercase tracking-wider px-2 py-1 rounded transition-all active:scale-95 cursor-pointer w-full"
                                      title="Manually Override Order Status"
                                    >
                                      ✏️ Edit
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="block md:hidden p-4 space-y-4">
                {orders.filter(o => !o.isDelivered && !o.isCancelled && !o.isOutForDelivery).length === 0 ? (
                  <p className="text-center text-xs font-bold text-gray-500 py-6 italic">No pending orders waiting.</p>
                ) : (
                  orders
                    .filter(o => !o.isDelivered && !o.isCancelled && !o.isOutForDelivery)
                    .map((order, index) => {
                      const paidTime = order.paidAt ? new Date(order.paidAt).getTime() : 0;
                      const elapsed = Date.now() - paidTime;
                      const totalWindow = 1 * 60 * 1000;
                      const cancelWindowActive = order.isPaid && elapsed < totalWindow;
                      const secondsRemaining = Math.max(0, Math.ceil((totalWindow - elapsed) / 1000));

                      return (
                        <div 
                          key={order._id}
                          className="bg-gray-50 border border-gray-250 rounded-xl p-4 space-y-3.5 shadow-2xs animate-row"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2.5">
                            <span className="font-mono text-gray-900 text-xs font-bold">#{order._id.slice(-8)}</span>
                            <span className="text-[11px] text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-left">
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Customer:</span>
                              <span className="font-bold text-gray-950 block">{order.user?.name || 'Deleted Account'}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Amount:</span>
                              <span className="font-extrabold text-gray-905 text-sm">₹{order.totalPrice.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${order.isPaid ? 'bg-emerald-50 border-emerald-250 text-emerald-800' : 'bg-red-50 border-red-250 text-red-800'}`}>
                              {order.isPaid ? 'Paid' : 'Awaiting'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${order.orderType === 'Routine' ? 'bg-purple-50 border-purple-250 text-purple-800' : 'bg-gray-100 border-gray-250 text-gray-800'}`}>
                              {order.orderType === 'Routine' ? 'Subscription' : 'One-Time'}
                            </span>
                          </div>

                          <div className="pt-2.5 border-t border-gray-200 flex items-center justify-end gap-2">
                            {!order.isPaid ? (
                              <span className="text-red-500 font-bold text-[10px] uppercase tracking-wider">Awaiting Funds</span>
                            ) : cancelWindowActive ? (
                              <span 
                                className="text-amber-600 bg-amber-50 border border-amber-200 font-bold text-[9px] uppercase px-2 py-1.5 rounded-lg"
                              >
                                ⏳ Grace (00:{secondsRemaining.toString().padStart(2, '0')})
                              </span>
                            ) : (
                              <button
                                onClick={() => outForDeliveryHandler(order._id)}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-2 rounded-lg transition-all active:scale-95 cursor-pointer"
                              >
                                Out for Delivery
                              </button>
                            )}
                            <button
                              onClick={() => openEditModal(order)}
                              className="bg-white hover:bg-gray-150 border border-gray-300 text-gray-705 font-bold text-[10px] uppercase tracking-wider px-3 py-2 rounded-lg transition-all active:scale-95 cursor-pointer"
                            >
                              ✏️ Edit
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </>
          )}

          {activeTab === 'complete' && (
            <>
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-900 font-bold uppercase tracking-wider bg-gray-100 text-[11px]">
                      <th className="p-4">Order ID</th>
                      <th className="p-4">Customer Name</th>
                      <th className="p-4">Dispatched At</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4 font-semibold text-gray-705">Type</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 font-medium text-gray-850">
                    {orders.filter(o => o.isOutForDelivery && !o.isDelivered && !o.isCancelled).length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-gray-450 font-bold italic">No orders currently out for delivery.</td>
                      </tr>
                    ) : (
                      orders
                        .filter(o => o.isOutForDelivery && !o.isDelivered && !o.isCancelled)
                        .map((order, index) => {
                          return (
                            <tr key={order._id} className="transition-all duration-300 animate-row bg-purple-50/20 hover:bg-purple-100/30 text-gray-805 border-l-4 border-l-purple-400" style={{ animationDelay: `${index * 50}ms` }}>
                              <td className="p-4 font-mono text-gray-900 text-[11px]">{order._id.slice(-8)}</td>
                              <td className="p-4 text-gray-955 font-bold">{order.user?.name || 'Deleted Account'}</td>
                              <td className="p-4 text-gray-700">{order.outForDeliveryAt ? new Date(order.outForDeliveryAt).toLocaleString() : 'N/A'}</td>
                              <td className="p-4 text-gray-955 font-bold text-sm">₹{order.totalPrice.toFixed(2)}</td>
                              <td className="p-4">
                                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${order.orderType === 'Routine' ? 'bg-purple-100 border-purple-300 text-purple-800' : 'bg-gray-200 border-gray-300 text-gray-800'}`}>
                                  {order.orderType === 'Routine' ? 'Sub' : 'One-Time'}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center justify-center">
                                  <div className="flex flex-col items-center justify-center gap-1.5 min-w-[120px]">
                                    <button
                                      onClick={() => dispatchFulfillmentHandler(order._id)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded transition-all shadow-sm active:scale-95 cursor-pointer w-full"
                                    >
                                      Mark Complete
                                    </button>
                                    <button
                                      onClick={() => openEditModal(order)}
                                      className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-707 font-bold text-[10px] uppercase tracking-wider px-2 py-1 rounded transition-all active:scale-95 cursor-pointer w-full"
                                      title="Manually Override Order Status"
                                    >
                                      ✏️ Edit
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="block md:hidden p-4 space-y-4">
                {orders.filter(o => o.isOutForDelivery && !o.isDelivered && !o.isCancelled).length === 0 ? (
                  <p className="text-center text-xs font-bold text-gray-500 py-6 italic">No orders currently out for delivery.</p>
                ) : (
                  orders
                    .filter(o => o.isOutForDelivery && !o.isDelivered && !o.isCancelled)
                    .map((order, index) => {
                      return (
                        <div 
                          key={order._id}
                          className="bg-purple-50/10 border border-purple-150 border-l-4 border-l-purple-400 rounded-xl p-4 space-y-3.5 shadow-2xs animate-row"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex justify-between items-center border-b border-purple-100 pb-2.5">
                            <span className="font-mono text-purple-900 text-xs font-bold">#{order._id.slice(-8)}</span>
                            <span className="text-[11px] text-purple-600 font-semibold">{order.outForDeliveryAt ? new Date(order.outForDeliveryAt).toLocaleString() : 'N/A'}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-left">
                            <div>
                              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block">Customer:</span>
                              <span className="font-bold text-purple-955 block">{order.user?.name || 'Deleted Account'}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block">Amount:</span>
                              <span className="font-extrabold text-purple-900 text-sm">₹{order.totalPrice.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <span className="bg-purple-100 border border-purple-250 text-purple-800 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                              Out for Delivery
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${order.orderType === 'Routine' ? 'bg-purple-50 border-purple-200 text-purple-800' : 'bg-gray-100 border-gray-250 text-gray-800'}`}>
                              {order.orderType === 'Routine' ? 'Subscription' : 'One-Time'}
                            </span>
                          </div>

                          <div className="pt-2.5 border-t border-purple-100 flex items-center justify-end gap-2">
                            <button
                              onClick={() => dispatchFulfillmentHandler(order._id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-2 rounded-lg transition-all active:scale-95 cursor-pointer"
                            >
                              Mark Complete
                            </button>
                            <button
                              onClick={() => openEditModal(order)}
                              className="bg-white hover:bg-gray-150 border border-gray-300 text-gray-707 font-bold text-[10px] uppercase tracking-wider px-3 py-2 rounded-lg transition-all active:scale-95 cursor-pointer"
                            >
                              ✏️ Edit
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </>
          )}

          {activeTab === 'finished' && (
            <>
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-900 font-bold uppercase tracking-wider bg-gray-100 text-[11px]">
                      <th className="p-4">Order ID</th>
                      <th className="p-4">Customer Name</th>
                      <th className="p-4">Completed/Cancelled At</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Status & Reasons</th>
                      <th className="p-4 font-semibold text-gray-705">Type</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 font-medium text-gray-805">
                    {orders.filter(o => o.isDelivered || o.isCancelled).length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-gray-450 font-bold italic">No completed or cancelled orders found.</td>
                      </tr>
                    ) : (
                      orders
                        .filter(o => o.isDelivered || o.isCancelled)
                        .map((order, index) => {
                          let rowBgClass = 'bg-gray-50/70 hover:bg-gray-100/70 text-gray-500 border-l-4 border-l-gray-450';
                          if (order.isCancelled) {
                            rowBgClass = 'bg-red-50/30 hover:bg-red-100/30 text-gray-500 border-l-4 border-l-red-400';
                          }

                          return (
                            <tr key={order._id} className={`transition-all duration-300 animate-row ${rowBgClass}`} style={{ animationDelay: `${index * 50}ms` }}>
                              <td className="p-4 font-mono text-gray-905 text-[11px]">{order._id.slice(-8)}</td>
                              <td className="p-4 text-gray-950 font-bold">{order.user?.name || 'Deleted Account'}</td>
                              <td className="p-4 text-gray-600">
                                {order.isCancelled 
                                  ? (order.cancelledAt ? new Date(order.cancelledAt).toLocaleString() : 'N/A')
                                  : (order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : 'N/A')
                                }
                              </td>
                              <td className="p-4 text-gray-955 font-bold text-sm">₹{order.totalPrice.toFixed(2)}</td>
                              <td className="p-4">
                                {order.isCancelled ? (
                                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-red-100 border-red-300 text-red-800" title={`Refund Details: ${order.refundStatus || 'Pending'} (₹${(order.refundAmount || 0).toFixed(2)})`}>
                                    Cancelled ({order.refundStatus || 'No Refund'})
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-emerald-100 border-emerald-300 text-emerald-800">
                                    Completed
                                  </span>
                                )}
                              </td>
                              <td className="p-4">
                                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${order.orderType === 'Routine' ? 'bg-purple-100 border-purple-300 text-purple-800' : 'bg-gray-200 border-gray-300 text-gray-800'}`}>
                                  {order.orderType === 'Routine' ? 'Sub' : 'One-Time'}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center justify-center">
                                  <button
                                    onClick={() => openEditModal(order)}
                                    className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-707 font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded transition-all active:scale-95 cursor-pointer"
                                    title="Manually Override Order Status"
                                  >
                                    ✏️ Edit
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="block md:hidden p-4 space-y-4">
                {orders.filter(o => o.isDelivered || o.isCancelled).length === 0 ? (
                  <p className="text-center text-xs font-bold text-gray-500 py-6 italic">No completed or cancelled orders found.</p>
                ) : (
                  orders
                    .filter(o => o.isDelivered || o.isCancelled)
                    .map((order, index) => {
                      let borderClass = 'border-l-4 border-l-gray-450 border-gray-250 bg-gray-50/50';
                      if (order.isCancelled) {
                        borderClass = 'border-l-4 border-l-red-400 border-red-200 bg-red-50/20';
                      }

                      return (
                        <div 
                          key={order._id}
                          className={`border rounded-xl p-4 space-y-3.5 shadow-2xs animate-row ${borderClass}`}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2.5">
                            <span className="font-mono text-gray-900 text-xs font-bold">#{order._id.slice(-8)}</span>
                            <span className="text-[11px] text-gray-500">
                              {order.isCancelled 
                                ? (order.cancelledAt ? new Date(order.cancelledAt).toLocaleString() : 'N/A')
                                : (order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : 'N/A')
                              }
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-left">
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Customer:</span>
                              <span className="font-bold text-gray-955 block">{order.user?.name || 'Deleted Account'}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Amount:</span>
                              <span className="font-extrabold text-gray-900 text-sm">₹{order.totalPrice.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            {order.isCancelled ? (
                              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border bg-red-50 border-red-250 text-red-700">
                                Cancelled ({order.refundStatus || 'No Refund'})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border bg-emerald-50 border-emerald-250 text-emerald-800">
                                Completed
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${order.orderType === 'Routine' ? 'bg-purple-50 border-purple-250 text-purple-800' : 'bg-gray-100 border-gray-250 text-gray-800'}`}>
                              {order.orderType === 'Routine' ? 'Subscription' : 'One-Time'}
                            </span>
                          </div>

                          <div className="pt-2.5 border-t border-gray-200 flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(order)}
                              className="bg-white hover:bg-gray-150 border border-gray-300 text-gray-707 font-bold text-[10px] uppercase tracking-wider px-3 py-2 rounded-lg transition-all active:scale-95 cursor-pointer"
                            >
                              ✏️ Edit
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {editingOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999999, backdropFilter: 'blur(2px)' }} className="p-4">
          <form onSubmit={saveOrderEditHandler} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl border border-gray-200 w-full max-w-md p-6 shadow-2xl space-y-4 text-left font-sans text-gray-700">
            <div className="flex justify-between items-center pb-2 border-b border-gray-150">
              <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-tight">✏️ Manually Edit Order Status</h3>
              <button type="button" onClick={() => setEditingOrder(null)} className="text-gray-400 hover:text-gray-900 text-sm font-bold">×</button>
            </div>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="editIsPaid"
                  checked={editIsPaid}
                  onChange={(e) => setEditIsPaid(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 rounded border-gray-300"
                />
                <label htmlFor="editIsPaid" className="font-bold text-gray-900 uppercase">Mark Order as Paid</label>
              </div>

              <div ref={editDeliveryRef}>
                <label className="block text-[11px] text-gray-600 font-bold uppercase mb-1">Delivery Status</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEditDeliveryStatusDropdown(!showEditDeliveryStatusDropdown)}
                    className="w-full p-2 pr-8 text-xs text-left font-semibold text-gray-700 border border-gray-300 rounded bg-white flex items-center justify-between cursor-pointer focus:border-emerald-500 transition-colors h-[34px] outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                  >
                    <span>{editDeliveryStatus}</span>
                    <span className="text-[9px] text-gray-400 select-none">▼</span>
                  </button>

                  {showEditDeliveryStatusDropdown && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto custom-scrollbar border-t-2 border-t-emerald-600 overflow-hidden">
                      {['Processing', 'Out for Delivery', 'Delivered', 'Cancelled'].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => {
                            setEditDeliveryStatus(status);
                            setShowEditDeliveryStatusDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-emerald-50 hover:text-emerald-700 block outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                            editDeliveryStatus === status
                              ? 'text-emerald-600 bg-emerald-50/50 font-black'
                              : 'text-gray-700 font-semibold'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {editDeliveryStatus === 'Cancelled' && (
                <>
                  <div ref={editRefundRef}>
                    <label className="block text-[11px] text-gray-600 font-bold uppercase mb-1">Refund Status</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowEditRefundStatusDropdown(!showEditRefundStatusDropdown)}
                        className="w-full p-2 pr-8 text-xs text-left font-semibold text-gray-700 border border-gray-300 rounded bg-white flex items-center justify-between cursor-pointer focus:border-emerald-500 transition-colors h-[34px] outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                      >
                        <span>{editRefundStatus}</span>
                        <span className="text-[9px] text-gray-400 select-none">▼</span>
                      </button>

                      {showEditRefundStatusDropdown && (
                        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto custom-scrollbar border-t-2 border-t-emerald-600 overflow-hidden">
                          {['Pending', 'Refunded (Except Shipping)', 'No Refund'].map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => {
                                setEditRefundStatus(status);
                                setShowEditRefundStatusDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-emerald-50 hover:text-emerald-700 block outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                                editRefundStatus === status
                                  ? 'text-emerald-600 bg-emerald-50/50 font-black'
                                  : 'text-gray-700 font-semibold'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-600 font-bold uppercase mb-1">Refund Amount (₹)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={editRefundAmount}
                      onChange={(e) => setEditRefundAmount(e.target.value)}
                      className="w-full border border-gray-300 p-2 rounded font-semibold text-gray-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-gray-150 flex justify-end gap-2 text-[10px] uppercase font-bold tracking-wider">
              <button 
                type="button" 
                onClick={() => setEditingOrder(null)} 
                className="bg-transparent text-gray-500 hover:text-gray-800 px-4 py-2"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={updateLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg shadow-sm cursor-pointer"
              >
                {updateLoading ? 'Saving...' : 'Save Overrides'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;