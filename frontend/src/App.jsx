// frontend/src/App.jsx (Optimized for v7 compliance)
import React from 'react';
import { createBrowserRouter, RouterProvider, ScrollRestoration } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

// Import pages...
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import BrowseProducts from './pages/BrowseProducts';
import SearchProducts from './pages/SearchProducts';
import Cart from './pages/Cart';
import RoutineCartPage from './pages/RoutineCartPage'; // Added custom workspace route import
import Checkout from './pages/Checkout';
import Payment from './pages/Payment';
import EBill from './pages/EBill';
import CancellationReceipt from './pages/CancellationReceipt';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import AdminProducts from './pages/AdminProducts';
import AdminOrders from './pages/AdminOrders';
import AdminUsers from './pages/AdminUsers';

// Layout wrapper to keep things scannable
const Layout = ({ children }) => (
  <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 selection:bg-emerald-500 selection:text-white">
    <ScrollRestoration />
    <Navbar />
    <main className="flex-grow max-w-[1400px] w-full mx-auto px-4 py-4 lg:py-8">
      {children}
    </main>
    <Footer />
  </div>
);

const router = createBrowserRouter([
  { path: "/", element: <Layout><Home /></Layout> },
  { path: "/login", element: <Layout><Login /></Layout> },
  { path: "/register", element: <Layout><Register /></Layout> },
  { path: "/forgot-password", element: <Layout><ForgotPassword /></Layout> },
  { path: "/browse", element: <Layout><BrowseProducts /></Layout> },
  { path: "/search", element: <Layout><SearchProducts /></Layout> },
  { path: "/cart", element: <Layout><Cart /></Layout> },
  { path: "/routine/:routineName", element: <Layout><RoutineCartPage /></Layout> }, // Registered the custom routine context landing port
  { path: "/checkout", element: <Layout><ProtectedRoute><Checkout /></ProtectedRoute></Layout> },
  { path: "/payment/:id", element: <Layout><ProtectedRoute><Payment /></ProtectedRoute></Layout> },
  { path: "/ebill/:id", element: <Layout><ProtectedRoute><EBill /></ProtectedRoute></Layout> },
  { path: "/cancellation-receipt/:id", element: <Layout><ProtectedRoute><CancellationReceipt /></ProtectedRoute></Layout> },
  { path: "/profile", element: <Layout><ProtectedRoute><Profile /></ProtectedRoute></Layout> },
  { path: "/admin", element: <Layout><ProtectedRoute isAdminRequired={true}><AdminDashboard /></ProtectedRoute></Layout> },
  { path: "/admin/products", element: <Layout><ProtectedRoute isAdminRequired={true}><AdminProducts /></ProtectedRoute></Layout> },
  { path: "/admin/orders", element: <Layout><ProtectedRoute isAdminRequired={true}><AdminOrders /></ProtectedRoute></Layout> },
  { path: "/admin/users", element: <Layout><ProtectedRoute isAdminRequired={true}><AdminUsers /></ProtectedRoute></Layout> },
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  },
});

