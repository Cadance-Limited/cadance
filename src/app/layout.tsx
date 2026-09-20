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

export const metadata: Metadata = {
  title: "Cadence — The AI operations analyst",
  description:
    "Cadence diagnoses your operations from invoices, contracts, and SOPs, then prescribes the workflow fixes that matter. Built for business teams.",
  keywords: [
    "AI operations",
    "workflow automation",
    "invoice analysis",
    "contract review",
    "business diagnostics",
    "AI analyst",
    "Cadence",
  ],
  authors: [{ name: "Cadence" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Cadence — The AI operations analyst",
    description:
      "Diagnose your operations. Prescribe what's next. The AI analyst for invoices, contracts, and SOPs.",
    url: "https://cadence.ai",
    siteName: "Cadence",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cadence — The AI operations analyst",
    description:
      "Diagnose your operations. Prescribe what's next. The AI analyst for invoices, contracts, and SOPs.",
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
