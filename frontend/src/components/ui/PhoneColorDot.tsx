import React from 'react';
import { getPhoneColor } from '../../utils/phoneColors';

interface PhoneColorDotProps {
  color?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3.5 h-3.5',
  lg: 'w-5 h-5',
};

export const PhoneColorDot: React.FC<PhoneColorDotProps> = ({
  color,
  size = 'sm',
  showLabel = false,
  className = '',
}) => {
  if (!color || !color.trim()) return null;

  const colorInfo = getPhoneColor(color);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        title={color}
        className={`inline-block rounded-full shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.35)] ring-1 ring-white/20 transition-transform ${sizeClasses[size]}`}
        style={{
          backgroundColor: colorInfo.hex,
          backgroundImage: colorInfo.gradient,
          border: colorInfo.border ? `1px solid ${colorInfo.border}` : undefined,
        }}
      />
      {showLabel && <span>{color}</span>}
    </span>
  );
};

export default PhoneColorDot;
