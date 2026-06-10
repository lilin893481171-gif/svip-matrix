import { useState, useEffect } from 'react';

export default function usePersistentState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      return window.localStorage.getItem(key) !== null
        ? JSON.parse(window.localStorage.getItem(key))
        : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
