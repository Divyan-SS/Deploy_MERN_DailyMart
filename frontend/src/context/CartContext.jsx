// frontend/src/context/CartContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from './AuthContext';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const { userInfo, logout } = useContext(AuthContext);

  const [cartItems, setCartItems] = useState(
    localStorage.getItem('cartItems') ? JSON.parse(localStorage.getItem('cartItems')) : []
  );

  const [routinesList, setRoutinesList] = useState([]);
  const [activeRoutine, setActiveRoutine] = useState(null);

  const [shippingAddress, setShippingAddress] = useState(
    localStorage.getItem('shippingAddress') ? JSON.parse(localStorage.getItem('shippingAddress')) : { address: '', city: '', postalCode: '', country: '' }
  );
  
  const [paymentMethod, setPaymentMethod] = useState('PayPal');
  const [selectedItems, setSelectedItems] = useState([]);

  // AUTHENTICATION SYNCHRONIZER LOOP: Polls user isolated routines periodically and syncs state
  useEffect(() => {
    let intervalId;

    const fetchUserIsolatedRoutines = async () => {
      if (!userInfo || !userInfo.token) {
        setRoutinesList([]);
        return;
      }
      try {
        const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
        const { data } = await axios.get('/api/routines', config);
        
        setRoutinesList(data.map(r => r.name));
        
        setCartItems((prevItems) => {
          const normalItems = prevItems.filter(item => !item.routineName);
          const routineItems = [];
          data.forEach(routine => {
            if (routine && routine.items) {
              routine.items.forEach(item => {
                if (!item || !item.product) return;
                
                const productId = item.product._id || item.product;
                routineItems.push({
                  product: productId,
                  name: item.product.name || item.name || 'Grocery Product',
                  image: item.product.image || item.image || '',
                  price: item.price,
                  variantName: item.variantName,
                  countInStock: item.product.variants?.find(v => v.name === item.variantName)?.countInStock || item.qty || 10,
                  qty: item.qty,
                  gst: item.product.gst || item.gst || 0,
                  routineName: routine.name
                });
              });
            }
          });
          const integratedItems = [...normalItems, ...routineItems];
          localStorage.setItem('cartItems', JSON.stringify(integratedItems));
          return integratedItems;
        });
      } catch (err) {
        console.error('Multi-User Sync Error: Custom folder tracking compilation failed:', err.message);
        if (err.response && err.response.status === 401) {
          logout();
        }
      }
    };

    if (userInfo && userInfo.token) {
      fetchUserIsolatedRoutines();
      intervalId = setInterval(fetchUserIsolatedRoutines, 5000);
    } else {
      setRoutinesList([]);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [userInfo]);

  // TAB SYNCHRONIZATION: Listens for cartItems changes in localstorage from other tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'cartItems') {
        const updatedItems = e.newValue ? JSON.parse(e.newValue) : [];
        setCartItems(updatedItems);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // SECURITY LEAK MONITOR: Flushes active workspace frames instantly if a logout event is detected
  useEffect(() => {
    const clearSessionCacheOnSignout = () => {
      setCartItems([]);
      setRoutinesList([]);
      setSelectedItems([]);
      setActiveRoutine(null);
      setShippingAddress({ address: '', city: 'Tiruppur', postalCode: '', country: 'India' });
      localStorage.removeItem('cartItems');
      localStorage.removeItem('shippingAddress');
      localStorage.removeItem('deliveryLocation');
    };
    window.addEventListener('userLogout', clearSessionCacheOnSignout);
    return () => window.removeEventListener('userLogout', clearSessionCacheOnSignout);
  }, []);

  useEffect(() => {
    setSelectedItems((prev) => {
      const activeKeys = cartItems.map((item) => `${item.product}-${item.variantName}-${item.routineName || 'normal'}`);
      return prev.filter((k) => activeKeys.includes(k));
    });
  }, [cartItems]);

  const createEmptyRoutine = async (routineName) => {
    if (!routineName || routineName.trim() === '' || !userInfo) return;
    const sanitizedName = routineName.trim();

    if (!routinesList.includes(sanitizedName)) {
      try {
        const config = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userInfo.token}` } };
        await axios.post('/api/routines', { name: sanitizedName, items: [] }, config);
        setRoutinesList((prev) => [...prev, sanitizedName]);
      } catch (err) {
        alert(err.response?.data?.message || err.message);
      }
    }
  };

  const addToCart = (product, variantName, qty) => {
    const variant = product.variants.find((v) => v.name === variantName);
    if (!variant) return;
    
    const newItem = {
      product: product._id,
      name: product.name,
      image: product.image,
      price: variant.price,
      variantName: variantName,
      countInStock: variant.countInStock,
      qty: Number(qty),
      gst: product.gst || 0,
      routineName: null 
    };

    const existItemIndex = cartItems.findIndex(
      (x) => x.product === newItem.product && x.variantName === newItem.variantName && !x.routineName
    );

    let newCartItems = [...cartItems];

    if (qty <= 0) {
      if (existItemIndex !== -1) newCartItems.splice(existItemIndex, 1);
    } else {
      if (existItemIndex !== -1) {
        newCartItems[existItemIndex] = { ...newCartItems[existItemIndex], qty: Number(qty) };
      } else {
        newCartItems.push(newItem);
      }
    }

    setCartItems(newCartItems);
    localStorage.setItem('cartItems', JSON.stringify(newCartItems));
  };

  const addToRoutine = async (product, variantName, qty, targetRoutineName) => {
    if (!targetRoutineName || targetRoutineName.trim() === '' || !userInfo) return;
    const sanitizedRoutineName = targetRoutineName.trim();

    const variant = product.variants.find((v) => v.name === variantName);
    if (!variant) return;

    const newRoutineItem = {
      product: product._id,
      name: product.name,
      image: product.image,
      price: variant.price,
      variantName: variantName,
      countInStock: variant.countInStock,
      qty: Number(qty),
      gst: product.gst || 0,
      routineName: sanitizedRoutineName
    };

    const existItemIndex = cartItems.findIndex(
      (x) => x.product === newRoutineItem.product && 
             x.variantName === newRoutineItem.variantName && 
             x.routineName === sanitizedRoutineName
    );

    let newCartItems = [...cartItems];

    if (qty <= 0) {
      if (existItemIndex !== -1) newCartItems.splice(existItemIndex, 1);
    } else {
      if (existItemIndex !== -1) {
        newCartItems[existItemIndex] = { ...newCartItems[existItemIndex], qty: Number(qty) };
      } else {
        newCartItems.push(newRoutineItem);
      }
    }

    try {
      const config = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userInfo.token}` } };
      const itemsToSync = newCartItems
        .filter(item => item.routineName === sanitizedRoutineName)
        .map(item => ({
          product: item.product,
          variantName: item.variantName,
          qty: item.qty,
          price: item.price
        }));

      await axios.post('/api/routines', { name: sanitizedRoutineName, items: itemsToSync }, config);
      
      setCartItems(newCartItems);
      localStorage.setItem('cartItems', JSON.stringify(newCartItems));
      if (!routinesList.includes(sanitizedRoutineName)) {
        setRoutinesList(prev => [...prev, sanitizedRoutineName]);
      }
    } catch (err) {
      alert(`Database Synchronization Error: ${err.response?.data?.message || err.message}`);
    }
  };

  const clearVisibleWorkspaceCartOnly = async (targetRoutineName) => {
    const cleanRoutineName = targetRoutineName || null;
    const remainingItems = cartItems.filter((item) => item.routineName !== cleanRoutineName);

    if (cleanRoutineName && userInfo) {
      try {
        const config = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userInfo.token}` } };
        await axios.post('/api/routines', { name: cleanRoutineName, items: [] }, config);
      } catch (err) {
        console.error(err.message);
      }
    }

    setCartItems(remainingItems);
    localStorage.setItem('cartItems', JSON.stringify(remainingItems));
    const contextTag = targetRoutineName || 'normal';
    setSelectedItems((prev) => prev.filter((key) => !key.includes(`-${contextTag}`)));
  };

  const checkoutEntireRoutine = (targetRoutineName, discardedKeys = []) => {
    const routineItems = cartItems.filter((item) => {
      if (item.routineName !== targetRoutineName) return false;
      const key = `${item.product}-${item.variantName}-${targetRoutineName}`;
      return !discardedKeys.includes(key);
    });
    if (routineItems.length === 0) return;

    let newCartItems = [...cartItems];

    routineItems.forEach((item) => {
      const existingNormalIndex = newCartItems.findIndex(
        (x) => x.product === item.product && x.variantName === item.variantName && !x.routineName
      );

      if (existingNormalIndex !== -1) {
        const blendedQty = newCartItems[existingNormalIndex].qty + item.qty;
        const boundedQty = Math.min(blendedQty, item.countInStock);
        newCartItems[existingNormalIndex].qty = boundedQty;
      } else {
        newCartItems.push({ ...item, routineName: null });
      }
    });

    setCartItems(newCartItems);
    localStorage.setItem('cartItems', JSON.stringify(newCartItems));
  };

  const removeFromContext = async (id, variantName, targetContext) => {
    const sanitizedContext = targetContext === 'normal' ? null : targetContext;
    const newCartItems = cartItems.filter(
      (x) => !(x.product === id && x.variantName === variantName && x.routineName === sanitizedContext)
    );

    if (sanitizedContext && userInfo) {
      try {
        const config = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userInfo.token}` } };
        const itemsToSync = newCartItems
          .filter(item => item.routineName === sanitizedContext)
          .map(item => ({
            product: item.product,
            variantName: item.variantName,
            qty: item.qty,
            price: item.price
          }));
        await axios.post('/api/routines', { name: sanitizedContext, items: itemsToSync }, config);
      } catch (err) {
        console.error(err.message);
      }
    }

    setCartItems(newCartItems);
    localStorage.setItem('cartItems', JSON.stringify(newCartItems));
  };

  const saveProductEdit = async (routineName, oldItem, product, newVariantName, newQty, targetRoutineName, isSaveAndMove) => {
    if (!userInfo) return;

    const variant = product.variants.find((v) => v.name === newVariantName);
    if (!variant) return;

    let newCartItems = [...cartItems];

    // 1. Update the item in the current routine (routineName)
    const oldItemIndex = newCartItems.findIndex(
      (item) => item.product === product._id && 
                item.variantName === oldItem.variantName && 
                item.routineName === routineName
    );

    const updatedItemPayload = {
      product: product._id,
      name: product.name,
      image: product.image,
      price: variant.price,
      variantName: newVariantName,
      countInStock: variant.countInStock,
      qty: Number(newQty),
      gst: product.gst || 0,
      routineName: routineName
    };

    if (newVariantName !== oldItem.variantName) {
      if (isSaveAndMove && oldItemIndex !== -1) {
        newCartItems.splice(oldItemIndex, 1);
      }
      
      const targetExistIndex = newCartItems.findIndex(
        (item) => item.product === product._id && 
                  item.variantName === newVariantName && 
                  item.routineName === routineName
      );
      if (targetExistIndex !== -1) {
        newCartItems[targetExistIndex].qty = Number(newQty);
      } else {
        newCartItems.push(updatedItemPayload);
      }
    } else {
      if (oldItemIndex !== -1) {
        newCartItems[oldItemIndex].qty = Number(newQty);
      } else {
        newCartItems.push(updatedItemPayload);
      }
    }

    // 2. If isSaveAndMove is true and targetRoutineName is different, copy to destination
    if (isSaveAndMove && targetRoutineName && targetRoutineName !== routineName) {
      const copyItemPayload = {
        ...updatedItemPayload,
        routineName: targetRoutineName
      };

      const destExistIndex = newCartItems.findIndex(
        (item) => item.product === product._id && 
                  item.variantName === newVariantName && 
                  item.routineName === targetRoutineName
      );

      if (destExistIndex !== -1) {
        newCartItems[destExistIndex].qty = Number(newQty);
      } else {
        newCartItems.push(copyItemPayload);
      }
    }

    try {
      const config = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userInfo.token}` } };
      
      const sourceItemsToSync = newCartItems
        .filter(item => item.routineName === routineName)
        .map(item => ({
          product: item.product,
          variantName: item.variantName,
          qty: item.qty,
          price: item.price
        }));
      await axios.post('/api/routines', { name: routineName, items: sourceItemsToSync }, config);

      if (isSaveAndMove && targetRoutineName && targetRoutineName !== routineName) {
        const destItemsToSync = newCartItems
          .filter(item => item.routineName === targetRoutineName)
          .map(item => ({
            product: item.product,
            variantName: item.variantName,
            qty: item.qty,
            price: item.price
          }));
        await axios.post('/api/routines', { name: targetRoutineName, items: destItemsToSync }, config);
      }

      setCartItems(newCartItems);
      localStorage.setItem('cartItems', JSON.stringify(newCartItems));
      
      if (targetRoutineName && !routinesList.includes(targetRoutineName)) {
        setRoutinesList(prev => [...prev, targetRoutineName]);
      }
    } catch (err) {
      alert(`Database Synchronization Error: ${err.response?.data?.message || err.message}`);
      throw err;
    }
  };

  const deleteEntireRoutineGroup = async (targetRoutineName) => {
    if (!userInfo) return;
    try {
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      const { data: allRoutines } = await axios.get('/api/routines', config);
      const targetMatchDoc = allRoutines.find(r => r.name === targetRoutineName);
      
      if (targetMatchDoc) {
        await axios.delete(`/api/routines/${targetMatchDoc._id}`, config);
      }

      setRoutinesList((prev) => prev.filter((r) => r !== targetRoutineName));
      setCartItems((prev) => {
        const remaining = prev.filter((item) => item.routineName !== targetRoutineName);
        localStorage.setItem('cartItems', JSON.stringify(remaining));
        return remaining;
      });

      if (activeRoutine === targetRoutineName) setActiveRoutine(null);
    } catch (err) {
      alert(`Failed to delete routine cloud map configuration: ${err.message}`);
    }
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem('cartItems');
  };

  const clearNormalCart = () => {
    const remaining = cartItems.filter((item) => item.routineName);
    setCartItems(remaining);
    localStorage.setItem('cartItems', JSON.stringify(remaining));
  };

  const discardSelectedProducts = (currentContext) => {
    const remainingItems = cartItems.filter(
      (item) => !selectedItems.includes(`${item.product}-${item.variantName}-${item.routineName || 'normal'}`)
    );
    setCartItems(remainingItems);
    localStorage.setItem('cartItems', JSON.stringify(remainingItems));
    setSelectedItems([]);
  };

  const toggleItemSelection = (id, variantName, currentContext) => {
    const targetContext = currentContext || 'normal';
    const key = `${id}-${variantName}-${targetContext}`;
    setSelectedItems((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const saveShippingAddress = (data) => {
    setShippingAddress(data);
    localStorage.setItem('shippingAddress', JSON.stringify(data));
  };

  const savePaymentMethod = (method) => {
    setPaymentMethod(method);
  };

  const visibleCartItems = activeRoutine 
    ? cartItems.filter((item) => item.routineName === activeRoutine)
    : cartItems.filter((item) => !item.routineName);

  const itemsPrice = visibleCartItems.reduce((acc, item) => acc + item.price * item.qty, 0);
  
  // Calculate delivery charge based on the distance matrix:
  // 0-2 km: Free
  // 2-5 km: ₹10 - ₹20
  // 5-8 km: ₹20 - ₹40
  // 8-10 km: ₹40 - ₹60
  // Above 10 km: actual cost (₹60 + ₹15/km surcharge)
  const getDistance = () => {
    try {
      const loc = localStorage.getItem('deliveryLocation');
      if (loc) {
        const parsed = JSON.parse(loc);
        return Number(parsed.distance) || 0;
      }
    } catch (e) {}
    return 0;
  };
  const distance = getDistance();

  const calculateShipping = (dist) => {
    if (dist <= 2) return 0;
    if (dist <= 5) return Math.round(10 + ((dist - 2) / 3) * 10);
    if (dist <= 8) return Math.round(20 + ((dist - 5) / 3) * 20);
    if (dist <= 10) return Math.round(40 + ((dist - 8) / 2) * 20);
    return Math.round(60 + (dist - 10) * 15);
  };

  const shippingPrice = itemsPrice === 0 ? 0 : calculateShipping(distance);

  // Calculate GST dynamically from each item's specific rate (0%, 5%, 18%, 28%)
  const taxPrice = Number(
    visibleCartItems.reduce((acc, item) => {
      const itemGst = item.gst || 0;
      return acc + (item.price * item.qty * itemGst) / 100;
    }, 0).toFixed(2)
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        routinesList,
        activeRoutine,
        visibleCartItems,
        selectedItems,
        shippingAddress,
        paymentMethod,
        itemsPrice,
        shippingPrice,
        taxPrice,
        totalPrice: Number((itemsPrice + shippingPrice + taxPrice).toFixed(2)),
        setActiveRoutine,
        toggleItemSelection,
        addToCart,
        addToRoutine,
        checkoutEntireRoutine,
        saveProductEdit,
        createEmptyRoutine,
        removeFromContext,
        clearVisibleWorkspaceCartOnly, 
        deleteEntireRoutineGroup,
        deleteRoutine: deleteEntireRoutineGroup, 
        discardSelectedProducts,
        saveShippingAddress,
        savePaymentMethod,
        clearCart,
        clearNormalCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};