function App() {
  const isSimulator = new URLSearchParams(window.location.search).get('isSimulator') === 'true';
  const [viewportMode, setViewportMode] = React.useState(() => localStorage.getItem('viewportMode') || 'Default');
  const [isPhysicalMobile, setIsPhysicalMobile] = React.useState(() => window.innerWidth < 1024);

  React.useEffect(() => {
    localStorage.setItem('viewportMode', viewportMode);
  }, [viewportMode]);

  React.useEffect(() => {
    const handleResize = () => {
      // If we are inside simulator, don't check physical screen size
      if (!isSimulator) {
        setIsPhysicalMobile(window.innerWidth < 1024);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSimulator]);

  // Adjust meta viewport dynamically (this forces mobile browser to render desktop site mode natively)
  React.useEffect(() => {
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (!metaViewport) return;

    if (viewportMode === 'Desktop') {
      metaViewport.setAttribute('content', 'width=1280, initial-scale=0.3, maximum-scale=3.0, user-scalable=yes');
    } else if (viewportMode === 'Tablet') {
      metaViewport.setAttribute('content', 'width=768, initial-scale=0.5, maximum-scale=3.0, user-scalable=yes');
    } else {
      // Default and Mobile viewport modes use device-width for full responsive fluid rendering
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes');
    }

    return () => {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
    };
  }, [viewportMode]);

  // If inside the simulation iframe, render app directly
  if (isSimulator) {
    return (
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <RouterProvider router={router} />
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    );
  }

  // Handle iframe load to synchronize browser history URL dynamically
  const handleFrameLoad = (e) => {
    try {
      const frameWindow = e.target.contentWindow;
      const iframePath = frameWindow.location.pathname + frameWindow.location.search;
      const parentPath = iframePath.replace(/[?&]isSimulator=true/, '').replace(/\?$/, '');
      
      if (parentPath !== window.location.pathname + window.location.search) {
        window.history.replaceState(null, '', parentPath);
      }
    } catch (err) {
      console.error('Failed to sync iframe path:', err);
    }
  };

  const getSimulatorUrl = () => {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set('isSimulator', 'true');
    return window.location.pathname + '?' + searchParams.toString();
  };

  // Determine if we need an iframe simulation:
  // ONLY render iframe if we are on a desktop monitor AND requesting Mobile or Tablet layouts.
  // Otherwise, use native meta-viewport tag adjustments on the main document.
  const needsIframeSimulator = !isPhysicalMobile && (viewportMode === 'Mobile' || viewportMode === 'Tablet');

  if (needsIframeSimulator) {
    const frameWidth = viewportMode === 'Mobile' ? '375px' : '768px';
    const frameTitle = viewportMode === 'Mobile' ? 'Mobile View (375px)' : 'Tablet View (768px)';

    return (
      <div className="min-h-screen bg-gray-150 flex flex-col items-center select-none font-sans">
        {/* VIEWPORT CONTROLLER TOOLBAR */}
        <div className="w-full bg-gray-900 text-white px-4 py-2 flex items-center justify-between shadow-md border-b border-gray-800 z-[999999]">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500 font-extrabold text-sm uppercase tracking-wider">DailyMart View</span>
            <span className="text-gray-400 text-xs font-semibold">({frameTitle})</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewportMode('Default')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${viewportMode === 'Default' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-gray-850 text-gray-350 hover:bg-gray-700'}`}
            >
              🔄 Auto Responsive
            </button>
            <button
              onClick={() => setViewportMode('Desktop')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${viewportMode === 'Desktop' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-gray-850 text-gray-350 hover:bg-gray-700'}`}
            >
              🖥️ Desktop
            </button>
            <button
              onClick={() => setViewportMode('Tablet')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${viewportMode === 'Tablet' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-gray-850 text-gray-350 hover:bg-gray-700'}`}
            >
              📟 Tablet
            </button>
            <button
              onClick={() => setViewportMode('Mobile')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${viewportMode === 'Mobile' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-gray-850 text-gray-350 hover:bg-gray-700'}`}
            >
              📱 Mobile
            </button>
          </div>
        </div>

        {/* CONTAINER FOR IFRAME SIMULATOR (No borders, just centered width alignment) */}
        <div className="flex-grow w-full flex items-center justify-center bg-gray-200 py-4">
          <div 
            style={{ 
              width: frameWidth, 
              height: 'calc(100vh - 80px)', 
              backgroundColor: '#ffffff',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              position: 'relative'
            }}
          >
            <iframe
              id="viewport-simulator-frame"
              src={getSimulatorUrl()}
              onLoad={handleFrameLoad}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="DailyMart Simulator Frame"
            />
          </div>
        </div>
      </div>
    );
  }

  // Render direct app with sticky top control bar (uses meta viewport adjustments)
  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky top toolbar */}
      <div className="w-full bg-gray-900 text-white px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between shadow-md border-b border-gray-800 z-[999999] text-xs select-none font-sans">
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="text-emerald-500 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider">DailyMart View</span>
          <span className="text-gray-400 font-semibold text-[9px] sm:text-xs hidden xs:inline-block">
            ({viewportMode === 'Default' ? 'Responsive' : `${viewportMode} Mode`})
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setViewportMode('Default')}
            className={`px-1.5 py-1 text-[10px] sm:px-3 sm:py-1 sm:text-xs font-bold rounded-lg transition-all ${viewportMode === 'Default' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-gray-850 text-gray-350 hover:bg-gray-700'}`}
          >
            🔄 Auto
          </button>
          <button
            onClick={() => setViewportMode('Desktop')}
            className={`px-1.5 py-1 text-[10px] sm:px-3 sm:py-1 sm:text-xs font-bold rounded-lg transition-all ${viewportMode === 'Desktop' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-gray-850 text-gray-350 hover:bg-gray-700'}`}
          >
            🖥️ Desktop
          </button>
          <button
            onClick={() => setViewportMode('Tablet')}
            className={`px-1.5 py-1 text-[10px] sm:px-3 sm:py-1 sm:text-xs font-bold rounded-lg transition-all ${viewportMode === 'Tablet' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-gray-850 text-gray-350 hover:bg-gray-700'}`}
          >
            📟 Tablet
          </button>
          <button
            onClick={() => setViewportMode('Mobile')}
            className={`px-1.5 py-1 text-[10px] sm:px-3 sm:py-1 sm:text-xs font-bold rounded-lg transition-all ${viewportMode === 'Mobile' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-gray-850 text-gray-350 hover:bg-gray-700'}`}
          >
            📱 Mobile
          </button>
        </div>
      </div>

      <div className="flex-grow">
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <RouterProvider router={router} />
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </div>
    </div>
  );
}

export default App;