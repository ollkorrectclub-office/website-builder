import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-soft hover:-translate-y-0.5 hover:shadow-panel",
  secondary:
    "border border-border bg-card/80 text-card-foreground hover:-translate-y-0.5 hover:border-primary/40",
  ghost: "bg-transparent text-foreground hover:bg-secondary/70",
};

export function buttonStyles(variant: ButtonVariant = "primary") {
  return cn(
    "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition duration-200",
    variantStyles[variant],
  );
}

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        buttonStyles(variant),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
