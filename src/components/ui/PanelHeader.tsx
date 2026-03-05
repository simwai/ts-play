import { ReactNode, useState } from 'react';
import { CatppuccinTheme } from '../../lib/theme';

interface PanelHeaderProps {
  label:    string;
  isOpen:   boolean;
  onToggle: () => void;
  theme:    CatppuccinTheme;
  left?:    ReactNode; // extra content after the label (e.g. badges)
  right?:   ReactNode; // extra content on the right side — clicks here won't toggle
}

export function PanelHeader({ label, isOpen, onToggle, theme: t, left, right }: PanelHeaderProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="button"
      aria-expanded={isOpen}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '6px 12px',
        cursor:         'pointer',
        userSelect:     'none',
        background:     hovered ? t.surface0 : t.mantle,
        minHeight:      32,
        transition:     'background 120ms',
      }}
    >
      {/* Left: label + extra badges — clicks here toggle the panel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          fontFamily:    'monospace',
          fontSize:      11,
          fontWeight:    700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color:         t.subtext0,
        }}>
          {label}
        </span>
        {left}
      </div>

      {/* Right: action buttons + chevron.
          Stop propagation on the actions wrapper so only the chevron / label toggles. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {right && (
          <div
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {right}
          </div>
        )}
        <span style={{
          fontSize:   12,
          color:      t.overlay1,
          transform:  isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 200ms',
          display:    'inline-block',
          lineHeight: 1,
          pointerEvents: 'none',
        }}>▾</span>
      </div>
    </div>
  );
}
