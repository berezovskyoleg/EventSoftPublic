import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Тост Слот — выбор тостующегося",
  description:
    "Слот-машина (однорукий Джек) для случайного выбора гостя, который произнесёт тост. Локальное приложение с лицензионными ключами, привязанными к устройству.",
  keywords: ["тост", "слот", "слот-машина", "игра", "свадьба", "торжество", "лицензия"],
  authors: [{ name: "Toast Slot" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
