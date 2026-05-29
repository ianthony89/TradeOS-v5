// Auth pages always render in dark mode (no theme switcher on login/register).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="dark" style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {children}
    </div>
  )
}
