import { useEffect, useMemo, useState } from 'react';

type VKState = {
  keyboardOpen: boolean;
  keyboardHeight: number;
  isMobileLike: boolean;
};

function activeTextTarget() {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return true;
  return !!el.closest('[contenteditable="true"]');
}

export function useVirtualKeyboard(): VKState {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [baselineHeight, setBaselineHeight] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    const handleOrientation = () => {
      setKeyboardHeight(0);
      setBaselineHeight(vv?.height ?? window.innerHeight);
    };
    const handleFocusOut = () => {
      setKeyboardHeight(0);
      const viewportHeight = vv?.height ?? window.innerHeight;
      setBaselineHeight(viewportHeight);
    };
    const measure = () => {
      const viewportHeight = vv?.height ?? window.innerHeight;
      setBaselineHeight((prev) => {
        if (!prev) return viewportHeight;
        if (!activeTextTarget() && viewportHeight > prev) return viewportHeight;
        return prev;
      });

      const base = baselineHeight || viewportHeight;
      const delta = Math.max(0, Math.round(base - viewportHeight));
      const open = activeTextTarget() && delta > 120;
      setKeyboardHeight(open ? delta : 0);
    };

    measure();
    vv?.addEventListener('resize', measure);
    vv?.addEventListener('scroll', measure);
    window.addEventListener('focusin', measure);
    window.addEventListener('focusout', handleFocusOut);
    window.addEventListener('orientationchange', handleOrientation);

    return () => {
      vv?.removeEventListener('resize', measure);
      vv?.removeEventListener('scroll', measure);
      window.removeEventListener('focusin', measure);
      window.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('orientationchange', handleOrientation);
    };
  }, [baselineHeight]);

  const isMobileLike = useMemo(() => {
    return window.matchMedia?.('(max-width: 820px)').matches ?? window.innerWidth <= 820;
  }, []);

  return {
    keyboardOpen: keyboardHeight > 0,
    keyboardHeight,
    isMobileLike,
  };
}