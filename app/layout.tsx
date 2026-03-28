import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nova Ecosystem",
  description: "Your intelligent, unified workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <style dangerouslySetInnerHTML={{__html: `
          @font-face {
              font-family: 'Google Sans';
              src: local('Google Sans'), url('https://fonts.gstatic.com/s/productsans/v18/pxPCypQkep0-WKPGWqqiG6k-J-zN_1e3Zg.woff2') format('woff2');
              font-weight: 400;
          }
          @font-face {
              font-family: 'Google Sans';
              src: local('Google Sans Medium'), url('https://fonts.gstatic.com/s/productsans/v18/pxPCypQkep0-WKPGWqqiG6k-J-zE_1e3Zg.woff2') format('woff2');
              font-weight: 500;
          }
          @font-face {
              font-family: 'Google Sans Bold';
              src: local('Google Sans Bold'), url('https://fonts.gstatic.com/s/productsans/v18/pxPCypQkep0-WKPGWqqiG6k-J-zC_1e3Zg.woff2') format('woff2');
              font-weight: 700;
          }
          body { font-family: 'Google Sans', sans-serif !important; }
        `}} />
      </head>
      {/* FIX: bg-white dark:bg-zinc-950 matching the black theme.
        overflow-hidden ensures no global scrollbars, delegating scrolling to child components.
      */}
      <body className="min-h-[100dvh] flex flex-col m-0 p-0 overflow-hidden bg-white dark:bg-zinc-950">
        
        {/* GLOBAL NAVBAR */}
        <Navbar />
        
        {/* PAGE CONTENT 
            FIX: Added min-h-0. Crucial for nested flexbox scrolling.
        */}
        <main className="flex-1 flex flex-col relative overflow-hidden min-h-0">
          {children}
        </main>
      </body>
    </html>
  );
}