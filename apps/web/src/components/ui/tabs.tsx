import * as React from "react";

const TabsContext = React.createContext<{
  value: string;
  onChange: (value: string) => void;
} | null>(null);

export function Tabs({
  value,
  onValueChange,
  children,
  className = "",
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TabsContext.Provider value={{ value, onChange: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-xl bg-[#1a1a24] p-1 ${className}`}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className = "",
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger outside Tabs");
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.onChange(value)}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-indigo-600 text-white shadow"
          : "text-indigo-200/70 hover:text-indigo-100"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className = "",
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent outside Tabs");
  if (ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
}
