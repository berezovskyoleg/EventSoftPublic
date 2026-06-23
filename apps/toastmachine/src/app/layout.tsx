import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "ToastMachine — выбор тостующегося",
  description:
    "Слот-машина (однорукий Джек) для случайного выбора гостя, который произнесёт тост. Локальное приложение с лицензионными ключами, привязанными к устройству.",
  keywords: ["тост", "слот", "слот-машина", "игра", "свадьба", "торжество", "лицензия"],
  authors: [{ name: "ToastMachine" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
