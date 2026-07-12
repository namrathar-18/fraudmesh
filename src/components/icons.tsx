// Minimal inline icon set (stroke-based) so we don't pull an icon dependency.
interface P { size?: number; className?: string }
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const Shield = ({ size = 22, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 2 4 5v6c0 5 3.4 8.6 8 11 4.6-2.4 8-6 8-11V5l-8-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)
export const Play = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="m6 4 13 8-13 8V4Z" fill="currentColor" stroke="none" /></svg>
)
export const Pause = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /></svg>
)
export const Zap = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" /></svg>
)
export const Reset = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
)
export const Bot = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><rect x="4" y="8" width="16" height="11" rx="2" /><path d="M12 8V4M8 3h8" /><circle cx="9" cy="13" r="1" fill="currentColor" /><circle cx="15" cy="13" r="1" fill="currentColor" /></svg>
)
export const Close = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}><path d="M18 6 6 18M6 6l12 12" /></svg>
)
export const Network = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M6.7 7.4 10.6 16M17.3 7.4 13.4 16M7 6h10" /></svg>
)
export const Fingerprint = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 10a2 2 0 0 1 2 2c0 3-.5 5-1 6.5M8.5 8.5A5 5 0 0 1 17 12c0 2 0 3-.3 4.5M6 12a6 6 0 0 1 1.2-3.6M9.5 20c.8-1.8 1-3.5 1-6a1.5 1.5 0 0 1 3 0" /></svg>
)
export const Trend = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7h-4M21 7v4" /></svg>
)
export const Clock = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
)
export const Doc = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
)
export const Github = ({ size = 14, className }: P) => (
  <svg {...base(size)} className={className}><path d="M9 19c-4 1.5-4-2-6-2m12 4v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.5 1.3a12 12 0 0 0-6.3 0C6.5 2.2 5.5 2.5 5.5 2.5a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 8.9c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" /></svg>
)
export const Grid = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
)
export const Activity = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>
)
export const Folder = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>
)
export const Cpu = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /><rect x="10" y="10" width="4" height="4" rx="1" /></svg>
)
export const Sliders = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
)
export const BarChart = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></svg>
)
export const FileCheck = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 15l2 2 4-4" /></svg>
)
export const Settings = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H7a1.6 1.6 0 0 0 1-1.5V1a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H23a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></svg>
)
export const LogOut = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
)
export const Bell = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
)
export const Search = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
)
export const User = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></svg>
)
export const Lock = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
)
export const Building = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><rect x="4" y="2" width="16" height="20" rx="1.5" /><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 22v-3h4v3" /></svg>
)
export const Check = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="m20 6-11 11-5-5" /></svg>
)
export const Alert = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 2 2 20h20L12 2Z" /><path d="M12 9v5M12 17.5v.5" /></svg>
)
export const Download = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 3v12M7 11l5 5 5-5M4 21h16" /></svg>
)
export const MapPin = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
)
export const Menu = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3 6h18M3 12h18M3 18h18" /></svg>
)
