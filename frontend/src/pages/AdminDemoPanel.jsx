// frontend/src/pages/AdminDemoPanel.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';

// ==========================================
// MOCK DATA (FRONTEND CONSTANTS ONLY)
// ==========================================
const MOCK_PRODUCTS = [
  {
    _id: 'prod_001',
    name: 'Fresh Premium Milk',
    brand: 'Amul Gold',
    category: 'Dairy & Milk Products',
    description: 'High-fat pasteurized fresh cow milk, rich in nutrients.',
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&q=80&w=600',
    rating: 4.6,
    gst: 5,
    variants: [
      { _id: 'v_001_1', name: '500ml', price: 32, originalPrice: 35, countInStock: 120 },
      { _id: 'v_001_2', name: '1L', price: 62, originalPrice: 66, countInStock: 85 }
    ]
  },
  {
    _id: 'prod_002',
    name: 'Organic Bananas',
    brand: 'DailyMart Choice',
    category: 'Fruits & Vegetables',
    description: 'Sweet, fully ripened organic yellow bananas sourced locally.',
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&q=80&w=600',
    rating: 4.8,
    gst: 0,
    variants: [
      { _id: 'v_002_1', name: '1kg', price: 49, originalPrice: 60, countInStock: 5 } // Low stock alert!
    ]
  },
  {
    _id: 'prod_003',
    name: 'Concentrated Dishwash Liquid',
    brand: 'Pril Clean',
    category: 'Kitchen Essentials',
    description: 'Tough grease remover liquid with fresh lime extracts.',
    image: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&q=80&w=600',
    rating: 4.3,
    gst: 18,
    variants: [
      { _id: 'v_003_1', name: '250ml', price: 42, originalPrice: 45, countInStock: 150 },
      { _id: 'v_003_2', name: '500ml', price: 79, originalPrice: 85, countInStock: 9 } // Low stock alert!
    ]
  },
  {
    _id: 'prod_004',
    name: 'Refined Sunflower Oil',
    brand: 'Fortune Gold',
    category: 'Kitchen Essentials',
    description: 'Light and healthy cooking oil rich in vitamins and low absorption.',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=600',
    rating: 4.5,
    gst: 5,
    variants: [
      { _id: 'v_004_1', name: '1L Refill', price: 145, originalPrice: 175, countInStock: 4 } // Low stock alert!
    ]
  },
  {
    _id: 'prod_005',
    name: 'Easy Wash Laundry Powder',
    brand: 'Surf Excel',
    category: 'Home Essentials',
    description: 'Ultra-clean formula detergent powder for bright whites and colors.',
    image: 'https://images.unsplash.com/photo-1583947581924-860bda6a26df?auto=format&fit=crop&q=80&w=600',
    rating: 4.7,
    gst: 18,
    variants: [
      { _id: 'v_005_1', name: '1kg', price: 120, originalPrice: 135, countInStock: 65 }
    ]
  },
  {
    _id: 'prod_006',
    name: 'Marie Gold Biscuits',
    brand: 'Britannia',
    category: 'Home Essentials',
    description: 'Crisp tea-time wheat biscuits filled with nutrients.',
    image: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&q=80&w=600',
    rating: 4.2,
    gst: 18,
    variants: [
      { _id: 'v_006_1', name: '250g Pack', price: 28, originalPrice: 30, countInStock: 250 }
    ]
  }
];

const MOCK_ORDERS = [
  {
    _id: 'DEMO-ORDER-001',
    user: { name: 'Demo User 1', email: 'demouser1@example.com' },
    createdAt: '2026-06-05T10:45:00.000Z',
    isPaid: true,
    paidAt: '2026-06-05T10:46:12Z',
    isDelivered: true,
    deliveredAt: '2026-06-05T15:20:00Z',
    isOutForDelivery: true,
    isCancelled: false,
    refundStatus: 'Pending',
    refundAmount: 0,
    totalPrice: 173.00,
    orderItems: [
      { name: 'Fresh Premium Milk', qty: 2, variantName: '1L', price: 62 },
      { name: 'Organic Bananas', qty: 1, variantName: '1kg', price: 49 }
    ],
    shippingAddress: {
      address: 'Suite 404, Tech Park Towers',
      city: 'Tiruppur',
      postalCode: '641602'
    }
  },
  {
    _id: 'DEMO-ORDER-002',
    user: { name: 'Demo User 2', email: 'demouser2@example.com' },
    createdAt: '2026-06-06T09:12:00.000Z',
    isPaid: true,
    paidAt: '2026-06-06T09:13:00Z',
    isDelivered: false,
    isOutForDelivery: true,
    isCancelled: false,
    refundStatus: 'Pending',
    refundAmount: 0,
    totalPrice: 219.00,
    orderItems: [
      { name: 'Concentrated Dishwash Liquid', qty: 1, variantName: '500ml', price: 79 },
      { name: 'Easy Wash Laundry Powder', qty: 1, variantName: '1kg', price: 120 }
    ],
    shippingAddress: {
      address: '22 Baker St, Town Center',
      city: 'Tiruppur',
      postalCode: '641601'
    }
  },
  {
    _id: 'DEMO-ORDER-003',
    user: { name: 'Demo User 3', email: 'demouser3@example.com' },
    createdAt: '2026-06-06T11:20:00.000Z',
    isPaid: false,
    isDelivered: false,
    isOutForDelivery: false,
    isCancelled: false,
    refundStatus: 'Pending',
    refundAmount: 0,
    totalPrice: 217.00,
    orderItems: [
      { name: 'Marie Gold Biscuits', qty: 3, variantName: '250g Pack', price: 28 },
      { name: 'Refined Sunflower Oil', qty: 1, variantName: '1L Refill', price: 145 }
    ],
    shippingAddress: {
      address: 'Plot 4A, Green Meadows Estate',
      city: 'Tiruppur',
      postalCode: '641603'
    }
  },
  {
    _id: 'DEMO-ORDER-004',
    user: { name: 'Demo User 1', email: 'demouser1@example.com' },
    createdAt: '2026-06-04T15:30:00.000Z',
    isPaid: true,
    paidAt: '2026-06-04T15:32:00Z',
    isDelivered: false,
    isOutForDelivery: false,
    isCancelled: true,
    refundStatus: 'Completed',
    refundAmount: 240.00,
    totalPrice: 240.00,
    orderItems: [
      { name: 'Easy Wash Laundry Powder', qty: 2, variantName: '1kg', price: 120 }
    ],
    shippingAddress: {
      address: 'Suite 404, Tech Park Towers',
      city: 'Tiruppur',
      postalCode: '641602'
    }
  }
];

