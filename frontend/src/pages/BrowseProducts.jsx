// frontend/src/pages/BrowseProducts.jsx

import React, { useState, useEffect, useContext, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import CategoryCarousel from '../components/CategoryCarousel';
import RoutineOrganizerModal from '../components/RoutineOrganizerModal';
import useOutsideClick from '../hooks/useOutsideClick';
import useProductCatalog from '../hooks/useProductCatalog';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';

const BrowseProducts = () => {
  const { userInfo } = useContext(AuthContext);
  const { 
    routinesList, 
    cartItems, 
    activeRoutine, 
    setActiveRoutine, 
    addToCart,         
    addToRoutine,     
    removeFromContext,
    saveProductEdit
  } = useContext(CartContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);

  const [activeRoutineProduct, setActiveRoutineProduct] = useState(null);
  const [activeVariantName, setActiveVariantName] = useState('');
  const [newRoutineName, setNewRoutineName] = useState('');

  const searchParams = new URLSearchParams(location.search);
  const categoryQuery = searchParams.get('category');
  const selectedProductQuery = searchParams.get('selectedProduct');
  const routineContextQuery = searchParams.get('routine'); 

  const [editorVariant, setEditorVariant] = useState('');
  const [editorQty, setEditorQty] = useState(1);
  const [editorRoutineTarget, setEditorRoutineTarget] = useState('');

  const [offerFilter, setOfferFilter] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(selectedProductQuery ? decodeURIComponent(selectedProductQuery) : '');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [sortBy, setSortBy] = useState('Relevance');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(110);
  const [openFilterDropdown, setOpenFilterDropdown] = useState(null);

  const [showBrowseEditorVariantDropdown, setShowBrowseEditorVariantDropdown] = useState(false);
  const [showBrowseEditorRoutineDropdown, setShowBrowseEditorRoutineDropdown] = useState(false);

  const browseEditorVariantRef = useRef(null);
  const browseEditorRoutineRef = useRef(null);

  useOutsideClick(browseEditorVariantRef, () => setShowBrowseEditorVariantDropdown(false));
  useOutsideClick(browseEditorRoutineRef, () => setShowBrowseEditorRoutineDropdown(false));

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.filter-dropdown-container')) {
        setOpenFilterDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const header = document.getElementById('sticky-header');
    if (!header) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setHeaderHeight(entry.target.offsetHeight);
      }
    });

    resizeObserver.observe(header);

    // Initial measurement fallback
    setHeaderHeight(header.offsetHeight);

    // Dynamic timer fallback to handle delayed layout shifts
    const timer = setTimeout(() => {
      setHeaderHeight(header.offsetHeight);
    }, 450);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (showFilterModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [showFilterModal]);

  // CONCURRENT REFRESH ENGINE: Polls inventory master data to catch multi-user updates live
  const { products: catalogProducts, loading: catalogLoading, error: catalogError } = useProductCatalog();

  useEffect(() => {
    setProducts(catalogProducts);
    setLoading(catalogLoading);
    setError(catalogError);
  }, [catalogProducts, catalogLoading, catalogError]);

  useEffect(() => {
    if (!mounted) {
      setTimeout(() => setMounted(true), 80);
    }
  }, [mounted]);

  // Handle initialization and sync for the inline editor panel inputs
  useEffect(() => {
    if (products.length > 0 && selectedProductQuery) {
      const matchedName = decodeURIComponent(selectedProductQuery);
      const match = products.find(p => p.name === matchedName);
      if (match) {
        setEditorVariant(match.variants?.[0]?.name || '');
        setEditorRoutineTarget(routineContextQuery ? decodeURIComponent(routineContextQuery) : routinesList[0] || '');
        
        const savedItem = cartItems.find(item => 
          item.product === match._id && 
          item.routineName === (routineContextQuery ? decodeURIComponent(routineContextQuery) : null)
        );
        if (savedItem) setEditorQty(savedItem.qty);
      }
    }
  }, [products, selectedProductQuery, routineContextQuery, routinesList, cartItems]);

  useEffect(() => {
    if (selectedProductQuery && selectedProduct === '') {
      navigate('/browse', { replace: true });
    }
  }, [selectedProduct, selectedProductQuery, navigate]);

  const uniqueProducts = [...new Set(products.map((p) => p.name))].sort();
  const uniqueBrands = [...new Set(products.map((p) => p.brand))].sort();
  const uniqueVariants = [...new Set(products.flatMap((p) => p.variants?.map((v) => v.name) || []))].sort();
  const uniqueCategories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  const categoriesList = ['All Products', ...uniqueCategories];

  const handleClearAllDropdownFilters = () => {
    setSelectedProduct('');
    setSelectedBrand('');
    setSelectedVariant('');
    setOfferFilter('All');
  };

  let processedProducts = products.map(p => {
    if (offerFilter === 'Offers') {
      const discountedVariants = p.variants?.filter(v => v.originalPrice && v.originalPrice > v.price) || [];
      if (discountedVariants.length > 0) {
        const nonDiscountedVariants = p.variants?.filter(v => !(v.originalPrice && v.originalPrice > v.price)) || [];
        return {
          ...p,
          variants: [...discountedVariants, ...nonDiscountedVariants]
        };
      }
    }
    return p;
  }).filter((p) => {
    if (categoryQuery && categoryQuery !== 'All Products') {
      if (!p.category || p.category.toLowerCase() !== categoryQuery.toLowerCase()) return false;
    }
    if (offerFilter === 'Offers') {
      const hasDiscountedVariant = p.variants?.some(v => v.originalPrice && v.originalPrice > v.price);
      if (!hasDiscountedVariant) return false;
    }
    if (selectedProduct && p.name !== selectedProduct) return false;
    if (selectedBrand && p.brand !== selectedBrand) return false;
    if (selectedVariant && !p.variants?.some((v) => v.name === selectedVariant)) return false;
    return true;
  });

  if (sortBy === 'Price: Low to High') {
    processedProducts.sort((a, b) => (a.variants?.[0]?.price || 0) - (b.variants?.[0]?.price || 0));
  } else if (sortBy === 'Price: High to Low') {
    processedProducts.sort((a, b) => (b.variants?.[0]?.price || 0) - (a.variants?.[0]?.price || 0));
  }

  const showCategoryLanes = (!categoryQuery || categoryQuery === 'All Products') && 
                            !selectedProduct && 
                            !selectedBrand && 
                            !selectedVariant && 
                            offerFilter === 'All';

  const groupedProducts = showCategoryLanes ? processedProducts.reduce((acc, product) => {
    const category = product.category || 'Other Essentials';
    if (!acc[category]) acc[category] = [];
    acc[category].push(product);
    return acc;
  }, {}) : {};

  const targetEditorProduct = products.find(p => p.name === selectedProduct);

  const handleAdvancedAddToCart = () => {
    if (!targetEditorProduct) return;
    const targetSpecs = targetEditorProduct.variants?.find(v => v.name === editorVariant);
    if (targetSpecs && editorQty > targetSpecs.countInStock) {
      alert('Multi-User Restriction: Staged quantity exceeds current active warehouse stock reserves.');
      return;
    }
    addToCart(targetEditorProduct, editorVariant, editorQty);
  };

  const handleAdvancedUpdateRoutine = async () => {
    if (!userInfo) {
      alert('Authentication required: Please log in to construct routine maps.');
      return;
    }
    if (!targetEditorProduct || !editorRoutineTarget) return;
    const targetSpecs = targetEditorProduct.variants?.find(v => v.name === editorVariant);
    if (targetSpecs && editorQty > targetSpecs.countInStock) {
      alert('Multi-User Restriction: Staged quantity exceeds current active warehouse stock reserves.');
      return;
    }

    const currentRoutine = decodeURIComponent(routineContextQuery);
    const oldItem = cartItems.find(
      item => item.product === targetEditorProduct._id && item.routineName === currentRoutine
    );

    if (!oldItem) return;

    try {
      await saveProductEdit(
        currentRoutine,
        oldItem,
        targetEditorProduct,
        editorVariant,
        editorQty,
        currentRoutine,
        true
      );
      alert('success: Product successfully updated in routine.');
      setSelectedProduct('');
      navigate('/browse');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdvancedRemoveFromRoutine = () => {
    if (!userInfo) return;
    if (!targetEditorProduct || !routineContextQuery) return;
    const currentRoutine = decodeURIComponent(routineContextQuery);
    removeFromContext(targetEditorProduct._id, editorVariant, currentRoutine);
    setSelectedProduct('');
    navigate('/browse');
  };

  const handleAdvancedMoveToAnotherRoutine = async () => {
    if (!userInfo) return;
    if (!targetEditorProduct || !routineContextQuery || !editorRoutineTarget) return;
    const currentRoutine = decodeURIComponent(routineContextQuery);
    if (currentRoutine === editorRoutineTarget) return;

    const oldItem = cartItems.find(
      item => item.product === targetEditorProduct._id && item.routineName === currentRoutine
    );

    if (!oldItem) return;

    const targetSpecs = targetEditorProduct.variants?.find(v => v.name === editorVariant);
    if (targetSpecs && editorQty > targetSpecs.countInStock) {
      alert('Multi-User Restriction: Staged quantity exceeds current active warehouse stock reserves.');
      return;
    }

    try {
      await saveProductEdit(
        currentRoutine,
        oldItem,
        targetEditorProduct,
        editorVariant,
        editorQty,
        editorRoutineTarget,
        true
      );
      alert('success: Product successfully moved and copy created in target routine.');
      setSelectedProduct('');
      navigate(`/routine/${encodeURIComponent(editorRoutineTarget)}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenRoutineModalTrigger = (product, selectedVariantName) => {
    if (!userInfo) {
      alert('Please register or sign in to build custom layout routine groupings.');
      return;
    }
    setActiveRoutineProduct(product);
    setActiveVariantName(selectedVariantName);
    setNewRoutineName('');
  };

  const handleCreateNewRoutineFromModal = (e) => {
    e.preventDefault();
    if (!newRoutineName.trim() || !activeRoutineProduct) return;
    addToRoutine(activeRoutineProduct, activeVariantName, 1, newRoutineName.trim());
    setNewRoutineName('');
    setActiveRoutineProduct(null);
  };

  const handleAddToExistingRoutineFromModal = (routineName) => {
    if (!activeRoutineProduct) return;
    addToRoutine(activeRoutineProduct, activeVariantName, 1, routineName);
    setActiveRoutineProduct(null);
  };

  const renderFilterContent = (isModal = false) => {
    const isFilterActive = selectedProduct || selectedBrand || selectedVariant || offerFilter !== 'All';
    return (
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1">🔍 Filter By</h2>
          <div className="flex items-center gap-2">
            {isFilterActive && (
              <button 
                type="button" 
                onClick={handleClearAllDropdownFilters} 
                className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase tracking-tight"
              >
                Clear ×
              </button>
            )}
            {isModal && (
              <button 
                type="button" 
                onClick={() => setShowFilterModal(false)} 
                className="text-[10px] text-emerald-600 hover:text-emerald-800 font-bold uppercase tracking-tight ml-2"
              >
                Done ✓
              </button>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 mb-5">
          <button type="button" onClick={() => setOfferFilter('All')} className={`flex-1 text-[11px] font-bold py-1.5 border rounded-lg transition-all uppercase tracking-wider ${offerFilter === 'All' ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>📦 All</button>
          <button type="button" onClick={() => setOfferFilter('Offers')} className={`flex-1 text-[11px] font-bold py-1.5 border rounded-lg transition-all uppercase tracking-wider ${offerFilter === 'Offers' ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>🔥 Offers</button>
        </div>

        <div className="space-y-4">
          {/* Product Name Filter */}
          <div className="filter-dropdown-container relative">
            <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">🛒 Product Name</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenFilterDropdown(openFilterDropdown === 'product' ? null : 'product')}
                className="w-full p-2 pr-8 text-xs text-left text-gray-700 border border-gray-300 rounded-lg bg-white flex items-center justify-between cursor-pointer focus:border-emerald-500 transition-colors font-medium h-[34px] outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
              >
                <span className="truncate">{selectedProduct || "All Products"}</span>
                <span className="text-[9px] text-gray-400 select-none">▼</span>
              </button>
              
              {openFilterDropdown === 'product' && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto custom-scrollbar border-t-2 border-t-emerald-600 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct('');
                      setOpenFilterDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-emerald-50 hover:text-emerald-700 block outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                      !selectedProduct ? 'text-emerald-600 bg-emerald-50/50 font-black' : 'text-gray-700 font-bold'
                    }`}
                  >
                    All Products
                  </button>
                  {uniqueProducts.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setSelectedProduct(name);
                        setOpenFilterDropdown(null);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-emerald-50 hover:text-emerald-700 block outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                        selectedProduct === name ? 'text-emerald-600 bg-emerald-50/50 font-black' : 'text-gray-750 font-medium'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Brand Ledger Filter */}
          <div className="filter-dropdown-container relative">
            <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">💡 Brand Ledger</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenFilterDropdown(openFilterDropdown === 'brand' ? null : 'brand')}
                className="w-full p-2 pr-8 text-xs text-left text-gray-900 border border-gray-300 rounded-lg bg-white flex items-center justify-between cursor-pointer focus:border-emerald-500 transition-colors font-bold h-[34px] outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
              >
                <span className="truncate">{selectedBrand || "All Brands"}</span>
                <span className="text-[9px] text-gray-400 select-none">▼</span>
              </button>

              {openFilterDropdown === 'brand' && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto custom-scrollbar border-t-2 border-t-emerald-600 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBrand('');
                      setOpenFilterDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-emerald-50 hover:text-emerald-700 block outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                      !selectedBrand ? 'text-emerald-600 bg-emerald-50/50 font-black' : 'text-gray-750 font-medium'
                    }`}
                  >
                    All Brands
                  </button>
                  {uniqueBrands.map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => {
                        setSelectedBrand(brand);
                        setOpenFilterDropdown(null);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-emerald-50 hover:text-emerald-700 block outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                        selectedBrand === brand ? 'text-emerald-600 bg-emerald-50/50 font-black' : 'text-gray-900 font-bold'
                      }`}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pack Sizes / Variants Filter */}
          <div className="filter-dropdown-container relative">
            <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">Pack Sizes / Variants</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenFilterDropdown(openFilterDropdown === 'variant' ? null : 'variant')}
                className="w-full p-2 pr-8 text-xs text-left text-gray-700 border border-gray-300 rounded-lg bg-white flex items-center justify-between cursor-pointer focus:border-emerald-500 transition-colors font-medium h-[34px] outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
              >
                <span className="truncate">{selectedVariant || "All Variants"}</span>
                <span className="text-[9px] text-gray-400 select-none">▼</span>
              </button>

              {openFilterDropdown === 'variant' && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto custom-scrollbar border-t-2 border-t-emerald-600 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVariant('');
                      setOpenFilterDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-emerald-50 hover:text-emerald-700 block outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                      !selectedVariant ? 'text-emerald-600 bg-emerald-50/50 font-black' : 'text-gray-700 font-bold'
                    }`}
                  >
                    All Variants
                  </button>
                  {uniqueVariants.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setSelectedVariant(v);
                        setOpenFilterDropdown(null);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-emerald-50 hover:text-emerald-700 block outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                        selectedVariant === v ? 'text-emerald-600 bg-emerald-50/50 font-black' : 'text-gray-750 font-medium'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`max-w-[1400px] mx-auto py-4 font-sans text-gray-700 transition-opacity duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="hidden sm:block w-full sm:w-60 flex-shrink-0 space-y-6 sm:border-r border-gray-200 sm:pr-6 px-4 sm:px-0">
          {renderFilterContent(false)}
        </aside>

        <main className="flex-grow min-w-0 space-y-6 px-4 md:px-0">
          {routineContextQuery && targetEditorProduct && (
            <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-xl space-y-4 border border-gray-800">
              <div className="border-b border-gray-800 pb-2 flex justify-between items-start gap-4">
                <div>
                  <span className="bg-amber-400 text-gray-900 font-black uppercase text-[9px] tracking-widest px-2 py-0.5 rounded">Advanced Product Editor</span>
                  <h2 className="text-base font-bold tracking-tight mt-1 text-white">Modifying: <span className="text-emerald-400">"{targetEditorProduct.name}"</span></h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">Context: Currently viewing via active routine folder group entry link.</p>
                </div>
                <button type="button" onClick={() => { setSelectedProduct(''); navigate('/browse'); }} className="text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider">Clear Editor ×</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-bold">
                <div className="space-y-1.5" ref={browseEditorVariantRef}>
                  <label className="text-gray-400 block text-[10px] uppercase tracking-wider">Selected Variant</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowBrowseEditorVariantDropdown(!showBrowseEditorVariantDropdown)}
                      className="w-full bg-gray-800 border border-gray-750 rounded-lg p-2.5 text-xs text-white flex items-center justify-between cursor-pointer focus:border-gray-655 transition-colors font-semibold outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                    >
                      <span>{editorVariant}</span>
                      <span className="text-[8px] text-gray-400 select-none">▼</span>
                    </button>
                    
                    {showBrowseEditorVariantDropdown && (
                      <div className="absolute left-0 right-0 mt-1 bg-gray-800 border border-gray-750 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto custom-scrollbar border-t-2 border-t-emerald-600 overflow-hidden">
                        {targetEditorProduct.variants?.map((v) => (
                          <button
                            key={v.name}
                            type="button"
                            onClick={() => {
                              if (v.countInStock === 0) {
                                alert("no stock");
                              }
                              setEditorVariant(v.name);
                              setShowBrowseEditorVariantDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-gray-700 hover:text-white block outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${
                              editorVariant === v.name
                                ? 'text-emerald-400 bg-gray-750 font-black'
                                : 'text-gray-300 font-semibold'
                            }`}
                          >
                            {v.name} — (₹{v.price})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-400 block text-[10px] uppercase tracking-wider">Adjustment Quantity</label>
                  <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg overflow-hidden h-[38px]">
                    <button type="button" onClick={() => setEditorQty(Math.max(1, editorQty - 1))} className="w-10 text-white font-black hover:bg-gray-700 h-full text-sm transition-colors">-</button>
                    <span className="flex-grow text-center font-extrabold text-xs text-white bg-gray-900/40 h-full flex items-center justify-center">{editorQty}</span>
                    <button type="button" onClick={() => setEditorQty(editorQty + 1)} className="w-10 text-white font-black hover:bg-gray-700 h-full text-sm transition-colors">+</button>
                  </div>
                </div>

                <div className="space-y-1.5" ref={browseEditorRoutineRef}>
                  <label className="text-gray-400 block text-[10px] uppercase tracking-wider">Target Routine Allocation Folder</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowBrowseEditorRoutineDropdown(!showBrowseEditorRoutineDropdown)}
                      className="w-full bg-gray-800 border border-gray-750 rounded-lg p-2.5 text-xs text-white flex items-center justify-between cursor-pointer focus:border-gray-655 transition-colors font-semibold outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                    >
                      <span>📁 {editorRoutineTarget}</span>
                      <span className="text-[8px] text-gray-400 select-none">▼</span>
                    </button>

                    {showBrowseEditorRoutineDropdown && (
                      <div className="absolute left-0 right-0 mt-1 bg-gray-800 border border-gray-750 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto custom-scrollbar border-t-2 border-t-emerald-600 overflow-hidden">
                        {routinesList.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setEditorRoutineTarget(name);
                              setShowBrowseEditorRoutineDropdown(false);
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
              </div>

              <div className="border-t border-gray-800 pt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-wider font-extrabold">
                <button type="button" onClick={handleAdvancedAddToCart} className="bg-white hover:bg-gray-100 text-gray-900 px-4 py-2 rounded-lg transition-all shadow-md active:scale-95">Add To Cart</button>
                <button type="button" onClick={handleAdvancedUpdateRoutine} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-all shadow-md active:scale-95">Update Routine</button>
                <button type="button" onClick={handleAdvancedMoveToAnotherRoutine} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-all shadow-md active:scale-95">Move To Another Routine</button>
                <button type="button" onClick={handleAdvancedRemoveFromRoutine} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all shadow-md active:scale-95">Remove From Routine</button>
              </div>
            </div>
          )}

          {activeRoutine && (
            <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex justify-between items-center text-xs text-amber-900 font-bold animate-pulse">
              <div>
                <span>🎯 Active Editing Workspace: </span>
                <span className="underline uppercase tracking-tight text-gray-900 font-extrabold">"{activeRoutine}"</span>
                <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Card controls directly update this folder. Click 'Add to Cart' to execute standard cart row purchases.</p>
              </div>
              <button type="button" onClick={() => setActiveRoutine(null)} className="bg-white text-gray-800 hover:bg-gray-100 border border-gray-300 text-[10px] uppercase font-black tracking-wider px-3 py-1.5 rounded-lg transition-colors shadow-3xs">Exit Workspace Mode ×</button>
            </div>
          )}

          <div style={{ top: `${headerHeight}px` }} className="sticky z-30 bg-gray-50/95 backdrop-blur-xs py-1 lg:py-2.5 border-b border-gray-200 flex flex-row justify-between items-center mb-4 lg:mb-6 gap-2 pr-1">
            <h1 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wider pr-2">
              ✨ {categoryQuery && categoryQuery !== 'All Products' ? categoryQuery : 'All Products'}
            </h1>
            <div className="flex items-center gap-2">
              {/* Filter Button for Mobile (integrated under breadcrumbs in the sticky header) */}
              <button
                type="button"
                onClick={() => setShowFilterModal(true)}
                className="sm:hidden flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-md w-8 h-8 relative cursor-pointer border border-white/20 flex-shrink-0 transition-all active:scale-95"
                title="Filter Products"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
                </svg>
                {(selectedProduct || selectedBrand || selectedVariant || offerFilter !== 'All') && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 text-[7px] text-white items-center justify-center font-bold">!</span>
                  </span>
                )}
              </button>

              {/* Custom Sort Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 bg-white hover:border-gray-400 flex items-center gap-1 font-bold cursor-pointer transition-colors shadow-2xs w-[115px] xs:w-[130px] lg:w-44 justify-between outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                >
                  <span className="truncate">
                    {sortBy === 'Relevance' 
                      ? 'Relevance' 
                      : sortBy === 'Price: Low to High' 
                      ? 'Price: Low → High' 
                      : 'Price: High → Low'}
                  </span>
                  <span className="text-[7px] text-gray-400 flex-shrink-0">▼</span>
                </button>

                {showSortDropdown && (
                  <>
                    <div className="hidden sm:block absolute right-0 mt-1.5 w-44 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-40 text-xs font-bold border-t-4 border-t-emerald-600 animate-dropdown-fade overflow-hidden">
                      <button type="button" onClick={() => { setSortBy('Relevance'); setShowSortDropdown(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 text-gray-700">Relevance Index</button>
                      <button type="button" onClick={() => { setSortBy('Price: Low to High'); setShowSortDropdown(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 text-gray-700">Price: Low → High</button>
                      <button type="button" onClick={() => { setSortBy('Price: High to Low'); setShowSortDropdown(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 text-gray-700">Price: High → Low</button>
                    </div>

                    <div className="sm:hidden fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4" style={{ zIndex: 9999999 }} onClick={() => setShowSortDropdown(false)}>
                      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl border-t-4 border-t-emerald-600 border border-gray-200 p-5 shadow-2xl space-y-3.5 relative w-full max-w-[280px] flex flex-col text-left overflow-hidden">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-150">
                          <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Sort Products By</h3>
                          <button type="button" onClick={() => setShowSortDropdown(false)} className="text-gray-400 hover:text-gray-700 font-black text-xs uppercase cursor-pointer">Close ×</button>
                        </div>
                        <div className="flex flex-col space-y-1 text-xs font-bold">
                          <button type="button" onClick={() => { setSortBy('Relevance'); setShowSortDropdown(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${sortBy === 'Relevance' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-700'}`}>Relevance Index</button>
                          <button type="button" onClick={() => { setSortBy('Price: Low to High'); setShowSortDropdown(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${sortBy === 'Price: Low to High' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-700'}`}>Price: Low → High</button>
                          <button type="button" onClick={() => { setSortBy('Price: High to Low'); setShowSortDropdown(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ${sortBy === 'Price: High to Low' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-700'}`}>Price: High → Low</button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            showCategoryLanes ? (
              <div className="space-y-5 sm:space-y-8 lg:space-y-10 animate-fade text-left">
                {[...Array(2)].map((_, catIdx) => (
                  <div key={catIdx} className="space-y-2 sm:space-y-3">
                    <div className="h-6 w-48 bg-gray-100 rounded-md animate-pulse"></div>
                    <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-3 scrollbar-none">
                      {[...Array(4)].map((_, n) => (
                        <div
                          key={n}
                          className="flex-shrink-0 w-[155px] xs:w-[175px] sm:w-[195px] md:w-[210px] lg:w-[220px] snap-start bg-white border border-gray-300 rounded-xl p-3 flex flex-col justify-between h-[300px] animate-pulse"
                        >
                          <div className="h-[45%] bg-gray-100 rounded-lg w-full" />
                          <div className="h-[50%] flex flex-col justify-between py-1">
                            <div className="h-3 bg-gray-100 rounded w-2/3" />
                            <div className="h-5 bg-gray-100 rounded w-1/2" />
                            <div className="h-7 bg-gray-100 rounded w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4 animate-fade">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-white border border-gray-300 rounded-xl p-3 flex flex-col justify-between h-[300px] animate-pulse">
                    <div className="h-[45%] bg-gray-100 rounded-lg w-full" />
                    <div className="h-[50%] flex flex-col justify-between py-1">
                      <div className="h-3 bg-gray-100 rounded w-2/3" />
                      <div className="h-5 bg-gray-100 rounded w-1/2" />
                      <div className="h-7 bg-gray-100 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : error ? (
            <div className="bg-red-50 border border-red-300 text-red-700 text-xs p-3.5 rounded-xl font-bold animate-pulse">⚠️ {error}</div>
          ) : processedProducts.length === 0 ? (
            <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-2xl max-w-xl mx-auto p-6">
              <p className="text-gray-500 text-sm font-bold">No products match your selected combination filter criteria.</p>
              <button type="button" onClick={() => { setSelectedProduct(''); setSelectedBrand(''); setSelectedVariant(''); setOfferFilter('All'); }} className="mt-4 bg-gray-900 text-white text-xs px-4 py-2 rounded-lg font-bold uppercase tracking-wider">Reset Filters</button>
            </div>
          ) : showCategoryLanes ? (
            <div className="space-y-5 sm:space-y-8 lg:space-y-10 animate-fade">
              {Object.entries(groupedProducts).map(([categoryName, categoryProducts]) => (
                <div key={categoryName} className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between items-end mb-1 pr-1">
                    <div>
                      <h2 className="text-base font-bold text-gray-900 tracking-tight uppercase">
                        {categoryName}
                      </h2>
                      <p className="text-[10px] sm:text-xs text-gray-500 font-semibold mt-0.5">
                        Fresh picks in {categoryName.toLowerCase()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/browse?category=${encodeURIComponent(categoryName)}`)}
                      className="text-[10px] sm:text-xs text-emerald-600 hover:text-emerald-700 uppercase tracking-widest font-bold hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none outline-none"
                    >
                      View More <span className="text-[8px]">▶</span>
                    </button>
                  </div>

                  <CategoryCarousel
                    categoryProducts={categoryProducts}
                    onOpenRoutineModal={handleOpenRoutineModalTrigger}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
              {processedProducts.map((p) => (
                <div key={p._id}>
                  <ProductCard product={p} key={`${p._id}-${p.variants?.[0]?.name || 'default'}`} onOpenRoutineModal={handleOpenRoutineModalTrigger} />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* FIXED PORTAL MODAL */}
      <RoutineOrganizerModal
        activeRoutineProduct={activeRoutineProduct}
        routinesList={routinesList}
        onClose={() => { setActiveRoutineProduct(null); setNewRoutineName(''); }}
        onAddToExisting={handleAddToExistingRoutineFromModal}
        onCreateNew={(name) => {
          addToRoutine(activeRoutineProduct, activeVariantName, 1, name);
          setActiveRoutineProduct(null);
          setNewRoutineName('');
        }}
      />



      {/* Filter Modal Portal */}
      {showFilterModal && createPortal(
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999999, backdropFilter: 'blur(2px)' }} 
          className="p-4" 
          onClick={() => setShowFilterModal(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '325px' }}
            className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xl space-y-4 relative animate-fadeIn"
          >
            {renderFilterContent(true)}
          </div>
        </div>,
        document.body
      )}

      {/* Floating Go to Cart button */}
      {(() => {
        const normalCartItems = cartItems?.filter(item => !item.routineName) || [];
        const normalItemsQty = normalCartItems.reduce((acc, item) => acc + item.qty, 0);
        const normalItemsPrice = normalCartItems.reduce((acc, item) => acc + item.price * item.qty, 0);
        
        if (normalItemsQty === 0) return null;
        
        return (
          <div className="fixed bottom-4 right-4 z-40 animate-fade">
            <Link
              to="/cart"
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[9px] xs:text-[10.5px] uppercase tracking-wider py-1.5 px-3 rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 group border border-white/20"
            >
              <span className="text-xs group-hover:animate-bounce">🛒</span>
              <span>Go to Cart ({normalItemsQty})</span>
              <span className="bg-emerald-850 text-[8px] xs:text-[9.5px] py-0.5 px-1.5 rounded-full font-black text-emerald-100">
                ₹{normalItemsPrice.toFixed(0)}
              </span>
            </Link>
          </div>
        );
      })()}
    </div>
  );
};

export default BrowseProducts;