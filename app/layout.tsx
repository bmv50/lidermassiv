import type { Metadata } from "next";
import "./storefront.css";
import "./product-details.css";
import "./showcase.css";
import "./home-collection.css";
import "./atelier.css";

const title = "Лидер Массив — мебель из массива дуба";
const description = "Мебель из массива дуба. Каталог, индивидуальное изготовление и доставка по России.";
const siteOrigin = "https://demo.lider-massiv.ru";
const isDemo = import.meta.env.VITE_DEMO_MODE === "true";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title,
  description,
  robots: isDemo ? { index: false, follow: false } : undefined,
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Лидер Массив",
    url: siteOrigin,
    title,
    description,
    images: [{
      url: "/images/social-preview.jpg",
      width: 1200,
      height: 630,
      alt: "Лидер Массив — мебель из массива дуба",
    }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/images/social-preview.jpg"] },
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
