import React, { useRef } from 'react';
import ProductCard from './ProductCard';

export const CategoryCarousel = ({ categoryProducts, onOpenRoutineModal, activeRoutineProduct }) => {
  const scrollRef = useRef(null);
  
  const handleScroll = (direction) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      scrollRef.current.scrollTo({ left: scrollLeft + scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative group/carousel w-full">
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto scroll-smooth snap-x snap-mandatory gap-3 pb-3 scrollbar-none px-4 -mx-4 sm:mx-0 sm:px-0"
      >
        {categoryProducts.map((product) => (
          <div
            key={product._id}
            className={`flex-shrink-0 w-[155px] xs:w-[175px] sm:w-[195px] md:w-[210px] lg:w-[220px] snap-start transition-transform duration-200 ${
              activeRoutineProduct ? 'pointer-events-none animate-none transform-none' : ''
            }`}
          >
            <ProductCard
              product={product}
              onOpenRoutineModal={onOpenRoutineModal}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => handleScroll('left')}
        className="absolute left-2 top-[35%] -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 border border-gray-200 w-8 h-8 rounded-full flex items-center justify-center shadow-md cursor-pointer z-20 transition-all opacity-0 group-hover/carousel:opacity-100 hidden lg:flex items-center justify-center hover:scale-105 active:scale-95 outline-none select-none"
        aria-label="Scroll Left"
      >
        <span className="text-xs font-black">◀</span>
      </button>

      <button
        type="button"
        onClick={() => handleScroll('right')}
        className="absolute right-2 top-[35%] -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 border border-gray-200 w-8 h-8 rounded-full flex items-center justify-center shadow-md cursor-pointer z-20 transition-all opacity-0 group-hover/carousel:opacity-100 hidden lg:flex items-center justify-center hover:scale-105 active:scale-95 outline-none select-none"
        aria-label="Scroll Right"
      >
        <span className="text-xs font-black">▶</span>
      </button>
    </div>
  );
};

export default CategoryCarousel;
