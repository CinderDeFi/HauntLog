/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        haunt: {
          red: "var(--haunt-red)",
          dark: "#111111",
          ghost: "#E5E5E5",
        },
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        // Route-enter motion. Short + eased so navigation feels responsive,
        // not sluggish. Gated behind `motion-safe:` at call sites so it never
        // fires for users who prefer reduced motion.
        //
        // fill-mode is `backwards`, NOT `both`: `both` would leave a transform
        // applied at rest, and any lingering transform turns the element into
        // the containing block for its `position: fixed` descendants — which
        // would break the fullscreen PhotoLightbox and modals. `backwards`
        // plays the entrance then returns to untransformed normal flow.
        fadeInUp: 'fadeInUp 0.28s cubic-bezier(0.22, 1, 0.36, 1) backwards',
        fadeIn: 'fadeIn 0.2s ease-out backwards',
      },
    },
  },
  plugins: [],
}
