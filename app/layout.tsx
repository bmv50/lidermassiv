import type { Metadata } from "next";
import "./storefront.css";

export const metadata: Metadata = {
  title: "Лидер Массив — мебель из массива дуба",
  description: "Мебель из массива дуба. Каталог, индивидуальное изготовление и доставка по России.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
