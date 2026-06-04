// frontend/src/pages/Checkout.jsx
import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import useOutsideClick from '../hooks/useOutsideClick';
import { reverseGeocodeAndValidate } from '../utils/locationHelper';

const Checkout = () => {
  const {
    cartItems,
    shippingAddress,
    paymentMethod,
    saveShippingAddress,
    savePaymentMethod,
    clearNormalCart,
  } = useContext(CartContext);

  const { userInfo } = useContext(AuthContext);
  const navigate = useNavigate();

  const [deliveryLocation, setDeliveryLocation] = useState(() => {
    try {
      const loc = localStorage.getItem('deliveryLocation');
      return loc ? JSON.parse(loc) : null;
    } catch (e) {
      return null;
    }
  });

  const [address, setAddress] = useState(() => {
    if (shippingAddress.address) return shippingAddress.address;
    try {
      const loc = localStorage.getItem('deliveryLocation');
      if (loc) {
        const parsed = JSON.parse(loc);
        return parsed.streetAndArea || parsed.area || parsed.address || '';
      }
    } catch (e) {}
    return '';
  });
  const [city, setCity] = useState(shippingAddress.city || 'Tiruppur');
  const [postalCode, setPostalCode] = useState(() => {
    if (shippingAddress.postalCode) return shippingAddress.postalCode;
    try {
      const loc = localStorage.getItem('deliveryLocation');
      if (loc) {
        const parsed = JSON.parse(loc);
        return parsed.postcode || '';
      }
    } catch (e) {}
    return '';
  });
  const [country, setCountry] = useState(shippingAddress.country || 'India');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Embedded map search states
  const [mapSearchTerm, setMapSearchTerm] = useState('');
  const [mapSuggestions, setMapSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const locationSectionRef = useRef(null);
  const checkoutMapContainerRef = useRef(null);
  const checkoutMapInstanceRef = useRef(null);
  const checkoutUserMarkerRef = useRef(null);
  const checkoutMapSearchRef = useRef(null);

  const martCoords = [11.1085, 77.3411];

  useEffect(() => {
    setMounted(true);
    // Only check normal cart items (without routineName)
    const normalItems = cartItems.filter(item => !item.routineName);
    if (normalItems.length === 0) {
      navigate('/browse');
    }

    try {
      const loc = localStorage.getItem('deliveryLocation');
      if (loc) {
        const parsed = JSON.parse(loc);
        setDeliveryLocation(parsed);
        if (!address) {
          setAddress(parsed.streetAndArea || parsed.area || parsed.address || '');
        }
        if (!postalCode) {
          setPostalCode(parsed.postcode || '');
        }
      }
    } catch (e) {}
  }, [cartItems, navigate]);

  const handleLocationSelectionExternally = async (lat, lng, markerToUpdate) => {
    const result = await reverseGeocodeAndValidate(lat, lng);
    
    if (!result.valid) {
      alert(result.error);
      if (markerToUpdate && checkoutMapInstanceRef.current) {
        checkoutMapInstanceRef.current.removeLayer(markerToUpdate);
      }
      checkoutUserMarkerRef.current = null;
      setDeliveryLocation(null);
      localStorage.removeItem('deliveryLocation');
      window.dispatchEvent(new CustomEvent('deliveryLocationChanged', { detail: null }));
      return;
    }

    const locObj = {
      lat: result.lat,
      lng: result.lng,
      address: result.address,
      area: result.area,
      distance: result.distance,
      postcode: result.postcode,
      streetAndArea: result.streetAndArea
    };

    localStorage.setItem('deliveryLocation', JSON.stringify(locObj));
    setDeliveryLocation(locObj);
    setLocationError(null);

    setAddress(result.streetAndArea);
    setPostalCode(result.postcode);

    if (markerToUpdate) {
      markerToUpdate.bindPopup(`<b>Delivery Spot</b><br>${result.address}`).openPopup();
    }

    window.dispatchEvent(new CustomEvent('deliveryLocationChanged', { detail: locObj }));
  };

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

        if (checkoutMapInstanceRef.current) {
          checkoutMapInstanceRef.current.setView([lat, lng], 14);

          const userIcon = window.L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          if (checkoutUserMarkerRef.current) {
            checkoutUserMarkerRef.current.setLatLng([lat, lng]);
            await handleLocationSelectionExternally(lat, lng, checkoutUserMarkerRef.current);
          } else {
            const marker = window.L.marker([lat, lng], { icon: userIcon, draggable: true }).addTo(checkoutMapInstanceRef.current);
            checkoutUserMarkerRef.current = marker;
            await handleLocationSelectionExternally(lat, lng, marker);

            marker.on('dragend', (event) => {
              const newPos = event.target.getLatLng();
              handleLocationSelectionExternally(newPos.lat, newPos.lng, marker);
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

  const handleSuggestionClick = async (lat, lng) => {
    const latLng = window.L.latLng(lat, lng);
    const dist = (window.L.latLng(martCoords).distanceTo(latLng) / 1000);
    if (dist > 20) {
      alert("⚠️ Search Bound Alert: The selected suggestion is more than 20 km away from the store.");
      return;
    }

    if (checkoutMapInstanceRef.current) {
      checkoutMapInstanceRef.current.setView([lat, lng], 14);

      const userIcon = window.L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      if (checkoutUserMarkerRef.current) {
        checkoutUserMarkerRef.current.setLatLng([lat, lng]);
        await handleLocationSelectionExternally(lat, lng, checkoutUserMarkerRef.current);
      } else {
        const marker = window.L.marker([lat, lng], { icon: userIcon, draggable: true }).addTo(checkoutMapInstanceRef.current);
        checkoutUserMarkerRef.current = marker;
        await handleLocationSelectionExternally(lat, lng, marker);

        marker.on('dragend', (event) => {
          const newPos = event.target.getLatLng();
          handleLocationSelectionExternally(newPos.lat, newPos.lng, marker);
        });
      }
    }
  };

  // Debounced search suggestions effect
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
    }, 450);

    return () => clearTimeout(timer);
  }, [mapSearchTerm]);

  useOutsideClick(checkoutMapSearchRef, () => setShowSuggestions(false));

  // Initialize embedded Leaflet map
  useEffect(() => {
    if (!checkoutMapContainerRef.current) return;

    const storeBounds20km = window.L.latLngBounds(
      window.L.latLng(10.9284, 77.1575),
      window.L.latLng(11.2886, 77.5247)
    );

    const map = window.L.map(checkoutMapContainerRef.current, {
      center: deliveryLocation ? [deliveryLocation.lat, deliveryLocation.lng] : martCoords,
      zoom: deliveryLocation ? 14 : 12,
      minZoom: 11,
      maxZoom: 18,
      maxBounds: storeBounds20km,
      maxBoundsViscosity: 1.0
    });

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const martIcon = window.L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    const userIcon = window.L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Mart Marker
    window.L.marker(martCoords, { icon: martIcon })
      .addTo(map)
      .bindPopup('<b>DailyMart Hub (Tiruppur)</b><br>Central Depot Location');

    checkoutMapInstanceRef.current = map;

    // Restore user location marker if it exists
    if (deliveryLocation) {
      const marker = window.L.marker([deliveryLocation.lat, deliveryLocation.lng], { icon: userIcon, draggable: true }).addTo(map);
      marker.bindPopup(`<b>Your Delivery Point</b><br>${deliveryLocation.address || ''}`).openPopup();

      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        handleLocationSelectionExternally(newPos.lat, newPos.lng, marker);
      });

      checkoutUserMarkerRef.current = marker;
    }

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const dist = (window.L.latLng(martCoords).distanceTo(e.latlng) / 1000);

      if (dist > 20) {
        alert("⚠️ Delivery Boundary Restriction: Please select a location within 20 km of the store.");
        return;
      }

      if (checkoutUserMarkerRef.current) {
        checkoutUserMarkerRef.current.setLatLng(e.latlng);
        handleLocationSelectionExternally(lat, lng, checkoutUserMarkerRef.current);
      } else {
        const marker = window.L.marker([lat, lng], { icon: userIcon, draggable: true }).addTo(map);
        checkoutUserMarkerRef.current = marker;
        handleLocationSelectionExternally(lat, lng, marker);

        marker.on('dragend', (event) => {
          const newPos = event.target.getLatLng();
          handleLocationSelectionExternally(newPos.lat, newPos.lng, marker);
        });
      }
    });

    return () => {
      if (checkoutMapInstanceRef.current) {
        checkoutMapInstanceRef.current.remove();
        checkoutMapInstanceRef.current = null;
      }
      checkoutUserMarkerRef.current = null;
    };
  }, []);

  // Listen for Navbar or general location changes
  useEffect(() => {
    const handleLocationChange = (e) => {
      const parsed = e.detail;
      setDeliveryLocation(parsed);
      if (parsed) {
        setAddress(parsed.streetAndArea || parsed.area || parsed.address || '');
        setPostalCode(parsed.postcode || '');

        if (checkoutMapInstanceRef.current) {
          const latLng = [parsed.lat, parsed.lng];
          checkoutMapInstanceRef.current.setView(latLng, 14);

          if (checkoutUserMarkerRef.current) {
            checkoutUserMarkerRef.current.setLatLng(latLng);
            checkoutUserMarkerRef.current.bindPopup(`<b>Your Delivery Point</b><br>${parsed.address || ''}`).openPopup();
          } else {
            const userIcon = window.L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            });
            const marker = window.L.marker(latLng, { icon: userIcon, draggable: true }).addTo(checkoutMapInstanceRef.current);
            checkoutUserMarkerRef.current = marker;
            marker.bindPopup(`<b>Your Delivery Point</b><br>${parsed.address || ''}`).openPopup();

            marker.on('dragend', (event) => {
              const newPos = event.target.getLatLng();
              handleLocationSelectionExternally(newPos.lat, newPos.lng, marker);
            });
          }
        }
      } else {
        if (checkoutUserMarkerRef.current && checkoutMapInstanceRef.current) {
          checkoutMapInstanceRef.current.removeLayer(checkoutUserMarkerRef.current);
          checkoutUserMarkerRef.current = null;
        }
      }
    };
    window.addEventListener('deliveryLocationChanged', handleLocationChange);
    return () => {
      window.removeEventListener('deliveryLocationChanged', handleLocationChange);
    };
  }, []);

  // 🔥 Only normal items (without routineName) are considered for checkout
  const normalCartItems = cartItems.filter(item => !item.routineName);

  const aggregateItemsPrice = normalCartItems.reduce((acc, item) => acc + item.price * item.qty, 0);

  const distance = deliveryLocation ? Number(deliveryLocation.distance) || 0 : 0;
  
  const calculateShipping = (dist) => {
    if (dist <= 2) return 0;
    if (dist <= 5) return Math.round(10 + ((dist - 2) / 3) * 10);
    if (dist <= 8) return Math.round(20 + ((dist - 5) / 3) * 20);
    if (dist <= 10) return Math.round(40 + ((dist - 8) / 2) * 20);
    return Math.round(60 + (dist - 10) * 15);
  };

  const aggregateShippingPrice = aggregateItemsPrice === 0 ? 0 : calculateShipping(distance);

  const aggregateTaxPrice = Number(
    normalCartItems.reduce((acc, item) => {
      const itemGst = item.gst || 0;
      return acc + (item.price * item.qty * itemGst) / 100;
    }, 0).toFixed(2)
  );

  const aggregateTotalPrice = Number((aggregateItemsPrice + aggregateShippingPrice + aggregateTaxPrice).toFixed(2));

  const groupedItems = { 'Normal Products': normalCartItems };

  const placeOrderHandler = async (e) => {
    e.preventDefault();
    setError(null);
    setLocationError(null);

    if (!deliveryLocation) {
      setLocationError('Please select a delivery location before placing your order.');
      if (locationSectionRef.current) {
        locationSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (!address || !city || !postalCode) {
      setError('⚠️ Please fill out all delivery address fields before proceeding.');
      return;
    }

    if (normalCartItems.length === 0) {
      setError('⚠️ Your cart is empty. Use "Checkout Full Routine" from a routine page to copy routine items to your cart first.');
      return;
    }

    const compiledAddress = { address, city, postalCode, country };
    saveShippingAddress(compiledAddress);

    try {
      setLoading(true);
      const config = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      const orderPayload = {
        orderItems: normalCartItems.map(item => ({
          product: item.product,
          name: item.name,
          image: item.image,
          price: item.price,
          variantName: item.variantName,
          qty: item.qty,
          gst: item.gst || 0,
          routineGroupLabel: 'Normal'
        })),
        shippingAddress: compiledAddress,
        deliveryLocation: deliveryLocation ? {
          lat: deliveryLocation.lat,
          lng: deliveryLocation.lng,
          address: deliveryLocation.address,
          area: deliveryLocation.area || '',
          distance: Number(deliveryLocation.distance) || 0
        } : undefined,
        paymentMethod,
        itemsPrice: Number(aggregateItemsPrice.toFixed(2)),
        taxPrice: Number(aggregateTaxPrice.toFixed(2)),
        shippingPrice: Number(aggregateShippingPrice.toFixed(2)),
        totalPrice: Math.round(aggregateTotalPrice),
        orderType: 'OrganizedGroceryGrid'
      };

      const { data } = await axios.post('/api/orders', orderPayload, config);

      clearNormalCart();
      
      setLoading(false);
      navigate(`/payment/${data._id}`);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.message || err.message);
    }
  };

  if (normalCartItems.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto py-8 font-sans">
        <div className="bg-white border border-gray-300 rounded-2xl py-20 flex flex-col items-center justify-center text-center px-4 shadow-xs">
          <h3 className="text-base font-semibold text-gray-900 mb-2">📦 Your checkout pipeline is empty</h3>
          <p className="text-gray-500 text-xs mb-6 max-w-sm font-medium">Add products to your cart, or use "Checkout Full Routine" from a routine page to copy routine items here.</p>
          <Link to="/browse" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-5 py-2.5 rounded-lg uppercase tracking-wider font-semibold shadow-xs">
            ➕ Browse Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-[1200px] mx-auto py-6 space-y-6 font-sans text-gray-800 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>

      <div className="border-b border-gray-200 pb-3">
        <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight">🧾 Secure Checkout</h1>
        <p className="text-xs text-gray-500 font-semibold mt-0.5">Review your normal cart items. Routine items are not included – use a routine page to copy them first.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 text-xs p-3.5 rounded-xl font-bold animate-pulse">
          {error}
        </div>
      )}

      <form onSubmit={placeOrderHandler} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* Warning banner if deliveryLocation is not set */}
          {!deliveryLocation && (
            <div className="bg-amber-50 border border-amber-300 text-amber-800 text-xs p-4 rounded-xl font-semibold flex items-center gap-3 shadow-xs animate-pulse">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <div>
                <p className="font-bold">Delivery Location Map Pin Required</p>
                <p className="mt-0.5">Please select your location on the map below or use the search bar to locate your area within Tiruppur District.</p>
              </div>
            </div>
          )}

          {/* Dedicated location section with embedded Leaflet Map */}
          <div 
            ref={locationSectionRef}
            className={`border rounded-2xl p-5 md:p-6 transition-all duration-350 ${
              locationError 
                ? 'bg-red-50/50 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-shake' 
                : 'bg-white border-gray-300 shadow-sm'
            }`}
          >
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-150 pb-2.5 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span>Delivery Location Map Selection</span>
              <span className="text-[9px] font-bold text-red-500 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider ml-auto">Required</span>
            </h2>

            {locationError && (
              <div className="mt-3 bg-red-600 text-white font-bold text-xs p-3 rounded-lg flex items-center gap-2 shadow-xs transition-all duration-300">
                <span>⚠️</span>
                <span>{locationError}</span>
              </div>
            )}

            <div className="mt-4 space-y-4">
              {/* Location Search Bar */}
              <div ref={checkoutMapSearchRef} className="relative">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="🔍 Search neighborhood, street or area in Tiruppur..." 
                    className="min-w-0 flex-grow border border-gray-300 p-2.5 text-xs rounded-lg outline-none focus:border-emerald-500 bg-white text-gray-900 font-medium"
                    value={mapSearchTerm}
                    onChange={(e) => setMapSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearch(mapSearchTerm);
                        setShowSuggestions(false);
                      }
                    }}
                    onFocus={() => mapSuggestions.length > 0 && setShowSuggestions(true)}
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      handleSearch(mapSearchTerm);
                      setShowSuggestions(false);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg cursor-pointer transition-colors flex-shrink-0 shadow-xs"
                  >
                    Search
                  </button>
                </div>

                {showSuggestions && mapSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-[9999] divide-y divide-gray-100">
                    {mapSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          const lat = parseFloat(suggestion.lat);
                          const lng = parseFloat(suggestion.lon);
                          handleSuggestionClick(lat, lng);
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left p-2.5 text-xs text-gray-800 hover:bg-emerald-50 hover:text-emerald-950 font-semibold transition-colors truncate block"
                      >
                        {suggestion.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Map Canvas */}
              <div 
                ref={checkoutMapContainerRef} 
                className="w-full h-[220px] rounded-xl border border-gray-300 overflow-hidden shadow-inner relative z-10"
              />

              {/* Selection Summary Panel */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col md:flex-row justify-between gap-3 text-xs font-semibold">
                <div className="space-y-1 text-left min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[9px] text-red-500 uppercase font-black">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
                    <span>Selected Destination</span>
                  </div>
                  <p className="text-gray-900 text-xs font-extrabold truncate">
                    {deliveryLocation ? deliveryLocation.address : "❌ No location marked on map (Selection is Mandatory)"}
                  </p>
                  {deliveryLocation && (
                    <div className="text-[10px] text-gray-500 font-bold">
                      Lat: {Number(deliveryLocation.lat).toFixed(6)}, Lng: {Number(deliveryLocation.lng).toFixed(6)}
                    </div>
                  )}
                </div>

                {deliveryLocation && (
                  <div className="flex flex-row md:flex-col justify-between items-center md:items-end gap-2 flex-shrink-0 md:pl-3 md:border-l border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem('deliveryLocation');
                        setDeliveryLocation(null);
                        setAddress('');
                        setPostalCode('');
                        if (checkoutUserMarkerRef.current && checkoutMapInstanceRef.current) {
                          checkoutMapInstanceRef.current.removeLayer(checkoutUserMarkerRef.current);
                          checkoutUserMarkerRef.current = null;
                        }
                        window.dispatchEvent(new CustomEvent('deliveryLocationChanged', { detail: null }));
                      }}
                      className="text-[9px] uppercase font-bold tracking-wider text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded transition-colors cursor-pointer"
                    >
                      Clear Pin
                    </button>
                    <div className="text-right">
                      <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">Distance</span>
                      <span className="text-xs font-black text-gray-900 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                        {distance.toFixed(2)} km
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Delivery address details block */}
          <div className="bg-white border border-gray-300 p-6 rounded-xl shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span>Delivery Address Details</span>
            </h2>
            <div>
              <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">Street Address / Area</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter flat number, wing, street name, and area"
                className="w-full border border-gray-300 p-2.5 rounded text-xs text-gray-900 font-medium bg-white focus:border-emerald-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">District</label>
                <input 
                  type="text" 
                  required 
                  readOnly 
                  value={city} 
                  className="w-full border border-gray-200 bg-gray-50 p-2.5 rounded text-xs text-gray-500 font-semibold cursor-not-allowed outline-none" 
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-600 font-bold uppercase tracking-wide mb-1">Postal Code</label>
                <input 
                  type="text" 
                  required 
                  value={postalCode} 
                  onChange={(e) => setPostalCode(e.target.value)} 
                  placeholder="Pincode" 
                  className="w-full border border-gray-300 p-2.5 rounded text-xs text-gray-900 font-medium bg-white focus:border-emerald-500 outline-none" 
                />
              </div>
            </div>

            {deliveryLocation && distance > 10 && (
              <div className="mt-3 bg-amber-50/60 border border-amber-200 text-amber-900 p-3.5 rounded-xl text-xs font-bold text-left animate-pulse">
                ⚠️ Long Distance Delivery: Your location is {distance.toFixed(1)} km away from our central hub. A premium actual-cost delivery surcharge is applied.
              </div>
            )}
          </div>

          {/* Items list (only normal items) */}
          <div className="bg-white border border-gray-300 p-6 rounded-xl shadow-xs space-y-6">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1.5">📦 Shipment Contents</h2>
            {Object.keys(groupedItems).map((groupName) => (
              <div key={groupName} className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-900">🛒 {groupName}</span>
                  <span className="text-[10px] font-bold bg-white text-gray-600 border border-gray-300 px-2 py-0.5 rounded-full">
                    {groupedItems[groupName].length} Item(s)
                  </span>
                </div>
                <div className="divide-y divide-gray-100 bg-white max-h-64 overflow-y-auto custom-scrollbar">
                  {groupedItems[groupName].map((item) => (
                    <div key={`${item.product}-${item.variantName}`} className="p-3.5 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-3">
                        <img src={item.image} alt={item.name} className="w-8 h-9 object-contain bg-gray-50 p-0.5 rounded border" />
                        <div className="text-left">
                          {item.brand && <span className="block font-semibold text-[11px] text-emerald-600 uppercase tracking-wider mb-0.5">{item.brand}</span>}
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Variant: {item.variantName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-600">Qty: {item.qty}</p>
                        <p className="font-bold text-gray-900">₹{(item.price * item.qty).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Payment options (unchanged) */}
          <div className="bg-white border border-gray-300 p-6 rounded-xl shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">💳 Payment Options</h2>
            <label className="flex items-center gap-2 border border-gray-300 p-3 rounded-lg cursor-pointer hover:bg-gray-50 transition">
              <input type="radio" value="PayPal" checked={paymentMethod === 'PayPal'} onChange={(e) => savePaymentMethod(e.target.value)} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" />
              <span className="text-xs text-gray-900 font-semibold">PayPal / NetBanking Secure Gateway</span>
            </label>
            <label className="flex items-center gap-2 border border-gray-300 p-3 rounded-lg cursor-pointer hover:bg-gray-50 transition">
              <input type="radio" value="Stripe" checked={paymentMethod === 'Stripe'} onChange={(e) => savePaymentMethod(e.target.value)} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" />
              <span className="text-xs text-gray-900 font-semibold">Credit Card / Debit Card (Stripe Secure)</span>
            </label>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white border border-gray-300 p-5 rounded-xl space-y-4 shadow-xs lg:sticky lg:top-4 w-full">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">📊 Invoice Summary</h3>
          <div className="space-y-2.5 text-xs text-gray-700 font-medium">
            <div className="flex justify-between"><span>Subtotal</span><span className="text-gray-900 font-semibold">₹{aggregateItemsPrice.toFixed(2)}</span></div>
            <div className="flex justify-between">
              <span>Shipping {distance > 0 ? `(${distance.toFixed(1)} km)` : ''}</span>
              <span className="text-gray-900 font-semibold">
                {aggregateShippingPrice === 0 ? 'Free' : `₹${aggregateShippingPrice.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span>GST (Calculated)</span>
              <span className="text-gray-900 font-semibold">₹{aggregateTaxPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-green-700 font-bold text-sm pt-2">
              <span>💰 Total</span>
              <span className="text-sm font-bold">₹{Math.round(aggregateTotalPrice)}</span>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-3 rounded-lg font-bold uppercase tracking-widest transition-all disabled:bg-gray-300 active:scale-95 shadow-xs cursor-pointer">
            {loading ? '⏳ Processing...' : '🚀 Place Order & Pay'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Checkout;