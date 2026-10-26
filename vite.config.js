import { defineConfig } from 'vite';

// Dev pulls fonts from Google; the server hosts its own copy (server/fetch_fonts.py).
const GOOGLE_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Geist+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700;900&display=swap">`;
const fonts = {
  name: 'fonts',
  transformIndexHtml: { order: 'post', handler: (html, ctx) => html.replace('<!--fonts-->', ctx.server ? GOOGLE_FONTS : '<link rel="stylesheet" href="fonts/fonts.css">') },
};

export default defineConfig({
  base: './',
  plugins: [fonts],
  build: { target: 'es2022', modulePreload: { polyfill: false } },
});
