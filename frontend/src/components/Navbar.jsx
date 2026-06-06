// frontend/src/components/Navbar.jsx
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';
import useOutsideClick from '../hooks/useOutsideClick';
import QuantityStepper from './QuantityStepper';
import { reverseGeocodeAndValidate } from '../utils/locationHelper';

const Navbar = () => {
  const { userInfo, logout } = useContext(AuthContext);
  const { 
    cartItems, 
    routinesList, 
    activeRoutine, 
    setActiveRoutine, 
    addToCart, 
    addToRoutine,
    deleteRoutine, 
    createEmptyRoutine,
    checkoutEntireRoutine
  } = useContext(CartContext); 
  const navigate = useNavigate();
  const location = useLocation();

  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showRoutineDropdown, setShowRoutineDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [routineSearch, setRoutineSearch] = useState('');
  
  const [searchVariantsState, setSearchVariantsState] = useState({});
  const [navNewRoutineName, setNavNewRoutineName] = useState('');
  const [isConfirmingCreate, setIsConfirmingCreate] = useState(false);
  const [confirmDeleteName, setConfirmDeleteName] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showMobileProfileDropdown, setShowMobileProfileDropdown] = useState(false);
  const [openSearchDropdownId, setOpenSearchDropdownId] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // LOCAL DROPDOWN SEARCH ENGINE CONTROLLER STATE
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [dynamicCategoriesList, setDynamicCategoriesList] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [mapSearchTerm, setMapSearchTerm] = useState('');
  const [executeSearch, setExecuteSearch] = useState(null);
  const [mapSuggestions, setMapSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [executeSuggestionClick, setExecuteSuggestionClick] = useState(null);
  const mapSearchRef = useRef(null);

  const profileRef = useRef(null);
  const mobileProfileRef = useRef(null);
  const routineRef = useRef(null);
  const mobileRoutineRef = useRef(null);
  const categoryRef = useRef(null);
  const searchRef = useRef(null);

  const [deliveryLocation, setDeliveryLocation] = useState(
    localStorage.getItem('deliveryLocation')
      ? JSON.parse(localStorage.getItem('deliveryLocation'))
      : null
  );
  const [showMapModal, setShowMapModal] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [calculatedDistance, setCalculatedDistance] = useState(null);
  const [geocodedAddress, setGeocodedAddress] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedPostcode, setSelectedPostcode] = useState(() => {
    try {
      const loc = localStorage.getItem('deliveryLocation');
      return loc ? JSON.parse(loc).postcode || '' : '';
    } catch (e) {
      return '';
    }
  });
  const [selectedStreetAndArea, setSelectedStreetAndArea] = useState(() => {
    try {
      const loc = localStorage.getItem('deliveryLocation');
      return loc ? JSON.parse(loc).streetAndArea || '' : '';
    } catch (e) {
      return '';
    }
  });

  const martCoords = [11.1085, 77.3411]; // DailyMart Central Hub in Tiruppur

  // Sync delivery location changes across other components/pages instantly
  useEffect(() => {
    const handleLocationChange = (e) => {
      setDeliveryLocation(e.detail);
    };
    window.addEventListener('deliveryLocationChanged', handleLocationChange);
    return () => {
      window.removeEventListener('deliveryLocationChanged', handleLocationChange);
    };
  }, []);

  // Live location suggestions with debounce
  useEffect(() => {
    if (!mapSearchTerm || mapSearchTerm.trim().length <= 2) {
      setMapSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const query = `${mapSearchTerm.trim()}, Tiruppur, Tamil Nadu, India`;
        const { data } = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=12`);
        if (data) {
          setMapSuggestions(data);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error('Suggestions Load Error:', err);
      }
    }, 450); // 450ms debounce to avoid Nominatim rate-limits

    return () => clearTimeout(timer);
  }, [mapSearchTerm]);

  // Click outside listener for suggestions dropdown
  useOutsideClick(mapSearchRef, () => setShowSuggestions(false));

  useEffect(() => {
    if (showMapModal) {
      const initTimer = setTimeout(async () => {
        if (!mapContainerRef.current) return;

        // 20 km bounding box around martCoords [11.1085, 77.3411]
        const storeBounds20km = window.L.latLngBounds(
          window.L.latLng(10.9284, 77.1575),
          window.L.latLng(11.2886, 77.5247)
        );

        const map = window.L.map(mapContainerRef.current, {
          center: martCoords,
          zoom: 12,
          minZoom: 11,
          maxZoom: 18,
          maxBounds: storeBounds20km,
          maxBoundsViscosity: 1.0
        });

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // Custom icon for Mart (Green)
        const martIcon = window.L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        // Custom icon for User (Red)
        const userIcon = window.L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        // Fixed Mart Marker
        window.L.marker(martCoords, { icon: martIcon })
          .addTo(map)
          .bindPopup('<b>DailyMart Hub (Tiruppur)</b><br>Central Depot Location')
          .openPopup();

        mapInstanceRef.current = map;

        const handleLocationSelection = async (lat, lng, markerToUpdate) => {
          const result = await reverseGeocodeAndValidate(lat, lng);
          
          if (!result.valid) {
            alert(result.error);
            if (markerToUpdate && mapInstanceRef.current) {
              mapInstanceRef.current.removeLayer(markerToUpdate);
            }
            userMarkerRef.current = null;
            setSelectedCoords(null);
            setCalculatedDistance(null);
            setGeocodedAddress('');
            setSelectedArea('');
            setSelectedPostcode('');
            setSelectedStreetAndArea('');
            return;
          }

          setSelectedCoords([result.lat, result.lng]);
          setCalculatedDistance(result.distance);
          setGeocodedAddress(result.address);
          setSelectedArea(result.area);
          setSelectedPostcode(result.postcode);
          setSelectedStreetAndArea(result.streetAndArea);

          if (markerToUpdate) {
            markerToUpdate.bindPopup(`<b>Delivery Spot</b><br>${result.address}`).openPopup();
          }
        };

        // Restore previous location if exist
        if (deliveryLocation) {
          const prevCoords = [deliveryLocation.lat, deliveryLocation.lng];
          setSelectedCoords(prevCoords);
          setCalculatedDistance(deliveryLocation.distance);
          setGeocodedAddress(deliveryLocation.address || '');
          setSelectedArea(deliveryLocation.area || '');
          setSelectedPostcode(deliveryLocation.postcode || '');
          setSelectedStreetAndArea(deliveryLocation.streetAndArea || '');

          const marker = window.L.marker(prevCoords, { icon: userIcon, draggable: true }).addTo(map);
          marker.bindPopup(`<b>Your Delivery Point</b><br>${deliveryLocation.address || ''}`).openPopup();

          marker.on('dragend', (e) => {
            const newPos = e.target.getLatLng();
            handleLocationSelection(newPos.lat, newPos.lng, marker);
          });

          userMarkerRef.current = marker;
          map.setView(prevCoords, 13);
        }

        map.on('click', (e) => {
          const { lat, lng } = e.latlng;
          const dist = (window.L.latLng(martCoords).distanceTo(e.latlng) / 1000);
          
          if (dist > 20) {
            alert("⚠️ Delivery Boundary Restriction: Please select a location within 20 km of the store.");
            return;
          }

          if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng(e.latlng);
            handleLocationSelection(lat, lng, userMarkerRef.current);
          } else {
            const marker = window.L.marker([lat, lng], { icon: userIcon, draggable: true }).addTo(map);
            userMarkerRef.current = marker;
            handleLocationSelection(lat, lng, marker);
            
            marker.on('dragend', (event) => {
              const newPos = event.target.getLatLng();
              handleLocationSelection(newPos.lat, newPos.lng, marker);
            });
          }
        });

        const handleSearch = async (searchTerm) => {
          if (!searchTerm || !searchTerm.trim()) return;
          const query = `${searchTerm.trim()}, Tiruppur, Tamil Nadu, India`;
          try {
            const { data } = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            if (data && data.length > 0) {
              const firstResult = data[0];
              const lat = parseFloat(firstResult.lat);
              const lng = parseFloat(firstResult.lon);
              
              const latLng = window.L.latLng(lat, lng);
              const dist = (window.L.latLng(martCoords).distanceTo(latLng) / 1000);
              if (dist > 20) {
                alert("⚠️ Search Bound Alert: The location found is more than 20 km away from the store. DailyMart only delivers within a 20 km radius.");
                return;
              }

              if (mapInstanceRef.current) {
                mapInstanceRef.current.setView([lat, lng], 14);
                
                if (userMarkerRef.current) {
                  userMarkerRef.current.setLatLng([lat, lng]);
                  handleLocationSelection(lat, lng, userMarkerRef.current);
                } else {
                  const marker = window.L.marker([lat, lng], { icon: userIcon, draggable: true }).addTo(mapInstanceRef.current);
                  userMarkerRef.current = marker;
                  handleLocationSelection(lat, lng, marker);
                  
                  marker.on('dragend', (event) => {
                    const newPos = event.target.getLatLng();
                    handleLocationSelection(newPos.lat, newPos.lng, marker);
                  });
                }
              }
            } else {
              alert("🔍 Location not found. Please try searching for a different landmark or area in Tiruppur.");
            }
          } catch (err) {
            alert("❌ Error searching for location. Please check your internet connection.");
          }
        };

        const handleSuggestionClick = (lat, lng, displayName) => {
          const latLng = window.L.latLng(lat, lng);
          const dist = (window.L.latLng(martCoords).distanceTo(latLng) / 1000);
          if (dist > 20) {
            alert("⚠️ Search Bound Alert: The selected suggestion is more than 20 km away from the store.");
            return;
          }

          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([lat, lng], 14);
            
            if (userMarkerRef.current) {
              userMarkerRef.current.setLatLng([lat, lng]);
              handleLocationSelection(lat, lng, userMarkerRef.current);
            } else {
              const marker = window.L.marker([lat, lng], { icon: userIcon, draggable: true }).addTo(mapInstanceRef.current);
              userMarkerRef.current = marker;
              handleLocationSelection(lat, lng, marker);
              
              marker.on('dragend', (event) => {
                const newPos = event.target.getLatLng();
                handleLocationSelection(newPos.lat, newPos.lng, marker);
              });
            }
          }
        };

        setExecuteSearch(() => handleSearch);
        setExecuteSuggestionClick(() => handleSuggestionClick);

      }, 150);

      return () => {
        clearTimeout(initTimer);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
        userMarkerRef.current = null;
        setExecuteSearch(null);
        setExecuteSuggestionClick(null);
      };
    }
  }, [showMapModal, deliveryLocation]);

  useEffect(() => {
    const handleLogout = () => {
      setDeliveryLocation(null);
    };
    window.addEventListener('userLogout', handleLogout);
    return () => window.removeEventListener('userLogout', handleLogout);
  }, []);

  const handleConfirmLocation = () => {
    if (!selectedCoords) {
      alert("Please select a delivery location on the map first.");
      return;
    }
    const locObj = {
      lat: selectedCoords[0],
      lng: selectedCoords[1],
      address: geocodedAddress || `${selectedCoords[0].toFixed(4)}, ${selectedCoords[1].toFixed(4)}`,
      area: selectedArea || '',
      distance: calculatedDistance,
      postcode: selectedPostcode || '',
      streetAndArea: selectedStreetAndArea || ''
    };
    localStorage.setItem('deliveryLocation', JSON.stringify(locObj));
    setDeliveryLocation(locObj);
    setShowMapModal(false);

    // Dispatch custom event to notify other components instantly
    const event = new CustomEvent('deliveryLocationChanged', { detail: locObj });
    window.dispatchEvent(event);
  };

  // Essential store departments with customized, precise contextual emojis
  const essentialCategories = [
    { label: 'All Products', query: 'All Products', icon: '📦' },
    { label: 'Dairy & Milk Products', query: 'Dairy & Milk Products', icon: '🥛' },
    { label: 'Home Essentials', query: 'Home Essentials', icon: '🧻' },
    { label: 'Fruits & Vegetables', query: 'Fruits & Vegetables', icon: '🥦' },
    { label: 'Personal Care Products', query: 'Personal Care Products', icon: '🧼' },
    { label: 'Kitchen Essentials', query: 'Kitchen Essentials', icon: '🧂' }
  ];

  const activeEssentialCategories = React.useMemo(() => {
    return essentialCategories.filter(cat =>
      cat.query === 'All Products' ||
      allProducts.some(p => p.category && p.category.toLowerCase() === cat.query.toLowerCase())
    );
  }, [allProducts]);


  // HYBRID ENGINE FETCH: Grabs master inventory dynamically and cross-compiles admin-defined categories
  const compileStoreCategoriesLayout = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/products');
      setAllProducts(data);
      
      const extractedCategories = [...new Set(data.map(p => p.category).filter(Boolean))];

      const staticQueriesList = essentialCategories.map(c => c.query.toLowerCase());
      const extraAdminCategories = extractedCategories.filter(
        catName => !staticQueriesList.includes(catName.toLowerCase())
      );

      const formattedAdminCategories = extraAdminCategories.map(cat => ({
        label: cat,
        query: cat,
        icon: '🏷️' 
      }));

      setDynamicCategoriesList(formattedAdminCategories);
    } catch (err) {
      console.error('Dynamic layout compilation failed:', err.message);
    }
  }, []);

  useEffect(() => {
    compileStoreCategoriesLayout();
  }, [compileStoreCategoriesLayout, cartItems]);

  useEffect(() => {
    window.addEventListener('productsUpdated', compileStoreCategoriesLayout);
    const interval = setInterval(compileStoreCategoriesLayout, 5500);
    return () => {
      window.removeEventListener('productsUpdated', compileStoreCategoriesLayout);
      clearInterval(interval);
    };
  }, [compileStoreCategoriesLayout]);
 

  useEffect(() => {
    const path = location.pathname;
    if (!path.startsWith('/routine') && path !== '/cart' && path !== '/checkout') {
      setActiveRoutine(null);
    }
  }, [location.pathname, setActiveRoutine]);

  useEffect(() => {
     const handleClickOutside = (event) => {
       if (profileRef.current && !profileRef.current.contains(event.target)) {
         setShowProfileDropdown(false);
       }
       if (mobileProfileRef.current && !mobileProfileRef.current.contains(event.target) && !event.target.closest('.mobile-profile-portal')) {
         setShowMobileProfileDropdown(false);
       }
       if (
         (!routineRef.current || !routineRef.current.contains(event.target)) && 
         (!mobileRoutineRef.current || !mobileRoutineRef.current.contains(event.target)) && 
         !event.target.closest('.mobile-routine-portal')
       ) {
         setShowRoutineDropdown(false);
         setConfirmDeleteName(null); 
         setIsConfirmingCreate(false);
       }
       if (categoryRef.current && !categoryRef.current.contains(event.target) && !event.target.closest('.mobile-category-portal')) {
         setShowCategoryDropdown(false);
         setCategorySearchTerm(''); // Flush category input value smoothly on focus loss
       }
       if (searchRef.current && !searchRef.current.contains(event.target)) {
         setShowSearchDropdown(false);
         setOpenSearchDropdownId(null);
       }
     };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (keyword.trim()) {
      const delayDebounce = setTimeout(async () => {
        try {
          const { data } = await axios.get(`/api/products?keyword=${keyword}`);
          setSearchResults(data);
          setShowSearchDropdown(true);

          const initialVariantsMap = {};
          data.forEach(product => {
            if (product.variants && product.variants.length > 0) {
              initialVariantsMap[product._id] = product.variants[0].name;
            }
          });
          setSearchVariantsState(prev => ({ ...initialVariantsMap, ...prev }));
        } catch (err) {
          console.error(err.message);
        }
      }, 200);
      return () => clearTimeout(delayDebounce);
    } else {
      setSearchResults([]); 
      setShowSearchDropdown(false);
    }
  }, [keyword]);

  const handleCartClick = (e) => {
    if (activeRoutine) {
      e.preventDefault();
      const targetRoutineItems = cartItems.filter((item) => item.routineName === activeRoutine);
      if (targetRoutineItems.length > 0) {
        checkoutEntireRoutine(activeRoutine);
      }
      setActiveRoutine(null);
      navigate('/cart');
    }
  };

  const handleOpenRoutineCart = (routineName) => {
    setConfirmDeleteName(null);
    setIsConfirmingCreate(false);
    setActiveRoutine(routineName);
    navigate(`/routine/${encodeURIComponent(routineName)}`);
    setTimeout(() => {
      setShowRoutineDropdown(false);
    }, 50);
  };

  const handleNavTriggerCreateStage = (e) => {
    e.preventDefault();
    if (!userInfo) {
      alert('Please sign in to manage or create custom routines.');
      return;
    }
    if (!navNewRoutineName.trim()) return;
    if (routinesList.includes(navNewRoutineName.trim())) {
      alert('A routine folder with this name identity already exists.');
      return;
    }
    setIsConfirmingCreate(true);
  };

  const handleNavConfirmCreate = () => {
    const freshName = navNewRoutineName.trim();
    if (!freshName) return;
    createEmptyRoutine(freshName);
    setNavNewRoutineName('');
    setIsConfirmingCreate(false);
  };

  const handleNavConfirmDelete = (routineName) => {
    deleteRoutine(routineName);
    setConfirmDeleteName(null);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setShowSearchDropdown(false);
    navigate(`/search?q=${encodeURIComponent(keyword)}`);
  };

  const handleSearchRowQtyMutation = (product, targetVariantSpecs, currentQty, delta) => {
    if (activeRoutine && !userInfo) {
      alert('Please log in to alter routine layout states.');
      return;
    }

    const computedFinalQty = currentQty + delta;
    if (computedFinalQty < 0) return;
    
    const variantTotalAllocated = cartItems
      .filter(item => item.product === product._id && item.variantName === targetVariantSpecs.name)
      .reduce((acc, item) => acc + item.qty, 0);

    const inventoryDelta = computedFinalQty - currentQty;

    if (variantTotalAllocated + inventoryDelta > targetVariantSpecs.countInStock) {
      alert(`Multi-User Allocation Restriction: Only ${Math.max(0, targetVariantSpecs.countInStock - variantTotalAllocated)} units left available for purchase.`);
      return;
    }

    const packedProductPayload = {
      ...product,
      variants: product.variants || []
    };

    if (activeRoutine) {
      addToRoutine(packedProductPayload, targetVariantSpecs.name, computedFinalQty, activeRoutine);
    } else {
      addToCart(packedProductPayload, targetVariantSpecs.name, computedFinalQty);
    }
  };

  const filteredRoutines = routinesList.filter((routineName) =>
    routineName.toLowerCase().includes(routineSearch.toLowerCase())
  );

  const totalCartQty = cartItems
    .filter((item) => (activeRoutine ? item.routineName === activeRoutine : !item.routineName))
    .reduce((acc, item) => acc + item.qty, 0);

  const buildDynamicBreadcrumbs = () => {
    const searchParams = new URLSearchParams(location.search);
    const categoryParam = searchParams.get('category');
    const selectedProdParam = searchParams.get('selectedProduct');
    const pathSegments = location.pathname.split('/').filter(Boolean);

    const crumbTree = [{ label: 'Home', url: '/' }];

    if (pathSegments.length === 0) {
      return crumbTree;
    }

    if (pathSegments[0] === 'browse') {
      crumbTree.push({ label: 'Browse', url: '/browse' });
      if (categoryParam) {
        crumbTree.push({ label: decodeURIComponent(categoryParam), url: `/browse?category=${categoryParam}` });
      }
      if (selectedProdParam) {
        crumbTree.push({ label: decodeURIComponent(selectedProdParam), url: `/browse?selectedProduct=${selectedProdParam}` });
      }
    } else if (pathSegments[0] === 'routine' && pathSegments[1]) {
      crumbTree.push({ label: 'Routines', url: '/browse' });
      crumbTree.push({ label: decodeURIComponent(pathSegments[1]), url: location.pathname });
    } else if (pathSegments[0]) {
      crumbTree.push({ label: pathSegments[0].toUpperCase(), url: location.pathname });
    }

    return crumbTree;
  };

  const currentCrumbs = buildDynamicBreadcrumbs();

  // FILTER LOGIC MATRICES: Filter arrays natively against category input parameters
  const filteredEssentialCategories = activeEssentialCategories.filter(cat => 
    cat.label.toLowerCase().includes(categorySearchTerm.toLowerCase())
  );

  const filteredDynamicCategories = dynamicCategoriesList.filter(cat => 
    cat.label.toLowerCase().includes(categorySearchTerm.toLowerCase())
  );

  return (
    <header id="sticky-header" className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm font-sans text-gray-700">
      <style>{`
        @keyframes trolleyJerkEffect {
          0% { transform: scale(1) rotate(0deg); }
          20% { transform: scale(1.25) rotate(-10deg); }
          40% { transform: scale(0.9) rotate(8deg); }
          60% { transform: scale(1.1) rotate(-4deg); }
          80% { transform: scale(0.95) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .animate-trolley-jerk { display: inline-block; animation: trolleyJerkEffect 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
        @keyframes dropdownReveal {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-dropdown-fade { animation: dropdownReveal 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes pinBobbing { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .hover-pin-bounce:hover .pin-emoji { animation: pinBobbing 0.6s ease-in-out infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { bg-color: #cbd5e1; border-radius: 4px; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="max-w-[1400px] mx-auto px-4 py-2 lg:py-3.5 flex flex-col lg:flex-row items-center justify-between gap-2 lg:gap-4">
        <div className="flex items-center justify-between w-full lg:w-auto gap-4">
          <div className="flex items-center gap-2">
            <Link to="/" onClick={() => setActiveRoutine(null)} className="text-xl lg:text-2xl font-semibold text-emerald-600 tracking-tight flex items-center">
              Daily<span className="text-red-500">Mart</span>
            </Link>
            {activeRoutine && (
              <span className="bg-amber-400 text-gray-900 text-[9px] lg:text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse max-w-[100px] truncate">
                {activeRoutine}
              </span>
            )}
          </div>

          {/* Mobile Profile & Actions Trigger (rendered opposite the logo on mobile/tablet) */}
          <div className="lg:hidden flex items-center gap-3 sm:gap-4 relative animate-fade">
            
            {/* Location selector trigger */}
            <div 
              onClick={() => setShowMapModal(true)}
              className="hover-pin-bounce flex items-center gap-0.5 text-gray-700 hover:text-emerald-600 transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wide"
            >
              <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0 transition-transform pin-emoji inline-block" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span className="underline decoration-dotted underline-offset-4 text-gray-700 truncate max-w-[50px] xs:max-w-[70px]">
                {deliveryLocation ? `${deliveryLocation.distance} km` : "Loc"}
              </span>
            </div>

            {/* Routines Dropdown Selector */}
            <div className="relative" ref={mobileRoutineRef}>
              <button
                type="button"
                onClick={() => {
                  setShowRoutineDropdown(!showRoutineDropdown);
                  setRoutineSearch('');
                  setNavNewRoutineName('');
                  setConfirmDeleteName(null);
                  setIsConfirmingCreate(false);
                }}
                className="px-2 py-1 color-wheel-btn text-[9px] font-bold rounded flex items-center justify-center cursor-pointer shadow-3xs"
              >
                <span className="color-wheel-btn-content">📂 Routines</span>
              </button>
            </div>

            {/* Cart Link */}
            <Link key={`mobile-${totalCartQty}`} to="/cart" onClick={handleCartClick} className="relative flex items-center p-1 text-gray-700 hover:text-emerald-600 transition-all">
              <span className={`text-lg ${totalCartQty > 0 ? 'animate-trolley-jerk' : 'hover:scale-110 transition-transform'}`}>
                {activeRoutine ? '📁' : '🛒'}
              </span>
              {totalCartQty > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-gray-900 text-white text-[9px] font-bold rounded-full px-1.5 py-0.2 border border-white">
                  {totalCartQty}
                </span>
              )}
            </Link>

            {/* Profile Avatar trigger */}
            <div className="relative" ref={mobileProfileRef}>
              {userInfo ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowMobileProfileDropdown(!showMobileProfileDropdown)}
                    className="text-gray-900 outline-none focus:outline-none flex items-center pt-1 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center font-bold text-xs uppercase text-gray-700 hover:border-emerald-500 hover:text-emerald-600 transition-all">
                      {userInfo.name.charAt(0)}
                    </div>
                  </button>
                  {showMobileProfileDropdown && createPortal(
                    <div 
                      className="mobile-profile-portal fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 text-left" 
                      style={{ zIndex: 9999999 }}
                      onClick={() => setShowMobileProfileDropdown(false)}
                    >
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl border-t-4 border-t-emerald-600 border border-gray-200 p-5 shadow-2xl space-y-3 relative w-full max-w-[280px] text-xs font-bold divide-y divide-gray-100 flex flex-col animate-fadeIn"
                      >
                        <div className="flex justify-between items-center pb-2 border-b border-gray-150">
                          <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">👤 My Profile</h3>
                          <button 
                            type="button" 
                            onClick={() => setShowMobileProfileDropdown(false)} 
                            className="text-gray-400 hover:text-gray-700 font-black text-xs uppercase cursor-pointer"
                          >
                            Close ×
                          </button>
                        </div>

                        <div className="py-2 text-gray-600 font-bold truncate">Hello, <span className="text-gray-900 font-black">{userInfo.name}</span></div>
                        <div className="py-2 flex flex-col space-y-0.5">
                          {userInfo.isAdmin && (
                            <Link to="/admin" onClick={() => setTimeout(() => setShowMobileProfileDropdown(false), 50)} className="block px-3 py-2 text-amber-800 hover:bg-amber-50 rounded-lg transition-colors font-black tracking-wide uppercase text-[10px]">👑 Admin Dashboard</Link>
                          )}
                          <Link to="/admin-demo" onClick={() => setTimeout(() => setShowMobileProfileDropdown(false), 50)} className="block px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">📊 Admin Panel (View Only - Demo)</Link>
                          <Link to="/profile" onClick={() => setTimeout(() => setShowMobileProfileDropdown(false), 50)} className="block px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">👤 My Profile</Link>
                        </div>
                        <div className="pt-2">
                          <button type="button" onClick={() => { setShowMobileProfileDropdown(false); logout(); navigate('/login'); }} className="w-full text-left px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors font-bold uppercase tracking-wider text-[10px] cursor-pointer">
                            🚪 Log Out
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                </>
              ) : (
                <Link to="/login" className="text-gray-700 hover:text-emerald-600 transition-all pt-1">
                  <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center font-black text-xs">👤</div>
                </Link>
              )}
            </div>

          </div>
        </div>

        <div className="relative w-full lg:max-w-2xl flex-grow mx-2" ref={searchRef}>
          <form onSubmit={handleSearchSubmit} className="group relative flex items-center border border-gray-300 rounded-lg overflow-hidden bg-gray-50 focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all">
            <input
              type="text"
              placeholder={activeRoutine ? `Search and append products into "${activeRoutine}" workspace context...` : "Search for groceries, snacks, brands..."}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onFocus={() => keyword.trim() && setShowSearchDropdown(true)}
              className="w-full px-4 py-2 text-sm font-normal text-gray-900 bg-transparent placeholder-gray-400 outline-none"
            />
            <button type="submit" className="px-4 text-gray-600 hover:text-emerald-600 group-focus-within:scale-110 transition-transform duration-200 cursor-pointer">
              🔍
            </button>
          </form>

          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 border-t-4 border-t-emerald-600 rounded-xl shadow-2xl z-50 max-h-[350px] md:max-h-[460px] overflow-y-auto p-2 sm:p-3 space-y-2 custom-scrollbar animate-dropdown-fade w-full">
              <div className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-wider border-b pb-1 mb-1 text-left">Live Search Feature Catalog Matches</div>
              
              {searchResults.map((product) => {
                const currentSelectedVariantName = searchVariantsState[product._id] || product.variants?.[0]?.name || '';
                const activeVariantSpecs = product.variants?.find(v => v.name === currentSelectedVariantName) || { price: 0, originalPrice: 0, countInStock: 0 };
                
                const originalPriceVal = Number(activeVariantSpecs.originalPrice || activeVariantSpecs.price);
                const sellingPriceVal = Number(activeVariantSpecs.price);
                const discountPct = originalPriceVal > sellingPriceVal ? Math.round(((originalPriceVal - sellingPriceVal) / originalPriceVal) * 100) : 0;

                const activeCartInstance = cartItems.find(item => 
                  item.product === product._id && 
                  item.variantName === currentSelectedVariantName && 
                  (activeRoutine ? item.routineName === activeRoutine : !item.routineName)
                );
                const inlineCount = activeCartInstance ? activeCartInstance.qty : 0;

                const variantTotalAllocated = cartItems
                  .filter(item => item.product === product._id && item.variantName === currentSelectedVariantName)
                  .reduce((acc, item) => acc + item.qty, 0);
                const remainingStock = Math.max(0, activeVariantSpecs.countInStock - variantTotalAllocated);
                const isOutOfStock = remainingStock === 0;

                // Find related in-stock products as substitutes
                const substitutes = allProducts.filter((p) => {
                  if (p._id === product._id) return false;
                  
                  // Must have stock
                  const hasStock = p.variants?.some(v => {
                    const allocated = cartItems.filter(item => item.product === p._id && item.variantName === v.name).reduce((acc, item) => acc + item.qty, 0);
                    return v.countInStock > allocated;
                  });
                  if (!hasStock) return false;

                  // Match category or name overlap
                  const sameCategory = p.category && product.category && p.category.toLowerCase() === product.category.toLowerCase();
                  const nameOverlap = p.name.toLowerCase().split(' ').some(word => 
                    word.length > 2 && product.name.toLowerCase().includes(word)
                  );
                  
                  return sameCategory || nameOverlap;
                }).slice(0, 3);

                return (
                  <div key={product._id} className="space-y-1.5">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2.5 hover:border-gray-400 transition-all">
                      {/* Top section on mobile, left on desktop */}
                      <div className="flex items-center justify-between w-full sm:w-auto min-w-0 gap-2">
                        <div className="flex items-center gap-2 flex-grow min-w-0">
                          <img src={product.image} alt="" className="w-9 h-9 sm:w-11 sm:h-11 object-contain bg-white border rounded-lg p-0.5 flex-shrink-0" />
                          <div className="truncate text-left min-w-0">
                            <h4 className="font-bold text-gray-900 text-[11px] sm:text-xs truncate block leading-tight">{product.name}</h4>
                            <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-amber-500 font-bold mt-0.5 flex-wrap">
                              <span>★ {product.rating || '4.3'}</span>
                              <span className={`${remainingStock === 0 ? 'text-red-500 font-extrabold' : 'text-gray-400'} font-bold`}>
                                | {remainingStock === 0 ? 'Out of Stock' : `Stock: ${remainingStock}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Mobile Price info (hidden on sm+) */}
                        {!activeRoutine && (
                          <div className="text-right min-w-[55px] flex flex-col items-end leading-none justify-center flex-shrink-0 sm:hidden">
                            <span className="text-green-700 font-extrabold text-[11px]">₹{sellingPriceVal}</span>
                            {discountPct > 0 && (
                              <div className="flex items-center gap-0.5 text-[8px] mt-0.5">
                                <span className="text-gray-400 line-through text-[8px]">₹{Math.round(originalPriceVal)}</span>
                                <span className="text-red-500 font-extrabold bg-red-55 px-0.5 rounded text-[8px]">-{discountPct}%</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Mobile Add Routine Button (only if activeRoutine is true, hidden on sm+) */}
                        {activeRoutine && (
                          <div className="flex-shrink-0 w-[80px] sm:hidden">
                            <button
                              type="button"
                              disabled={remainingStock === 0}
                              onClick={() => handleSearchRowQtyMutation(product, activeVariantSpecs, inlineCount, 1)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[8px] font-bold uppercase tracking-wider px-2 py-1.5 rounded transition-all disabled:bg-gray-200 disabled:text-gray-400 cursor-pointer w-full text-center h-6 flex items-center justify-center"
                            >
                              {inlineCount > 0 ? `✓ (${inlineCount})` : 'Add Routine'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Divider on mobile - only when not activeRoutine */}
                      {!activeRoutine && (
                        <div className="w-full border-t border-gray-200/60 my-0.5 sm:hidden"></div>
                      )}

                      {/* Bottom section on mobile, right side on desktop */}
                      <div className={`flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto flex-shrink-0 ${activeRoutine ? 'hidden sm:flex' : ''}`}>
                        {/* Variant selector dropdown (only if not activeRoutine) */}
                        {!activeRoutine && (
                          <div className="flex-shrink-0">
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenSearchDropdownId(openSearchDropdownId === product._id ? null : product._id);
                                }}
                                className="py-0.5 pl-1.5 pr-4 text-[10px] sm:text-[11px] font-bold text-gray-750 border border-gray-300 rounded bg-white flex items-center gap-0.5 cursor-pointer focus:border-emerald-500 transition-colors min-w-[55px] sm:min-w-[70px] justify-between focus:outline-none h-6 sm:h-7"
                              >
                                <span>{currentSelectedVariantName}</span>
                                <span className="text-[6px] sm:text-[8px] text-gray-400 select-none">▼</span>
                              </button>

                              {openSearchDropdownId === product._id && (
                                <div className="absolute left-0 sm:left-auto sm:right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 max-h-36 overflow-y-auto custom-scrollbar border-t-2 border-t-emerald-600 min-w-[75px] overflow-hidden">
                                  {product.variants?.map(v => (
                                    <button
                                      key={v.name}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSearchVariantsState(prev => ({ ...prev, [product._id]: v.name }));
                                        setOpenSearchDropdownId(null);
                                      }}
                                      className={`w-full text-center px-1.5 py-1 text-[10px] sm:text-[11px] transition-colors hover:bg-emerald-50 hover:text-emerald-700 block focus:outline-none ${
                                        currentSelectedVariantName === v.name
                                          ? 'text-emerald-600 bg-emerald-50/50 font-extrabold'
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
                        )}

                        {/* Desktop Price info (hidden on mobile) */}
                        {!activeRoutine && (
                          <div className="hidden sm:flex text-right min-w-[55px] sm:min-w-[75px] flex-col items-end leading-none justify-center mx-1 flex-shrink-0">
                            <span className="text-green-700 font-extrabold text-[11px] sm:text-xs">₹{sellingPriceVal}</span>
                            {discountPct > 0 && (
                              <div className="flex items-center gap-0.5 text-[8px] sm:text-[9px] mt-0.5">
                                <span className="text-gray-400 line-through">₹{Math.round(originalPriceVal)}</span>
                                <span className="text-red-500 font-extrabold bg-red-55 px-0.5 rounded">-{discountPct}%</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Add button / Stepper (only visible if not activeRoutine on mobile, or always on desktop) */}
                        <div className="flex-shrink-0 w-[80px] sm:w-[100px] flex justify-end">
                          {activeRoutine ? (
                            <button
                              type="button"
                              disabled={remainingStock === 0}
                              onClick={() => handleSearchRowQtyMutation(product, activeVariantSpecs, inlineCount, 1)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[8px] sm:text-[9.5px] font-bold uppercase tracking-wider px-2 py-1.5 rounded transition-all disabled:bg-gray-200 disabled:text-gray-400 cursor-pointer w-full text-center h-6 sm:h-7 flex items-center justify-center"
                            >
                              {inlineCount > 0 ? `✓ (${inlineCount})` : 'Add Routine'}
                            </button>
                          ) : inlineCount > 0 ? (
                            <QuantityStepper
                              qty={inlineCount}
                              onIncrement={() => handleSearchRowQtyMutation(product, activeVariantSpecs, inlineCount, 1)}
                              onDecrement={() => handleSearchRowQtyMutation(product, activeVariantSpecs, inlineCount, -1)}
                              isIncrementDisabled={remainingStock === 0}
                              className="h-6 sm:h-7 w-full"
                              btnClassName="w-5 sm:w-6 text-xs"
                              valClassName="text-[10px] sm:text-xs"
                            />
                          ) : (
                            <button
                              type="button"
                              disabled={remainingStock === 0}
                              onClick={() => handleSearchRowQtyMutation(product, activeVariantSpecs, 0, 1)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[8px] sm:text-[9.5px] font-bold uppercase tracking-wider px-2 py-1.5 rounded transition-all disabled:bg-gray-200 disabled:text-gray-400 cursor-pointer w-full text-center h-6 sm:h-7 flex items-center justify-center"
                            >
                              {remainingStock > 0 ? '➕ Add' : 'Out Of Stock'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {isOutOfStock && substitutes.length > 0 && (
                      <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-2 text-left space-y-1.5 animate-row">
                        <div className="text-[9px] sm:text-[10px] text-amber-700 font-extrabold uppercase tracking-wider flex items-center gap-1 leading-none">
                          <span>💡 Alternative Suggestions (In Stock)</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5">
                          {substitutes.map((sub) => {
                            const subSelectedVariantName = sub.variants?.[0]?.name || '';
                            const subActiveVariantSpecs = sub.variants?.[0] || { price: 0 };
                            
                            const subCartInstance = cartItems.find(item => 
                              item.product === sub._id && 
                              item.variantName === subSelectedVariantName && 
                              (activeRoutine ? item.routineName === activeRoutine : !item.routineName)
                            );
                            const subInlineCount = subCartInstance ? subCartInstance.qty : 0;
                            const subVariantTotalAllocated = cartItems
                              .filter(item => item.product === sub._id && item.variantName === subSelectedVariantName)
                              .reduce((acc, item) => acc + item.qty, 0);
                            const subRemainingStock = Math.max(0, subActiveVariantSpecs.countInStock - subVariantTotalAllocated);

                            return (
                              <div key={sub._id} className="bg-white border border-gray-150 rounded-lg p-2 flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 truncate flex-grow">
                                  <img src={sub.image} alt="" className="w-7 h-7 object-contain bg-white border rounded p-0.5 flex-shrink-0" />
                                  <div className="truncate text-left min-w-0">
                                    <h5 className="font-bold text-gray-900 text-[11px] sm:text-xs truncate leading-none">{sub.name}</h5>
                                    {!activeRoutine && (
                                      <span className="text-[8.5px] sm:text-[9px] text-emerald-600 font-extrabold mt-0.5 block leading-none">{subSelectedVariantName} • ₹{subActiveVariantSpecs.price}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-shrink-0 w-[80px] sm:w-[90px] flex justify-end">
                                  {activeRoutine ? (
                                    <button
                                      type="button"
                                      disabled={subRemainingStock === 0}
                                      onClick={() => handleSearchRowQtyMutation(sub, subActiveVariantSpecs, subInlineCount, 1)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-2 py-1.5 rounded transition-all disabled:bg-gray-200 disabled:text-gray-400 cursor-pointer text-center h-5 sm:h-6 flex items-center justify-center w-full"
                                    >
                                      {subInlineCount > 0 ? `✓ (${subInlineCount})` : 'Add'}
                                    </button>
                                  ) : subInlineCount > 0 ? (
                                    <QuantityStepper
                                      qty={subInlineCount}
                                      onIncrement={() => handleSearchRowQtyMutation(sub, subActiveVariantSpecs, subInlineCount, 1)}
                                      onDecrement={() => handleSearchRowQtyMutation(sub, subActiveVariantSpecs, subInlineCount, -1)}
                                      isIncrementDisabled={subRemainingStock === 0}
                                      className="h-5 sm:h-6 w-full"
                                      btnClassName="w-4 sm:w-5 text-[10px]"
                                      valClassName="text-[9px] sm:text-[10px]"
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={subRemainingStock === 0}
                                      onClick={() => handleSearchRowQtyMutation(sub, subActiveVariantSpecs, 0, 1)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all disabled:bg-gray-200 disabled:text-gray-400 cursor-pointer text-center h-5 sm:h-6 flex items-center justify-center w-full"
                                    >
                                      {subRemainingStock > 0 ? '➕ Add' : 'No Stock'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden lg:flex items-center justify-end gap-5 text-sm flex-shrink-0">
          <div className="relative" ref={routineRef}>
            <button
              type="button"
              onClick={() => {
                setShowRoutineDropdown(!showRoutineDropdown);
                setRoutineSearch('');
                setNavNewRoutineName('');
                setConfirmDeleteName(null);
                setIsConfirmingCreate(false);
              }}
              className="px-2.5 py-1.5 sm:px-4 sm:py-2 color-wheel-btn color-wheel-btn-thick shadow-xs rounded-lg flex items-center gap-1 font-bold text-[10px] sm:text-xs tracking-wide uppercase transition-all duration-200 cursor-pointer"
            >
              <span className="color-wheel-btn-content">📂 ROUTINES <span className="text-[9px] opacity-80">▼</span></span>
            </button>

            {showRoutineDropdown && (() => {
              const dropdownElement = (
                <div 
                  className="mobile-routine-portal fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 lg:absolute lg:inset-auto lg:right-0 lg:left-auto lg:-translate-x-0 lg:mt-2 lg:w-80 lg:bg-white lg:border lg:border-gray-200 lg:rounded-xl lg:shadow-xl lg:p-4 lg:flex lg:flex-col lg:space-y-3.5 lg:animate-dropdown-fade lg:border-t-4 lg:border-t-emerald-600 lg:block"
                  style={isMobile ? { zIndex: 9999999 } : {}}
                  onClick={() => setShowRoutineDropdown(false)}
                >
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-2xl border-t-4 border-t-emerald-600 border border-gray-200 p-5 shadow-2xl space-y-4 relative w-full max-w-[340px] lg:max-w-none lg:w-auto lg:p-0 lg:border-none lg:shadow-none lg:rounded-none lg:bg-transparent flex flex-col text-left"
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-gray-150 lg:hidden">
                      <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1">
                        <span>📁 Routines Folders</span>
                      </h3>
                      <button 
                        type="button" 
                        onClick={() => setShowRoutineDropdown(false)} 
                        className="text-gray-400 hover:text-gray-700 font-black text-xs uppercase"
                      >
                        Close ×
                      </button>
                    </div>

                    {!isConfirmingCreate ? (
                      <form onSubmit={handleNavTriggerCreateStage} className="pb-3 border-b border-gray-100 flex flex-col space-y-1.5">
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Create Fresh Empty Routine</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            required
                            placeholder="e.g., Office Snacks, Diet Plan"
                            value={navNewRoutineName}
                            onChange={(e) => setNavNewRoutineName(e.target.value)}
                            className="h-9 min-w-0 flex-grow px-3 border border-gray-200 text-xs rounded-lg outline-none focus:border-emerald-500 bg-gray-50 font-bold text-gray-800"
                          />
                          <button type="submit" className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] uppercase tracking-wide px-4 rounded-lg shadow-2xs cursor-pointer flex-shrink-0 flex items-center justify-center">Create</button>
                        </div>
                      </form>
                    ) : (
                      <div className="pb-3 border-b border-gray-100 bg-emerald-50/60 border border-emerald-200 p-2 rounded-lg flex items-center justify-between gap-1 text-[11px]">
                        <span className="font-bold text-emerald-800 truncate">Build folder "{navNewRoutineName}"?</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <button type="button" onClick={handleNavConfirmCreate} className="bg-emerald-600 text-white font-black text-[9px] uppercase px-2 py-1 rounded-md hover:bg-emerald-700 shadow-3xs cursor-pointer">Confirm</button>
                          <button type="button" onClick={() => setIsConfirmingCreate(false)} className="bg-white border border-gray-300 text-gray-600 font-bold text-[9px] uppercase px-2 py-1 rounded-md hover:bg-gray-100">Cancel</button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Search & Manage Folders</label>
                      <input
                        type="text"
                        placeholder="Search custom routine folders..."
                        value={routineSearch}
                        onChange={(e) => setRoutineSearch(e.target.value)}
                        className="h-9 w-full px-3 border border-gray-200 text-xs rounded-lg outline-none focus:border-emerald-500 bg-gray-50 font-bold text-gray-800"
                      />
                    </div>

                    {!userInfo ? (
                      <p className="text-xs font-bold text-amber-800 text-center py-2 bg-amber-50 rounded-lg border border-amber-200">Please sign in to view your folders.</p>
                    ) : filteredRoutines.length === 0 ? (
                      <p className="text-xs font-bold text-gray-400 text-center py-4 italic border border-dashed rounded-lg bg-gray-50/50">No routines built yet.</p>
                    ) : (
                      <div className="max-h-44 overflow-y-auto custom-scrollbar divide-y divide-gray-100 pr-0.5">
                        {filteredRoutines.map((routineName) => {
                          const itemCount = cartItems.filter(item => item.routineName === routineName).length;
                          const isConfirming = confirmDeleteName === routineName;

                          return (
                            <div key={routineName} className="py-2.5 flex justify-between items-center text-xs gap-2 first:pt-0">
                              {!isConfirming ? (
                                <>
                                  <div className="truncate max-w-[130px]">
                                    <p className="font-bold text-gray-900 truncate">📁 {routineName}</p>
                                    <span className="text-[10px] text-gray-400 font-bold">{itemCount} items packed</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <button type="button" onClick={() => handleOpenRoutineCart(routineName)} className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-md hover:bg-emerald-600 transition-colors cursor-pointer">Open</button>
                                    <button type="button" onClick={() => { setConfirmDeleteName(routineName); setIsConfirmingCreate(false); }} className="text-[10px] text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors cursor-pointer" title="Delete Routine">🗑️</button>
                                  </div>
                                </>
                              ) : (
                                <div className="w-full bg-red-50/70 border border-red-200/60 rounded-lg p-2 flex items-center justify-between gap-1 text-[11px]">
                                  <span className="font-bold text-red-700">Delete folder?</span>
                                  <div className="flex gap-1">
                                    <button type="button" onClick={() => handleNavConfirmDelete(routineName)} className="bg-red-600 text-white font-black text-[9px] uppercase px-2 py-1 rounded-md hover:bg-red-700 shadow-3xs cursor-pointer">Confirm</button>
                                    <button type="button" onClick={() => setConfirmDeleteName(null)} className="bg-white border border-gray-300 text-gray-600 font-bold text-[9px] uppercase px-2 py-1 rounded-md hover:bg-gray-150">Cancel</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
              return isMobile ? createPortal(dropdownElement, document.body) : dropdownElement;
            })()}
          </div>

          <div 
            onClick={() => setShowMapModal(true)}
            className="hover-pin-bounce flex items-center gap-1 text-gray-700 hover:text-emerald-600 transition-colors cursor-pointer text-[10px] sm:text-xs font-bold uppercase tracking-wide"
          >
            <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0 transition-transform pin-emoji inline-block" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <span className="underline decoration-dotted underline-offset-4 text-gray-700 truncate max-w-[80px] xs:max-w-[120px] sm:max-w-[180px]">
              {deliveryLocation 
                ? `Delivery: Tiruppur (${deliveryLocation.distance} km)` 
                : "Set Delivery Location"}
            </span>
          </div>

          <Link key={totalCartQty} to="/cart" onClick={handleCartClick} className="relative flex items-center p-1 text-gray-700 hover:text-emerald-600 transition-all">
            <span className={`text-xl ${totalCartQty > 0 ? 'animate-trolley-jerk' : 'hover:scale-110 transition-transform'}`}>
              {activeRoutine ? '📁' : '🛒'}
            </span>
            {totalCartQty > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-gray-900 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 border border-white">
                {totalCartQty}
              </span>
            )}
          </Link>

          <div className="hidden lg:block">
            {userInfo ? (
              <div className="relative" ref={profileRef}>
                <button type="button" onClick={() => setShowProfileDropdown(!showProfileDropdown)} className="text-gray-900 outline-none focus:outline-none flex items-center pt-1 cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center font-bold text-sm uppercase text-gray-700 hover:border-emerald-500 hover:text-emerald-600 hover:scale-105 transition-all">
                    {userInfo.name.charAt(0)}
                  </div>
                </button>
                
                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 border-t-4 border-t-emerald-600 rounded-xl shadow-xl z-50 p-2 text-xs font-bold divide-y divide-gray-100 transform origin-top-right origin-top-right animate-dropdown-fade">
                    <div className="px-3 py-2 text-gray-600 font-bold truncate">Hello, <span className="text-gray-900 font-black">{userInfo.name}</span></div>
                    <div className="py-1">
                      {userInfo.isAdmin && (
                        <Link to="/admin" onClick={() => setShowProfileDropdown(false)} className="block px-3 py-2 text-amber-800 hover:bg-amber-50 rounded-lg transition-colors font-black tracking-wide uppercase text-[10px]">👑 Admin Dashboard</Link>
                      )}
                      <Link to="/admin-demo" onClick={() => setShowProfileDropdown(false)} className="block px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">📊 Admin Panel (View Only - Demo)</Link>
                      <Link to="/profile" onClick={() => setShowProfileDropdown(false)} className="block px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">👤 My Profile</Link>
                    </div>
                    <div className="pt-1.5">
                      <button type="button" onClick={() => { setShowProfileDropdown(false); logout(); navigate('/login'); }} className="w-full text-left px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors font-bold uppercase tracking-wider text-[10px] cursor-pointer">
                        🚪 Log Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="text-gray-700 hover:text-emerald-600 transition-all pt-1">
                <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center font-black text-sm">👤</div>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border-t border-gray-200 relative z-30">
        <div className="max-w-[1400px] mx-auto px-4 py-1.5 flex items-center gap-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap text-gray-600">
          <div className="relative flex-shrink-0" ref={categoryRef}>
            <button 
              type="button"
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="bg-emerald-600 border border-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition-all text-[11px] cursor-pointer outline-none shadow-xs"
            >
              🛍️ Shop by Category <span className="text-[8px] opacity-80">▼</span>
            </button>

            {showCategoryDropdown && (() => {
              const dropdownElement = (
                <div 
                  className="mobile-category-portal fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 lg:absolute lg:inset-auto lg:left-0 lg:-translate-x-0 lg:mt-2 lg:w-72 lg:bg-white lg:border lg:border-gray-200 lg:rounded-xl lg:shadow-2xl lg:p-3 lg:animate-dropdown-fade lg:border-t-4 lg:border-t-emerald-600 lg:max-h-[420px] lg:overflow-y-auto lg:custom-scrollbar lg:flex lg:flex-col lg:space-y-3 lg:block"
                  style={isMobile ? { zIndex: 9999999 } : {}}
                  onClick={() => setShowCategoryDropdown(false)}
                >
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-2xl border-t-4 border-t-emerald-600 border border-gray-200 p-5 shadow-2xl space-y-3.5 relative w-full max-w-[340px] max-h-[80vh] overflow-y-auto custom-scrollbar lg:max-w-none lg:w-auto lg:p-0 lg:border-none lg:shadow-none lg:rounded-none lg:bg-transparent flex flex-col text-left"
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-gray-150 lg:hidden">
                      <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1">
                        <span>🛍️ Store Departments</span>
                      </h3>
                      <button 
                        type="button" 
                        onClick={() => setShowCategoryDropdown(false)} 
                        className="text-gray-400 hover:text-gray-700 font-black text-xs uppercase"
                      >
                        Close ×
                      </button>
                    </div>

                    {/* INLINE CATEGORY SEARCH CONTROLLER BOX */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search store categories..."
                        value={categorySearchTerm}
                        onChange={(e) => setCategorySearchTerm(e.target.value)}
                        className="w-full p-2 pl-7 border border-gray-300 text-xs rounded-lg outline-none focus:border-emerald-500 bg-gray-50 font-bold text-gray-800"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                      {categorySearchTerm && (
                        <button 
                          type="button" 
                          onClick={() => setCategorySearchTerm('')} 
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 hover:text-gray-600"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* EMPTY FALLBACK CONTAINER */}
                    {filteredEssentialCategories.length === 0 && filteredDynamicCategories.length === 0 ? (
                      <p className="text-[11px] text-gray-400 italic text-center py-4 font-semibold border border-dashed rounded-lg bg-gray-50/50">
                        No matching categories found.
                      </p>
                    ) : (
                      <>
                        {/* FIRST SEGMENT: Core Essential Categories */}
                        {filteredEssentialCategories.length > 0 && (
                          <div className="space-y-0.5">
                            <div className="text-[9px] text-gray-400 font-extrabold tracking-widest uppercase px-2 pb-1.5 border-b border-gray-100 mb-1">Store Departments</div>
                            {filteredEssentialCategories.map((cat, i) => (
                              <Link
                                key={i}
                                to={`/browse?category=${encodeURIComponent(cat.query)}`}
                                onClick={() => { setTimeout(() => setShowCategoryDropdown(false), 50); setCategorySearchTerm(''); }}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 border-l-2 border-l-transparent hover:border-l-emerald-600 transition-all"
                              >
                                <span className="text-sm bg-white border border-gray-200 shadow-3xs w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0">{cat.icon}</span>
                                <span className="truncate">{cat.label}</span>
                              </Link>
                            ))}
                          </div>
                        )}

                        {/* SECOND SEGMENT: Admin Defined Categories */}
                        {filteredDynamicCategories.length > 0 && (
                          <div className="space-y-0.5 pt-1">
                            <div className="text-[9px] text-gray-400 font-extrabold tracking-widest uppercase px-2 pb-1.5 border-b border-gray-100 mb-1">Additional Departments</div>
                            {filteredDynamicCategories.map((cat, i) => (
                              <Link
                                key={`dynamic-${i}`}
                                to={`/browse?category=${encodeURIComponent(cat.query)}`}
                                onClick={() => { setTimeout(() => setShowCategoryDropdown(false), 50); setCategorySearchTerm(''); }}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 border-l-2 border-l-transparent hover:border-l-emerald-600 transition-all"
                              >
                                <span className="text-sm bg-white border border-gray-200 shadow-3xs w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0">{cat.icon}</span>
                                <span className="truncate">{cat.label}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
              return isMobile ? createPortal(dropdownElement, document.body) : dropdownElement;
            })()}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1 min-w-0">
            {(() => {
              const currentCategory = new URLSearchParams(location.search).get('category');
              const isAllProductsActive = location.pathname === '/browse' && (!currentCategory || currentCategory === 'All Products');
              return (
                <Link
                  to="/browse"
                  className={`px-3 py-1.5 rounded-lg transition-all font-bold flex-shrink-0 ${
                    isAllProductsActive 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold shadow-3xs' 
                      : 'hover:bg-gray-200/60 hover:text-gray-900 text-gray-700'
                  }`}
                >
                  All Products
                </Link>
              );
            })()}
            {activeEssentialCategories.filter(c => c.query !== 'All Products').slice(0, 5).map((cat, i) => {
              const currentCategory = new URLSearchParams(location.search).get('category');
              const isActive = location.pathname === '/browse' && currentCategory && currentCategory.toLowerCase() === cat.query.toLowerCase();
              return (
                <Link
                  key={i}
                  to={`/browse?category=${encodeURIComponent(cat.query)}`}
                  className={`px-3 py-1.5 rounded-lg transition-all font-bold flex-shrink-0 ${
                    isActive 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold shadow-3xs' 
                      : 'hover:bg-gray-200/60 hover:text-gray-900 text-gray-700'
                  }`}
                >
                  {cat.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-gray-100 border-b border-gray-200 px-4 py-1.5 text-[10px] sm:text-xs font-bold text-gray-600">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold">
            {currentCrumbs.map((crumb, idx) => {
              const isLastNode = idx === currentCrumbs.length - 1;
              return (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-gray-300">/</span>}
                  {isLastNode ? (
                    <span className="text-emerald-600 uppercase tracking-wider text-[10px] font-black truncate max-w-[200px]">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link to={crumb.url} className="text-gray-400 hover:text-gray-700 hover:underline">
                      {crumb.label}
                    </Link>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <button type="button" onClick={() => navigate(-1)} className="bg-white border border-gray-300 text-gray-700 font-bold px-2.5 py-1 rounded-md text-[10px] hover:bg-gray-50 flex items-center gap-1 transition-colors uppercase tracking-wider cursor-pointer">
            👈 Back
          </button>
        </div>
      </div>

       {showMapModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, backdropFilter: 'blur(2px)' }} className="p-4">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl border border-gray-200 w-full max-w-2xl p-5 shadow-2xl space-y-4 text-left max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-gray-150">
              <div>
                <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-tight flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                  <span>Set Delivery Location</span>
                  <span className="text-[10px] font-normal text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">Within 20 km of Store</span>
                </h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Click or drag the red marker to select your delivery destination.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowMapModal(false)} 
                className="text-gray-400 hover:text-gray-900 text-sm font-bold uppercase tracking-wider"
              >
                Close ×
              </button>
            </div>

            {/* SEARCH INPUT BAR WITH LIVE SUGGESTIONS */}
            <div ref={mapSearchRef} className="relative" data-html2pdf-ignore="true">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="🔍 Search for neighborhood or area in Tiruppur..." 
                  className="min-w-0 flex-grow border border-gray-300 p-2 text-xs rounded outline-none focus:border-emerald-500 bg-white text-gray-900"
                  value={mapSearchTerm}
                  onChange={(e) => setMapSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (executeSearch) executeSearch(mapSearchTerm);
                      setShowSuggestions(false);
                    }
                  }}
                  onFocus={() => mapSuggestions.length > 0 && setShowSuggestions(true)}
                />
                <button 
                  type="button"
                  onClick={() => {
                    if (executeSearch) executeSearch(mapSearchTerm);
                    setShowSuggestions(false);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer transition-colors flex-shrink-0"
                >
                  Search
                </button>
              </div>

              {showSuggestions && mapSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-[99999999] divide-y divide-gray-100">
                  {mapSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        const lat = parseFloat(suggestion.lat);
                        const lng = parseFloat(suggestion.lon);
                        if (executeSuggestionClick) {
                          executeSuggestionClick(lat, lng, suggestion.display_name);
                        }
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left p-2.5 text-xs text-gray-800 hover:bg-emerald-50 hover:text-emerald-950 font-medium transition-colors truncate block"
                    >
                      {suggestion.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* MAP CANVAS CONTAINER */}
            <div 
              ref={mapContainerRef} 
              className="w-full h-[200px] sm:h-[320px] min-h-[200px] sm:min-h-[320px] rounded-xl border border-gray-300 overflow-hidden shadow-inner relative z-10"
            />

            {/* LOCATION DETAILS PANEL */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col md:flex-row justify-between gap-3 text-xs font-semibold">
              <div className="space-y-1 text-left min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 uppercase font-black">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                  <span>DailyMart Hub (Source)</span>
                </div>
                <p className="text-gray-800 text-[11px] font-bold">Central Tiruppur Center Branch</p>
                
                <div className="flex items-center gap-1.5 text-[10px] text-red-500 uppercase font-black pt-1">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
                  <span>Destination Delivery Address</span>
                </div>
                <p className="text-gray-900 text-[11px] font-extrabold truncate">
                  {geocodedAddress || "Not Selected yet (Please click map)"}
                </p>
              </div>

              <div className="flex flex-row md:flex-col justify-between items-center md:items-end gap-1.5 flex-shrink-0 md:pl-3 md:border-l border-gray-200">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Route</span>
                <span className="text-sm font-black text-gray-900 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg">
                  {calculatedDistance ? `${calculatedDistance} km` : "0.00 km"}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center text-[10px] uppercase font-bold tracking-wider">
              <div>
                {deliveryLocation && (
                  <button 
                    type="button" 
                    onClick={() => {
                      localStorage.removeItem('deliveryLocation');
                      setDeliveryLocation(null);
                      setShowMapModal(false);
                      setSelectedCoords(null);
                      setCalculatedDistance(null);
                      setGeocodedAddress('');
                      setSelectedArea('');
                      setSelectedPostcode('');
                      setSelectedStreetAndArea('');
                      if (userMarkerRef.current && mapInstanceRef.current) {
                        mapInstanceRef.current.removeLayer(userMarkerRef.current);
                        userMarkerRef.current = null;
                      }
                      window.dispatchEvent(new CustomEvent('deliveryLocationChanged', { detail: null }));
                    }} 
                    className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-lg border border-red-200 transition-colors cursor-pointer"
                  >
                    Clear Location
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowMapModal(false)} 
                  className="bg-transparent text-gray-500 hover:text-gray-800 px-4 py-2"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleConfirmLocation} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg shadow-sm"
                >
                  Confirm Location
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};

export default Navbar;