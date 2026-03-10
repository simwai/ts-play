import { CSSProperties, forwardRef, useState } from 'react';
import { CatppuccinTheme } from '../../lib/theme';
import { cn } from '../../utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  theme: CatppuccinTheme;
  style?: CSSProperties;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ theme: t, style, className, onFocus, onBlur, ...rest }, ref) => {
    const [focused, setFocused] = useState(false);

    return (
      <input
        ref={ref}
        onFocus={e => { setFocused(true); onFocus?.(e); }}
        onBlur={e => { setFocused(false); onBlur?.(e); }}
        className={cn(
          "w-full px-[10px] py-[8px] text-[13px] font-inherit rounded-[5px] outline-none box-border transition-colors duration-140",
          className
        )}
        style={{
          background: t.base,
          border: `1px solid ${focused ? t.lavender : t.surface1}`,
          color: t.text,
          ...style,
        }}
        {...rest}
      />
    );
  }
);

Input.displayName = 'Input';
