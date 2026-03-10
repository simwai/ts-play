import { CSSProperties, ReactNode, useState } from 'react';
import { cn } from '../../utils/cn';

interface IconButtonProps {
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  disabled?: boolean;
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
  children,
  variant = 'surface',
  size = 'md',
  style,
  className,
}: IconButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

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
        {
          'bg-transparent hover:bg-surface0 text-text border-none': variant === 'ghost',
          'bg-red/15 hover:bg-red/28 text-red border border-red/44 hover:border-red/60': variant === 'danger',
          'bg-surface0 hover:bg-surface1 text-text border border-surface1': variant === 'surface',
        },
        className
      )}
      style={style}
    >
      {children}
    </button>
  );
}
