// Mobile builds use @tailwindcss/vite directly.
// Keep PostCSS configuration local so Vite does not inherit the web root
// postcss.config.mjs, which depends on @tailwindcss/postcss.
export default {
  plugins: {}
};
