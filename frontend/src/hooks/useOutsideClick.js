import { useEffect } from 'react';

export const useOutsideClick = (refOrRefs, callback) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      const refs = Array.isArray(refOrRefs) ? refOrRefs : [refOrRefs];
      const clickedInside = refs.some(ref => {
        return ref && ref.current && ref.current.contains(event.target);
      });
      if (!clickedInside) {
        callback(event);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [refOrRefs, callback]);
};

export default useOutsideClick;
