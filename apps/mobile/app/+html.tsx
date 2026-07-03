import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Custom HTML shell for the Expo web static export.
 * Loads Ionicons from the ionicons.web-component CDN so icons
 * render correctly on the deployed Cloudflare Pages site.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* Ionicons font — self-hosted in /fonts so no CDN version issues */}
        <style dangerouslySetInnerHTML={{ __html: `
          @font-face {
            font-family: 'Ionicons';
            src: url('/fonts/Ionicons.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
        `}} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
