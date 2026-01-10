import { useEffect } from 'react';

/**
 * useClickOutside
 * Listens for mousedown/touchstart outside the given ref and for Escape key presses.
 * Calls `onClose` when an outside click or Escape is detected.
 */
export default function useClickOutside(ref, onClose) {
  useEffect(() => {
    if (!ref || !onClose) return undefined;

    function handlePointer(e) {
      if (!ref.current) return;

      // Click inside this modal => ignore
      if (ref.current.contains(e.target)) return;

      // Click inside any other modal root (e.g. a nested child modal overlay/content)
      // => ignore so that only the top-most modal reacts to outside clicks
      if (e.target && e.target.closest && e.target.closest('[data-modal-root]')) return;

      // click is outside all modals => close
      onClose(e);
    }

    function handleKey(e) {
      if (e.key === 'Escape' || e.key === 'Esc') onClose(e);
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ref, onClose]);
}
