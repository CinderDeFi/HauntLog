import { ButtonHTMLAttributes } from 'react';

type Variant = 'default' | 'outline' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-haunt-red text-white hover:bg-haunt-red/90',
  outline: 'border border-white/10 bg-transparent text-haunt-ghost hover:bg-white/5',
  ghost: 'bg-transparent text-haunt-ghost hover:bg-white/5',
};

export function Button({ className = '', variant = 'default', ...props }: ButtonProps) {
  return (
    <button
      className={`px-6 py-3 rounded-xl font-medium transition-all active:scale-95 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
