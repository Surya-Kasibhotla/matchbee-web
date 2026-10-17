import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SITE } from '@/lib/site';
import { fill, SITE_URL } from '@/lib/text';
import { AppProvider } from '@/components/app/AppProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: fill(SITE.pages.home.title),
  description: fill(SITE.pages.home.description),
  applicationName: SITE.brand.name,
  manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/logo.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/apple-touch-icon.png' },
  openGraph: { type: 'website', siteName: SITE.brand.name, locale: 'en_US', images: [{ url: '/og-image.png', width: 1200, height: 630, alt: SITE.brand.name + ': ' + SITE.brand.tagline }] },
  twitter: { card: 'summary_large_image', images: ['/og-image.png'] },
  robots: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
};
export const viewport: Viewport = { themeColor: '#0b996e', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* applies the saved light/dark choice before the page paints */}
        <script src="/theme.js" />
      </head>
      <body>
        <AppProvider>
          <Header />
          {children}
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}
