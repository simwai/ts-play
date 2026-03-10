import { CSSProperties, ReactNode, useState } from 'react';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  variant?: Variant;
  title?: string;
  style?: CSSProperties;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export function Button({
  onClick,
  disabled = false,
  children,
  variant = 'secondary',
  title,
  style,
  type = 'button',
  className,
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className={cn(
        "px-[14px] py-[7px] text-[13px] font-inherit rounded-[5px] flex items-center gap-[5px] transition-all duration-120 whitespace-nowrap",
        variant === 'primary' ? "font-bold" : "font-medium",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer opacity-100",
        pressed && !disabled ? "scale-[0.97]" : "scale-100",
        {
          'bg-green text-crust hover:bg-teal border-none': variant === 'primary',
          'bg-surface0 text-text hover:bg-surface1 border border-surface1': variant === 'secondary',
          'bg-red/15 text-red hover:bg-red/25 border border-red/40 hover:border-red/60': variant === 'danger',
          'bg-transparent text-text hover:bg-surface0 border-none': variant === 'ghost',
        },
        className
      )}
      style={style}
    >
      {children}
    </button>
  );
}
