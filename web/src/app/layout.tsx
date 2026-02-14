import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Agent Space — Mission Control for Your AI Agents",
  description:
    "Observe, debug, and manage every AI agent across your tools. Real-time dashboards, traces, and alerts — all in one place.",
  openGraph: {
    title: "Agent Space — Mission Control for Your AI Agents",
    description:
      "Observe, debug, and manage every AI agent across your tools. Real-time dashboards, traces, and alerts.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${jetbrainsMono.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
