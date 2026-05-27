import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  children: ReactNode;
}

export function Button({ variant = "primary", children, className = "", ...rest }: ButtonProps) {
  const base = "min-w-[152px] px-6 py-4 rounded-[4px] text-[16px] text-center shadow-sm border-2 transition-colors";
  const styles =
    variant === "primary"
      ? "bg-[#005299] text-white border-transparent hover:bg-[#003d73]"
      : "bg-[#ecf7fe] text-[#0065bd] border-[#0065bd] hover:bg-[#d9edfc]";
  return (
    <button className={`${base} ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}
