/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        aparecer: { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        aparecer: 'aparecer 150ms ease-out',
        'aparecer-demorado': 'aparecer 200ms ease-out 250ms forwards', // Spinner: solo se ve si la carga tarda
      },
    },
  },
  plugins: [],
}
