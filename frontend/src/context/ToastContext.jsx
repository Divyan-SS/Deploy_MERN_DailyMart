import React, { createContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

export const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null); // { message, resolve } or null

  const showConfirm = useCallback((message) => {
    return new Promise((resolve) => {
      setConfirmState({ message, resolve });
    });
  }, []);

  const handleConfirmResponse = (value) => {
    if (confirmState) {
      confirmState.resolve(value);
      setConfirmState(null);
    }
  };

  const showToast = useCallback((message, type = 'info', duration) => {
    const id = Math.random().toString(36).substring(2, 9);
    // Automatically estimate reading time if duration is not explicitly specified (90ms per character, minimum of 4.5s)
    const calculatedDuration = duration || Math.max(4500, message.length * 90);
    setToasts((prevToasts) => [...prevToasts, { id, message, type, duration: calculatedDuration }]);
    
    // Auto-remove toast after the calculated duration
    setTimeout(() => {
      setToasts((prevToasts) => prevToasts.filter((t) => t.id !== id));
    }, calculatedDuration);
  }, []);

  // Globally intercept native browser alerts and redirect to custom styled toasts
  useEffect(() => {
    const nativeAlert = window.alert;
    window.alert = (message, duration) => {
      if (typeof message !== 'string') {
        message = String(message || '');
      }
      const msgLower = message.toLowerCase();
      let type = 'warning';
      
      if (
        msgLower.includes('success') || 
        msgLower.includes('added') || 
        msgLower.includes('delivered') || 
        msgLower.includes('restock') || 
        msgLower.includes('removed') ||
        msgLower.includes('completed')
      ) {
        type = 'success';
      } else if (
        msgLower.includes('fail') || 
        msgLower.includes('error') || 
        msgLower.includes('restriction') || 
        msgLower.includes('limit') || 
        msgLower.includes('exceed') || 
        msgLower.includes('conflict') ||
        msgLower.includes('no stock')
      ) {
        type = 'error';
      } else if (
        msgLower.includes('please') || 
        msgLower.includes('required') || 
        msgLower.includes('select') ||
        msgLower.includes('notice') ||
        msgLower.includes('login') ||
        msgLower.includes('sign in')
      ) {
        type = 'info';
      }

      showToast(message, type, duration);
    };

    return () => {
      window.alert = nativeAlert;
    };
  }, [showToast]);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((t) => t.id !== id));
  }, []);

  const getToastDetails = (type) => {
    switch (type) {
      case 'success':
        return {
          bgClass: 'bg-emerald-50/95 border-emerald-500 text-emerald-950 shadow-[0_8px_30px_rgba(16,185,129,0.12)]',
          barClass: 'bg-emerald-500',
          icon: (
            <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )
        };
      case 'error':
        return {
          bgClass: 'bg-red-50/95 border-red-500 text-red-955 shadow-[0_8px_30px_rgba(239,68,68,0.12)]',
          barClass: 'bg-red-500',
          icon: (
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )
        };
      case 'warning':
        return {
          bgClass: 'bg-amber-50/95 border-amber-500 text-amber-955 shadow-[0_8px_30px_rgba(245,158,11,0.12)]',
          barClass: 'bg-amber-500',
          icon: (
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )
        };
      case 'info':
      default:
        return {
          bgClass: 'bg-blue-50/95 border-blue-500 text-blue-955 shadow-[0_8px_30px_rgba(59,130,246,0.12)]',
          barClass: 'bg-blue-500',
          icon: (
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}
      {createPortal(
        <div className="fixed bottom-5 right-5 z-[99999999] flex flex-col gap-3.5 max-w-sm w-full px-4 sm:px-0 pointer-events-none font-sans">
          <style>{`
            @keyframes slideInToast {
              from { transform: translateX(120%) scale(0.9); opacity: 0; }
              to { transform: translateX(0) scale(1); opacity: 1; }
            }
            .animate-toast-in {
              animation: slideInToast 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            @keyframes toastProgressBar {
              from { width: 100%; }
              to { width: 0%; }
            }
            .animate-toast-progress {
              animation: toastProgressBar 4.5s linear forwards;
            }
          `}</style>
          {toasts.map((toast) => {
            const { bgClass, barClass, icon } = getToastDetails(toast.type);
            return (
              <div
                key={toast.id}
                className={`animate-toast-in pointer-events-auto border-l-4 ${bgClass} rounded-xl p-4 flex gap-3 items-start justify-between relative overflow-hidden backdrop-blur-md transition-all select-none`}
              >
                <div className="flex gap-3 items-start">
                  {icon}
                  <div className="text-left">
                    <p className="text-xs font-black tracking-wide leading-relaxed">
                      {toast.message}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-gray-400 hover:text-gray-700 transition-colors text-xs font-bold leading-none p-1 rounded-lg cursor-pointer"
                  aria-label="Close notification"
                >
                  ✕
                </button>
                {/* Visual shrinking time-progress tracker */}
                <div 
                  className={`absolute bottom-0 left-0 h-1 ${barClass} animate-toast-progress`} 
                  style={{ animationDuration: `${toast.duration || 4500}ms` }}
                />
              </div>
            );
          })}
        </div>,
        document.body
      )}
      {confirmState && createPortal(
        <div className="fixed inset-0 z-[99999999] bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none animate-fade-in">
          <style>{`
            @keyframes scaleInModal {
              from { transform: scale(0.95); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
            .animate-modal-in {
              animation: scaleInModal 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            .animate-fade-in {
              animation: fadeIn 0.2s ease-out forwards;
            }
          `}</style>
          <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-left animate-modal-in">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-2">
              ⚠️ Confirmation
            </h3>
            <p className="text-xs font-semibold text-gray-500 leading-relaxed mb-6">
              {confirmState.message}
            </p>
            <div className="flex justify-end gap-2.5 text-[10px] uppercase font-black tracking-wider">
              <button
                onClick={() => handleConfirmResponse(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmResponse(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer transition-colors shadow-2xs"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};
