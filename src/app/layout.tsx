import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRISM — Plaksha Review Interface for Student Mobility",
  description:
    "A configurable approvals workflow platform for managing student mobility applications end-to-end.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-background-light text-slate-900 font-display antialiased">
        {children}
      </body>
    </html>
  );
}
