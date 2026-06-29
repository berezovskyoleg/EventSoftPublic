import * as React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "default", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50";
    const variants = {
      default: "bg-indigo-600 text-white hover:bg-indigo-500",
      outline:
        "border border-indigo-700/50 bg-transparent text-indigo-100 hover:bg-indigo-900/30",
      ghost: "text-indigo-100 hover:bg-indigo-900/30",
      secondary: "bg-[#1a1a24] text-indigo-100 hover:bg-[#252532]",
    };
    const sizes = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-8 px-3 text-xs",
      icon: "h-10 w-10",
    };
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
