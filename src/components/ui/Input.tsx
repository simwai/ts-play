import { CSSProperties, forwardRef, useState } from 'react';
import { CatppuccinTheme } from '../../lib/theme';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  theme: CatppuccinTheme;
  style?: CSSProperties;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ theme: t, style, onFocus, onBlur, ...rest }, ref) => {
    const [focused, setFocused] = useState(false);

    return (
      <input
        ref={ref}
        onFocus={e => { setFocused(true); onFocus?.(e); }}
        onBlur={e => { setFocused(false); onBlur?.(e); }}
        style={{
          width:        '100%',
          padding:      '8px 10px',
          fontSize:     13,
          fontFamily:   'inherit',
          background:   t.base,
          border:       `1px solid ${focused ? t.lavender : t.surface1}`,
          borderRadius: 5,
          color:        t.text,
          outline:      'none',
          boxSizing:    'border-box',
          transition:   'border-color 140ms',
          ...style,
        }}
        {...rest}
      />
    );
  }
);

Input.displayName = 'Input';
