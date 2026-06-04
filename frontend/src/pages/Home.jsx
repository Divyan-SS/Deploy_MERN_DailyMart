// frontend/src/pages/Home.jsx

import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import ProductCard from '../components/ProductCard';
import CategoryCarousel from '../components/CategoryCarousel';
import RoutineOrganizerModal from '../components/RoutineOrganizerModal';
import { CartContext } from '../context/CartContext';

const Home = () => {
  const { routinesList, addToRoutine, cartItems, activeRoutine } = useContext(CartContext);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeRoutineProduct, setActiveRoutineProduct] = useState(null);
  const [activeVariantName, setActiveVariantName] = useState('');
  const [newRoutineName, setNewRoutineName] = useState('');

  // CONCURRENT REFRESH ENGINE: Polls inventory master data to catch multi-user updates live
  const fetchFreshProducts = async () => {
    try {
      const { data } = await axios.get('/api/products');
      setProducts(data);
      setLoading(false);
    } catch (err) {
      setError(
        err.response && err.response.data.message
          ? err.response.data.message
          : err.message
      );
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFreshProducts();

    // Auto-refresh landing choices every 5.5 seconds smoothly to reflect true remaining stock levels
    const livePollingTimer = setInterval(fetchFreshProducts, 5500);
    return () => clearInterval(livePollingTimer);
  }, []);

  useEffect(() => {
    if (activeRoutineProduct) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [activeRoutineProduct]);

  const closeRoutineModal = () => {
    setActiveRoutineProduct(null);
    setActiveVariantName('');
    setNewRoutineName('');
  };

  const handleCreateNewRoutineFromModal = (e) => {
    e.preventDefault();
    if (!newRoutineName.trim() || !activeRoutineProduct) return;

    addToRoutine(
      activeRoutineProduct,
      activeVariantName,
      1,
      newRoutineName.trim()
    );

    closeRoutineModal();
  };

  const handleAddToExistingRoutineFromModal = (routineName) => {
    if (!activeRoutineProduct) return;

    addToRoutine(
      activeRoutineProduct,
      activeVariantName,
      1,
      routineName
    );

    closeRoutineModal();
  };

  const handleOpenRoutineModalTrigger = (product, selectedVariantName) => {
    setActiveRoutineProduct(product);
    setActiveVariantName(selectedVariantName);
  };

  return (
    <div className="max-w-[1400px] mx-auto py-4 sm:py-6 space-y-6 sm:space-y-10 lg:space-y-12 font-sans text-gray-800">

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-fade {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>

      {/* HERO SECTION */}
      <div className="bg-emerald-50 rounded-2xl p-8 md:p-12 border border-emerald-100 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden animate-fade">
        <div className="max-w-2xl relative z-10 space-y-4 text-center md:text-left">
          <span className="bg-emerald-200 text-emerald-900 text-[10px] uppercase tracking-widest px-3 py-1 rounded-sm font-semibold">
            100% Fresh Guaranteed
          </span>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight leading-tight">
            Fresh Groceries,
            <br />
            <span className="text-emerald-600">
              Delivered Straight to Your Door.
            </span>
          </h1>

          <p className="text-gray-700 text-sm leading-relaxed max-w-lg mx-auto md:mx-0">
            DailyMart makes shopping simple. Get your everyday essentials delivered quickly and safely right when you need them.
          </p>

          <div className="pt-2">
            <Link
              to="/browse"
              className="inline-block bg-gray-900 hover:bg-emerald-600 text-white text-sm px-6 py-2.5 rounded-lg shadow-xs transition-colors font-bold uppercase tracking-wider"
            >
              Shop All Products
            </Link>
          </div>
        </div>

        <div className="hidden md:flex relative z-10 w-64 h-64 bg-emerald-100 rounded-full items-center justify-center border-4 border-white shadow-xs">
          <span className="text-7xl">🛒</span>
        </div>
      </div>

      {/* PRODUCTS SECTION BY CATEGORY */}
      <div>
        {loading ? (
          <div className="space-y-5 sm:space-y-8 lg:space-y-10">
            {[...Array(2)].map((_, catIdx) => (
              <div key={catIdx} className="space-y-2 sm:space-y-3">
                <div className="h-6 w-48 bg-gray-100 rounded-md animate-pulse px-4 sm:px-0"></div>
                <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-3 scrollbar-none px-4 -mx-4 sm:mx-0 sm:px-0">
                  {[...Array(4)].map((_, n) => (
                    <div
                      key={n}
                      className="flex-shrink-0 w-[155px] xs:w-[175px] sm:w-[195px] md:w-[210px] lg:w-[220px] snap-start bg-white border border-gray-300 rounded-xl p-3 flex flex-col justify-between h-[300px] animate-pulse"
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
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-xl font-bold animate-fade">
            ⚠️ {error}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-xl max-w-xl mx-auto p-6 animate-fade">
            <p className="text-gray-600 text-sm tracking-wide font-bold">
              We couldn't find any products right now.
            </p>
          </div>
        ) : (
          <div className="space-y-5 sm:space-y-8 lg:space-y-10">
            {Object.entries(
              products.reduce((acc, product) => {
                const category = product.category || 'Other Essentials';
                if (!acc[category]) acc[category] = [];
                acc[category].push(product);
                return acc;
              }, {})
            ).map(([categoryName, categoryProducts]) => (
              <div key={categoryName} className="animate-fade-in-up space-y-2 sm:space-y-3">
                <div className="flex justify-between items-end mb-1 px-4 sm:px-0">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 tracking-tight uppercase">
                      {categoryName}
                    </h2>
                    <p className="text-[10px] sm:text-xs text-gray-500 font-semibold mt-0.5">
                      Fresh picks in {categoryName.toLowerCase()}
                    </p>
                  </div>

                  <Link
                    to={`/browse?category=${encodeURIComponent(categoryName)}`}
                    className="text-[10px] sm:text-xs text-emerald-600 hover:text-emerald-700 uppercase tracking-widest font-bold hover:underline flex items-center gap-1"
                  >
                    View More <span className="text-[8px]">▶</span>
                  </Link>
                </div>

                <CategoryCarousel
                  categoryProducts={categoryProducts}
                  onOpenRoutineModal={handleOpenRoutineModalTrigger}
                  activeRoutineProduct={activeRoutineProduct}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* INFORMATIONAL SUMMARY INFO AREA */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center space-y-4 relative overflow-hidden shadow-xs animate-fade">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight uppercase">
          Custom Routine Grocery Staging
        </h2>
        <p className="text-gray-700 text-sm max-w-xl mx-auto leading-relaxed font-semibold">
          Organize products into personalized folders like{' '}
          <span className="text-emerald-600 font-extrabold">"Breakfast Items"</span>{' '}
          or{' '}
          <span className="text-emerald-600 font-extrabold">"Office Snacks"</span>.
          Re-order items inside custom routines with detached counts whenever you want!
        </p>
      </div>

      {/* FIXED PORTAL MODAL */}
      <RoutineOrganizerModal
        activeRoutineProduct={activeRoutineProduct}
        routinesList={routinesList}
        onClose={closeRoutineModal}
        onAddToExisting={handleAddToExistingRoutineFromModal}
        onCreateNew={(name) => {
          addToRoutine(activeRoutineProduct, activeVariantName, 1, name);
          closeRoutineModal();
        }}
      />

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

export default Home;