import { useEffect, useRef } from 'react';

// Lightweight substitute for React Navigation's useFocusEffect.
// Runs the callback every time the component mounts (or when deps change).
export function useFocusEffect(callback: () => void | (() => void)) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    return savedCallback.current();
  }, []);
}
