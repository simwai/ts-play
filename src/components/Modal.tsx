import { CatppuccinTheme } from '../lib/theme';

interface Props {
  theme: CatppuccinTheme;
  onConfirm: () => void;
  onCancel: () => void;
}

export function OverrideModal({ theme: t, onConfirm, onCancel }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 8000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `${t.crust}bb`,
      backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        background: t.mantle,
        border: `1px solid ${t.surface1}`,
        borderRadius: 10,
        width: 'min(92vw, 360px)',
        overflow: 'hidden',
        boxShadow: `0 16px 48px ${t.crust}`,
      }}>
        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: `${t.peach}22`,
            border: `1px solid ${t.peach}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            ⚠️
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text }}>
              Override JS Code?
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: t.subtext0, lineHeight: 1.5 }}>
              The JavaScript editor has been manually edited. Running TypeScript will overwrite those changes.
            </p>
          </div>
        </div>
        <div style={{
          display: 'flex', gap: 8, padding: 16, justifyContent: 'flex-end',
          borderTop: `1px solid ${t.surface0}`,
          marginTop: 16,
        }}>
          <button
            onClick={onCancel}
            style={{
              background: t.surface0,
              border: `1px solid ${t.surface1}`,
              borderRadius: 6,
              padding: '7px 16px',
              fontSize: 13,
              color: t.text,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: t.peach,
              border: 'none',
              borderRadius: 6,
              padding: '7px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: t.crust,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Override
          </button>
        </div>
      </div>
    </div>
  );
}
