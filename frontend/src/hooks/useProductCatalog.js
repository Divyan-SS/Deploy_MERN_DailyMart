import { useState, useEffect } from 'react';
import axios from 'axios';

let globalCache = null;
let globalListeners = [];
let globalInterval = null;
let globalLoading = true;
let globalError = null;

const fetchFreshProducts = async () => {
  try {
    const { data } = await axios.get('/api/products');
    // Normalize data (ensure rawVariants is defined)
    const normalizedData = data.map(p => ({
      ...p,
      rawVariants: p.variants || []
    }));
    globalCache = normalizedData;
    globalLoading = false;
    globalError = null;
  } catch (err) {
    globalError = err.response?.data?.message || err.message;
    globalLoading = false;
  }
  globalListeners.forEach(listener => listener({ products: globalCache || [], loading: globalLoading, error: globalError }));
};

export const useProductCatalog = () => {
  const [state, setState] = useState({
    products: globalCache || [],
    loading: globalCache ? false : globalLoading,
    error: globalError
  });

  useEffect(() => {
    const listener = (newState) => {
      setState({
        products: newState.products || [],
        loading: newState.loading,
        error: newState.error
      });
    };
    globalListeners.push(listener);

    if (globalListeners.length === 1) {
      fetchFreshProducts();
      globalInterval = setInterval(fetchFreshProducts, 5500);
    } else if (globalCache) {
      listener({ products: globalCache, loading: globalLoading, error: globalError });
    }

    return () => {
      globalListeners = globalListeners.filter(l => l !== listener);
      if (globalListeners.length === 0 && globalInterval) {
        clearInterval(globalInterval);
        globalInterval = null;
      }
    };
  }, []);

  return state;
};

export default useProductCatalog;