const MOCK_USERS = [
  { _id: 'usr_001', name: 'Demo User 1', email: 'demouser1@example.com', isAdmin: false, createdAt: '2026-05-15T08:30:00Z' },
  { _id: 'usr_002', name: 'Demo User 2', email: 'demouser2@example.com', isAdmin: false, createdAt: '2026-05-20T14:45:00Z' },
  { _id: 'usr_003', name: 'Demo User 3', email: 'demouser3@example.com', isAdmin: false, createdAt: '2026-06-01T11:10:00Z' },
  { _id: 'usr_004', name: 'Daily Mart Admin', email: 'dailymartadmin@gmail.com', isAdmin: true, createdAt: '2026-01-01T00:00:00Z' }
];

const MOCK_TRENDS = [
  { date: '05-31', sales: 1250, orders: 6 },
  { date: '06-01', sales: 1840, orders: 8 },
  { date: '06-02', sales: 980, orders: 4 },
  { date: '06-03', sales: 2400, orders: 12 },
  { date: '06-04', sales: 1550, orders: 7 },
  { date: '06-05', sales: 2900, orders: 15 },
  { date: '06-06', sales: 3400, orders: 18 }
];

// Reusable low stock list computed once
const MOCK_LOW_STOCK = MOCK_PRODUCTS.flatMap(p => 
  p.variants
    .filter(v => v.countInStock < 10)
    .map(v => ({ ...v, productName: p.name, productImage: p.image, productId: p._id }))
);

const MOCK_TOP_SELLING = [
  { _id: 'p_ts1', name: 'Fresh Premium Milk', image: MOCK_PRODUCTS[0].image, totalQty: 42, totalSales: 2604 },
  { _id: 'p_ts2', name: 'Easy Wash Laundry Powder', image: MOCK_PRODUCTS[4].image, totalQty: 18, totalSales: 2160 },
  { _id: 'p_ts3', name: 'Refined Sunflower Oil', image: MOCK_PRODUCTS[3].image, totalQty: 12, totalSales: 1740 }
];

const MOCK_TOP_CUSTOMERS = [
  { _id: 'usr_001', name: 'Demo User 1', totalOrders: 5, totalSpend: 1120.00 },
  { _id: 'usr_002', name: 'Demo User 2', totalOrders: 3, totalSpend: 680.00 },
  { _id: 'usr_003', name: 'Demo User 3', totalOrders: 2, totalSpend: 317.00 }
];

