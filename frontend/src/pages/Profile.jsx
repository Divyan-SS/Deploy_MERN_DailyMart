// frontend/src/pages/Profile.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';

const Profile = () => {
  const { userInfo, updateProfile, logout } = useContext(AuthContext);
  const { showConfirm } = useContext(ToastContext);
  const navigate = useNavigate();

  const [name, setName] = useState(userInfo?.name || '');
  const [email, setEmail] = useState(userInfo?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [orders, setOrders] = useState([]);
  const [routines, setRoutines] = useState([]);

  const [deliveryLocation, setDeliveryLocation] = useState(() => {
    try {
      const loc = localStorage.getItem('deliveryLocation');
      return loc ? JSON.parse(loc) : null;
    } catch (e) {
      return null;
    }
  });

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);
  const [profileError, setProfileError] = useState(null);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackReason, setFeedbackReason] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackOrderId, setFeedbackOrderId] = useState('');
  const [feedbackSignature, setFeedbackSignature] = useState('');

  const [dataLoading, setDataLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTimeout(() => setMounted(true), 80);
    try {
      const loc = localStorage.getItem('deliveryLocation');
      if (loc) {
        setDeliveryLocation(JSON.parse(loc));
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('feedback') === 'dislike') {
      setFeedbackOrderId(params.get('orderId') || '');
      setFeedbackSignature(params.get('signature') || '');
      setShowFeedbackModal(true);
    }
  }, [location]);

  useEffect(() => {
    // If there is any paid order that is not delivered and not cancelled, poll every 5 seconds to track state changes
    const hasActiveSim = orders.some(o => o.isPaid && !o.isDelivered && !o.isCancelled);
    if (hasActiveSim && userInfo) {
      const interval = setInterval(() => {
        fetchUserRecords();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [orders, userInfo]);

  const fetchUserRecords = async () => {
    try {
      setDataLoading(true);
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      const ordersResponse = await axios.get('/api/orders/myorders', config);
      setOrders(ordersResponse.data);

      const routinesResponse = await axios.get('/api/routines', config);
      setRoutines(routinesResponse.data);

      setDataLoading(false);
    } catch (err) {
      setDataLoading(false);
      console.error(err.message);
    }
  };

  useEffect(() => {
    if (userInfo) fetchUserRecords();
  }, [userInfo]);

  const submitProfileHandler = async (e) => {
    e.preventDefault();
    setProfileMessage(null);
    setProfileError(null);

    if (password !== confirmPassword) {
      setProfileError('Passwords do not match.');
      return;
    }

    try {
      setProfileLoading(true);
      await updateProfile({ id: userInfo._id, name, email, password });
      setProfileMessage('Profile updated successfully.');
      setProfileLoading(false);
    } catch (err) {
      setProfileError(err.message);
      setProfileLoading(false);
    }
  };

  const deleteRoutineHandler = async (routineId) => {
    const isConfirmed = await showConfirm('Are you absolutely sure you want to delete this custom routine list? This will remove all its saved grocery templates.');
    if (!isConfirmed) return;
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      await axios.delete(`/api/routines/${routineId}`, config);
      setRoutines(routines.filter((r) => r._id !== routineId));
      alert('Routine template list removed completely.');
    } catch (err) {
      alert(err.message);
    }
  };

  const logoutSessionHandler = async () => {
    const isConfirmed = await showConfirm('Are you sure you want to sign out safely from your account?');
    if (isConfirmed) {
      logout();
      navigate('/login');
    }
  };

  const cancelOrderHandler = async (order) => {
    const paidTime = order.paidAt ? new Date(order.paidAt).getTime() : 0;
    const elapsed = Date.now() - paidTime;
    const isWithinWindow = order.isPaid && elapsed <= 10 * 1000;
    
    let confirmMsg = '';
    if (order.isOutForDelivery) {
      confirmMsg = `⚠️ WARNING: This order is already Out for Delivery. If you cancel this order, NO REFUND will be provided (₹0.00 refund). The total payment of ₹${order.totalPrice.toFixed(0)} will go to the store. Are you sure you want to cancel?`;
    } else if (isWithinWindow) {
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
      fetchUserRecords();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const getRemainingCancelTime = (order) => {
    if (!order.isPaid || order.isCancelled || order.isDelivered) return 0;
    const paidTime = new Date(order.paidAt).getTime();
    const elapsed = Date.now() - paidTime;
    const totalWindow = 10 * 1000;
    return Math.max(0, totalWindow - elapsed);
  };

  const renderOrderTimeline = (order) => {
    if (!order.isPaid) {
      return (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800 font-semibold space-y-1">
          <p className="font-extrabold flex items-center gap-1">⏱️ Payment Pending (Demo)</p>
          <p className="text-gray-500 font-normal">Complete the checkout simulation to start the demo workflow timeline.</p>
        </div>
      );
    }

    if (order.isCancelled) {
      return (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-2.5 text-[11px] text-red-800 font-semibold space-y-2">
          <p className="font-extrabold flex items-center gap-1">❌ Cancelled (Demo)</p>
          <p className="text-gray-500 font-normal mb-1">Simulated order stopped. Stocks restored. Refund: {order.refundStatus || 'No Refund'}.</p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-800 font-medium leading-relaxed text-[10px]">
            <strong className="text-amber-950 block text-[10px] uppercase font-bold mb-0.5">ℹ️ Simulated Experience:</strong>
            This transaction exists solely for demonstration purposes and no real charges occurred. If you wish, you can place another order to retry and experience the full workflow simulation from the beginning!
          </div>
        </div>
      );
    }

    // Step indicators
    const isPlaced = order.isPaid;
    const isDispatched = order.isOutForDelivery;
    const isDelivered = order.isDelivered;

    return (
      <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2 text-left">
        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider mb-1">
          <span className="text-gray-400">Order Progress</span>
          <span className="bg-amber-100 text-amber-800 border border-amber-250 px-1.5 py-0.5 rounded text-[8px] font-black">DEMO MODE</span>
        </div>
        
        {/* Visual timeline */}
        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 pt-1">
          <div className="flex flex-col items-center flex-1">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all duration-300 ${isPlaced ? 'bg-emerald-500 border-emerald-600 text-white shadow-xs' : 'bg-gray-100 border-gray-300 text-gray-400'}`}>✓</div>
            <span className={`mt-1 font-bold ${isPlaced ? 'text-emerald-600' : 'text-gray-400'}`}>Placed</span>
          </div>
          <div className={`h-0.5 flex-1 transition-all duration-300 ${isDispatched ? 'bg-purple-500' : 'bg-gray-200'}`}></div>
          <div className="flex flex-col items-center flex-1">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all duration-300 ${isDispatched ? 'bg-purple-500 border-purple-600 text-white shadow-xs' : 'bg-gray-100 border-gray-300 text-gray-400'}`}>{isDispatched ? '✓' : '2'}</div>
            <span className={`mt-1 font-bold ${isDispatched ? 'text-purple-600' : 'text-gray-400'}`}>Dispatched</span>
          </div>
          <div className={`h-0.5 flex-1 transition-all duration-300 ${isDelivered ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
          <div className="flex flex-col items-center flex-1">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all duration-300 ${isDelivered ? 'bg-blue-500 border-blue-600 text-white shadow-xs' : 'bg-gray-100 border-gray-300 text-gray-400'}`}>{isDelivered ? '✓' : '3'}</div>
            <span className={`mt-1 font-bold ${isDelivered ? 'text-blue-600' : 'text-gray-400'}`}>Delivered</span>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 italic text-center font-medium pt-1.5 border-t border-gray-150">
          * This is a simulated order experience for demonstration purposes.
        </p>
      </div>
    );
  };

  return (
    <div className={`max-w-[1400px] mx-auto py-6 space-y-8 font-sans text-gray-700 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight">👤 My Profile</h1>
          <p className="text-xs text-gray-500 font-semibold mt-1">Manage your account, orders, and preferences easily.</p>
        </div>
        <button
          type="button"
          onClick={logoutSessionHandler}
          className="bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg transition-all hidden sm:block active:scale-95"
        >
          🚪 Logout
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="space-y-6">
          {/* PROFILE CARD */}
          <div className="bg-white border border-gray-300 rounded-xl p-5 space-y-4 hover:shadow-md transition-all">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1.5">Profile Details</h2>

          {profileMessage && <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs p-3 rounded-lg font-bold">✓ {profileMessage}</div>}
          {profileError && <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-lg font-bold">⚠️ {profileError}</div>}

          <form onSubmit={submitProfileHandler} className="space-y-4">
            <div>
              <label className="block text-[11px] text-gray-600 uppercase tracking-wide mb-1 font-bold">Account Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-300 p-2 rounded text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-semibold text-gray-800" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 uppercase tracking-wide mb-1 font-bold">📧 Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-300 p-2 rounded text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-semibold text-gray-800" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 uppercase tracking-wide mb-1 font-bold">🔑 Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="(optional)" className="w-full border border-gray-300 p-2 rounded text-xs font-semibold" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 uppercase tracking-wide mb-1 font-bold">🔑 Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="(optional)" className="w-full border border-gray-300 p-2 rounded text-xs font-semibold" />
            </div>

            <div className="text-xs text-gray-800 bg-gray-50 border border-gray-200 p-2 rounded font-bold uppercase tracking-wider">
              👤 {userInfo?.isAdmin ? 'Admin Account' : 'User Account'}
            </div>

            <button type="submit" disabled={profileLoading} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs uppercase tracking-widest py-2.5 rounded-lg font-bold transition-all active:scale-95 shadow-2xs">
              {profileLoading ? 'Saving...' : '💾 Save Changes'}
            </button>
          </form>
        </div>

        {/* DELIVERY LOCATION CARD */}
        <div className="bg-white border border-gray-300 rounded-xl p-5 space-y-4 hover:shadow-md transition-all">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <span>Saved Delivery Pin</span>
          </h2>
          {deliveryLocation ? (
            <div className="space-y-3 text-xs font-semibold text-gray-700">
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-lg flex items-start gap-2">
                <svg className="w-4 h-4 text-emerald-800 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <div className="text-left leading-relaxed">
                  <p className="font-bold text-emerald-950">Active Pin Locked</p>
                  <p className="text-[11px] font-normal text-emerald-800 mt-0.5">{deliveryLocation.address}</p>
                </div>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500 uppercase tracking-wide">Coordinates:</span>
                  <span className="font-mono text-gray-900">{deliveryLocation.lat.toFixed(6)}, {deliveryLocation.lng.toFixed(6)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500 uppercase tracking-wide">Distance from Mart:</span>
                  <span className="text-gray-900">{Number(deliveryLocation.distance).toFixed(2)} km</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-medium pt-2 border-t border-gray-100 italic">
                * To update your delivery point, click "Set Delivery Location" in the navigation bar.
              </p>
            </div>
          ) : (
            <div className="text-center py-4 space-y-2">
              <p className="text-xs text-gray-400 font-bold italic">No delivery location locked on map yet.</p>
              <p className="text-[11px] text-gray-500 font-medium">Please set your address coordinate via the navigation bar map pin.</p>
            </div>
          )}
        </div>
      </div>

      {/* DETAILS COLUMN */}
      <div className="lg:col-span-2 space-y-6">
          {/* CUSTOM USER ROUTINES */}
          <div className="bg-white border border-gray-300 rounded-xl p-5 hover:shadow-md transition-all">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">📂 Saved Custom Routines</h2>

            {dataLoading ? (
              <p className="text-xs text-gray-400 animate-pulse font-bold">Loading custom templates...</p>
            ) : routines.length === 0 ? (
              <p className="text-xs text-gray-400 font-bold italic">No custom routines configured yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {routines.map((routine) => (
                  <div key={routine._id} className="border border-gray-200 p-4 rounded-xl bg-gray-50 hover:bg-white transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center border-b border-gray-200 pb-1.5 mb-2">
                        <h4 className="text-xs font-extrabold text-gray-900 uppercase tracking-tight">📁 {routine.name}</h4>
                        <span className="text-[9px] bg-emerald-50 border border-emerald-200 text-emerald-600 px-2 py-0.5 rounded font-bold uppercase">
                          {routine.items?.length || 0} Slots Saved
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 space-y-1 font-semibold">
                        {routine.items?.map((item, idx) => (
                          <div key={idx} className="truncate">
                            • {item.product?.name || 'Loading Item...'} <span className="text-gray-400">({item.variantName})</span> x{item.qty}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-gray-100 flex justify-between items-center">
                      <button type="button" onClick={() => navigate(`/routine/${encodeURIComponent(routine.name)}`)} className="text-emerald-600 font-bold text-[10px] uppercase hover:underline">
                        Open Grid View →
                      </button>
                      <button type="button" onClick={() => deleteRoutineHandler(routine._id)} className="text-red-500 text-[10px] font-bold uppercase hover:underline">
                        Delete List
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COMPLETED ORDERS HISTORY */}
          <div className="bg-white border border-gray-300 rounded-xl p-5 hover:shadow-md transition-all">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">📦 Order Transactions History</h2>

            {dataLoading ? (
              <p className="text-xs text-gray-400 animate-pulse font-bold">Loading purchase logs...</p>
            ) : orders.length === 0 ? (
              <p className="text-xs text-gray-400 font-bold italic">No order entries found.</p>
            ) : (
              <>
                {/* Mobile / Tablet view: Compact Cards */}
                <div className="sm:hidden space-y-4 text-left">
                  {orders.map((order) => {
                    const remainingMs = getRemainingCancelTime(order);
                    return (
                      <div key={order._id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 hover:bg-white transition-all space-y-3">
                        <div className="flex justify-between items-center border-b border-gray-150 pb-2">
                          <div>
                            <span className="text-[10px] text-gray-400 font-mono block">Order ID</span>
                            <span className="font-mono text-xs font-bold text-gray-950">#{order._id.slice(-8)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400 block text-right font-medium">Date</span>
                            <span className="text-xs font-bold text-gray-800">{new Date(order.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-[10px] text-gray-400 block font-medium">Total Paid</span>
                            <span className="text-sm font-black text-gray-905">₹{order.totalPrice.toFixed(0)}</span>
                          </div>
                          <div>
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
                              order.isCancelled
                                ? 'bg-red-50 text-red-650 border border-red-100'
                                : order.isDelivered
                                ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                : order.isOutForDelivery
                                ? 'bg-purple-50 text-purple-650 border border-purple-100'
                                : order.isPaid
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                : 'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}>
                              {order.isCancelled 
                                ? 'CANCELLED' 
                                : order.isDelivered 
                                ? 'DELIVERED' 
                                : order.isOutForDelivery 
                                ? 'OUT FOR DELIVERY' 
                                : order.isPaid 
                                ? 'PAID' 
                                : 'PENDING'}
                            </span>
                          </div>
                        </div>

                        {renderOrderTimeline(order)}

                        {order.isOutForDelivery && order.deliveryLocation && order.deliveryLocation.lat && order.deliveryLocation.lng && (
                          <div className="pt-1.5 border-t border-gray-150">
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${order.deliveryLocation.lat},${order.deliveryLocation.lng}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-600 hover:underline font-bold flex items-center justify-center gap-1 bg-blue-50/50 py-1.5 rounded-lg border border-blue-100"
                            >
                              <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                              </svg>
                              <span>Track Delivery Location</span>
                            </a>
                          </div>
                        )}

                        <div className="pt-2 border-t border-gray-150 flex justify-end gap-2">
                          {order.isCancelled ? (
                            <div className="flex flex-col gap-2 w-full">
                              <span className="text-red-500 font-bold text-[9px] uppercase animate-pulse text-center">
                                Cancelled ({order.refundStatus || 'No Refund'})
                              </span>
                              <button
                                type="button"
                                onClick={() => navigate(`/cancellation-receipt/${order._id}`)}
                                className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-[9px] uppercase py-2 rounded-lg transition-all active:scale-95 cursor-pointer text-center block"
                              >
                                📄 View Cancellation Receipt
                              </button>
                            </div>
                          ) : remainingMs > 0 ? (
                            <button
                              type="button"
                              onClick={() => cancelOrderHandler(order)}
                              className="w-full bg-red-50 hover:bg-red-100 text-red-655 border border-red-200 font-bold text-[9px] uppercase py-2 rounded-lg transition-all active:scale-95 cursor-pointer text-center"
                              title="Cancel order during 10-second grace period for a FULL refund"
                            >
                              ❌ Cancel (00:{Math.ceil(remainingMs / 1000).toString().padStart(2, '0')})
                            </button>
                          ) : order.isPaid ? (
                            <div className="flex w-full gap-2 text-xs">
                              <button
                                type="button"
                                onClick={() => navigate(`/ebill/${order._id}`)}
                                className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 font-bold text-[10px] uppercase py-2 rounded-lg transition-all active:scale-95 cursor-pointer text-center"
                              >
                                {order.isDelivered ? '📄 Download E-Bill (Demo Invoice)' : '📄 View Status'}
                              </button>
                              {!order.isDelivered && (
                                <button
                                  type="button"
                                  onClick={() => cancelOrderHandler(order)}
                                  className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-[10px] uppercase px-3 py-2 rounded-lg transition-all active:scale-95 cursor-pointer"
                                  title={order.isOutForDelivery ? "Cancel order (NO REFUND)" : "Cancel order"}
                                >
                                  ❌ Cancel
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate(`/payment/${order._id}`)}
                              className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-bold text-[10px] uppercase py-2 rounded-lg transition-all active:scale-95 cursor-pointer text-center"
                            >
                              💳 Pay Now
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop view: Detailed Table Layout */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-gray-400 border-b uppercase tracking-wider text-[10px]">
                        <th className="p-2">Transaction ID</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Total Paid</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 text-center">Receipt & Actions</th>
                      </tr>
                    </thead>
                    <tbody className="font-semibold text-gray-800">
                      {orders.map((order) => {
                        const remainingMs = getRemainingCancelTime(order);
                        return (
                          <tr key={order._id} className="border-b hover:bg-gray-50/70 transition-colors">
                            <td className="p-2 font-mono text-gray-905">{order._id.slice(-8)}</td>
                            <td className="p-2 text-gray-600">{new Date(order.createdAt).toLocaleDateString()}</td>
                            <td className="p-2 text-gray-900 font-bold">₹{order.totalPrice.toFixed(0)}</td>
                            <td className="p-2 min-w-[280px]">
                              <div className="flex flex-col items-start gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                    order.isCancelled
                                      ? 'bg-red-50 text-red-655 border border-red-100'
                                      : order.isDelivered
                                      ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                      : order.isOutForDelivery
                                      ? 'bg-purple-50 text-purple-655 border border-purple-100'
                                      : order.isPaid
                                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                      : 'bg-amber-50 text-amber-600 border border-amber-100'
                                  }`}>
                                    {order.isCancelled 
                                      ? 'CANCELLED' 
                                      : order.isDelivered 
                                      ? 'DELIVERED' 
                                      : order.isOutForDelivery 
                                      ? 'OUT FOR DELIVERY' 
                                      : order.isPaid 
                                      ? 'PAID' 
                                      : 'PENDING'}
                                  </span>
                                  <span className="bg-amber-100 text-amber-800 border border-amber-250 px-1.5 py-0.5 rounded text-[8px] font-black tracking-wide">DEMO MODE</span>
                                </div>
                                
                                {renderOrderTimeline(order)}

                                {order.isOutForDelivery && order.deliveryLocation && order.deliveryLocation.lat && order.deliveryLocation.lng && (
                                  <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${order.deliveryLocation.lat},${order.deliveryLocation.lng}`}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[9px] text-blue-600 hover:underline font-bold flex items-center gap-1 mt-0.5"
                                  >
                                    <svg className="w-3 h-3 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                    </svg>
                                    <span>View Location</span>
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              {order.isCancelled ? (
                                <div className="flex flex-col gap-1 items-center">
                                  <span className="text-red-500 font-bold text-[9px] uppercase animate-pulse mb-1">
                                    Cancelled ({order.refundStatus || 'No Refund'})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/cancellation-receipt/${order._id}`)}
                                    className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-[9px] uppercase px-2 py-1 rounded transition-all active:scale-95 cursor-pointer text-center"
                                  >
                                    📄 Receipt
                                  </button>
                                </div>
                              ) : remainingMs > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => cancelOrderHandler(order)}
                                  className="bg-red-50 hover:bg-red-100 text-red-655 border border-red-200 font-bold text-[9px] uppercase px-2 py-1 rounded transition-all active:scale-95 cursor-pointer"
                                  title="Cancel order during 10-second grace period for a FULL refund"
                                >
                                  ❌ Cancel (00:{Math.ceil(remainingMs / 1000).toString().padStart(2, '0')})
                                </button>
                              ) : order.isPaid ? (
                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/ebill/${order._id}`)}
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 font-bold text-[9px] uppercase px-2 py-1 rounded transition-all active:scale-95 cursor-pointer"
                                  >
                                    {order.isDelivered ? '📄 Download E-Bill (Demo Invoice)' : '📄 View Status'}
                                  </button>
                                  {!order.isDelivered && (
                                    <button
                                      type="button"
                                      onClick={() => cancelOrderHandler(order)}
                                      className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-[9px] uppercase px-2 py-1 rounded transition-all active:scale-95 cursor-pointer"
                                      title={order.isOutForDelivery ? "Cancel order (NO REFUND)" : "Cancel order"}
                                    >
                                      ❌ Cancel Order
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/payment/${order._id}`)}
                                  className="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-bold text-[9px] uppercase px-2 py-1 rounded transition-all active:scale-95 cursor-pointer"
                                >
                                  💳 Pay Now
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* DEVELOPER FEEDBACK MODAL */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-300">
          <div className="bg-white/95 backdrop-blur-md border border-purple-200 shadow-2xl rounded-2xl max-w-md w-full overflow-hidden p-6 relative space-y-4 animate-in fade-in zoom-in duration-200 text-left">
            {/* Top Accent Strip */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600"></div>

            <div className="text-center space-y-1">
              <span className="text-3xl">👨💻</span>
              <h3 className="text-lg font-bold text-gray-900 tracking-tight uppercase">Developer Insights Feedback</h3>
              <p className="text-xs text-gray-500 font-semibold">We appreciate your feedback to make this simulation system better!</p>
            </div>

            {feedbackSubmitted ? (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center space-y-3 font-semibold text-purple-950">
                <span className="text-2xl">🎉</span>
                <p className="text-xs font-bold text-purple-900 uppercase">Feedback Received Successfully!</p>
                <p className="text-[11px] text-purple-750 font-normal">Thank you for sharing your thoughts on Divyan's portfolio project. Your insight has been mocked and logged to the developer console.</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowFeedbackModal(false);
                    setFeedbackSubmitted(false);
                    setFeedbackReason('');
                    navigate('/profile', { replace: true });
                  }}
                  className="w-full bg-purple-600 hover:bg-purple-750 text-white text-xs uppercase tracking-wider py-2 rounded-lg font-bold transition-all active:scale-95 cursor-pointer"
                >
                  Close Feedback Window
                </button>
              </div>
            ) : (
              <div className="space-y-4 font-semibold text-gray-700">
                <div className="space-y-1">
                  <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider">Dislike Reason (Optional)</label>
                  <textarea
                    value={feedbackReason}
                    onChange={(e) => setFeedbackReason(e.target.value)}
                    placeholder="E.g., timing interval, layout styling, or missing simulation states..."
                    className="w-full border border-gray-300 p-2.5 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-purple-500 outline-none h-24 resize-none text-gray-800"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFeedbackModal(false);
                      setFeedbackReason('');
                      navigate('/profile', { replace: true });
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs uppercase tracking-wider py-2 rounded-lg font-bold transition-all active:scale-95 cursor-pointer border border-gray-250"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (feedbackOrderId && feedbackSignature) {
                        try {
                          await axios.get(`/api/orders/${feedbackOrderId}/email-action`, {
                            params: {
                              status: 'feedback',
                              type: 'dislike',
                              reason: feedbackReason,
                              signature: feedbackSignature
                            }
                          });
                          setFeedbackSubmitted(true);
                        } catch (err) {
                          alert(err.response?.data?.message || 'Error submitting dislike feedback');
                        }
                      } else {
                        console.log('[Developer Insight Feedback] Dislike Reason Received (Fallback):', feedbackReason || '(Not Specified)');
                        setFeedbackSubmitted(true);
                      }
                    }}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs uppercase tracking-wider py-2 rounded-lg font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    Submit Feedback
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;