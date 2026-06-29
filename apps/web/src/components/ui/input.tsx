import * as React from "react";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={`flex h-10 w-full rounded-lg border border-indigo-700/50 bg-[#0f0f13] px-3 py-2 text-sm text-indigo-100 placeholder:text-indigo-700/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 ${className}`}
      {...props}
    />
  );
});
Input.displayName = "Input";
