import { CSSProperties, ReactNode, useState } from 'react';
import { CatppuccinTheme } from '../../lib/theme';
import { cn } from '../../utils/cn';

interface IconButtonProps {
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  disabled?: boolean;
  theme: CatppuccinTheme;
  children: ReactNode;
  variant?: 'ghost' | 'surface' | 'danger';
  size?: 'sm' | 'md';
  style?: CSSProperties;
  className?: string;
}

export function IconButton({
  onClick,
  title,
  disabled = false,
  theme: t,
  children,
  variant = 'surface',
  size = 'md',
  style,
  className,
}: IconButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const bg =
    variant === 'ghost'
      ? hovered ? t.surface0 : 'transparent'
      : variant === 'danger'
      ? hovered ? `${t.red}28` : `${t.red}15`
      : hovered ? t.surface1 : t.surface0;

  const border =
    variant === 'ghost'  ? 'none' :
    variant === 'danger' ? `1px solid ${t.red}${hovered ? '60' : '44'}` :
    `1px solid ${t.surface1}`;

  const col =
    variant === 'danger' ? t.red :
    disabled             ? t.overlay0 :
    t.text;

  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className={cn(
        "rounded-[5px] text-[13px] leading-none flex items-center justify-center shrink-0 transition-all duration-120",
        size === 'sm' ? "px-[6px] py-[3px]" : "px-[9px] py-[5px]",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer opacity-100",
        pressed && !disabled ? "scale-[0.93]" : "scale-100",
        className
      )}
      style={{
        background: bg,
        border,
        color: col,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
