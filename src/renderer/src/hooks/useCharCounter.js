import { useMemo } from 'react';

export default function useCharCounter(text, max) {
  return useMemo(() => {
    const count = (text || '').length;
    return {
      count,
      remaining: Math.max(0, max - count),
      isOver: count > max,
      ratio: Math.min(count / max, 1)
    };
  }, [text, max]);
}
