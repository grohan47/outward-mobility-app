import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRISM — Workflow Platform",
  description:
    "PRISM is an app to manage approval flows across any department and any organization.",
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
