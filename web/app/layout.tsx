import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StarkVote Admin",
  description: "Admin dashboard for StarkVote poll lifecycle management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
