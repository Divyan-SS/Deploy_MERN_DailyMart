// frontend/src/pages/RoutineCartPage.jsx

import React, { useContext, useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { CartContext } from '../context/CartContext';
import { ToastContext } from '../context/ToastContext';

const RoutineCartPage = () => {
  const { routineName } = useParams();
  const { showConfirm, showToast } = useContext(ToastContext);
  const decodedRoutineName = decodeURIComponent(routineName);
  const navigate = useNavigate();

  const {
    cartItems,
    selectedItems,
    routinesList,
    setActiveRoutine,
    toggleItemSelection,
    addToRoutine,
    removeFromContext,
    deleteRoutine,
    checkoutEntireRoutine,
    saveProductEdit,
    discardSelectedProducts
  } = useContext(CartContext);

  const [mounted, setMounted] = useState(false);
  const [liveInventoryState, setLiveInventoryState] = useState([]);
  const [discardedItemKeys, setDiscardedItemKeys] = useState([]);
  const [discardHistory, setDiscardHistory] = useState([]);

  // LOCAL MODAL EDITOR STATES
  const [editingItem, setEditingItem] = useState(null);
  const [editorProductData, setEditorProductData] = useState(null);
  const [editorVariant, setEditorVariant] = useState('');
  const [editorQty, setEditorQty] = useState(1);
  const [editorRoutineTarget, setEditorRoutineTarget] = useState(decodedRoutineName);
  const [modalLoading, setModalLoading] = useState(false);

  const [showEditorVariantDropdown, setShowEditorVariantDropdown] = useState(false);
  const [showEditorRoutineDropdown, setShowEditorRoutineDropdown] = useState(false);

  const editorVariantRef = useRef(null);
  const editorRoutineRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (editorVariantRef.current && !editorVariantRef.current.contains(event.target)) {
        setShowEditorVariantDropdown(false);
      }
      if (editorRoutineRef.current && !editorRoutineRef.current.contains(event.target)) {
        setShowEditorRoutineDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // AUTOMATED STOCK RESYNC REFRESH LOOP: Protects multi-user baseline overrides continuously
  useEffect(() => {
    setActiveRoutine(decodedRoutineName);
    setMounted(true);

    const pullLiveConcurrencyCatalog = async () => {
      try {
        const { data } = await axios.get('/api/products');
        setLiveInventoryState(data);
      } catch (err) {
        console.error('Real-time database sync polling malfunctioned:', err.message);
      }
    };

    pullLiveConcurrencyCatalog();
    const livePollingTimer = setInterval(pullLiveConcurrencyCatalog, 5500);

    return () => {
      setActiveRoutine(null);
      clearInterval(livePollingTimer);
    };
  }, [decodedRoutineName, setActiveRoutine]);

  // Isolate custom routine entries belonging strictly to this saved collection context
  const targetRoutineItems = cartItems.filter((item) => item.routineName === decodedRoutineName);

  // Visible items after applying the session discard filters
  const visibleRoutineItems = targetRoutineItems.filter(item => {
    const key = `${item.product}-${item.variantName}-${decodedRoutineName}`;
    return !discardedItemKeys.includes(key);
  });

  const visibleSelectedItemsCount = selectedItems.filter(key => {
    if (!key.endsWith(`-${decodedRoutineName}`)) return false;
    return !discardedItemKeys.includes(key);
  }).length;

  const handleDiscardSelectedProducts = () => {
    const routineContextTag = decodedRoutineName;
    const selectedKeysForThisRoutine = selectedItems.filter(key => key.endsWith(`-${routineContextTag}`));
    
    if (selectedKeysForThisRoutine.length === 0) return;

    const itemsToDiscard = targetRoutineItems.filter(item => {
      const key = `${item.product}-${item.variantName}-${decodedRoutineName}`;
      return selectedKeysForThisRoutine.includes(key) && !discardedItemKeys.includes(key);
    });

    if (itemsToDiscard.length === 0) return;

    const newKeys = itemsToDiscard.map(item => `${item.product}-${item.variantName}-${decodedRoutineName}`);
    
    setDiscardedItemKeys(prev => [...prev, ...newKeys]);

    const discardAction = {
      id: Date.now(),
      count: itemsToDiscard.length,
      keys: newKeys,
    };
    setDiscardHistory(prev => [...prev, discardAction]);

    // Timer to automatically expire undo notification after 8 seconds
    setTimeout(() => {
      setDiscardHistory(prev => prev.filter(act => act.id !== discardAction.id));
    }, 8000);
  };

  const handleUndoDiscard = (actionId) => {
    const action = discardHistory.find(act => act.id === actionId);
    if (!action) return;

    setDiscardedItemKeys(prev => prev.filter(k => !action.keys.includes(k)));
    setDiscardHistory(prev => prev.filter(act => act.id !== actionId));
  };

  const updateQtyHandler = (item, action) => {
    const change = action === 'increment' ? 1 : -1;
    const newQty = item.qty + change;
    if (newQty < 1) return;

    // Resolve structural metrics live against our hot polled memory sync array layers
    const synchronizedMasterRecord = liveInventoryState.find(x => x._id === item.product);
    const serverCountInStock = synchronizedMasterRecord?.variants?.find(v => v.name === item.variantName)?.countInStock ?? item.countInStock;

    const totalVariantQtyInCart = cartItems
      .filter((x) => x.product === item.product && x.variantName === item.variantName)
      .reduce((acc, x) => acc + x.qty, 0);

    if (change === 1 && totalVariantQtyInCart + 1 > serverCountInStock) {
      alert(`Multi-User Stock Interception: High-demand conflict. Only ${Math.max(0, serverCountInStock - totalVariantQtyInCart)} units remain available in central warehouse allocations.`);
      return;
    }

    const mockProductRef = {
      _id: item.product,
      name: item.name,
      image: item.image,
      variants: [
        {
          name: item.variantName,
          price: item.price,
          countInStock: serverCountInStock,
        },
      ],
    };

    addToRoutine(mockProductRef, item.variantName, newQty, decodedRoutineName);
  };

  const handleRemoveProductFromThisRoutineOnly = (item) => {
    removeFromContext(item.product, item.variantName, decodedRoutineName);
  };

  const handleDeleteEntireRoutineBucket = async () => {
    const isConfirmed = await showConfirm(`Are you absolutely sure you want to delete the entire "${decodedRoutineName}" routine group? This will not alter your normal shopping cart rows.`);
    if (isConfirmed) {
      deleteRoutine(decodedRoutineName);
      navigate('/browse');
    }
  };

  const handleCheckoutEntireRoutine = () => {
    if (visibleRoutineItems.length === 0) return;
    checkoutEntireRoutine(decodedRoutineName, discardedItemKeys);
    setActiveRoutine(null); 
    navigate('/cart');
  };

  const handleOpenInlineEditor = async (item) => {
    setEditingItem(item);
    setEditorVariant(item.variantName);
    setEditorQty(item.qty);
    setEditorRoutineTarget(decodedRoutineName);
    try {
      setModalLoading(true);
      const { data } = await axios.get(`/api/products/${item.product}`);
      setEditorProductData(data);
      setModalLoading(false);
    } catch (err) {
      console.error(err.message);
      setModalLoading(false);
    }
  };

  const handleSaveInlineEditorChanges = async (e) => {
    e.preventDefault();
    if (!editorProductData) return;

    const chosenVariant = editorProductData.variants.find(v => v.name === editorVariant);
    if (!chosenVariant) return;

    const totalVariantQtyOutsideThisRow = cartItems
      .filter((x) => x.product === editingItem.product && x.variantName === editorVariant && !(x.routineName === decodedRoutineName && x.variantName === editingItem.variantName))
      .reduce((acc, x) => acc + x.qty, 0);

    const isDifferentRoutine = editorRoutineTarget !== decodedRoutineName;
    const targetRoutineItem = cartItems.find(
      (x) => x.product === editingItem.product && x.variantName === editorVariant && x.routineName === editorRoutineTarget
    );
    const currentQtyInTarget = targetRoutineItem ? targetRoutineItem.qty : 0;
    const addedQtyInTarget = isDifferentRoutine ? editorQty - currentQtyInTarget : 0;

    if (totalVariantQtyOutsideThisRow + editorQty + addedQtyInTarget > chosenVariant.countInStock) {
      alert(`Requested amount exceeds real-time concurrent warehouse thresholds (${chosenVariant.countInStock} total units exist).`);
      return;
    }

    try {
      setModalLoading(true);
      await saveProductEdit(
        decodedRoutineName,
        editingItem,
        editorProductData,
        editorVariant,
        editorQty,
        editorRoutineTarget,
        true
      );
      showToast('Product successfully saved and copy created in destination routine.', 'success');
      setEditingItem(null);
      setEditorProductData(null);
    } catch (err) {
      console.error(err);
      showToast(`Failed to save product: ${err.message}`, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveACopy = async (e) => {
    e.preventDefault();
    if (!editorProductData) return;

    const chosenVariant = editorProductData.variants.find(v => v.name === editorVariant);
    if (!chosenVariant) return;

    const isNewVariant = editorVariant !== editingItem.variantName;
    const totalVariantQtyOutsideThisRow = cartItems
      .filter((x) => x.product === editingItem.product && x.variantName === editorVariant && !(x.routineName === decodedRoutineName && x.variantName === (isNewVariant ? editorVariant : editingItem.variantName)))
      .reduce((acc, x) => acc + x.qty, 0);

    if (totalVariantQtyOutsideThisRow + editorQty > chosenVariant.countInStock) {
      alert(`Requested amount exceeds real-time concurrent warehouse thresholds (${chosenVariant.countInStock} total units exist).`);
      return;
    }

    try {
      setModalLoading(true);
      await saveProductEdit(
        decodedRoutineName,
        editingItem,
        editorProductData,
        editorVariant,
        editorQty,
        decodedRoutineName,
        false
      );
      showToast('Changes saved to routine successfully.', 'success');
      setEditingItem(null);
      setEditorProductData(null);
    } catch (err) {
      console.error(err);
      showToast(`Failed to save product: ${err.message}`, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className={`max-w-[1200px] mx-auto px-4 sm:px-0 py-8 font-sans text-gray-800 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
      
      <style>{`
        @keyframes slideInRow {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-routine-row {
          animation: slideInRow 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* HEADER CONTROLS SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-gray-200 pb-4">
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span 
              className="text-xl cursor-pointer hover:scale-110 active:scale-95 transition-all duration-150 inline-block"
              onClick={handleCheckoutEntireRoutine}
              title="Checkout Full Routine"
              role="button"
              aria-label="Checkout Full Routine"
            >
              📁
            </span>
            <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight">
              Routine Workspace: {decodedRoutineName}
            </h1>
          </div>
          <p className="text-xs text-gray-500 font-semibold mt-0.5">
            Managing independent product arrays stored exclusively inside this organizational template list.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDeleteEntireRoutineBucket}
          className="text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-4 py-2 rounded-lg transition-colors active:scale-95 cursor-pointer w-full sm:w-auto text-center"
        >
          💥 Delete Routine Group
        </button>
      </div>

      {/* CRITICAL ARCHITECTURE USER NOTICE BANNER */}
      {targetRoutineItems.length > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-300 rounded-xl p-4 flex items-center gap-3 text-xs text-blue-900 font-bold shadow-2xs text-left">
          <span className="text-lg">💡</span>
          <div>
            <p className="uppercase tracking-wide font-extrabold">Workflow Workspace Notice</p>
            <p className="text-blue-700 font-semibold mt-0.5">
              The products listed below will be **appended and merged** with your existing selected products on the main shopping cart page when checking out. Your regular cart items will not be overwritten or replaced.
            </p>
          </div>
        </div>
      )}

      {/* EMPTY STRUCTURAL GRID FALLBACK */}
      {visibleRoutineItems.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-2xl max-w-2xl mx-auto p-6 shadow-xs animate-routine-row">
          <span className="text-5xl block mb-4">📦</span>
          <h2 className="text-gray-800 text-sm font-bold uppercase tracking-wider mb-1">
            No products inside this routine
          </h2>
          <p className="text-xs text-gray-400 max-w-sm mx-auto font-medium">
            This custom routine collection is completely initialized but empty. Use the gateway button below to route into the catalog with this routine workspace enabled.
          </p>
          <Link
            to="/browse"
            className="inline-block mt-6 bg-emerald-600 hover:bg-emerald-700 text-white text-xs uppercase tracking-widest px-6 py-2.5 rounded-lg font-bold transition-all hover:scale-105 active:scale-95 shadow-2xs"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Labels for Grid View */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2 text-center">
            <div className="col-span-3 text-left">Product Details</div>
            <div className="col-span-2">Variant</div>
            <div className="col-span-1">Price</div>
            <div className="col-span-4">Actions</div>
            <div className="col-span-2 text-right pr-4">Quantity</div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {visibleRoutineItems.map((item, index) => {
              const itemKey = `${item.product}-${item.variantName}-${decodedRoutineName}`;
              const isSelected = selectedItems.includes(itemKey);

              // Live variant lookups mapped directly against fetched concurrency datasets
              const syncedVariantRef = liveInventoryState.find(x => x._id === item.product)?.variants?.find(v => v.name === item.variantName);
              const hotServerStockValue = syncedVariantRef ? syncedVariantRef.countInStock : item.countInStock;

              const totalVariantQtyInCart = cartItems
                .filter((x) => x.product === item.product && x.variantName === item.variantName)
                .reduce((acc, x) => acc + x.qty, 0);

              const currentRemainingLiveStock = Math.max(0, hotServerStockValue - totalVariantQtyInCart);

              return (
                <div
                  key={itemKey}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className="bg-white border border-gray-300 rounded-xl p-3 md:p-4 shadow-xs animate-routine-row hover:shadow-md transition-all duration-300"
                >
                  {/* MOBILE VIEW COMPACT CARD (md:hidden) */}
                  <div className="md:hidden flex flex-col gap-2.5">
                    <div className="flex items-start gap-3 w-full">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItemSelection(item.product, item.variantName, decodedRoutineName)}
                        className="w-4 h-4 rounded border-gray-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer flex-shrink-0 mt-1"
                      />
                      <div className="w-14 h-14 flex-shrink-0 bg-white border border-gray-150 flex items-center justify-center p-1 rounded-lg">
                        <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="flex-grow min-w-0 text-left">
                        <h3 className="text-gray-900 text-xs font-black truncate">{item.name}</h3>
                        <span className="inline-block text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider border border-gray-150 mt-1">
                          {item.variantName}
                        </span>
                        <p className={`text-[9px] font-bold mt-1 ${currentRemainingLiveStock === 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {currentRemainingLiveStock === 0 ? 'Maximum Stock' : `Stock: ${currentRemainingLiveStock}`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-extrabold text-xs text-gray-900 block">₹{item.price}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 pt-2 gap-2">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenInlineEditor(item)}
                          className="text-[9px] uppercase font-bold tracking-wider px-2.5 py-1.5 rounded border border-gray-300 text-gray-600 bg-white hover:border-gray-900"
                        >
                          🔧 Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveProductFromThisRoutineOnly(item)}
                          className="text-[9px] uppercase font-bold tracking-wider px-2.5 py-1.5 rounded border border-red-200 text-red-500 bg-red-50"
                        >
                          🗑️ Remove
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {hotServerStockValue === 0 ? (
                          <span className="text-[9px] font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-1 rounded uppercase tracking-wider">
                            No stock
                          </span>
                        ) : (
                          <div className="flex items-center border border-gray-300 rounded bg-white h-6 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => updateQtyHandler(item, 'decrement')}
                              className="bg-gray-100 text-gray-700 w-6 h-full flex items-center justify-center font-black text-xs hover:bg-gray-200 active:scale-90"
                            >
                              -
                            </button>
                            <span className="font-bold text-[11px] w-6 text-center text-gray-900 leading-none">
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQtyHandler(item, 'increment')}
                              disabled={currentRemainingLiveStock === 0}
                              className="bg-gray-100 text-gray-700 w-6 h-full flex items-center justify-center font-black text-xs hover:bg-gray-200 active:scale-90 disabled:opacity-30"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* DESKTOP VIEW GRID ROW (hidden md:grid) */}
                  <div className="hidden md:grid grid-cols-12 items-center gap-4 w-full">
                    {/* SECTOR 1: CHECKBOX & PRODUCT DETAILS */}
                    <div className="col-span-12 md:col-span-3 flex items-center gap-4 w-full min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItemSelection(item.product, item.variantName, decodedRoutineName)}
                        className="w-4 h-4 rounded border-gray-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer flex-shrink-0"
                      />

                      <div className="w-14 h-16 flex-shrink-0 bg-white border border-gray-200 flex items-center justify-center p-1 rounded-lg">
                        <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" />
                      </div>

                      <div className="truncate text-left min-w-0 flex-grow">
                        <h3 className="text-gray-900 text-sm font-bold truncate">
                          {item.name}
                        </h3>
                        <p className={`text-[10px] uppercase font-bold mt-0.5 ${currentRemainingLiveStock === 0 ? 'text-red-500 font-extrabold' : 'text-gray-400'}`}>
                          {currentRemainingLiveStock === 0 ? 'Maximum Stock' : `Stock Left: ${currentRemainingLiveStock}`}
                        </p>
                      </div>
                    </div>

                    {/* SECTOR 2: IN-LINE VARIANT BADGE */}
                    <div className="col-span-6 md:col-span-2 flex justify-start md:justify-center w-full">
                      <span className="text-[11px] bg-gray-100 text-gray-700 px-2.5 py-1 rounded font-bold uppercase tracking-wider border border-gray-200 truncate max-w-full">
                        {item.variantName}
                      </span>
                    </div>

                    {/* SECTOR 3: COSTS */}
                    <div className="col-span-6 md:col-span-1 flex justify-end md:justify-center items-center text-sm w-full">
                      <span className="font-extrabold text-gray-900">₹{item.price}</span>
                    </div>

                    {/* SECTOR 4: EDITOR ACTIONS */}
                    <div className="col-span-6 md:col-span-4 flex flex-wrap gap-2 justify-start w-full">
                      <button
                        type="button"
                        onClick={() => handleOpenInlineEditor(item)}
                        className="text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded border border-gray-300 text-gray-700 bg-white hover:border-gray-900 transition-colors shadow-3xs cursor-pointer flex-grow md:flex-grow-0 text-center"
                      >
                        🔧 Editor
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveProductFromThisRoutineOnly(item)}
                        className="text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 transition-colors shadow-3xs cursor-pointer flex-grow md:flex-grow-0 text-center"
                      >
                        🗑️ Remove
                      </button>
                    </div>

                    {/* SECTOR 5: STEPPERS */}
                    <div className="col-span-12 md:col-span-2 flex items-center justify-center md:justify-end gap-2 w-full pr-0 md:pr-2">
                      {hotServerStockValue === 0 ? (
                        <span className="text-xs font-bold text-red-500 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg uppercase tracking-wider block text-center w-full md:w-auto">
                          No stock
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => updateQtyHandler(item, 'decrement')}
                            className="bg-gray-900 text-white w-7 h-7 rounded hover:bg-gray-800 flex items-center justify-center text-sm font-bold transition-all active:scale-90 cursor-pointer"
                          >
                            -
                          </button>

                          <span className="font-bold text-sm w-6 text-center text-gray-900">
                            {item.qty}
                          </span>

                          <button
                            type="button"
                            onClick={() => updateQtyHandler(item, 'increment')}
                            disabled={currentRemainingLiveStock === 0}
                            className="bg-gray-900 text-white w-7 h-7 rounded hover:bg-gray-800 flex items-center justify-center text-sm font-bold transition-all active:scale-90 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer"
                          >
                            +
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-4 mt-8 pt-6 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row justify-center gap-3 w-full sm:w-auto">
              <Link
                to="/browse"
                className="text-gray-700 bg-white hover:bg-gray-50 text-[11px] uppercase tracking-wider px-5 py-2.5 rounded-lg border border-gray-300 font-bold transition-all inline-block w-full sm:w-auto text-center"
              >
                + Add More to This List
              </Link>

              <button
                type="button"
                onClick={handleDiscardSelectedProducts}
                disabled={visibleSelectedItemsCount === 0}
                className="text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 text-[11px] uppercase tracking-wider px-5 py-2.5 rounded-lg font-bold transition-all disabled:opacity-40 cursor-pointer w-full sm:w-auto text-center"
              >
                Discard Checked Items
              </button>

              <button
                type="button"
                onClick={handleCheckoutEntireRoutine}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] uppercase tracking-wider px-6 py-2.5 rounded-lg font-bold transition-all active:scale-95 shadow-2xs cursor-pointer w-full sm:w-auto text-center"
              >
                ⚡ Checkout Full Routine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-PLACE INTERACTIVE MODAL CANVAS PORTAL */}
      {editingItem && createPortal(
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999999, backdropFilter: 'blur(1px)' }}
          onClick={() => { setEditingItem(null); setEditorProductData(null); }}
          className="p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 text-white rounded-2xl border border-gray-800 w-full max-w-md p-6 shadow-2xl space-y-4 text-left max-h-[95vh] overflow-y-auto"
          >
            <div>
              <span className="bg-amber-400 text-gray-900 font-black uppercase text-[9px] tracking-widest px-2 py-0.5 rounded">Advanced Product Editor</span>
              <h3 className="text-sm font-bold text-white mt-1.5 uppercase tracking-tight">Editing: {editingItem.name}</h3>
            </div>

            {modalLoading ? (
              <p className="text-xs text-gray-400 animate-pulse py-4 font-bold text-center">Loading parameters from catalog streams...</p>
            ) : editorProductData ? (
              <form onSubmit={handleSaveInlineEditorChanges} className="space-y-4">
                
                <div className="space-y-1" ref={editorVariantRef}>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Select Variant Size</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEditorVariantDropdown(!showEditorVariantDropdown)}
                      className="w-full bg-gray-800 border border-gray-750 rounded-lg p-2.5 text-xs text-white flex items-center justify-between cursor-pointer focus:border-gray-600 transition-colors font-semibold outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                    >
                      <span>{editorVariant}</span>
                      <span className="text-[8px] text-gray-400 select-none">▼</span>
                    </button>
                    
                    {showEditorVariantDropdown && (
                      <div className="absolute left-0 right-0 mt-1 bg-gray-800 border border-gray-750 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto custom-scrollbar border-t-2 border-t-emerald-600 overflow-hidden">
                        {editorProductData.variants?.map((v) => (
                          <button
                            key={v.name}
                            type="button"
                            onClick={() => {
                              setEditorVariant(v.name);
                              setShowEditorVariantDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-gray-700 hover:text-white block outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                              editorVariant === v.name
                                ? 'text-emerald-400 bg-gray-750 font-black'
                                : 'text-gray-300 font-semibold'
                            }`}
                          >
                            {v.name} — (₹{v.price}) — Stock: {v.countInStock}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {(() => {
                    const chosen = editorProductData.variants?.find(v => v.name === editorVariant);
                    return (
                      <div className="text-[10px] font-bold uppercase tracking-wider text-right mt-1">
                        {chosen ? (
                          chosen.countInStock === 0 ? (
                            <span className="text-red-400">Out of Stock</span>
                          ) : (
                            <span className="text-emerald-400 font-extrabold">Stock Count: {chosen.countInStock}</span>
                          )
                        ) : null}
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Quantity Adjustments</label>
                  {(() => {
                    const chosen = editorProductData.variants?.find(v => v.name === editorVariant);
                    const isOutOfStock = !chosen || chosen.countInStock === 0;
                    return isOutOfStock ? (
                      <div className="bg-gray-800 border border-gray-700 rounded-lg h-9 flex items-center justify-center text-xs font-bold text-red-400 uppercase tracking-wider">
                        no stock
                      </div>
                    ) : (
                      <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg overflow-hidden h-9">
                        <button type="button" onClick={() => setEditorQty(Math.max(1, editorQty - 1))} className="w-12 text-white font-black hover:bg-gray-700 h-full cursor-pointer">-</button>
                        <span className="flex-grow text-center text-xs font-bold">{editorQty}</span>
                        <button type="button" onClick={() => setEditorQty(editorQty + 1)} className="w-12 text-white font-black hover:bg-gray-700 h-full cursor-pointer">+</button>
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-1" ref={editorRoutineRef}>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Reallocate to Routine Group</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEditorRoutineDropdown(!showEditorRoutineDropdown)}
                      className="w-full bg-gray-800 border border-gray-750 rounded-lg p-2.5 text-xs text-white flex items-center justify-between cursor-pointer focus:border-gray-600 transition-colors font-semibold outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                    >
                      <span>📁 {editorRoutineTarget}</span>
                      <span className="text-[8px] text-gray-400 select-none">▼</span>
                    </button>

                    {showEditorRoutineDropdown && (
                      <div className="absolute left-0 right-0 mt-1 bg-gray-800 border border-gray-750 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto custom-scrollbar border-t-2 border-t-emerald-600 overflow-hidden">
                        {routinesList.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setEditorRoutineTarget(name);
                              setShowEditorRoutineDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-gray-700 hover:text-white block outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                              editorRoutineTarget === name
                                ? 'text-emerald-400 bg-gray-750 font-black'
                                : 'text-gray-300 font-semibold'
                            }`}
                          >
                            📁 {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2 text-[10px] uppercase font-bold tracking-wider">
                  <button type="button" onClick={() => { setEditingItem(null); setEditorProductData(null); }} className="bg-transparent text-gray-400 hover:text-white px-4 py-2 cursor-pointer">Cancel</button>
                  <button
                    type="button"
                    onClick={handleSaveACopy}
                    disabled={!editorProductData.variants?.find(v => v.name === editorVariant) || editorProductData.variants.find(v => v.name === editorVariant).countInStock === 0}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-sm cursor-pointer disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed"
                  >
                    Save a Copy
                  </button>
                  <button
                    type="submit"
                    disabled={!editorProductData.variants?.find(v => v.name === editorVariant) || editorProductData.variants.find(v => v.name === editorVariant).countInStock === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow-sm cursor-pointer disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed"
                  >
                    Save & Move
                  </button>
                </div>

              </form>
            ) : null}
          </div>
        </div>,
        document.body
      )}

      {/* UNDO SNACKBAR TOAST OVERLAY */}
      {discardHistory.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
          {discardHistory.map((action) => (
            <div
              key={action.id}
              className="pointer-events-auto bg-gray-900 text-white rounded-xl px-4 py-3 shadow-2xl flex items-center justify-between gap-4 border border-gray-800 animate-fadeIn text-xs font-bold text-left"
            >
              <div className="flex items-center gap-2">
                <span>🗑️</span>
                <span>{action.count} {action.count === 1 ? 'item' : 'items'} discarded.</span>
              </div>
              <button
                type="button"
                onClick={() => handleUndoDiscard(action.id)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded font-black uppercase tracking-wider text-[10px] cursor-pointer transition-colors active:scale-95 border-none outline-none"
              >
                Undo
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default RoutineCartPage;