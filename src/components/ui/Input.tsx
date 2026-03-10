import { CSSProperties, forwardRef, useState } from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  style?: CSSProperties;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ style, className, onFocus, onBlur, ...rest }, ref) => {
    const [focused, setFocused] = useState(false);

    return (
      <input
        ref={ref}
        onFocus={e => { setFocused(true); onFocus?.(e); }}
        onBlur={e => { setFocused(false); onBlur?.(e); }}
        className={cn(
          "w-full px-[10px] py-[8px] text-[13px] font-inherit rounded-[5px] outline-none box-border transition-colors duration-140 bg-base text-text border",
          focused ? "border-lavender" : "border-surface1",
          className
        )}
        style={style}
        {...rest}
      />
    );
  }
);

Input.displayName = 'Input';
