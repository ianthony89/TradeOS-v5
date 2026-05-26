export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="dark" className="min-h-screen bg-[var(--bg)]">
      {children}
    </div>
  )
}
