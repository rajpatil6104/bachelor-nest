import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BachelorNest — PG, Hostel & Room Finder for Bachelors",
    template: "%s · BachelorNest",
  },
  description:
    "Find bachelor-friendly PGs, hostels, rooms and flats in India with live vacancy availability. Zero brokerage, direct from owners.",
  openGraph: {
    title: "BachelorNest — PG, Hostel & Room Finder for Bachelors",
    description:
      "Bachelor-friendly PGs, hostels, rooms and flats in India with live vacancy availability. Zero brokerage, direct from owners.",
    siteName: "BachelorNest",
    type: "website",
  },
};

// Sets the theme class before first paint to avoid a light/dark flash
const themeScript = `try{var t=localStorage.getItem('bn-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-navy-950 dark:text-zinc-100">
        <ThemeProvider>
          <AuthProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
