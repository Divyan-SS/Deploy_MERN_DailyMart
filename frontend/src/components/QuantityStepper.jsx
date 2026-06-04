import React from 'react';

export const QuantityStepper = ({
  qty,
  onIncrement,
  onDecrement,
  isIncrementDisabled = false,
  variant = 'emerald',
  onInputChange,
  onInputBlur,
  className = '',
  btnClassName = '',
  valClassName = '',
}) => {
  if (variant === 'gray-input') {
    return (
      <div className={`flex items-center gap-0.5 flex-shrink-0 ${className}`}>
        <button
          type="button"
          onClick={onDecrement}
          className={`w-5 h-5 rounded border border-gray-300 bg-gray-150 text-[10px] font-black flex items-center justify-center cursor-pointer hover:bg-gray-200 active:scale-95 select-none ${btnClassName}`}
        >
          -
        </button>
        <input
          type="text"
          value={qty}
          onChange={(e) => onInputChange && onInputChange(e.target.value)}
          onBlur={onInputBlur}
          className={`w-7 h-5 border border-gray-300 rounded text-center text-[9px] font-bold ${valClassName}`}
        />
        <button
          type="button"
          onClick={onIncrement}
          disabled={isIncrementDisabled}
          className={`w-5 h-5 rounded border border-gray-300 bg-gray-150 text-[10px] font-black flex items-center justify-center cursor-pointer hover:bg-gray-200 active:scale-95 disabled:opacity-35 ${btnClassName}`}
        >
          +
        </button>
      </div>
    );
  }

  // Default 'emerald' variant
  return (
    <div className={`flex items-center border border-emerald-600 rounded bg-white overflow-hidden ${className || 'h-5 w-12 xs:w-14'}`}>
      <button
        type="button"
        onClick={onDecrement}
        className={`bg-emerald-600 hover:bg-emerald-700 text-white h-full flex items-center justify-center font-black cursor-pointer select-none ${btnClassName || 'w-4 text-[9px] xs:text-[10px]'}`}
      >
        -
      </button>
      <span className={`flex-grow font-black text-center text-gray-800 leading-none ${valClassName || 'text-[9px] xs:text-[10px]'}`}>
        {qty}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={isIncrementDisabled}
        className={`bg-emerald-600 hover:bg-emerald-700 text-white h-full flex items-center justify-center font-black cursor-pointer select-none disabled:bg-gray-200 disabled:text-gray-400 ${btnClassName || 'w-4 text-[9px] xs:text-[10px]'}`}
      >
        +
      </button>
    </div>
  );
};

export default QuantityStepper;
