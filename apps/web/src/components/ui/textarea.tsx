import * as React from "react";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className = "", ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={`flex min-h-[80px] w-full rounded-lg border border-indigo-700/50 bg-[#0f0f13] px-3 py-2 text-sm text-indigo-100 placeholder:text-indigo-700/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 ${className}`}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
