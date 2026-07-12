@import 'tailwindcss';
@import 'tw-animate-css';
@import 'shadcn/tailwind.css';

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: var(--font-geist), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-display), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-gold: var(--gold);
  --color-neon-cyan: var(--neon-cyan);
  --color-neon-magenta: var(--neon-magenta);

  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
}

:root {
  color-scheme: dark;
  --background: oklch(0.13 0.02 264);
  --foreground: oklch(0.97 0.01 250);
  --card: oklch(0.17 0.025 264);
  --card-foreground: oklch(0.97 0.01 250);
  --popover: oklch(0.16 0.025 264);
  --popover-foreground: oklch(0.97 0.01 250);
  --primary: oklch(0.8 0.16 195);
  --primary-foreground: oklch(0.13 0.02 264);
  --secondary: oklch(0.24 0.03 264);
  --secondary-foreground: oklch(0.97 0.01 250);
  --muted: oklch(0.22 0.02 264);
  --muted-foreground: oklch(0.72 0.02 260);
  --accent: oklch(0.72 0.22 330);
  --accent-foreground: oklch(0.99 0.01 320);
  --destructive: oklch(0.63 0.23 22);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 14%);
  --ring: oklch(0.8 0.16 195);
  --gold: oklch(0.83 0.15 85);
  --neon-cyan: oklch(0.82 0.17 195);
  --neon-magenta: oklch(0.72 0.24 330);
  --radius: 0.9rem;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html {
    -webkit-tap-highlight-color: transparent;
  }
  body {
    @apply bg-background text-foreground;
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -10%, oklch(0.8 0.16 195 / 0.12), transparent),
      radial-gradient(ellipse 60% 50% at 100% 0%, oklch(0.72 0.24 330 / 0.1), transparent);
    background-attachment: fixed;
  }
}

@layer utilities {
  .neon-text-cyan {
    text-shadow: 0 0 12px oklch(0.82 0.17 195 / 0.7);
  }
  .neon-text-magenta {
    text-shadow: 0 0 12px oklch(0.72 0.24 330 / 0.7);
  }
  .glass {
    background: linear-gradient(160deg, oklch(1 0 0 / 0.06), oklch(1 0 0 / 0.02));
    backdrop-filter: blur(10px);
  }
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  @keyframes shine {
    0% {
      background-position: 200% center;
    }
    100% {
      background-position: -200% center;
    }
  }
  .animate-shine {
    background-size: 200% auto;
    animation: shine 3s linear infinite;
  }

  /* Premium card: subtle top sheen + inner border */
  .card-premium {
    background:
      linear-gradient(180deg, oklch(1 0 0 / 0.05), oklch(1 0 0 / 0) 40%),
      var(--card);
    box-shadow:
      inset 0 1px 0 0 oklch(1 0 0 / 0.06),
      0 1px 2px 0 oklch(0 0 0 / 0.4);
  }

  /* Glowing primary CTA */
  .btn-glow {
    background: linear-gradient(180deg, oklch(0.86 0.16 195), oklch(0.72 0.16 200));
    color: var(--primary-foreground);
    box-shadow:
      0 0 0 1px oklch(0.9 0.1 195 / 0.4) inset,
      0 8px 24px -6px oklch(0.8 0.16 195 / 0.6);
  }
  .btn-glow:active {
    transform: scale(0.97);
  }

  /* Animated conic gradient border wrapper */
  .grad-border {
    position: relative;
    isolation: isolate;
  }
  .grad-border::before {
    content: "";
    position: absolute;
    inset: 0;
    padding: 1px;
    border-radius: inherit;
    background: conic-gradient(
      from var(--a, 0deg),
      oklch(0.82 0.17 195 / 0.9),
      oklch(0.72 0.24 330 / 0.9),
      oklch(0.83 0.15 85 / 0.9),
      oklch(0.82 0.17 195 / 0.9)
    );
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: spin-border 6s linear infinite;
    z-index: -1;
  }
  @property --a {
    syntax: "<angle>";
    inherits: false;
    initial-value: 0deg;
  }
  @keyframes spin-border {
    to {
      --a: 360deg;
    }
  }

  @keyframes float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-6px);
    }
  }
  .animate-float {
    animation: float 4s ease-in-out infinite;
  }

  @keyframes pop-in {
    0% {
      transform: scale(0.6);
      opacity: 0;
    }
    60% {
      transform: scale(1.08);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  .animate-pop-in {
    animation: pop-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  @keyframes twinkle {
    0%,
    100% {
      opacity: 0.25;
    }
    50% {
      opacity: 1;
    }
  }
}
