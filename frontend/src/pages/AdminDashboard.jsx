// frontend/src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";

const AdminDashboard = () => {
  const { userInfo } = useContext(AuthContext);

  const [metrics, setMetrics] = useState({
    totalOrders: 0,
    totalProducts: 0,
    totalUsers: 0,
    totalSales: 0,
  });

  const [trends, setTrends] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [topSelling, setTopSelling] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [restockLoading, setRestockLoading] = useState(null); // variantId

  // Input states for restocking: { [variantId]: number }
  const [restockInputs, setRestockInputs] = useState({});

  const fetchAnalytics = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo?.token || ""}`,
        },
      };

      const { data } = await axios.get("/api/admin/analytics", config);

      setMetrics({
        totalOrders: data?.totalOrders || 0,
        totalProducts: data?.totalProducts || 0,
        totalUsers: data?.totalUsers || 0,
        totalSales: data?.totalSales || 0,
      });

      setTrends(data?.trends || []);
      setLowStockProducts(data?.lowStockProducts || []);
      setTopSelling(data?.topSelling || []);
      setTopCustomers(data?.topCustomers || []);

      // Pre-fill restock input values
      const initialInputs = {};
      (data?.lowStockProducts || []).forEach(p => {
        p.variants.forEach(v => {
          if (v.countInStock < 10) {
            initialInputs[v._id] = v.countInStock + 20; // suggest restocking 20 units
          }
        });
      });
      setRestockInputs(prev => ({ ...initialInputs, ...prev }));

      setLoading(false);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not load stats.");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userInfo?.token) {
      fetchAnalytics(true);

      const interval = setInterval(() => {
        fetchAnalytics(false);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [userInfo]);

  const handleRestockSubmit = async (e, productId, variantId) => {
    e.preventDefault();
    const qty = Number(restockInputs[variantId]);
    if (isNaN(qty) || qty < 0) {
      setError("Please enter a valid stock quantity");
      return;
    }

    try {
      setRestockLoading(variantId);
      setError(null);
      setSuccessMsg("");

      const config = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userInfo?.token || ""}`,
        },
      };

      await axios.put(`/api/admin/products/${productId}/restock`, {
        variantId,
        countInStock: qty
      }, config);

      setSuccessMsg("Inventory restocked successfully!");
      // Reload stats silently to update UI
      await fetchAnalytics(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMsg(""), 3000);
      setRestockLoading(null);
    } catch (err) {
      setRestockLoading(null);
      setError(err?.response?.data?.message || err.message || "Failed to update stock.");
    }
  };

  const handleInputChange = (variantId, value) => {
    setRestockInputs(prev => ({
      ...prev,
      [variantId]: value
    }));
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
        <p className="text-center text-sm text-gray-500 font-medium">
          Loading dashboard intelligence analytics...
        </p>
      </div>
    );

  // SVG Chart Computations for Sales and Orders
  const renderSalesChart = () => {
    if (!trends || trends.length === 0) return null;
    const maxSales = Math.max(...trends.map(t => t.sales), 100);
    const chartHeight = 140;
    const chartWidth = 500;
    const paddingLeft = 50;
    const paddingRight = 10;
    const paddingTop = 15;
    const paddingBottom = 20;

    const usableWidth = chartWidth - paddingLeft - paddingRight;
    const usableHeight = chartHeight - paddingTop - paddingBottom;

    const points = trends.map((t, idx) => {
      const x = paddingLeft + (idx / (trends.length - 1)) * usableWidth;
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
        {/* Horizontal Gridlines */}
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
        {/* Area fill */}
        <path d={areaData} fill="url(#salesGrad)" />
        {/* Line path */}
        <path d={pathData} fill="none" stroke="#10b981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* Data points */}
        {points.map((p, i) => (
          <g key={i} className="group cursor-pointer">
            <circle cx={p.x} cy={p.y} r={3} fill="#ffffff" stroke="#10b981" strokeWidth={2} />
            <circle cx={p.x} cy={p.y} r={6} fill="#10b981" opacity={0} className="hover:opacity-20 transition-opacity" />
            {/* Tooltip showing on hover */}
            <title>{`${p.date}: ₹${p.sales.toFixed(2)}`}</title>
          </g>
        ))}
        {/* X Axis Labels */}
        {points.map((p, i) => {
          const formattedDate = p.date.substring(5); // MM-DD
          return (
            <text key={i} x={p.x} y={chartHeight - 4} fill="#6b7280" fontSize={8} textAnchor="middle">
              {formattedDate}
            </text>
          );
        })}
      </svg>
    );
  };

  const renderOrdersChart = () => {
    if (!trends || trends.length === 0) return null;
    const maxOrders = Math.max(...trends.map(t => t.orders), 5);
    const chartHeight = 140;
    const chartWidth = 500;
    const paddingLeft = 40;
    const paddingRight = 10;
    const paddingTop = 15;
    const paddingBottom = 20;

    const usableWidth = chartWidth - paddingLeft - paddingRight;
    const usableHeight = chartHeight - paddingTop - paddingBottom;

    const points = trends.map((t, idx) => {
      const x = paddingLeft + (idx / (trends.length - 1)) * usableWidth;
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
        {/* Horizontal Gridlines */}
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
        {/* Area fill */}
        <path d={areaData} fill="url(#ordersGrad)" />
        {/* Line path */}
        <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* Data points */}
        {points.map((p, i) => (
          <g key={i} className="group cursor-pointer">
            <circle cx={p.x} cy={p.y} r={3} fill="#ffffff" stroke="#3b82f6" strokeWidth={2} />
            <circle cx={p.x} cy={p.y} r={6} fill="#3b82f6" opacity={0} className="hover:opacity-20 transition-opacity" />
            <title>{`${p.date}: ${p.orders} Orders`}</title>
          </g>
        ))}
        {/* X Axis Labels */}
        {points.map((p, i) => {
          const formattedDate = p.date.substring(5); // MM-DD
          return (
            <text key={i} x={p.x} y={chartHeight - 4} fill="#6b7280" fontSize={8} textAnchor="middle">
              {formattedDate}
            </text>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto py-6 px-4 md:px-6 space-y-8 font-sans text-gray-700">
      
      {/* Title */}
      <div className="border-b border-gray-100 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">
            📊 Executive Intelligence Panel
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Real-time management dashboards monitoring sales performance, restocking lists, and customer activity.
          </p>
        </div>
        <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 self-start md:self-auto uppercase tracking-wider">
          🔴 Live Sync Connected
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-medium max-w-4xl">
          ⚠️ {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl text-xs font-medium max-w-4xl animate-bounce">
          ✅ {successMsg}
        </div>
      )}

      {/* Navigation Controls */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs">
        <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
          ⚙️ Dashboard Management Shortcuts
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/admin/products"
            className="p-6 bg-emerald-50/20 hover:bg-emerald-50/40 border border-emerald-100 border-l-4 border-l-emerald-500 rounded-2xl block transition-all duration-300 shadow-2xs hover:shadow-md hover:scale-[1.03]"
          >
            <h4 className="font-bold text-sm uppercase tracking-wide text-gray-900 flex items-center gap-2">
              <span>🛒</span> Manage Products
            </h4>
            <p className="text-[11px] text-gray-500 font-medium mt-2.5 leading-relaxed">
              Add new grocery items, update stock quantities, change pricing details, or remove store entries.
            </p>
          </Link>

          <Link
            to="/admin/orders"
            className="p-6 bg-blue-50/20 hover:bg-blue-50/40 border border-blue-100 border-l-4 border-l-blue-500 rounded-2xl block transition-all duration-300 shadow-2xs hover:shadow-md hover:scale-[1.03]"
          >
            <h4 className="font-bold text-sm uppercase tracking-wide text-gray-900 flex items-center gap-2">
              <span>📦</span> Manage Orders
            </h4>
            <p className="text-[11px] text-gray-500 font-medium mt-2.5 leading-relaxed">
              Track active delivery schedules, verify successful purchases, and mark orders as shipped or delivered.
            </p>
          </Link>

          <Link
            to="/admin/users"
            className="p-6 bg-purple-50/20 hover:bg-purple-50/40 border border-purple-100 border-l-4 border-l-purple-500 rounded-2xl block transition-all duration-300 shadow-2xs hover:shadow-md hover:scale-[1.03]"
          >
            <h4 className="font-bold text-sm uppercase tracking-wide text-gray-900 flex items-center gap-2">
              <span>👥</span> Manage Users
            </h4>
            <p className="text-[11px] text-gray-500 font-medium mt-2.5 leading-relaxed">
              View customer profiles, look up account information records, and easily check active user counts.
            </p>
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-2xs hover:shadow-xs transition-shadow">
          <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest block">
            Gross Revenue
          </span>
          <span className="text-3xl font-extrabold text-emerald-600 tracking-tight block mt-2">
            ₹{Number(metrics.totalSales || 0).toFixed(2)}
          </span>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-2xs hover:shadow-xs transition-shadow">
          <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest block">
            Total Orders
          </span>
          <span className="text-3xl font-extrabold text-gray-950 tracking-tight block mt-2">
            {metrics.totalOrders || 0}
          </span>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-2xs hover:shadow-xs transition-shadow">
          <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest block">
            Product Catalog
          </span>
          <span className="text-3xl font-extrabold text-gray-950 tracking-tight block mt-2">
            {metrics.totalProducts || 0} Items
          </span>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-2xs hover:shadow-xs transition-shadow">
          <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest block">
            Customer Base
          </span>
          <span className="text-3xl font-extrabold text-gray-950 tracking-tight block mt-2">
            {metrics.totalUsers || 0} Users
          </span>
        </div>
      </div>

      {/* 1. Analytics & Trends Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs">
          <div className="flex justify-between items-center mb-4 border-b border-gray-50 pb-2">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              📈 Sales Performance (7-Day Trend)
            </h3>
            <span className="text-[10px] text-gray-400 font-medium">Sum of paid transactions</span>
          </div>
          <div className="w-full bg-slate-50/50 p-2 rounded-xl border border-gray-50">
            {renderSalesChart()}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs">
          <div className="flex justify-between items-center mb-4 border-b border-gray-50 pb-2">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              📦 Order Volumes (7-Day Trend)
            </h3>
            <span className="text-[10px] text-gray-400 font-medium">Daily processed orders</span>
          </div>
          <div className="w-full bg-slate-50/50 p-2 rounded-xl border border-gray-50">
            {renderOrdersChart()}
          </div>
        </div>
      </div>

      {/* 2. Low Stock Warning List & Inline Restocking Panel */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
          <div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              ⚠️ Low Stock Catalog Alerts
            </h3>
            <p className="text-[10px] text-gray-500 font-medium mt-0.5">
              Flagged items with stock counts less than 10. Update inventory instantly.
            </p>
          </div>
          <span className="bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {lowStockProducts.reduce((acc, p) => acc + p.variants.filter(v => v.countInStock < 10).length, 0)} Items Flagged
          </span>
        </div>

        {lowStockProducts.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-500 font-medium bg-gray-50 rounded-xl border border-dashed border-gray-200">
            🎉 All product variants are fully stocked! No warnings to report.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-semibold text-[10px]">
                    <th className="py-2.5 pb-2">Product Item</th>
                    <th className="py-2.5 pb-2">Variant</th>
                    <th className="py-2.5 pb-2 text-center">Current Stock</th>
                    <th className="py-2.5 pb-2 text-right">Quick Restock Operation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lowStockProducts.flatMap(product => 
                    product.variants
                      .filter(variant => variant.countInStock < 10)
                      .map(variant => (
                        <tr key={variant._id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 flex items-center gap-3">
                            <img 
                              src={product.image} 
                              alt={product.name} 
                              className="w-8 h-8 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                            />
                            <span className="font-semibold text-gray-900">{product.name}</span>
                          </td>
                          <td className="py-3 text-gray-600 font-medium">
                            {variant.name}
                          </td>
                          <td className="py-3 text-center">
                            <span className="bg-rose-50 text-rose-700 font-bold px-2.5 py-0.5 rounded-full border border-rose-100 text-[10px]">
                              {variant.countInStock} Left
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <form 
                              onSubmit={(e) => handleRestockSubmit(e, product._id, variant._id)} 
                              className="inline-flex items-center gap-2"
                            >
                              <input 
                                type="number" 
                                min="0"
                                value={restockInputs[variant._id] || ""}
                                onChange={(e) => handleInputChange(variant._id, e.target.value)}
                                placeholder="Qty" 
                                required
                                className="w-16 border border-gray-300 p-1 rounded text-center text-xs outline-none bg-white text-gray-900 focus:border-emerald-500 font-medium"
                              />
                              <button 
                                type="submit"
                                disabled={restockLoading === variant._id}
                                className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold py-1 px-3 rounded text-[10px] uppercase tracking-wider transition-all disabled:bg-gray-200 disabled:text-gray-400"
                              >
                                {restockLoading === variant._id ? "Restocking..." : "Restock"}
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="block md:hidden space-y-4">
              {lowStockProducts.flatMap(product => 
                product.variants
                  .filter(variant => variant.countInStock < 10)
                  .map(variant => (
                    <div key={variant._id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3.5">
                      <div className="flex items-center gap-3">
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                        />
                        <div className="text-left min-w-0 flex-grow">
                          <h4 className="font-bold text-gray-900 text-xs truncate">{product.name}</h4>
                          <span className="text-[10px] text-gray-500 font-semibold uppercase">{variant.name}</span>
                        </div>
                        <div className="flex-shrink-0">
                          <span className="bg-rose-50 text-rose-700 font-extrabold px-2.5 py-0.5 rounded-full border border-rose-100 text-[10px]">
                            {variant.countInStock} Left
                          </span>
                        </div>
                      </div>
                      
                      <div className="pt-2.5 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Quick Restock:</span>
                        <form 
                          onSubmit={(e) => handleRestockSubmit(e, product._id, variant._id)} 
                          className="flex items-center gap-2 w-full sm:w-auto justify-end"
                        >
                          <input 
                            type="number" 
                            min="0"
                            value={restockInputs[variant._id] || ""}
                            onChange={(e) => handleInputChange(variant._id, e.target.value)}
                            placeholder="Qty" 
                            required
                            className="w-16 border border-gray-300 p-1.5 rounded text-center text-xs outline-none bg-white text-gray-900 focus:border-emerald-500 font-semibold"
                          />
                          <button 
                            type="submit"
                            disabled={restockLoading === variant._id}
                            className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black py-1.5 px-3 rounded text-[10px] uppercase tracking-wider transition-all disabled:bg-gray-200 disabled:text-gray-400 cursor-pointer"
                          >
                            {restockLoading === variant._id ? "..." : "Restock"}
                          </button>
                        </form>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </>
        )}
      </div>

      {/* 5. Business Insights tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top-Selling Products */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-3 mb-4">
            🏆 Top Selling Grocery Items
          </h3>
          {topSelling.length === 0 ? (
            <p className="text-center py-10 text-xs text-gray-500 font-medium">No sales data available yet.</p>
          ) : (
            <div className="space-y-4">
              {topSelling.map((p, idx) => (
                <div key={p._id || idx} className="flex items-center justify-between hover:bg-gray-50/50 p-2 rounded-xl transition-all">
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-gray-400">#{idx + 1}</span>
                    <img 
                      src={p.image} 
                      alt={p.name} 
                      className="w-10 h-10 rounded-xl object-cover border border-gray-100 flex-shrink-0"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 line-clamp-1">{p.name}</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">{p.totalQty} units sold</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600">
                    ₹{Number(p.totalSales || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Customers (Spenders) */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-3 mb-4">
            💎 Most Active Customers (Top Spenders)
          </h3>
          {topCustomers.length === 0 ? (
            <p className="text-center py-10 text-xs text-gray-500 font-medium">No registered buyer records found.</p>
          ) : (
            <div className="space-y-4">
              {topCustomers.map((c, idx) => (
                <div key={c._id || idx} className="flex items-center justify-between hover:bg-gray-50/50 p-2 rounded-xl transition-all">
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-gray-400">#{idx + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-xs flex-shrink-0">
                      {c.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">{c.name}</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">{c.totalOrders} total orders</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-900">
                    ₹{Number(c.totalSpend || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default AdminDashboard;