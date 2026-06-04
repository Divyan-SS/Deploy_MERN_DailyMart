// frontend/src/pages/Cart.jsx

import React, { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CartContext } from '../context/CartContext';
import { ToastContext } from '../context/ToastContext';

const Cart = () => {
  const { showConfirm } = useContext(ToastContext);
  const {
    activeRoutine,
    cartItems,
    visibleCartItems,
    selectedItems,
    toggleItemSelection,
    addToCart,         
    addToRoutine,      
    removeFromContext,
    saveProductEdit,
    clearVisibleWorkspaceCartOnly
  } = useContext(CartContext);

  const navigate = useNavigate();
  const [globalCatalog, setGlobalCatalog] = useState([]);
  const [openCartDropdownKey, setOpenCartDropdownKey] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.cart-dropdown-container')) {
        setOpenCartDropdownKey(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // CONCURRENT DYNAMIC INVENTORY FETCH & AUTO-POLLING LOOP
  useEffect(() => {
    const fetchMasterCatalogRef = async () => {
      try {
        const { data } = await axios.get('/api/products');
        setGlobalCatalog(data);
      } catch (err) {
        console.error('Variant rescue mapping synchronization bridge failed:', err.message);
      }
    };
    
    fetchMasterCatalogRef();
    const concurrencyInterval = setInterval(fetchMasterCatalogRef, 5500);
    return () => clearInterval(concurrencyInterval);
  }, []);

  const buildProductPayload = (item) => {
    const originalMasterProduct = globalCatalog.find(p => p._id === item.product);
    
    return {
      ...item,
      _id: item.product,
      brand: originalMasterProduct?.brand || item.brand || '', // Extract brand meta properties cleanly
      variants: originalMasterProduct?.variants || item.rawVariants || [
        {
          name: item.variantName,
          price: item.price,
          countInStock: item.countInStock
        }
      ]
    };
  };

  const handleVariantDropdownChange = async (item, newVariantName) => {
    if (item.variantName === newVariantName) return;

    const isAlreadyPresentInWorkspace = visibleCartItems.some(
      (x) => x.product === item.product && x.variantName === newVariantName
    );

    if (isAlreadyPresentInWorkspace) {
      alert(`This option is already in your cart list!`);
      return;
    }

    const productData = buildProductPayload(item);
    const targetVariant = productData.variants.find(v => v.name === newVariantName);
    
    if (!targetVariant) return;

    if (targetVariant.countInStock === 0) {
      alert("no stock");
      return;
    }

    if (activeRoutine) {
      try {
        await saveProductEdit(
          activeRoutine,
          item,
          productData,
          newVariantName,
          1,
          activeRoutine,
          true
        );
      } catch (err) {
        console.error(err);
      }
    } else {
      removeFromContext(item.product, item.variantName, 'normal');
      addToCart(productData, newVariantName, 1);
    }
  };

  const handleQuantityStepButton = (item, action) => {
    const change = action === 'increment' ? 1 : -1;
    const finalQty = item.qty + change;
    if (finalQty < 1) return;

    const productData = buildProductPayload(item);
    const activeVariantSpecs = productData.variants?.find(v => v.name === item.variantName) || item;

    const variantTotalAllocated = cartItems
      .filter(x => x.product === item.product && x.variantName === item.variantName)
      .reduce((acc, x) => acc + x.qty, 0);

    if (action === 'increment' && variantTotalAllocated + 1 > activeVariantSpecs.countInStock) {
      alert(`Stock limit reached. Only ${activeVariantSpecs.countInStock} total units available.`);
      return;
    }

    if (activeRoutine) {
      addToRoutine(productData, item.variantName, finalQty, activeRoutine);
    } else {
      addToCart(productData, item.variantName, finalQty);
    }
  };

  const handleManualKeyboardQuantityInput = (item, eventInputString) => {
    const standardizedDigits = eventInputString.replace(/[^0-9]/g, '');
    if (standardizedDigits === '') return;

    let computedValue = Number(standardizedDigits);
    if (computedValue < 1) computedValue = 1;

    const productData = buildProductPayload(item);
    const activeVariantSpecs = productData.variants?.find(v => v.name === item.variantName) || item;

    const variantTotalAllocatedOutsideThisContext = cartItems
      .filter(x => x.product === item.product && x.variantName === item.variantName && !(x.routineName === item.routineName))
      .reduce((acc, x) => acc + x.qty, 0);

    if (variantTotalAllocatedOutsideThisContext + computedValue > activeVariantSpecs.countInStock) {
      computedValue = Math.max(1, activeVariantSpecs.countInStock - variantTotalAllocatedOutsideThisContext);
      alert(`Multi-User Allocation Limit Enforced: Adjusted input to max viable ceiling (${computedValue} units).`);
    }

    if (activeRoutine) {
      addToRoutine(productData, item.variantName, computedValue, activeRoutine);
    } else {
      addToCart(productData, item.variantName, computedValue);
    }
  };

  const handleManualInputBlurFallback = (item) => {
    if (!item.qty || item.qty < 1) {
      const productData = buildProductPayload(item);
      if (activeRoutine) {
        addToRoutine(productData, item.variantName, 1, activeRoutine);
      } else {
        addToCart(productData, item.variantName, 1);
      }
    }
  };

  const handleClearCartWorkspace = async () => {
    const message = activeRoutine 
      ? `Clear all products from the "${activeRoutine}" routine workspace?`
      : 'Are you sure you want to clear all standalone items from your shopping cart?';

    const isConfirmed = await showConfirm(message);
    if (!isConfirmed) return;

    if (activeRoutine) {
      clearVisibleWorkspaceCartOnly(activeRoutine);
    } else {
      clearVisibleWorkspaceCartOnly(null);
    }
  };

  const displayedCartItems = visibleCartItems.filter((item) => {
    const productData = buildProductPayload(item);
    const activeVariantSpecs = productData.variants?.find(v => v.name === item.variantName) || item;
    return activeVariantSpecs.countInStock > 0;
  });

  const totalPrice = displayedCartItems.reduce((acc, item) => acc + item.price * item.qty, 0);
  const totalQty = displayedCartItems.reduce((acc, item) => acc + item.qty, 0);

  const handleSecureCheckoutHandler = () => {
    if (displayedCartItems.length === 0) {
      alert('Your cart is empty.');
      return;
    }
    navigate('/checkout');
  };

  const calculateInlineOfferPercentage = (current, original) => {
    if (!original || original <= current) return 0;
    return Math.round(((original - current) / original) * 100);
  };

  return (
    <div className="max-w-[1200px] mx-auto py-8 pb-24 md:pb-8 px-4 font-sans text-gray-800">
      <style>{`
        @keyframes fadeInRow { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { transform: scale(0.98); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-row { animation: fadeInRow 0.45s ease-out forwards; }
        .animate-pop { animation: popIn 0.35s ease-out forwards; }
      `}</style>

      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-gray-200 pb-3 animate-pop">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{activeRoutine ? '📁' : '🛒'}</span>
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight">
            {activeRoutine ? `${activeRoutine} Routine Cart` : 'Your Shopping Cart'}
          </h1>
        </div>
        {activeRoutine && (
          <span className="bg-blue-100 text-blue-700 border border-blue-300 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Routine Checkout Workspace
          </span>
        )}
      </div>

      {displayedCartItems.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-2xl max-w-2xl mx-auto p-6 shadow-xs animate-pop">
          <p className="text-gray-700 text-sm font-bold">
            {activeRoutine ? `No products selected from "${activeRoutine}" routine` : 'Your shopping cart is currently empty'}
          </p>
          <Link to="/browse" className="inline-block mt-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs uppercase tracking-widest px-6 py-2.5 rounded-lg font-bold transition-all hover:scale-105 active:scale-95 shadow-2xs">
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
            {/* Left Column: Cart Items List */}
            <div className="lg:col-span-8 space-y-4">
              {/* Header Labels for Grid View */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2 text-center">
                <div className="col-span-4 text-left">Product Details</div>
                <div className="col-span-2">Size / Variant</div>
                <div className="col-span-2">Price</div>
                <div className="col-span-2">Quantity</div>
                <div className="col-span-2 text-right pr-4">Actions</div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {displayedCartItems.map((item, index) => {
                  const currentContext = item.routineName || 'normal';
                  const itemKey = `${item.product}-${item.variantName}-${currentContext}-${item.userId || 'guest'}`;
                  const isSelected = selectedItems.includes(itemKey);

                  const liveProductContextRef = buildProductPayload(item);
                  const dropdownVariantsList = liveProductContextRef.variants;

                  const activeVariantSpecs = dropdownVariantsList.find(v => v.name === item.variantName) || item;
                  const originalPriceValue = Number(activeVariantSpecs.originalPrice || item.originalPrice || activeVariantSpecs.price || item.price);
                  const sellingPriceValue = Number(activeVariantSpecs.price || item.price);
                  
                  const currentDiscountPct = calculateInlineOfferPercentage(sellingPriceValue, originalPriceValue);
                  const hasDiscount = currentDiscountPct > 0;

                  const variantTotalAllocated = cartItems
                    .filter(itemX => itemX.product === item.product && itemX.variantName === item.variantName)
                    .reduce((acc, itemX) => acc + itemX.qty, 0);

                  const currentRemainingLiveStock = Math.max(0, activeVariantSpecs.countInStock - variantTotalAllocated);

                  return (
                    <div
                      key={itemKey}
                      style={{ animationDelay: `${index * 40}ms` }}
                      className="bg-white border border-gray-300 rounded-xl p-3 md:p-4 shadow-2xs animate-row hover:shadow-sm transition-all duration-200"
                    >
                      {/* MOBILE VIEW COMPACT CARD (md:hidden) - SINGLE ROW HORIZONTAL LAYOUT */}
                      <div className="md:hidden flex items-center justify-between gap-2.5 py-1">
                        {/* Left: Product Image */}
                        <div className="w-12 h-12 flex-shrink-0 bg-white border border-gray-150 flex items-center justify-center p-1 rounded-lg relative">
                          <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" />
                          {hasDiscount && (
                            <span className="absolute -top-1.5 -left-1.5 bg-red-600 text-white font-black text-[7px] px-1 rounded-sm shadow-xs uppercase tracking-tight">
                              {currentDiscountPct}%
                            </span>
                          )}
                        </div>

                        {/* Middle-Left: Details */}
                        <div className="flex-grow min-w-0 text-left">
                          {liveProductContextRef.brand && (
                            <span className="block font-extrabold text-[8px] text-emerald-600 uppercase tracking-wider leading-none mb-0.5 truncate">
                              {liveProductContextRef.brand}
                            </span>
                          )}
                          <h3 className="text-gray-900 text-[11px] font-black truncate leading-tight">{item.name}</h3>
                          
                          <div className="relative inline-block mt-0.5 cart-dropdown-container">
                            <button
                              type="button"
                              onClick={() => setOpenCartDropdownKey(openCartDropdownKey === itemKey ? null : itemKey)}
                              className="py-0.5 pl-1.5 pr-3.5 text-[9px] font-extrabold text-gray-750 border border-gray-300 rounded bg-white flex items-center justify-between cursor-pointer focus:border-emerald-500 transition-colors gap-0.5 outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                            >
                              <span>{item.variantName}</span>
                              <span className="text-[6px] text-gray-400 select-none">▼</span>
                            </button>

                            {openCartDropdownKey === itemKey && (
                              <div className="absolute left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg z-30 max-h-36 overflow-y-auto custom-scrollbar border-t-2 border-t-emerald-600 min-w-[70px] overflow-hidden">
                                {dropdownVariantsList.map((v) => (
                                  <button
                                    key={v.name}
                                    type="button"
                                    onClick={() => {
                                      handleVariantDropdownChange(item, v.name);
                                      setOpenCartDropdownKey(null);
                                    }}
                                    className={`w-full text-center px-1.5 py-1 text-[9px] transition-colors hover:bg-emerald-50 hover:text-emerald-700 block outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                                      item.variantName === v.name
                                        ? 'text-emerald-600 bg-emerald-50/50 font-black'
                                        : 'text-gray-700 font-bold'
                                    }`}
                                  >
                                    {v.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Middle-Right: Compact Stepper */}
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleQuantityStepButton(item, 'decrement')}
                            className="w-5 h-5 rounded border border-gray-300 bg-gray-150 text-[10px] font-black flex items-center justify-center cursor-pointer hover:bg-gray-200 active:scale-95 select-none"
                          >
                            -
                          </button>
                          <input
                            type="text"
                            value={item.qty}
                            onChange={(e) => handleManualKeyboardQuantityInput(item, e.target.value)}
                            onBlur={() => handleManualInputBlurFallback(item)}
                            className="w-7 h-5 border border-gray-300 rounded text-center text-[9px] font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityStepButton(item, 'increment')}
                            disabled={currentRemainingLiveStock === 0}
                            className="w-5 h-5 rounded border border-gray-300 bg-gray-150 text-[10px] font-black flex items-center justify-center cursor-pointer hover:bg-gray-200 active:scale-95 disabled:opacity-35"
                          >
                            +
                          </button>
                        </div>

                        {/* Right: Cost & Delete Action */}
                        <div className="text-right flex-shrink-0 flex flex-col items-end gap-1.5 pl-1">
                          <span className="font-extrabold text-[11px] text-green-700 leading-none">₹{sellingPriceValue.toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => removeFromContext(item.product, item.variantName, currentContext)}
                            className="text-[9px] uppercase font-black text-red-500 hover:text-red-700 bg-red-50/50 hover:bg-red-100/60 p-1 rounded transition-colors"
                            title="Remove Item"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* DESKTOP VIEW GRID ROW (hidden md:grid) */}
                      <div className="hidden md:grid grid-cols-12 items-center gap-4 w-full">
                        {/* SECTOR 1: DETAILS WITHOUT CHECKBOX */}
                        <div className="col-span-12 md:col-span-4 flex items-center gap-4 w-full min-w-0">
                          <div className="w-16 h-16 flex-shrink-0 bg-white border border-gray-200 flex items-center justify-center p-1 rounded-lg relative">
                            <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" />
                            {hasDiscount && (
                              <span className="absolute -top-1.5 -left-1.5 bg-red-600 text-white font-black text-[8px] px-1 rounded-sm shadow-xs uppercase tracking-tight">
                                {currentDiscountPct}% Off
                              </span>
                            )}
                          </div>
                          <div className="truncate text-left min-w-0 flex-grow">
                            {liveProductContextRef.brand && (
                              <span className="block font-semibold text-[11px] text-emerald-600 uppercase tracking-wider mb-0.5">
                                {liveProductContextRef.brand}
                              </span>
                            )}
                            <h3 className="text-gray-900 text-sm font-bold truncate">{item.name}</h3>
                            <p className={`text-[10px] ${currentRemainingLiveStock === 0 ? 'text-amber-600 font-extrabold' : 'text-gray-500 font-semibold'} uppercase mt-0.5 tracking-wide`}>
                              {currentRemainingLiveStock === 0 ? '⚠️ No Stock' : `Stock: ${currentRemainingLiveStock}`}
                            </p>
                          </div>
                        </div>

                        {/* SECTOR 2: IN-LINE VARIANT SELECTOR */}
                        <div className="col-span-6 md:col-span-2 w-full cart-dropdown-container">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenCartDropdownKey(openCartDropdownKey === itemKey ? null : itemKey)}
                              className="w-full py-1.5 px-3 text-xs font-bold text-gray-750 border border-gray-300 rounded-lg bg-white flex items-center justify-between cursor-pointer focus:border-emerald-500 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                            >
                              <span>Size: {item.variantName}</span>
                              <span className="text-[9px] text-gray-400 select-none">▼</span>
                            </button>

                            {openCartDropdownKey === itemKey && (
                              <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-36 overflow-y-auto custom-scrollbar border-t-2 border-t-emerald-600 overflow-hidden">
                                {dropdownVariantsList.map((v) => (
                                  <button
                                    key={v.name}
                                    type="button"
                                    onClick={() => {
                                      handleVariantDropdownChange(item, v.name);
                                      setOpenCartDropdownKey(null);
                                    }}
                                    className={`w-full text-center px-3 py-1.5 text-xs transition-colors hover:bg-emerald-50 hover:text-emerald-700 block outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                                      item.variantName === v.name
                                        ? 'text-emerald-600 bg-emerald-50/50 font-black'
                                        : 'text-gray-700 font-bold'
                                    }`}
                                  >
                                    {v.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* SECTOR 3: COSTS */}
                        <div className="col-span-6 md:col-span-2 text-center w-full bg-gray-50 md:bg-transparent py-2 md:py-0 rounded-lg">
                          <span className="text-green-700 font-black text-sm md:text-base">₹{sellingPriceValue.toFixed(2)}</span>
                        </div>

                        {/* SECTOR 4: STEPPERS */}
                        <div className="col-span-6 md:col-span-2 flex items-center justify-center gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => handleQuantityStepButton(item, 'decrement')}
                            className="w-7 h-7 rounded-md border border-gray-300 bg-gray-100 text-sm font-black flex items-center justify-center cursor-pointer hover:bg-gray-200 active:scale-95 transition-all select-none"
                          >
                            -
                          </button>
                          <input
                            type="text"
                            value={item.qty}
                            onChange={(e) => handleManualKeyboardQuantityInput(item, e.target.value)}
                            onBlur={() => handleManualInputBlurFallback(item)}
                            className="w-10 h-7 border border-gray-300 rounded-md text-center text-xs font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityStepButton(item, 'increment')}
                            disabled={currentRemainingLiveStock === 0}
                            className="w-7 h-7 rounded-md border border-gray-300 bg-gray-100 text-sm font-black flex items-center justify-center cursor-pointer hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>

                        {/* SECTOR 5: REMOVE */}
                        <div className="col-span-6 md:col-span-2 flex justify-end w-full">
                          <button
                            type="button"
                            onClick={() => removeFromContext(item.product, item.variantName, currentContext)}
                            className="text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 bg-red-50/50 hover:bg-red-50 transition-colors cursor-pointer w-full md:w-auto text-center"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Desktop Sticky Summary Sidebar Card */}
            <div className="hidden lg:block lg:col-span-4 sticky top-24 bg-white border border-gray-300 rounded-xl p-5 shadow-xs space-y-4 text-left">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">📋 Workspace Summary</h3>
              <div className="space-y-2 text-xs font-semibold text-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-500 uppercase tracking-wide">Total Items:</span>
                  <span className="text-gray-950 font-bold">{totalQty}</span>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-2 text-green-700 font-bold text-sm">
                  <span>💰 Subtotal</span>
                  <span className="text-base font-black">₹{totalPrice.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button type="button" onClick={handleSecureCheckoutHandler} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs uppercase tracking-widest py-3 rounded-lg font-bold shadow-xs transition-all active:scale-95 cursor-pointer text-center">
                  Proceed to Pay →
                </button>
                <button type="button" onClick={() => navigate('/browse')} className="w-full text-gray-700 bg-white border border-gray-300 text-[10px] uppercase tracking-wider py-2.5 rounded-lg font-extrabold hover:bg-gray-50 transition-colors cursor-pointer text-center">
                  + Add More Products
                </button>
                <button type="button" onClick={handleClearCartWorkspace} className="w-full text-gray-500 bg-white border border-gray-200 text-[10px] uppercase tracking-wider py-2.5 rounded-lg font-extrabold hover:bg-red-50 hover:text-red-650 transition-colors cursor-pointer text-center">
                  Clear Cart Workspace
                </button>
              </div>
            </div>
          </div>

          {/* FLOATING/STICKY BOTTOM BAR FOR MOBILE */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-45 flex items-center justify-between shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
            <div className="text-left leading-none">
              <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider block">Total Amount</span>
              <span className="text-xs font-black text-emerald-700 mt-1 block">₹{totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button 
                type="button" 
                onClick={() => navigate('/browse')} 
                className="text-gray-700 bg-white border border-gray-300 text-[9px] uppercase tracking-wider font-extrabold px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                + Add
              </button>
              <button 
                type="button" 
                onClick={handleClearCartWorkspace} 
                className="text-red-650 bg-red-50 border border-red-150 text-[9px] uppercase tracking-wider font-extrabold px-2 py-1.5 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
              >
                Clear
              </button>
              <button 
                type="button" 
                onClick={handleSecureCheckoutHandler} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] uppercase tracking-widest px-4 py-2 rounded-lg font-black shadow-sm cursor-pointer transition-all active:scale-95"
              >
                Proceed to Pay →
              </button>
            </div>
          </div>

          {/* FLOATING/STICKY BOTTOM BAR FOR TABLET */}
          <div className="hidden md:flex lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-45 items-center justify-between shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-6">
            <div className="text-left">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">Total Amount</span>
              <span className="text-sm font-black text-emerald-700 mt-1 block">₹{totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => navigate('/browse')} className="text-gray-700 bg-white border border-gray-300 text-[10px] uppercase tracking-wider font-extrabold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">+ Add More Products</button>
              <button type="button" onClick={handleClearCartWorkspace} className="text-red-650 bg-red-50 border border-red-250 text-[10px] uppercase tracking-wider font-extrabold px-4 py-2 rounded-lg hover:bg-red-100 transition-colors cursor-pointer">Clear Workspace</button>
              <button type="button" onClick={handleSecureCheckoutHandler} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] uppercase tracking-widest px-6 py-2.5 rounded-lg font-black shadow-sm cursor-pointer transition-all active:scale-95">Proceed to Pay →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;