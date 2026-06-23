import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "MusicBingo — музыкальное бинго",
  description:
    "Музыкальное бинго для вечеринок и мероприятий. Ведущий запускает треки, игроки отмечают их на карточках по телефону.",
  keywords: ["music bingo", "музыкальное бинго", "игра", "вечеринка", "мероприятие", "лицензия"],
  authors: [{ name: "MusicBingo" }],
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