const AdminDemoPanel = () => {
  // Navigation states
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'products', 'orders', 'users'
  
  // Dashboard states
  const [restockInputs, setRestockInputs] = useState(() => {
    const inputs = {};
    MOCK_LOW_STOCK.forEach(v => { inputs[v._id] = v.countInStock + 20; });
    return inputs;
  });

  // Products tab inner sub-tab states
  const [productsSubTab, setProductsSubTab] = useState('all'); // 'all', 'manual', 'bulk', 'convert_cat', 'image_update'
  const [productsSearch, setProductsSearch] = useState('');
  const [productsSort, setProductsSort] = useState('1'); // Latest upload first
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);

  // Manual product form state
  const [productForm, setProductForm] = useState({
    name: '', brand: '', category: '', description: '', image: '', rating: 0, gst: 0,
    variants: []
  });
  const [newVariant, setNewVariant] = useState({ name: '', price: '', originalPrice: '', countInStock: '' });

  // Category conversion / Image URL states
  const [sourceCategory, setSourceCategory] = useState('');
  const [targetCategory, setTargetCategory] = useState('');
  const [imageInputs, setImageInputs] = useState(() => {
    const inputs = {};
    MOCK_PRODUCTS.forEach(p => { inputs[p._id] = p.image; });
    return inputs;
  });

  // Bulk product import states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState({
    totalRows: 0, importedCount: 0, updatedCount: 0, duplicateCount: 0, failedCount: 0
  });

  // Orders tab sub-tab & edit modal states
  const [ordersSubTab, setOrdersSubTab] = useState('all'); // 'all', 'pending', 'active', 'completed', 'cancelled'
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState(null);
  const [orderEditForm, setOrderEditForm] = useState({
    isPaid: false, deliveryStatus: 'Processing', refundStatus: 'Pending', refundAmount: 0
  });
  
  const [showEditDeliveryStatusDropdown, setShowEditDeliveryStatusDropdown] = useState(false);
  const [showEditRefundStatusDropdown, setShowEditRefundStatusDropdown] = useState(false);

  const editDeliveryRef = useRef(null);
  const editRefundRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (editDeliveryRef.current && !editDeliveryRef.current.contains(event.target)) {
        setShowEditDeliveryStatusDropdown(false);
      }
      if (editRefundRef.current && !editRefundRef.current.contains(event.target)) {
        setShowEditRefundStatusDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Alert safety wrapper for actions
  const triggerReadOnlyWarning = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    alert('🔒 Read-Only Mode (Demo Only)\nThis action is locked. No changes can be saved in this demo environment.');
  };

  // Bulk upload simulator
  const handleBulkUploadSimulate = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);

    setTimeout(() => {
      setUploadProgress(45);
      setTimeout(() => {
        setUploadProgress(80);
        setTimeout(() => {
          setUploadProgress(100);
          setIsUploading(false);
          setSummaryData({
            totalRows: 24,
            importedCount: 18,
            updatedCount: 4,
            duplicateCount: 2,
            failedCount: 0
          });
          setShowSummaryModal(true);
          e.target.value = ''; // Reset uploader
        }, 500);
      }, 600);
    }, 400);
  };

  // SVG Chart Computations for Sales and Orders
  const renderSalesChart = () => {
    const maxSales = Math.max(...MOCK_TRENDS.map(t => t.sales), 100);
    const chartHeight = 140;
    const chartWidth = 500;
    const paddingLeft = 50;
    const paddingRight = 10;
    const paddingTop = 15;
    const paddingBottom = 20;
    const usableWidth = chartWidth - paddingLeft - paddingRight;
    const usableHeight = chartHeight - paddingTop - paddingBottom;

    const points = MOCK_TRENDS.map((t, idx) => {
      const x = paddingLeft + (idx / (MOCK_TRENDS.length - 1)) * usableWidth;
      const y = paddingTop + usableHeight - (t.sales / maxSales) * usableHeight;
      return { x, y, sales: t.sales, date: t.date };
    });

    const pathData = points.reduce((acc, p, idx) => {
      return acc + `${idx === 0 ? "M" : "L"} ${p.x} ${p.y} `;
    }, "");

    const areaData = pathData + `L ${points[points.length - 1].x} ${chartHeight - paddingBottom} L ${points[0].x} ${chartHeight - paddingBottom} Z`;

    return (
      <svg className="w-full h-auto" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        <defs>
          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = paddingTop + usableHeight * ratio;
          const val = (maxSales * (1 - ratio)).toFixed(0);
          return (
            <g key={i}>
              <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#f3f4f6" strokeWidth={1} />
              <text x={paddingLeft - 8} y={y + 4} fill="#9ca3af" fontSize={8} textAnchor="end">₹{val}</text>
            </g>
          );
        })}
        <path d={areaData} fill="url(#salesGrad)" />
        <path d={pathData} fill="none" stroke="#10b981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i} className="group cursor-pointer">
            <circle cx={p.x} cy={p.y} r={3} fill="#ffffff" stroke="#10b981" strokeWidth={2} />
            <title>{`${p.date}: ₹${p.sales.toFixed(2)}`}</title>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={i} x={p.x} y={chartHeight - 4} fill="#6b7280" fontSize={8} textAnchor="middle">
            {p.date}
          </text>
        ))}
      </svg>
    );
  };

  const renderOrdersChart = () => {
    const maxOrders = Math.max(...MOCK_TRENDS.map(t => t.orders), 5);
    const chartHeight = 140;
    const chartWidth = 500;
    const paddingLeft = 40;
    const paddingRight = 10;
    const paddingTop = 15;
    const paddingBottom = 20;
    const usableWidth = chartWidth - paddingLeft - paddingRight;
    const usableHeight = chartHeight - paddingTop - paddingBottom;

    const points = MOCK_TRENDS.map((t, idx) => {
      const x = paddingLeft + (idx / (MOCK_TRENDS.length - 1)) * usableWidth;
      const y = paddingTop + usableHeight - (t.orders / maxOrders) * usableHeight;
      return { x, y, orders: t.orders, date: t.date };
    });

    const pathData = points.reduce((acc, p, idx) => {
      return acc + `${idx === 0 ? "M" : "L"} ${p.x} ${p.y} `;
    }, "");

    const areaData = pathData + `L ${points[points.length - 1].x} ${chartHeight - paddingBottom} L ${points[0].x} ${chartHeight - paddingBottom} Z`;

    return (
      <svg className="w-full h-auto" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        <defs>
          <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.00" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = paddingTop + usableHeight * ratio;
          const val = Math.round(maxOrders * (1 - ratio));
          return (
            <g key={i}>
              <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#f3f4f6" strokeWidth={1} />
              <text x={paddingLeft - 8} y={y + 4} fill="#9ca3af" fontSize={8} textAnchor="end">{val}</text>
            </g>
          );
        })}
        <path d={areaData} fill="url(#ordersGrad)" />
        <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i} className="group cursor-pointer">
            <circle cx={p.x} cy={p.y} r={3} fill="#ffffff" stroke="#3b82f6" strokeWidth={2} />
            <title>{`${p.date}: ${p.orders} Orders`}</title>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={i} x={p.x} y={chartHeight - 4} fill="#6b7280" fontSize={8} textAnchor="middle">
            {p.date}
          </text>
        ))}
      </svg>
    );
  };

  // Filtered lists based on search/tab parameters
  const filteredProducts = useMemo(() => {
    let list = [...MOCK_PRODUCTS];
    if (productsSearch.trim() !== '') {
      const query = productsSearch.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query) || p.category.toLowerCase().includes(query));
    }
    return list;
  }, [productsSearch]);

  const filteredOrders = useMemo(() => {
    let list = [...MOCK_ORDERS];
    if (ordersSubTab !== 'all') {
      list = list.filter(o => {
        if (ordersSubTab === 'pending') return !o.isPaid && !o.isCancelled;
        if (ordersSubTab === 'active') return o.isPaid && !o.isDelivered && !o.isCancelled;
        if (ordersSubTab === 'completed') return o.isDelivered;
        if (ordersSubTab === 'cancelled') return o.isCancelled;
        return true;
      });
    }
    return list;
  }, [ordersSubTab]);

  return (
    <div className="max-w-[1400px] mx-auto py-6 px-4 md:px-6 space-y-6 font-sans text-gray-700">
      
      {/* ⚠️ TOP BANNER (MANDATORY WARNING) */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-xs flex items-start gap-3">
        <span className="text-xl pt-0.5">⚠️</span>
        <div className="space-y-1 text-left">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-800">
            This is the EXACT Original Admin Panel UI (Demo Mode)
          </h4>
          <p className="text-[11px] text-amber-700 font-semibold leading-relaxed">
            You can only view the interface in READ-ONLY mode. No changes are allowed.
          </p>
        </div>
      </div>

      {/* Navigation Back Buttons */}
      <div className="flex items-center gap-3 text-left pt-1">
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-emerald-600 transition-colors uppercase tracking-wider"
        >
          <span>←</span> Back to Profile
        </Link>
        <span className="text-gray-300 font-semibold">|</span>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-emerald-600 transition-colors uppercase tracking-wider"
        >
          <span>🏠</span> Back to Store
        </Link>
      </div>

      {/* Header and Title */}
      <div className="border-b border-gray-150 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="text-left">
          <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight flex items-center gap-2">
            <span>🛡️</span> Demo Executive Panel
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Simulated visual sandbox replicating the administration controls and metrics layout.
          </p>
        </div>
        <div className="text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100 self-start md:self-auto uppercase tracking-wider">
          🔒 Read-Only Workspace
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`py-2 px-4 border-b-2 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors ${activeTab === 'dashboard' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          📊 Overview Analytics
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`py-2 px-4 border-b-2 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors ${activeTab === 'products' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          🛒 Store Inventory
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`py-2 px-4 border-b-2 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors ${activeTab === 'orders' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          📦 Delivery Orders
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`py-2 px-4 border-b-2 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors ${activeTab === 'users' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          👥 Registered Buyers
        </button>
      </div>

      {/* ========================================================
          1. OVERVIEW DASHBOARD VIEW
          ======================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Shortcuts Management panel */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-150 pb-2 text-left">
              ⚙️ Dashboard shortcuts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => { setActiveTab('products'); setProductsSubTab('all'); }}
                className="p-5 text-left bg-emerald-50/20 hover:bg-emerald-50/40 border border-emerald-100 border-l-4 border-l-emerald-500 rounded-2xl block transition-all duration-200 shadow-2xs"
              >
                <h4 className="font-bold text-sm uppercase tracking-wide text-gray-900 flex items-center gap-2">
                  <span>🛒</span> Product Catalog
                </h4>
                <p className="text-[11px] text-gray-500 font-medium mt-2 leading-relaxed">
                  Update inventory counts, manage packing variants, adjust tax GST brackets, or update images.
                </p>
              </button>

              <button
                onClick={() => { setActiveTab('orders'); setOrdersSubTab('all'); }}
                className="p-5 text-left bg-blue-50/20 hover:bg-blue-50/40 border border-blue-100 border-l-4 border-l-blue-500 rounded-2xl block transition-all duration-200 shadow-2xs"
              >
                <h4 className="font-bold text-sm uppercase tracking-wide text-gray-900 flex items-center gap-2">
                  <span>📦</span> Dispatch Orders
                </h4>
                <p className="text-[11px] text-gray-500 font-medium mt-2 leading-relaxed">
                  Check active shipping routes, inspect delivery details, and manually handle payment overrides.
                </p>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className="p-5 text-left bg-purple-50/20 hover:bg-purple-50/40 border border-purple-100 border-l-4 border-l-purple-500 rounded-2xl block transition-all duration-200 shadow-2xs"
              >
                <h4 className="font-bold text-sm uppercase tracking-wide text-gray-900 flex items-center gap-2">
                  <span>👥</span> User Profiles
                </h4>
                <p className="text-[11px] text-gray-500 font-medium mt-2 leading-relaxed">
                  Review customer details, role access indices, registration dates, and spender logs.
                </p>
              </button>
            </div>
          </div>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-2xs text-left">
              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest block">Gross Revenue</span>
              <span className="text-3xl font-extrabold text-emerald-600 tracking-tight block mt-2">₹15,320.00</span>
            </div>
            <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-2xs text-left">
              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest block">Total Orders</span>
              <span className="text-3xl font-extrabold text-gray-950 tracking-tight block mt-2">142</span>
            </div>
            <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-2xs text-left">
              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest block">Product Catalog</span>
              <span className="text-3xl font-extrabold text-gray-950 tracking-tight block mt-2">{MOCK_PRODUCTS.length} Items</span>
            </div>
            <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-2xs text-left">
              <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest block">Customer Base</span>
              <span className="text-3xl font-extrabold text-gray-950 tracking-tight block mt-2">{MOCK_USERS.length} Users</span>
            </div>
          </div>

          {/* Trends Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
              <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2 text-left">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">📈 Sales Trend (7-Day Simulation)</h3>
                <span className="text-[10px] text-gray-400 font-semibold">₹ total revenue</span>
              </div>
              <div className="bg-slate-50/50 p-2 rounded-xl border border-gray-50">{renderSalesChart()}</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
              <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2 text-left">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">📦 Order Volumes (7-Day Simulation)</h3>
                <span className="text-[10px] text-gray-400 font-semibold">Processed count</span>
              </div>
              <div className="bg-slate-50/50 p-2 rounded-xl border border-gray-50">{renderOrdersChart()}</div>
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs text-left">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">⚠️ Low Stock Alerts</h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Products with variant inventory units less than 10.</p>
              </div>
              <span className="bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {MOCK_LOW_STOCK.length} Alerts
              </span>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-semibold text-[10px]">
                  <th className="py-2.5">Product</th>
                  <th className="py-2.5">Variant</th>
                  <th className="py-2.5 text-center">In Stock</th>
                  <th className="py-2.5 text-right">Quick Restock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MOCK_LOW_STOCK.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 flex items-center gap-3">
                      <img src={item.productImage} alt={item.productName} className="w-8 h-8 rounded-lg object-cover border border-gray-200" />
                      <span className="font-semibold text-gray-900">{item.productName}</span>
                    </td>
                    <td className="py-3 text-gray-600 font-semibold">{item.name}</td>
                    <td className="py-3 text-center">
                      <span className="bg-rose-50 text-rose-700 font-bold px-2.5 py-0.5 rounded-full border border-rose-100 text-[10px]">
                        {item.countInStock} Left
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <input
                          type="number"
                          value={restockInputs[item._id] || ''}
                          onChange={(e) => setRestockInputs({ ...restockInputs, [item._id]: e.target.value })}
                          className="w-16 border border-gray-300 p-1 rounded text-center text-xs outline-none bg-white text-gray-900"
                        />
                        <button
                          onClick={triggerReadOnlyWarning}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-1 px-3 rounded text-[10px] uppercase tracking-wider cursor-pointer"
                        >
                          Restock
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top Selling / Top Customers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-3 mb-4">🏆 Top Selling Grocery Items</h3>
              <div className="space-y-4">
                {MOCK_TOP_SELLING.map((p, idx) => (
                  <div key={p._id} className="flex items-center justify-between hover:bg-gray-50/50 p-2 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-xs font-bold text-gray-400">#{idx + 1}</span>
                      <img src={p.image} alt={p.name} className="w-10 h-10 rounded-xl object-cover border border-gray-100" />
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">{p.name}</h4>
                        <p className="text-[10px] text-gray-500 mt-0.5">{p.totalQty} units sold</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600">₹{p.totalSales.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-3 mb-4">💎 Top Spenders</h3>
              <div className="space-y-4">
                {MOCK_TOP_CUSTOMERS.map((c, idx) => (
                  <div key={c._id} className="flex items-center justify-between hover:bg-gray-50/50 p-2 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-xs font-bold text-gray-400">#{idx + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-xs">
                        {c.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">{c.name}</h4>
                        <p className="text-[10px] text-gray-500 mt-0.5">{c.totalOrders} total orders</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-gray-900">₹{c.totalSpend.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          2. PRODUCTS CATALOG VIEW
          ======================================================== */}
      {activeTab === 'products' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Inner Sub-navigation tabs */}
          <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1">
            <button
              onClick={() => setProductsSubTab('all')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer ${productsSubTab === 'all' ? 'bg-emerald-50 text-emerald-600 border border-emerald-150' : 'text-gray-400 hover:text-gray-600'}`}
            >
              📋 All Products
            </button>
            <button
              onClick={() => setProductsSubTab('manual')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer ${productsSubTab === 'manual' ? 'bg-emerald-50 text-emerald-600 border border-emerald-150' : 'text-gray-400 hover:text-gray-600'}`}
            >
              ➕ Add Product (Manual)
            </button>
            <button
              onClick={() => setProductsSubTab('bulk')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer ${productsSubTab === 'bulk' ? 'bg-emerald-50 text-emerald-600 border border-emerald-150' : 'text-gray-400 hover:text-gray-600'}`}
            >
              📥 Bulk Import Upload
            </button>
            <button
              onClick={() => setProductsSubTab('convert_cat')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer ${productsSubTab === 'convert_cat' ? 'bg-emerald-50 text-emerald-600 border border-emerald-150' : 'text-gray-400 hover:text-gray-600'}`}
            >
              🔄 Convert Category
            </button>
            <button
              onClick={() => setProductsSubTab('image_update')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer ${productsSubTab === 'image_update' ? 'bg-emerald-50 text-emerald-600 border border-emerald-150' : 'text-gray-400 hover:text-gray-600'}`}
            >
              🖼️ Image URL Updater
            </button>
          </div>

          {/* Sub-tab: All products table */}
          {productsSubTab === 'all' && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs space-y-4 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Products Catalogue Grid</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search name, brand, category..."
                    value={productsSearch}
                    onChange={(e) => setProductsSearch(e.target.value)}
                    className="border border-gray-300 px-3 py-1.5 rounded-lg text-xs outline-none focus:border-emerald-500 w-64 bg-white"
                  />
                  <button onClick={triggerReadOnlyWarning} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase px-4 py-2 rounded-lg cursor-pointer">
                    ➕ Create
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-400 uppercase tracking-wider font-semibold text-[10px]">
                      <th className="py-2.5">Thumbnail</th>
                      <th className="py-2.5">Brand & Name</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">GST %</th>
                      <th className="py-2.5">Staged Packing Variants</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {filteredProducts.map((p) => (
                      <tr key={p._id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3">
                          <img src={p.image} alt={p.name} className="w-10 h-10 rounded-xl object-cover border border-gray-150" />
                        </td>
                        <td className="py-3">
                          <div className="font-bold text-gray-900">{p.name}</div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wide">{p.brand}</div>
                        </td>
                        <td className="py-3 text-gray-600 font-semibold">{p.category}</td>
                        <td className="py-3 font-mono">{p.gst}%</td>
                        <td className="py-3 space-y-1">
                          {p.variants.map((v, i) => (
                            <span key={i} className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 text-[10px] text-gray-700 px-2 py-0.5 rounded mr-1">
                              <strong>{v.name}</strong>: ₹{v.price} ({v.countInStock})
                            </span>
                          ))}
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex gap-1.5">
                            <button
                              onClick={() => {
                                setProductForm({
                                  name: p.name, brand: p.brand, category: p.category,
                                  description: p.description, image: p.image, rating: p.rating,
                                  gst: p.gst, variants: p.variants
                                });
                                setIsEditingProduct(true);
                                setEditingProductId(p._id);
                                setProductsSubTab('manual');
                              }}
                              className="border border-gray-300 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-lg cursor-pointer"
                            >
                              Edit
                            </button>
                            <button onClick={triggerReadOnlyWarning} className="border border-red-200 text-red-600 hover:bg-red-50 text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-lg cursor-pointer">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab: Manual Add product form */}
          {productsSubTab === 'manual' && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-6 text-left">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  {isEditingProduct ? '✏️ Modify Replicated Product' : '➕ Add Replicated Product Form'}
                </h3>
                {isEditingProduct && (
                  <button
                    onClick={() => {
                      setIsEditingProduct(false);
                      setEditingProductId(null);
                      setProductForm({ name: '', brand: '', category: '', description: '', image: '', rating: 0, gst: 0, variants: [] });
                      setProductsSubTab('all');
                    }}
                    className="text-xs font-semibold text-gray-400 hover:text-gray-600"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <form onSubmit={triggerReadOnlyWarning} className="space-y-4 max-w-3xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Product Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Organic Strawberries"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      className="w-full border border-gray-300 p-2 rounded text-xs outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Brand Name</label>
                    <input
                      type="text"
                      placeholder="e.g. DailyMart Fresh"
                      value={productForm.brand}
                      onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                      className="w-full border border-gray-300 p-2 rounded text-xs outline-none bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Category</label>
                    <input
                      type="text"
                      placeholder="Fruits & Vegetables"
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                      className="w-full border border-gray-300 p-2 rounded text-xs outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Image URL</label>
                    <input
                      type="text"
                      placeholder="https://images.unsplash.com/..."
                      value={productForm.image}
                      onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                      className="w-full border border-gray-300 p-2 rounded text-xs outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">GST Tax Bracket (%)</label>
                    <select
                      value={productForm.gst}
                      onChange={(e) => setProductForm({ ...productForm, gst: Number(e.target.value) })}
                      className="w-full border border-gray-300 p-2 rounded text-xs outline-none bg-white"
                    >
                      <option value="0">0% (Fruits/Veggies)</option>
                      <option value="5">5% (Dairy/Kitchen)</option>
                      <option value="18">18% (Essentials/Home)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Catalog Description</label>
                  <textarea
                    placeholder="Provide item specifications..."
                    rows="3"
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    className="w-full border border-gray-300 p-2 rounded text-xs outline-none bg-white"
                  />
                </div>

                {/* Variants Staging */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                  <h4 className="text-[10px] font-bold text-gray-900 uppercase tracking-wider">Staging packing variants</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="Pack Size (e.g. 500g)"
                      value={newVariant.name}
                      onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                      className="border border-gray-300 p-2 rounded text-xs outline-none bg-white"
                    />
                    <input
                      type="number"
                      placeholder="Selling Price"
                      value={newVariant.price}
                      onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value })}
                      className="border border-gray-300 p-2 rounded text-xs outline-none bg-white"
                    />
                    <input
                      type="number"
                      placeholder="Original Price"
                      value={newVariant.originalPrice}
                      onChange={(e) => setNewVariant({ ...newVariant, originalPrice: e.target.value })}
                      className="border border-gray-300 p-2 rounded text-xs outline-none bg-white"
                    />
                    <input
                      type="number"
                      placeholder="Stock Count"
                      value={newVariant.countInStock}
                      onChange={(e) => setNewVariant({ ...newVariant, countInStock: e.target.value })}
                      className="border border-gray-300 p-2 rounded text-xs outline-none bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newVariant.name || !newVariant.price) return alert('Enter name and price');
                      setProductForm({
                        ...productForm,
                        variants: [...productForm.variants, {
                          name: newVariant.name,
                          price: Number(newVariant.price),
                          originalPrice: Number(newVariant.originalPrice || newVariant.price),
                          countInStock: Number(newVariant.countInStock || 0)
                        }]
                      });
                      setNewVariant({ name: '', price: '', originalPrice: '', countInStock: '' });
                    }}
                    className="bg-gray-800 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded cursor-pointer"
                  >
                    ➕ Stage Variant
                  </button>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {productForm.variants.map((v, i) => (
                      <span key={i} className="bg-white border border-gray-200 text-xs px-2.5 py-1 rounded-lg flex items-center gap-2">
                        <strong>{v.name}</strong>: ₹{v.price} ({v.countInStock} units)
                        <button
                          type="button"
                          onClick={() => setProductForm({ ...productForm, variants: productForm.variants.filter((_, idx) => idx !== i) })}
                          className="text-red-500 font-bold hover:text-red-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-widest cursor-pointer shadow-xs">
                  {isEditingProduct ? '🔒 Update Product Details (Read-Only Mode)' : '🔒 Save Product Details (Read-Only Mode)'}
                </button>
              </form>
            </div>
          )}

          {/* Sub-tab: Bulk Import Excel simulator */}
          {productsSubTab === 'bulk' && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-6 text-left">
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">📥 Bulk Import Catalog Upload</h3>
                <p className="text-xs text-gray-500 font-semibold mt-1">Replicates the Excel spreadsheet parsing system for catalogue creation.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4">
                  <span className="text-4xl">📊</span>
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Upload Replicated CSV / XLSX</h4>
                    <p className="text-[10px] text-gray-400 mt-1">Files will be parsed locally within this browser sandboxed environment.</p>
                  </div>
                  
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={handleBulkUploadSimulate}
                    id="bulk-uploader-file"
                    className="hidden"
                    disabled={isUploading}
                  />
                  <label
                    htmlFor="bulk-uploader-file"
                    className={`bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider py-2 px-5 rounded-lg cursor-pointer transition-all ${isUploading ? 'opacity-55' : ''}`}
                  >
                    {isUploading ? 'Parsing Sheets...' : 'Select File'}
                  </label>

                  {isUploading && (
                    <div className="w-full max-w-xs space-y-1">
                      <div className="h-1.5 w-full bg-gray-150 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                      <span className="text-[10px] text-gray-400 font-bold block">{uploadProgress}% Complete</span>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Replicated Template Resources</h4>
                  <p className="text-[11px] text-gray-600 leading-relaxed font-semibold">
                    Download the exact spreadsheet columns layout template containing gst rate columns, display ratings, original rates, brand categories, and bulk items.
                  </p>
                  <button
                    onClick={triggerReadOnlyWarning}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase py-2.5 rounded-lg tracking-wider cursor-pointer"
                  >
                    📥 Download Template Sheet
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab: Category Converter */}
          {productsSubTab === 'convert_cat' && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-6 text-left">
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">🔄 Batch Category Converter</h3>
                <p className="text-xs text-gray-500 font-semibold mt-1">Converts all products belonging to a source category to a new target category.</p>
              </div>

              <form onSubmit={triggerReadOnlyWarning} className="max-w-md space-y-4">
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Source Category</label>
                  <select
                    value={sourceCategory}
                    onChange={(e) => setSourceCategory(e.target.value)}
                    className="w-full border border-gray-300 p-2 rounded text-xs outline-none bg-white"
                  >
                    <option value="">-- Choose Category --</option>
                    <option value="Dairy & Milk Products">Dairy & Milk Products</option>
                    <option value="Fruits & Vegetables">Fruits & Vegetables</option>
                    <option value="Kitchen Essentials">Kitchen Essentials</option>
                    <option value="Home Essentials">Home Essentials</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Target Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Organic Groceries"
                    value={targetCategory}
                    onChange={(e) => setTargetCategory(e.target.value)}
                    className="w-full border border-gray-300 p-2 rounded text-xs outline-none bg-white"
                  />
                </div>

                <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-lg text-xs uppercase tracking-widest cursor-pointer shadow-xs">
                  🔒 Batch Convert Categories (Read-Only)
                </button>
              </form>
            </div>
          )}

          {/* Sub-tab: Image URL Updater */}
          {productsSubTab === 'image_update' && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4 text-left">
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">🖼️ Image URL Batch Updater</h3>
                <p className="text-xs text-gray-500 font-semibold mt-1">Quickly audit and edit product thumbnails from a grid view list.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-250 text-gray-400 uppercase tracking-wider font-semibold text-[10px]">
                      <th className="py-2.5">Thumbnail</th>
                      <th className="py-2.5">Product Title</th>
                      <th className="py-2.5">Current URL / Replacement Input</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 font-medium">
                    {MOCK_PRODUCTS.map((p) => (
                      <tr key={p._id} className="hover:bg-gray-50/50">
                        <td className="py-3">
                          <img src={p.image} alt={p.name} className="w-12 h-12 rounded-xl object-cover border border-gray-150 shadow-2xs" />
                        </td>
                        <td className="py-3">
                          <div className="font-bold text-gray-950">{p.name}</div>
                          <div className="text-[10px] text-gray-400 font-semibold uppercase">{p.category}</div>
                        </td>
                        <td className="py-3">
                          <input
                            type="text"
                            value={imageInputs[p._id] || ''}
                            onChange={(e) => setImageInputs({ ...imageInputs, [p._id]: e.target.value })}
                            className="w-full border border-gray-300 p-2 rounded text-xs outline-none bg-white font-mono text-gray-500"
                          />
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={triggerReadOnlyWarning}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] uppercase py-1.5 px-3 rounded-lg cursor-pointer"
                          >
                            Update
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          3. ORDERS MANAGEMENT VIEW
          ======================================================== */}
      {activeTab === 'orders' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Filters Sub-navigation tabs */}
          <div className="flex border-b border-gray-200 pb-1">
            <button
              onClick={() => setOrdersSubTab('all')}
              className={`py-2 px-4 border-b-2 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors ${ordersSubTab === 'all' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              📋 All Orders
            </button>
            <button
              onClick={() => setOrdersSubTab('pending')}
              className={`py-2 px-4 border-b-2 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors ${ordersSubTab === 'pending' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              ⏳ Unpaid / Pending
            </button>
            <button
              onClick={() => setOrdersSubTab('active')}
              className={`py-2 px-4 border-b-2 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors ${ordersSubTab === 'active' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              🚚 Active Delivery
            </button>
            <button
              onClick={() => setOrdersSubTab('completed')}
              className={`py-2 px-4 border-b-2 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors ${ordersSubTab === 'completed' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              ✅ Completed Dispatches
            </button>
            <button
              onClick={() => setOrdersSubTab('cancelled')}
              className={`py-2 px-4 border-b-2 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors ${ordersSubTab === 'cancelled' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              ❌ Cancelled / Refunded
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs space-y-4 text-left">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">Replicated Global Orders Queue</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-250 text-gray-400 uppercase tracking-wider font-semibold text-[10px]">
                    <th className="py-2.5">Order ID</th>
                    <th className="py-2.5">Customer details</th>
                    <th className="py-2.5">Date & Time</th>
                    <th className="py-2.5">Total Price</th>
                    <th className="py-2.5">Payment</th>
                    <th className="py-2.5">Delivery Status</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredOrders.map((o) => (
                    <tr key={o._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 font-mono font-bold text-emerald-700">{o._id}</td>
                      <td className="py-3">
                        <div className="font-bold text-gray-950">{o.user.name}</div>
                        <div className="text-[10px] text-gray-400 font-semibold">{o.user.email}</div>
                      </td>
                      <td className="py-3 text-gray-500">{new Date(o.createdAt).toLocaleString()}</td>
                      <td className="py-3 font-bold text-gray-900">₹{o.totalPrice.toFixed(2)}</td>
                      <td className="py-3">
                        {o.isPaid ? (
                          <span className="bg-emerald-55 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">Paid</span>
                        ) : (
                          <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">Unpaid</span>
                        )}
                      </td>
                      <td className="py-3">
                        <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                          o.isCancelled ? 'bg-red-50 text-red-700 border-red-100' :
                          o.isDelivered ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          o.isOutForDelivery ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                          'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {o.isCancelled ? 'Cancelled' : o.isDelivered ? 'Delivered' : o.isOutForDelivery ? 'Out for Delivery' : 'Processing'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedOrderForEdit(o);
                            setOrderEditForm({
                              isPaid: o.isPaid,
                              deliveryStatus: o.isCancelled ? 'Cancelled' : o.isDelivered ? 'Delivered' : o.isOutForDelivery ? 'Out for Delivery' : 'Processing',
                              refundStatus: o.refundStatus || 'Pending',
                              refundAmount: o.refundAmount || 0
                            });
                          }}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] uppercase py-1.5 px-3 rounded-lg cursor-pointer shadow-3xs"
                        >
                          ⚙️ Update Status
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          4. USERS REGISTRY VIEW
          ======================================================== */}
      {activeTab === 'users' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs space-y-4 text-left animate-in fade-in duration-300">
          <div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">👥 Customer Profile Audit Logs</h3>
            <p className="text-xs text-gray-500 font-semibold mt-1">Overview of registered accounts and authentication authorization indexes.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-250 text-gray-400 uppercase tracking-wider font-semibold text-[10px]">
                  <th className="p-4">Customer ID</th>
                  <th className="p-4">Full Name</th>
                  <th className="p-4">Email Address</th>
                  <th className="p-4">Account Role</th>
                  <th className="p-4">Registration Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 font-medium">
                {MOCK_USERS.map((user) => (
                  <tr key={user._id} className="hover:bg-emerald-50/20 transition-colors">
                    <td className="p-4 font-mono text-gray-500">{user._id}</td>
                    <td className="p-4 font-bold text-gray-900">{user.name}</td>
                    <td className="p-4 text-emerald-700 font-semibold">{user.email}</td>
                    <td className="p-4">
                      {user.isAdmin ? (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">Admin</span>
                      ) : (
                        <span className="bg-gray-150 text-gray-700 border border-gray-250 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">User</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          5. EMAIL SUMMARY POPUP (BULK UPLOAD PROGRESS MODAL)
          ======================================================== */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-250 text-left animate-in fade-in zoom-in-95 duration-200">
            <div className="border-b border-gray-100 pb-2 flex justify-between items-center">
              <h4 className="font-bold text-sm text-gray-950 uppercase tracking-wider">📊 Excel Import summary</h4>
              <button onClick={() => setShowSummaryModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer">×</button>
            </div>
            <div className="space-y-2.5 text-xs text-gray-700 font-semibold">
              <div className="flex justify-between">
                <span>Total Sheet Rows Parsed:</span>
                <span className="font-bold text-gray-900">{summaryData.totalRows}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-750">New Catalog Entries Created:</span>
                <span className="font-bold text-emerald-700">+{summaryData.importedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-750">Existing Products Restocked:</span>
                <span className="font-bold text-blue-700">+{summaryData.updatedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-750">Duplicates Skipped:</span>
                <span className="font-bold text-amber-700">{summaryData.duplicateCount}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2 text-rose-600">
                <span>Failed Rows (Syntax Errors):</span>
                <span className="font-bold">{summaryData.failedCount}</span>
              </div>
            </div>
            <div className="bg-amber-55 text-amber-800 p-2.5 rounded-xl text-[10px] border border-amber-250 leading-relaxed font-semibold">
              🔒 Note: Catalog import is running in Read-Only simulation. Staged products are not saved to the persistent database.
            </div>
            <button
              onClick={() => setShowSummaryModal(false)}
              className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold text-xs uppercase py-2 rounded-lg cursor-pointer"
            >
              Close Summary
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          6. EDIT ORDERS MANUAL OVERRIDE MODAL
          ======================================================== */}
      {selectedOrderForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden flex flex-col shadow-2xl border border-gray-250 text-left animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-500">✏️ Order Manual Overrides</h4>
                <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Editing: {selectedOrderForEdit._id}</p>
              </div>
              <button
                onClick={() => setSelectedOrderForEdit(null)}
                className="text-gray-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                Close ×
              </button>
            </div>

            <form onSubmit={triggerReadOnlyWarning} className="p-6 space-y-4 text-xs font-semibold leading-relaxed text-gray-700 bg-gray-50/50">
              {/* Payment checkbox toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="order-edit-paid"
                  checked={orderEditForm.isPaid}
                  onChange={(e) => setOrderEditForm({ ...orderEditForm, isPaid: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="order-edit-paid" className="text-gray-800 font-bold uppercase tracking-wide cursor-pointer">
                  Mark as Paid (Manually Override status)
                </label>
              </div>

              {/* Delivery status custom dropdown selector */}
              <div className="relative" ref={editDeliveryRef}>
                <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">
                  Delivery Status
                </label>
                <button
                  type="button"
                  onClick={() => setShowEditDeliveryStatusDropdown(!showEditDeliveryStatusDropdown)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-left text-xs font-semibold flex justify-between items-center cursor-pointer shadow-3xs hover:border-gray-400"
                >
                  <span>{orderEditForm.deliveryStatus}</span>
                  <span className="text-[10px] text-gray-400">▼</span>
                </button>
                {showEditDeliveryStatusDropdown && (
                  <div className="absolute z-10 w-full bg-white border border-gray-250 rounded-lg shadow-lg mt-1 overflow-hidden divide-y divide-gray-100">
                    {['Processing', 'Out for Delivery', 'Delivered', 'Cancelled'].map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => {
                          setOrderEditForm({ ...orderEditForm, deliveryStatus: status });
                          setShowEditDeliveryStatusDropdown(false);
                        }}
                        className="w-full text-left p-2.5 text-xs hover:bg-emerald-50/50 hover:text-emerald-700 font-semibold transition-colors"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Refund status dropdown */}
              <div className="relative" ref={editRefundRef}>
                <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">
                  Refund Ledger Status
                </label>
                <button
                  type="button"
                  onClick={() => setShowEditRefundStatusDropdown(!showEditRefundStatusDropdown)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-left text-xs font-semibold flex justify-between items-center cursor-pointer shadow-3xs hover:border-gray-400"
                >
                  <span>{orderEditForm.refundStatus}</span>
                  <span className="text-[10px] text-gray-400">▼</span>
                </button>
                {showEditRefundStatusDropdown && (
                  <div className="absolute z-10 w-full bg-white border border-gray-250 rounded-lg shadow-lg mt-1 overflow-hidden divide-y divide-gray-100">
                    {['Pending', 'Completed'].map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => {
                          setOrderEditForm({ ...orderEditForm, refundStatus: status });
                          setShowEditRefundStatusDropdown(false);
                        }}
                        className="w-full text-left p-2.5 text-xs hover:bg-emerald-50/50 hover:text-emerald-700 font-semibold transition-colors"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Refund Amount input */}
              <div>
                <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">
                  Refund Amount (₹)
                </label>
                <input
                  type="number"
                  value={orderEditForm.refundAmount}
                  onChange={(e) => setOrderEditForm({ ...orderEditForm, refundAmount: Number(e.target.value) })}
                  className="w-full border border-gray-300 p-2 rounded-lg text-xs outline-none bg-white font-mono"
                />
              </div>

              <div className="pt-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForEdit(null)}
                  className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs uppercase font-extrabold py-2 px-4 rounded-lg cursor-pointer"
                >
                  Cancel Override
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs uppercase font-extrabold py-2 px-6 rounded-lg cursor-pointer shadow-2xs"
                >
                  🔒 Save Overrides (Read-Only)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDemoPanel;
