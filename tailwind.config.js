/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'outfit': ['Outfit', 'sans-serif'],
        // Portal editorial display face — used for headings and inventory
        // counts in the store-portal "luxury trade" surface. Already loaded
        // from Google Fonts in public/index.html, so this is purely additive.
        'serif-display': ['Cormorant', 'Cormorant Garamond', 'Garamond', 'serif'],
      },
      colors: {
        // ============================================================
        //  Portal design tokens — used by the store-portal surface.
        //  Restrained "luxury trade tool" palette kept around so the
        //  semantic champagne tones can still be used for positive
        //  state indicators (completed signatures, converted requests).
        //  The primary surface treatment is now `glass.*` below.
        //  Pure additions — does not affect any existing class usage.
        // ============================================================
        portal: {
          bone:       '#FAF8F2',
          canvas:     '#FFFFFF',
          pearl:      '#F2EFE6',
          line:       '#E5E1D6',
          line2:      '#D5CFC0',
          ink:        '#1A1815',
          graphite:   '#3A3631',
          muted:      '#7A7368',
          soft:       '#A39A8B',
          champagne:  '#A8874E',
          champagne2: '#8E7140',
        },
        // ============================================================
        //  Glass design tokens — Apple Liquid-Glass-inspired language
        //  for the store-portal surface. The canvas is a soft cool
        //  sand with a subtle tonal gradient (driven from index.css);
        //  glass surfaces sit on top with backdrop-blur + a thin lit
        //  inner edge. Text scale mirrors Apple's typographic ramp
        //  (#1D1D1F → #6E6E73 → #A1A1A6) so the result reads like a
        //  native macOS / iPadOS app, not a SaaS dashboard.
        // ============================================================
        glass: {
          canvas:   '#F2F2F5', // page background base — cool light sand
          canvas2:  '#E9E9EE', // secondary stop / sticky-element fill
          surface:  '#FFFFFF', // resolved opaque equivalent for glass
          ink:      '#1D1D1F', // primary text + primary surfaces
          graphite: '#3A3A3C', // secondary text / hover-primary
          muted:    '#6E6E73', // tertiary text / inactive nav
          soft:     '#A1A1A6', // quiet labels / placeholders
          line:     '#E5E5EA', // separator (Apple system)
          line2:    '#D1D1D6', // stronger separator
          tintWarm: '#F5EFE6', // very soft warm wash for lit zones
          tintCool: '#EAF0F6', // very soft cool wash for lit zones
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'glow': '0 0 40px -10px rgb(16 185 129 / 0.4)',
        'glow-lg': '0 0 60px -15px rgb(16 185 129 / 0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
