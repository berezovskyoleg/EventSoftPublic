import * as React from "react";

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Select({ value, onValueChange, children, className = "" }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={`flex h-10 w-full rounded-lg border border-indigo-700/50 bg-[#0f0f13] px-3 py-2 text-sm text-indigo-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 ${className}`}
    >
      {children}
    </select>
  );
}

export function SelectItem({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return <option value={value}>{children}</option>;
}
