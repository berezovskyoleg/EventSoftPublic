export function MusicBingoLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="mb-logo-web" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="url(#mb-logo-web)" strokeOpacity={0.35} strokeWidth="1" />
      <line x1="9.33" y1="4" x2="9.33" y2="20" stroke="url(#mb-logo-web)" strokeOpacity={0.22} strokeWidth="0.8" />
      <line x1="14.67" y1="4" x2="14.67" y2="20" stroke="url(#mb-logo-web)" strokeOpacity={0.22} strokeWidth="0.8" />
      <line x1="4" y1="9.33" x2="20" y2="9.33" stroke="url(#mb-logo-web)" strokeOpacity={0.22} strokeWidth="0.8" />
      <line x1="4" y1="14.67" x2="20" y2="14.67" stroke="url(#mb-logo-web)" strokeOpacity={0.22} strokeWidth="0.8" />
      <path
        d="M16.5 5.5a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 1 1-5 0v-4.5L9 12.5v4a2.5 2.5 0 1 1-5 0v-5c0-.8.4-1.5 1.1-1.9l6-3.5a2.5 2.5 0 0 1 3.4.9h1z"
        fill="url(#mb-logo-web)"
      />
    </svg>
  );
}
