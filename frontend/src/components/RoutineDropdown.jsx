// frontend/src/components/RoutineDropdown.jsx
import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';

const RoutineDropdown = () => {
  const { userInfo } = useContext(AuthContext);
  const { routinesList, cartItems } = useContext(CartContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const filteredRoutines = routinesList.filter((routineName) =>
    routineName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenRoutineCart = (routineName) => {
    setIsOpen(false);
    navigate(`/routine/${encodeURIComponent(routineName)}`);
  };

  return (
    <div className="relative w-full z-40 my-2 font-sans text-gray-700">
      <style>{`
        @keyframes dropdownFade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-dropdown {
          animation: dropdownFade 0.2s ease-out forwards;
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .pulse-dot {
          animation: pulseDot 1.2s infinite;
        }
      `}</style>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 px-4 py-2.5 rounded-lg font-semibold flex justify-between items-center transition-all uppercase tracking-wider text-xs shadow-sm active:scale-[0.99]"
      >
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-600 rounded-full pulse-dot"></span>
          My Custom Routines
        </span>
        <span className="text-emerald-600 text-[10px] font-bold">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 max-h-96 flex flex-col z-50 animate-dropdown">
          <input
            type="text"
            placeholder="Search custom routine folders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-gray-300 p-2 rounded-lg text-xs font-medium mb-3 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-gray-50 text-gray-800"
          />

          {!userInfo ? (
            <div className="text-center py-6 border border-dashed border-amber-300 rounded-xl bg-amber-50/50 p-4">
              <p className="text-amber-900 font-bold text-xs uppercase tracking-wide">Authentication Required</p>
              <p className="text-amber-700 text-[11px] mt-1 font-medium">Please sign in to view and construct personalized shopping routines.</p>
            </div>
          ) : filteredRoutines.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-gray-300 rounded-xl bg-gray-50 p-4">
              <p className="text-gray-900 font-semibold text-xs uppercase tracking-wide">No active routines found</p>
              <p className="text-gray-500 text-[11px] mt-1">Click "+ Add Routine" on any item card to organize your lists.</p>
            </div>
          ) : (
            <div className="overflow-y-auto space-y-1.5 pr-1 max-h-64 custom-scrollbar">
              {filteredRoutines.map((routineName) => {
                const totalRoutineItemsCount = cartItems
                  .filter((item) => item.routineName === routineName)
                  .reduce((acc, item) => acc + item.qty, 0);

                return (
                  <div
                    key={routineName}
                    className="flex justify-between items-center gap-3 py-2.5 px-2 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-50 last:border-0"
                  >
                    <div className="text-left">
                      <h4 className="font-semibold text-gray-900 text-xs flex items-center gap-2">📁 {routineName}</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5 font-medium">
                        {totalRoutineItemsCount} independent item{totalRoutineItemsCount !== 1 ? 's' : ''} packed
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenRoutineCart(routineName)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-md transition-all shadow-sm active:scale-95"
                    >
                      Open List View
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RoutineDropdown;