import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useHighlight() {
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get('highlight');

  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(highlight);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('buddy-highlight');
        setTimeout(() => el.classList.remove('buddy-highlight'), 4000);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [highlight]);
}
