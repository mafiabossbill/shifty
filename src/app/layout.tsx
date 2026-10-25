import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";

import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { APP_CONFIG } from "@/lib/app-config";
import { DEFAULT_ACCENT, THEME_COLORS, THEME_INIT_SCRIPT } from "@/lib/theme";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
/** Display face: headings, big numbers and the live timer (with `tabular`). */
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: APP_CONFIG.name, template: `%s · ${APP_CONFIG.name}` },
  description: APP_CONFIG.description,
  applicationName: APP_CONFIG.name,
  // iOS reads these instead of the manifest. "default" keeps the status bar out of the page in both themes.
  appleWebApp: { capable: true, title: APP_CONFIG.shortName, statusBarStyle: "default" },
  // Android/Chrome's equivalent of apple-mobile-web-app-capable.
  other: { "mobile-web-app-capable": "yes" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // The theme script swaps these for the chosen theme's color before first paint.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  // Installed app draws edge to edge; safe-area padding keeps content clear of the notch.
  viewportFit: "cover",
  // Android: the on-screen keyboard shrinks the layout, so sheets and dialogs stay above it.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={APP_CONFIG.locale}
      data-accent={DEFAULT_ACCENT}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="h-full">
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
