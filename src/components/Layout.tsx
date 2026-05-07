import logoSrc from '../assets/logo-hl-noir.png'

interface Props {
  speakerName: string
  onSwitchUser?: () => void
  children: React.ReactNode
}

export default function Layout({ speakerName, onSwitchUser, children }: Props) {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-cream-dark px-6 py-3 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <img src={logoSrc} alt="Heritage Lab" className="h-10 object-contain" />
          {speakerName && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-charcoal-light">Speaker</p>
                <p className="text-sm font-medium text-charcoal">{speakerName}</p>
              </div>
              {onSwitchUser && (
                <button
                  onClick={onSwitchUser}
                  title="Switch user"
                  className="p-1.5 rounded-lg text-charcoal-light hover:text-charcoal hover:bg-cream-dark/60 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col min-h-0">{children}</main>

      {/* Footer */}
      <footer className="bg-mauve px-6 py-3 shrink-0">
        <div className="max-w-4xl mx-auto text-center space-y-1">
          <p className="text-cream-dark/80 text-sm">
            Session: Time &bull; Place
          </p>
          <p className="text-cream-dark/80 text-xs">
            Need support? Email{' '}
            <a href="mailto:example@example.ca" className="underline hover:text-white transition-colors">
              example@example.ca
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
