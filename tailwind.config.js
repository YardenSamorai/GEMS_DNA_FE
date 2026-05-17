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
        //  Restrained "luxury trade tool" palette: bone backgrounds,
        //  graphite ink, hairline stones, and a single antique
        //  champagne accent applied sparingly (active states only).
        //  Pure additions — does not affect any existing class usage.
        // ============================================================
        portal: {
          bone:       '#FAF8F2', // page background — warm off-white
          canvas:     '#FFFFFF', // card surfaces
          pearl:      '#F2EFE6', // subtle bands / hovers / placeholder fills
          line:       '#E5E1D6', // hairline dividers
          line2:      '#D5CFC0', // emphasised hairlines, active borders
          ink:        '#1A1815', // primary text + primary surfaces
          graphite:   '#3A3631', // secondary text / hover-primary
          muted:      '#7A7368', // tertiary text / inactive nav
          soft:       '#A39A8B', // quiet labels / SKU lines
          champagne:  '#A8874E', // antique gold accent — sparing use only
          champagne2: '#8E7140', // hover/active accent
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
