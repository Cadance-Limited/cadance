import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/site/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cadence.ai";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Cadence — The AI operations analyst",
    template: "%s · Cadence",
  },
  description:
    "Cadence diagnoses operational workflows from invoices, contracts, and SOPs, then prescribes the next moves with explicit evidence and assumptions.",
  keywords: [
    "AI operations",
    "workflow diagnostics",
    "invoice analysis",
    "contract review",
    "3-way match",
    "operations analyst",
    "Cadence",
  ],
  authors: [{ name: "Cadence Labs" }],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
  },
  openGraph: {
    title: "Cadence — The AI operations analyst",
    description:
      "Diagnose your operations. Prescribe what's next. Interactive diagnostic chat and document intelligence for invoices, contracts, and SOPs.",
    url: appUrl,
    siteName: "Cadence",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cadence — The AI operations analyst",
    description:
      "Diagnose your operations. Prescribe what's next. Interactive diagnostic chat and document intelligence for invoices, contracts, and SOPs.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
