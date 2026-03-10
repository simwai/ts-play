import { ReactNode, useState } from 'react';
import { CatppuccinTheme } from '../../lib/theme';
import { cn } from '../../utils/cn';

interface PanelHeaderProps {
  label:    string;
  isOpen:   boolean;
  onToggle: () => void;
  theme:    CatppuccinTheme;
  left?:    ReactNode; // extra content after the label (e.g. badges)
  right?:   ReactNode; // extra content on the right side — clicks here won't toggle
  className?: string;
}

export function PanelHeader({ label, isOpen, onToggle, theme: t, left, right, className }: PanelHeaderProps) {
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
      className={cn(
        "flex items-center justify-between px-[12px] py-[6px] cursor-pointer select-none min-h-[32px] transition-colors duration-120",
        className
      )}
      style={{
        background: hovered ? t.surface0 : t.mantle,
      }}
    >
      {/* Left: label + extra badges — clicks here toggle the panel */}
      <div className="flex items-center gap-[7px]">
        <span 
          className="font-mono text-[11px] font-bold tracking-[0.06em] uppercase"
          style={{ color: t.subtext0 }}
        >
          {label}
        </span>
        {left}
      </div>

      {/* Right: action buttons + chevron.
          Stop propagation on the actions wrapper so only the chevron / label toggles. */}
      <div className="flex items-center gap-[8px]">
        {right && (
          <div
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-[6px]"
          >
            {right}
          </div>
        )}
        <span 
          className={cn(
            "text-[12px] inline-block leading-none pointer-events-none transition-transform duration-200",
            isOpen ? "rotate-180" : "rotate-0"
          )}
          style={{ color: t.overlay1 }}
        >
          ▾
        </span>
      </div>
    </div>
  );
}
