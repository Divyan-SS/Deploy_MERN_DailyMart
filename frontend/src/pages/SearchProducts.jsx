// frontend/src/pages/SearchProducts.jsx

import React, { useState, useEffect, useContext } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import axios from 'axios';
import ProductCard from '../components/ProductCard';
import { CartContext } from '../context/CartContext';

const SearchProducts = () => {
  const { routinesList, addToRoutine, cartItems, activeRoutine } = useContext(CartContext);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ELEVATED MODAL STATES
  const [activeRoutineProduct, setActiveRoutineProduct] = useState(null);
  const [activeVariantName, setActiveVariantName] = useState('');
  const [newRoutineName, setNewRoutineName] = useState('');

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const query = searchParams.get('q') || '';

  useEffect(() => {
    let interval;
    const executeSearchStream = async (showLoading = true) => {
      try {
        if (showLoading) setLoading(true);
        setError(null);
        const { data } = await axios.get(`/api/products?keyword=${query}`);
        setProducts(data);
        if (showLoading) setLoading(false);
      } catch (err) {
        if (showLoading) setError(err.response && err.response.data.message ? err.response.data.message : err.message);
        if (showLoading) setLoading(false);
      }
    };

    if (query) {
      executeSearchStream(true);
      interval = setInterval(() => {
        executeSearchStream(false);
      }, 5500);
    } else {
      setProducts([]);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [query]);

  // Modal Control Shuts
  const closeRoutineModal = () => {
    setActiveRoutineProduct(null);
    setActiveVariantName('');
    setNewRoutineName('');
  };

  const handleOpenRoutineModalTrigger = (product, selectedVariantName) => {
    setActiveRoutineProduct(product);
    setActiveVariantName(selectedVariantName);
  };

  const handleCreateNewRoutineFromModal = (e) => {
    e.preventDefault();
    if (!newRoutineName.trim() || !activeRoutineProduct) return;

    addToRoutine(activeRoutineProduct, activeVariantName, 1, newRoutineName.trim());
    closeRoutineModal();
  };

  const handleAddToExistingRoutineFromModal = (routineName) => {
    if (!activeRoutineProduct) return;

    addToRoutine(activeRoutineProduct, activeVariantName, 1, routineName);
    closeRoutineModal();
  };

  return (
    <div className="max-w-[1400px] mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6 font-sans text-gray-700">

      {/* Animation */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-up {
          animation: fadeInUp 0.5s ease-out forwards;
        }
      `}</style>

      {/* Header */}
      <div className="border-b border-gray-200 pb-3 animate-up">
        <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight">
          Search Results
        </h1>
        <p className="text-xs text-gray-600 font-semibold mt-1">
          Showing results for:{" "}
          <span className="text-emerald-600 font-extrabold">"{query}"</span>
        </p>
      </div>



      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 animate-up">
          {[...Array(4)].map((_, n) => (
            <div
              key={n}
              className="bg-white border border-gray-300 rounded-xl p-2 flex flex-col justify-between aspect-square lg:aspect-none lg:h-[350px] animate-pulse shadow-xs"
            >
              <div className="h-[45%] bg-gray-100 rounded-lg w-full" />
              <div className="h-[50%] flex flex-col justify-between py-1">
                <div className="h-3 bg-gray-100 rounded w-2/3" />
                <div className="h-5 bg-gray-100 rounded w-1/2" />
                <div className="h-7 bg-gray-100 rounded w-full animate-none" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl font-bold animate-up">
          ⚠️ {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && products.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-xl max-w-xl mx-auto shadow-xs p-6 animate-up">
          <span className="text-3xl block mb-3">🔍</span>
          <p className="text-gray-900 font-bold text-base mb-1">
            No products found matching your search.
          </p>
          <p className="text-gray-500 text-xs mb-6 font-semibold">
            Try checking your spelling, using different keywords, or explore our main categories.
          </p>
          <Link
            to="/browse"
            className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white text-xs uppercase tracking-widest px-5 py-2.5 rounded-lg font-bold transition-colors shadow-2xs"
          >
            Browse All Products
          </Link>
        </div>
      ) : (
        !loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 animate-up">
            {products.map((product) => (
              <div key={product._id} className={activeRoutineProduct ? 'pointer-events-none' : ''}>
                <ProductCard 
                  product={product} 
                  onOpenRoutineModal={handleOpenRoutineModalTrigger} 
                />
              </div>
            ))}
          </div>
        )
      )}

      {/* FIXED PORTAL OVERLAY CONTAINER LAYER BINDING */}
      {activeRoutineProduct && createPortal(
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          style={{ zIndex: 9999999 }}
          onClick={closeRoutineModal}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xl space-y-4 relative text-center w-full max-w-[325px]"
          >
            <div className="pb-1">
              <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-tight text-center">Organize Into Routine Group</h3>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center">Select Existing Routine</label>
              {routinesList.length === 0 ? (
                <p className="text-[11px] text-gray-400 italic bg-gray-50 rounded-lg p-2.5 text-center border border-dashed border-gray-200">No active routines built yet.</p>
              ) : (
                <div className="max-h-28 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white custom-scrollbar">
                  {routinesList.map((routineName) => (
                    <div key={routineName} className="p-2.5 flex justify-between items-center text-xs gap-2">
                      <span className="font-semibold text-gray-800 flex items-center gap-1 min-w-0 flex-1 text-left">
                        <span className="truncate">📁 {routineName}</span>
                      </span>
                      <button type="button" onClick={() => handleAddToExistingRoutineFromModal(routineName)} className="text-emerald-500 font-bold hover:underline text-[11px] cursor-pointer flex-shrink-0">Instantly Add →</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleCreateNewRoutineFromModal} className="space-y-1.5 pt-2 border-t border-gray-100">
              <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center">Or Create New Custom Routine</label>
              <div className="flex items-center gap-1.5">
                <input 
                  type="text" 
                  required 
                  placeholder="e.g., Office Snacks, Breakfast Grid" 
                  value={newRoutineName} 
                  onChange={(e) => setNewRoutineName(e.target.value)} 
                  className="h-9 min-w-0 flex-grow border border-gray-300 bg-white text-xs px-3 rounded outline-none text-gray-900 font-semibold text-center" 
                />
                <button 
                  type="submit" 
                  className="h-9 bg-gray-900 text-white text-[10px] uppercase tracking-wider font-bold px-4 rounded cursor-pointer flex-shrink-0 flex items-center justify-center"
                >
                  Create
                </button>
              </div>
            </form>

            <div className="pt-2 flex justify-center border-t border-gray-100">
              <button type="button" onClick={closeRoutineModal} className="text-[11px] text-gray-500 font-bold uppercase tracking-wider hover:text-gray-800 cursor-pointer">Close Window</button>
            </div>
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

export default SearchProducts;