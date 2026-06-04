// frontend/src/components/ProductCard.jsx

import React, { useState, useContext, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CartContext } from '../context/CartContext';
import useOutsideClick from '../hooks/useOutsideClick';
import QuantityStepper from './QuantityStepper';

const ProductCard = ({ product, onOpenRoutineModal }) => {
  const { cartItems, activeRoutine, addToCart, addToRoutine } = useContext(CartContext);

  const [selectedVariantName, setSelectedVariantName] = useState(
    product.variants && product.variants.length > 0 ? product.variants[0].name : ''
  );

  const [showDesktopDropdown, setShowDesktopDropdown] = useState(false);
  const [showMobileDropdown, setShowMobileDropdown] = useState(false);

  const desktopDropdownRef = useRef(null);
  const mobileDropdownRef = useRef(null);

  useOutsideClick(desktopDropdownRef, () => setShowDesktopDropdown(false));
  useOutsideClick(mobileDropdownRef, (event) => {
    if (!event.target.closest('.mobile-variant-portal')) {
      setShowMobileDropdown(false);
    }
  });

  const activeVariant = product.variants?.find((v) => v.name === selectedVariantName) || {
    price: 0,
    originalPrice: 0,
    countInStock: 0,
  };

  // DYNAMIC LOOKUP ENGINE: Intercept reference rows depending on the global active workspace mode
  const currentWorkspaceItemRef = cartItems.find((item) => {
    if (activeRoutine) {
      return (
        item.product === product._id &&
        item.variantName === selectedVariantName &&
        item.routineName === activeRoutine
      );
    } else {
      return (
        item.product === product._id &&
        item.variantName === selectedVariantName &&
        !item.routineName
      );
    }
  });

  // Track total quantity of this specific variant across all contexts for correct stock calculation
  const totalVariantQtyInCart = cartItems
    .filter((item) => item.product === product._id && item.variantName === selectedVariantName)
    .reduce((acc, item) => acc + item.qty, 0);

  // Compute live real-time remaining stock values cleanly
  const remainingLiveStock = Math.max(0, activeVariant.countInStock - totalVariantQtyInCart);
  const currentSelectedQty = currentWorkspaceItemRef ? currentWorkspaceItemRef.qty : 0;

  const handleQtyAdjustment = (targetQty) => {
    if (targetQty < 0) return;

    const packedProduct = {
      ...product,
      variants: product.variants || []
    };

    if (activeRoutine) {
      addToRoutine(packedProduct, selectedVariantName, targetQty, activeRoutine);
    } else {
      addToCart(packedProduct, selectedVariantName, targetQty);
    }
  };

  const handleWorkspaceQtyIncrement = () => {
    if (remainingLiveStock === 0) return;
    handleQtyAdjustment(currentSelectedQty + 1);
  };

  const handleWorkspaceQtyDecrement = () => {
    if (currentSelectedQty === 0) return;
    handleQtyAdjustment(currentSelectedQty - 1);
  };

  const handlePureAddToCart = () => {
    if (remainingLiveStock === 0) return;
    
    const normalCartItem = cartItems.find(
      (item) => item.product === product._id && item.variantName === selectedVariantName && !item.routineName
    );
    const currentNormalQty = normalCartItem ? normalCartItem.qty : 0;
    
    const packedProduct = {
      ...product,
      variants: product.variants || []
    };

    addToCart(packedProduct, selectedVariantName, currentNormalQty + 1);
  };

  const calculateDiscount = (current, original) => {
    if (!original || original <= current) return 0;
    return Math.round(((original - current) / original) * 100);
  };

  const discountPercentage = calculateDiscount(activeVariant.price, activeVariant.originalPrice);

  const getVariantHint = () => {
    if (!product.variants || product.variants.length <= 1) return "";
    
    // Check first variant name to guess type (sizes or general variant/color)
    const firstVarName = product.variants[0].name.toLowerCase();
    
    // Pattern for weights, sizes, liquid measures, counts, or size letters
    if (/\d/.test(firstVarName) || firstVarName.includes('g') || firstVarName.includes('ml') || firstVarName.includes('kg') || firstVarName.includes('pack') || firstVarName.includes('pc') || ['s', 'm', 'l', 'xl', 'xxl'].includes(firstVarName)) {
      return "Check other sizes";
    }
    
    // Otherwise general colors / flavors hint
    return "Check other variants/colors";
  };

  return (
    <>
      {/* DESKTOP/TABLET VIEW COMPACT NEAR-SQUARE CARD (hidden md:flex) */}
      <div className="hidden md:flex bg-white rounded-xl border border-gray-300 flex-col font-sans text-gray-800 relative p-3 justify-between hover:shadow-md transition-shadow text-left h-[335px] w-full">
        
        {/* IMAGE CONTAINER */}
        <div className="relative h-[45%] bg-white p-2 flex items-center justify-center rounded-t-xl flex-shrink-0">
          {discountPercentage > 0 && (
            <span className="absolute top-1 left-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider z-10 leading-none">
              {discountPercentage}% OFF
            </span>
          )}

          {/* Add Routine Folder Button overlayed on top-right */}
          <button
            type="button"
            onClick={() => onOpenRoutineModal(product, selectedVariantName)}
            disabled={activeVariant.countInStock === 0}
            className="hidden absolute top-1 right-1 color-wheel-icon-btn text-gray-700 w-7 h-7 rounded-full flex items-center justify-center shadow-sm text-xs cursor-pointer z-10 disabled:opacity-40 outline-none"
            title="Add to Routine"
          >
            <span className="color-wheel-icon-btn-content">📂</span>
          </button>

          <img
            src={product.image}
            alt={product.name}
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600';
            }}
          />

          {/* Rating overlayed on bottom-right */}
          <div className="absolute bottom-1 right-1 bg-amber-50/90 text-amber-600 px-1.5 py-0.5 rounded text-[9px] font-black flex items-center gap-0.5 shadow-3xs border border-amber-100">
            <span>★</span>
            <span className="text-gray-700 font-bold">
              {product.rating ? product.rating : '4.3'}
            </span>
          </div>
        </div>

        {/* DETAILS SECTION */}
        <div className="flex flex-col h-[52%] justify-between mt-2 min-h-0">
          {/* Brand & Name */}
          <div className="leading-none flex-shrink-0">
            <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider truncate">
              {product.brand || 'Store Brand'}
            </span>
            <h3 className="text-gray-900 text-xs font-bold truncate mt-0.5" title={product.name}>
              {product.name}
            </h3>
          </div>

          {/* Variant Selector */}
          <div className="my-1 flex-shrink-0" ref={desktopDropdownRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDesktopDropdown(!showDesktopDropdown)}
                className="w-full py-1 px-2.5 text-[10px] sm:text-xs text-center border border-gray-300 rounded bg-white font-bold text-gray-750 flex items-center justify-between cursor-pointer focus:border-emerald-500 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
              >
                <span className="flex-grow text-center truncate pr-1">{selectedVariantName}</span>
                <span className="text-[8px] text-gray-400 select-none">▼</span>
              </button>
              
              {showDesktopDropdown && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto custom-scrollbar border-t-2 border-t-emerald-600 overflow-hidden">
                  {product.variants?.map((v) => {
                    const hasDiscount = v.originalPrice && v.originalPrice > v.price;
                    const discountPercentageForV = hasDiscount ? Math.round(((v.originalPrice - v.price) / v.originalPrice) * 100) : 0;
                    const totalVarQtyInCartForV = cartItems
                      .filter((item) => item.product === product._id && item.variantName === v.name)
                      .reduce((acc, item) => acc + item.qty, 0);
                    const remainingStockForVar = Math.max(0, v.countInStock - totalVarQtyInCartForV);
                    return (
                      <button
                        key={v._id || v.name}
                        type="button"
                        onClick={() => {
                          setSelectedVariantName(v.name);
                          setShowDesktopDropdown(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 text-[11px] transition-colors hover:bg-emerald-50 hover:text-emerald-700 outline-none border-b border-gray-150 last:border-b-0 flex flex-col gap-0.5 ${
                          selectedVariantName === v.name ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className={`font-bold ${selectedVariantName === v.name ? 'text-emerald-600 font-extrabold' : 'text-gray-800'}`}>{v.name}</span>
                          {v.countInStock === 0 ? (
                            <span className="text-[7px] text-red-500 font-extrabold bg-red-50 px-1 rounded uppercase tracking-wider">Out</span>
                          ) : (
                            <span className="text-[7px] text-gray-500 font-bold uppercase tracking-wider">
                              {remainingStockForVar === 0 ? 'Maxed' : `Stock: ${remainingStockForVar}`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px]">
                          <span className="text-green-700 font-bold">₹{Number(v.price).toFixed(2)}</span>
                          {hasDiscount && (
                            <>
                              <span className="text-gray-400 line-through">₹{Number(v.originalPrice).toFixed(2)}</span>
                              <span className="text-[8px] text-red-500 font-black bg-red-50 px-1 rounded">-{discountPercentageForV}%</span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Stock Status text */}
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider my-0.5 leading-none">
            {activeVariant.countInStock === 0 ? (
              <span className="text-red-500 font-black">No Stock</span>
            ) : remainingLiveStock === 0 ? (
              <span className="text-amber-600 font-black">Maxed</span>
            ) : (
              <span>Stock: {remainingLiveStock}</span>
            )}
          </div>

          {/* Price and Actions footer row */}
          <div className="flex items-center justify-between gap-1.5 pt-1.5 pb-1 border-t border-gray-100">
            {/* Prices */}
            <div className="flex flex-col items-start leading-none">
              {discountPercentage > 0 && (
                <span className="text-gray-400 line-through text-[9px] sm:text-[10px]">
                  ₹{Number(activeVariant.originalPrice).toFixed(2)}
                </span>
              )}
              <span className="text-green-700 text-xs sm:text-sm font-black">
                ₹{Number(activeVariant.price).toFixed(2)}
              </span>
            </div>

            {/* Add / Qty Controls */}
            <div className="flex-shrink-0">
              {currentSelectedQty > 0 ? (
                <QuantityStepper
                  qty={currentSelectedQty}
                  onIncrement={handleWorkspaceQtyIncrement}
                  onDecrement={handleWorkspaceQtyDecrement}
                  isIncrementDisabled={remainingLiveStock === 0}
                  className="h-7 w-20 sm:w-24 shadow-3xs"
                  btnClassName="w-6 sm:w-7 text-xs"
                  valClassName="text-[10px] sm:text-xs"
                />
              ) : (
                <button
                  type="button"
                  onClick={activeRoutine ? handleWorkspaceQtyIncrement : handlePureAddToCart}
                  disabled={activeVariant.countInStock === 0 || remainingLiveStock === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] sm:text-[10px] px-2.5 py-1.5 rounded font-black uppercase tracking-wider disabled:bg-gray-200 disabled:text-gray-400 cursor-pointer leading-none flex items-center justify-center h-7 shadow-3xs"
                >
                  {activeVariant.countInStock > 0 
                    ? (remainingLiveStock > 0 ? 'ADD' : 'MAX')
                    : 'OUT'
                  }
                </button>
              )}
            </div>
          </div>

          {/* Add Routine or Buy Outside button */}
          <div className="pt-1.5 border-t border-gray-100 flex-shrink-0">
            {activeRoutine ? (
              <button
                type="button"
                onClick={handlePureAddToCart}
                disabled={remainingLiveStock === 0}
                className="w-full bg-gray-950 hover:bg-black text-white text-[9px] py-1 rounded-lg font-bold uppercase tracking-wider disabled:opacity-40 cursor-pointer text-center leading-none flex items-center justify-center h-7"
              >
                🛒 Buy Outside Routine
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenRoutineModal(product, selectedVariantName)}
                disabled={activeVariant.countInStock === 0}
                className="w-full color-wheel-btn text-[9px] py-1 rounded-lg font-bold uppercase tracking-wider disabled:opacity-40 transition-all shadow-3xs cursor-pointer text-center leading-none flex items-center justify-center h-7"
              >
                <span className="color-wheel-btn-content">📂 Add Routine</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE VIEW COMPACT SQUARE CARD (md:hidden) */}
      <div className="md:hidden bg-white rounded-xl border border-gray-300 flex flex-col aspect-square font-sans text-gray-800 relative p-2 text-left justify-between hover:shadow-sm transition-shadow w-full">
        
        {/* IMAGE AREA */}
        <div className="relative h-[38%] w-full bg-white flex items-center justify-center p-1.5 flex-shrink-0 animate-fade rounded-t-xl">
          {discountPercentage > 0 && (
            <span className="absolute top-0.5 left-0.5 bg-red-500 text-white text-[8px] px-1 py-0.5 rounded-sm font-bold uppercase tracking-wider z-10 leading-none">
              {discountPercentage}% OFF
            </span>
          )}

          {/* Add Routine Folder Button overlayed on top-right */}
          <button
            type="button"
            onClick={() => onOpenRoutineModal(product, selectedVariantName)}
            disabled={activeVariant.countInStock === 0}
            className="hidden absolute top-0.5 right-0.5 color-wheel-icon-btn text-gray-700 w-6 h-6 rounded-full flex items-center justify-center shadow-md text-[10px] cursor-pointer z-10 disabled:opacity-40"
            title="Add to Routine"
          >
            <span className="color-wheel-icon-btn-content">📂</span>
          </button>

          <img
            src={product.image}
            alt={product.name}
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600';
            }}
          />

          {/* Rating overlayed on bottom-right */}
          <div className="absolute bottom-0.5 right-0.5 bg-amber-50/90 text-amber-600 px-1 py-0.5 rounded text-[8px] font-black flex items-center gap-0.5 shadow-3xs">
            <span>★</span>
            <span className="text-gray-700 font-bold">
              {product.rating ? product.rating : '4.3'}
            </span>
          </div>
        </div>

        {/* DETAILS CONTAINER */}
        <div className="flex flex-col h-[60%] justify-between mt-0.5 min-h-0">
          
          {/* Brand and Name */}
          <div className="leading-none flex-shrink-0">
            <span className="block text-[8px] xs:text-[9px] text-gray-400 font-extrabold uppercase tracking-wider truncate">
              {product.brand || 'Store Brand'}
            </span>
            <h3 className="text-gray-900 text-[10px] xs:text-[11px] font-black truncate mt-0.5" title={product.name}>
              {product.name}
            </h3>
          </div>

          {/* Variant Selector */}
          <div className="my-0.5 flex-shrink-0" ref={mobileDropdownRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMobileDropdown(!showMobileDropdown)}
                className="w-full py-0.5 px-1.5 text-[9px] xs:text-[10px] text-center border border-gray-300 rounded bg-white font-bold text-gray-750 flex items-center justify-between cursor-pointer focus:border-emerald-500 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
              >
                <span className="flex-grow text-center">{selectedVariantName}</span>
                <span className="text-[7px] text-gray-400 select-none">▼</span>
              </button>
              
              {showMobileDropdown && createPortal(
                <div 
                  className="mobile-variant-portal fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 text-left"
                  style={{ zIndex: 9999999 }}
                  onClick={() => setShowMobileDropdown(false)}
                >
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-2xl border-t-4 border-t-emerald-600 border border-gray-200 p-5 shadow-2xl space-y-4 relative w-full max-w-[325px] text-xs animate-fadeIn flex flex-col max-h-[85vh] overflow-y-auto custom-scrollbar"
                  >
                    <div className="flex justify-between items-start pb-2 border-b border-gray-150">
                      <div className="flex gap-2.5 items-center truncate mr-4">
                        <img src={product.image} alt="" className="w-8 h-8 object-contain bg-gray-50 border rounded-md p-0.5 flex-shrink-0" />
                        <div className="truncate">
                          <h3 className="text-xs font-black text-gray-900 truncate">{product.name}</h3>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{product.brand || 'Store Brand'}</p>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setShowMobileDropdown(false)} 
                        className="text-gray-400 hover:text-gray-700 font-black text-xs uppercase cursor-pointer"
                      >
                        Close ×
                      </button>
                    </div>

                    <div className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Choose a Pack Size</div>

                    <div className="space-y-2">
                       {product.variants?.map((v) => {
                         const isSelected = selectedVariantName === v.name;
                         const hasDiscount = v.originalPrice && v.originalPrice > v.price;
                         const discountPercentage = hasDiscount ? Math.round(((v.originalPrice - v.price) / v.originalPrice) * 100) : 0;
                         const totalVarQtyInCart = cartItems
                           .filter((item) => item.product === product._id && item.variantName === v.name)
                           .reduce((acc, item) => acc + item.qty, 0);
                         const remainingStockForVar = Math.max(0, v.countInStock - totalVarQtyInCart);
                         const isOutOfStock = v.countInStock === 0;

                         return (
                           <button 
                             key={v._id || v.name}
                             type="button"
                             disabled={isOutOfStock}
                             onClick={() => {
                               setSelectedVariantName(v.name);
                               setShowMobileDropdown(false);
                             }}
                             className={`w-full p-3 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer text-left ${
                               isOutOfStock 
                                 ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60' 
                                 : isSelected 
                                   ? 'bg-emerald-50/50 border-emerald-500 shadow-xs font-bold' 
                                   : 'bg-white border-gray-200 hover:border-gray-300'
                             }`}
                           >
                             <div className="text-left space-y-1">
                               <span className={`block font-bold text-xs ${isSelected ? 'text-emerald-700 font-extrabold' : 'text-gray-800'}`}>
                                 {v.name}
                               </span>
                               <div className="flex items-center gap-1.5 text-[10px]">
                                 <span className="text-green-700 font-black">₹{Number(v.price).toFixed(2)}</span>
                                 {hasDiscount && (
                                   <>
                                     <span className="text-gray-400 line-through">₹{Number(v.originalPrice).toFixed(2)}</span>
                                     <span className="text-[9px] text-red-500 font-extrabold bg-red-50 px-1 rounded">-{discountPercentage}%</span>
                                  </>
                                 )}
                               </div>
                               <span className={`block text-[8px] font-black uppercase tracking-wider ${isOutOfStock ? 'text-red-500' : 'text-emerald-600'}`}>
                                 {isOutOfStock 
                                   ? 'Out of Stock' 
                                   : remainingStockForVar === 0
                                     ? 'Maxed (0 Left)'
                                     : `Stock Left: ${remainingStockForVar}`}
                               </span>
                             </div>

                             <div className="flex-shrink-0">
                               {isOutOfStock ? (
                                 <span className="text-[9px] font-extrabold text-gray-400 bg-gray-100 border border-gray-250 px-2.5 py-1.5 rounded-lg uppercase">
                                   Out
                                 </span>
                               ) : (
                                 <span
                                   className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg border transition-all inline-block ${
                                     isSelected 
                                       ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs' 
                                       : 'bg-white border-gray-300 text-emerald-600 hover:bg-emerald-50'
                                   }`}
                                 >
                                   {isSelected ? '✓ Selected' : 'Select'}
                                 </span>
                               )}
                             </div>
                           </button>
                         );
                       })}
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </div>
          </div>

          {/* Stock and Price/Actions Row */}
          <div className="space-y-0.5">
            {/* Stock Status text */}
            <div className="text-[8px] xs:text-[9px] uppercase font-bold tracking-wider leading-none">
              {activeVariant.countInStock === 0 ? (
                <div className="space-y-0.5">
                  <span className="text-red-500 font-black block">No Stock</span>
                  {getVariantHint() && (
                    <span className="text-amber-600 text-[7px] xs:text-[8px] font-bold normal-case block leading-none">
                      {getVariantHint()}
                    </span>
                  )}
                </div>
              ) : remainingLiveStock === 0 ? (
                <span className="text-amber-600 font-black">Maxed</span>
              ) : (
                <span className="text-gray-400">Stock: {remainingLiveStock}</span>
              )}
            </div>

            {/* Price and Actions footer row */}
            <div className="flex items-center justify-between gap-1 pt-0.5">
              {/* Prices */}
              <div className="flex flex-col items-start leading-none">
                {discountPercentage > 0 && (
                  <span className="text-gray-400 line-through text-[8px] xs:text-[9px]">
                    ₹{Number(activeVariant.originalPrice).toFixed(2)}
                  </span>
                )}
                <span className="text-green-700 text-[10px] xs:text-[11px] font-black">
                  ₹{Number(activeVariant.price).toFixed(2)}
                </span>
              </div>

              {/* Add / Qty Controls */}
              <div className="flex-shrink-0">
                {currentSelectedQty > 0 ? (
                  <QuantityStepper
                    qty={currentSelectedQty}
                    onIncrement={handleWorkspaceQtyIncrement}
                    onDecrement={handleWorkspaceQtyDecrement}
                    isIncrementDisabled={remainingLiveStock === 0}
                    className="h-5 w-12 xs:w-14"
                    btnClassName="w-4 text-[9px] xs:text-[10px]"
                    valClassName="text-[9px] xs:text-[10px]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={activeRoutine ? handleWorkspaceQtyIncrement : handlePureAddToCart}
                    disabled={activeVariant.countInStock === 0 || remainingLiveStock === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] xs:text-[10px] px-2 py-1 rounded font-black uppercase tracking-wider disabled:bg-gray-200 disabled:text-gray-400 cursor-pointer leading-none flex items-center justify-center"
                  >
                    {activeVariant.countInStock > 0 
                      ? (remainingLiveStock > 0 ? 'ADD' : 'MAX')
                      : 'OUT'
                    }
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Add Routine or Buy Outside button */}
          <div className="pt-1 border-t border-gray-100 flex-shrink-0">
            {activeRoutine ? (
              <button
                type="button"
                onClick={handlePureAddToCart}
                disabled={remainingLiveStock === 0}
                className="w-full bg-gray-950 hover:bg-black text-white text-[7.5px] py-0.5 rounded font-bold uppercase tracking-wider disabled:opacity-40 cursor-pointer text-center leading-none flex items-center justify-center h-[20px]"
              >
                🛒 Buy Outside
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenRoutineModal(product, selectedVariantName)}
                disabled={activeVariant.countInStock === 0}
                className="w-full color-wheel-btn text-[7.5px] py-0.5 rounded font-bold uppercase tracking-wider disabled:opacity-40 transition-all shadow-3xs cursor-pointer text-center leading-none flex items-center justify-center h-[20px]"
              >
                <span className="color-wheel-btn-content">📂 Add Routine</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </>
  );
};

export default ProductCard;