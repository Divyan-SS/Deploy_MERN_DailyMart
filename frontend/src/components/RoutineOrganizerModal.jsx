import React, { useState } from 'react';
import { createPortal } from 'react-dom';

export const RoutineOrganizerModal = ({
  activeRoutineProduct,
  routinesList = [],
  onClose,
  onAddToExisting,
  onCreateNew,
}) => {
  const [newRoutineName, setNewRoutineName] = useState('');

  if (!activeRoutineProduct) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newRoutineName.trim()) {
      onCreateNew(newRoutineName.trim());
      setNewRoutineName('');
    }
  };

  const handleClose = () => {
    setNewRoutineName('');
    onClose();
  };

  return createPortal(
    <div
      onClick={handleClose}
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
      style={{ zIndex: 9999999 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xl space-y-4 text-center w-full max-w-[325px]"
      >
        <div className="pb-1">
          <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-tight text-center">
            Organize Into Routine Group
          </h3>
        </div>

        {/* EXISTING ROUTINES */}
        <div className="space-y-1.5">
          <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center">
            Select Existing Routine
          </label>

          {routinesList.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic bg-gray-50 rounded-lg p-2.5 text-center border border-dashed border-gray-200">
              No active routines built yet.
            </p>
          ) : (
            <div className="max-h-28 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white custom-scrollbar">
              {routinesList.map((routineName) => (
                <div
                  key={routineName}
                  className="p-2.5 flex justify-between items-center text-xs gap-2"
                >
                  <span className="font-semibold text-gray-800 flex items-center gap-1 min-w-0 flex-1 text-left">
                    <span className="truncate">📁 {routineName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onAddToExisting(routineName)}
                    className="text-emerald-500 font-bold hover:underline text-[11px] cursor-pointer flex-shrink-0"
                  >
                    Instantly Add →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CREATE NEW ROUTINE */}
        <form onSubmit={handleSubmit} className="space-y-1.5 pt-2 border-t border-gray-100">
          <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center">
            Or Create New Custom Routine
          </label>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              required
              placeholder="e.g., Office Snacks, Breakfast Grid"
              value={newRoutineName}
              onChange={(e) => setNewRoutineName(e.target.value)}
              className="h-9 min-w-0 flex-grow border border-gray-300 bg-white text-xs px-3 rounded outline-none focus:border-gray-400 text-gray-900 font-semibold text-center"
            />
            <button
              type="submit"
              className="h-9 bg-gray-900 text-white text-[10px] uppercase tracking-wider font-bold px-4 rounded cursor-pointer flex-shrink-0 flex items-center justify-center"
            >
              Create
            </button>
          </div>
        </form>

        {/* CLOSE TRIGGER FOOTER */}
        <div className="pt-2 border-t border-gray-100 flex justify-center">
          <button
            type="button"
            onClick={handleClose}
            className="text-[11px] text-gray-500 font-bold uppercase tracking-wider hover:text-gray-800 transition-colors cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RoutineOrganizerModal;
