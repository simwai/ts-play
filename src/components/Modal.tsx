import { useEffect } from 'react';
import { CatppuccinTheme } from '../lib/theme';
import { Button } from './ui/Button';

interface Props {
  theme:     CatppuccinTheme;
  onConfirm: () => void;
  onCancel:  () => void;
}

export function OverrideModal({ theme: t, onConfirm, onCancel }: Props) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter')  onConfirm();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, onConfirm]);

  return (
    <div
      onClick={onCancel}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         8000,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     `${t.crust}bb`,
        backdropFilter: 'blur(6px)',
      }}
    >
      {/* Card — stop propagation so clicking inside doesn't close */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:   t.mantle,
          border:       `1px solid ${t.surface1}`,
          borderRadius: 10,
          width:        'min(92vw, 380px)',
          overflow:     'hidden',
          boxShadow:    `0 20px 60px ${t.crust}cc`,
        }}
      >
        {/* Header */}
        <div style={{
          padding:    '20px 20px 16px',
          display:    'flex',
          alignItems: 'flex-start',
          gap:        12,
        }}>
          {/* Icon */}
          <div style={{
            width:          36,
            height:         36,
            borderRadius:   8,
            flexShrink:     0,
            background:     `${t.peach}20`,
            border:         `1px solid ${t.peach}44`,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       18,
          }}>
            ⚠️
          </div>

          {/* Text */}
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text }}>
              Override JS Code?
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: t.subtext0, lineHeight: 1.6 }}>
              The JavaScript editor has been manually edited.
              Running TypeScript will overwrite those changes.
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: t.overlay0, fontFamily: 'monospace' }}>
              Press <strong style={{ color: t.text }}>Enter</strong> to confirm,{' '}
              <strong style={{ color: t.text }}>Escape</strong> to cancel.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display:        'flex',
          gap:            8,
          padding:        '12px 16px',
          justifyContent: 'flex-end',
          borderTop:      `1px solid ${t.surface0}`,
        }}>
          <Button onClick={onCancel}  variant="secondary" theme={t}>Cancel</Button>
          <Button onClick={onConfirm} variant="primary"   theme={t}
            style={{ background: t.peach, color: t.crust }}
          >
            Override
          </Button>
        </div>
      </div>
    </div>
  );
}
