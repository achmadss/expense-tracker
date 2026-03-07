import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ProcessingProvider } from "@/context/ProcessingContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expense Tracker",
  description: "Track and manage expenses submitted via Discord",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ProcessingProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 bg-[#1e1e1e] p-8 overflow-auto">
              {children}
            </main>
          </div>
        </ProcessingProvider>
      </body>
    </html>
  );
}
