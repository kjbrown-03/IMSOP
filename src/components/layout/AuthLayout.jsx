export default function AuthLayout({ heading, tagline, badges, children, bgImage }) {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col md:flex-row font-body-md">
      <div className="hidden md:flex md:w-1/2 bg-surface-container flex-col justify-center items-center p-8 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={bgImage ? { backgroundImage: `url('${bgImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        />
        <div className="relative z-10 max-w-md text-center">
          <h2 className="font-headline-lg text-headline-lg text-primary mb-6" dangerouslySetInnerHTML={{ __html: heading }} />
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-8">{tagline}</p>
          {badges && <div className="flex justify-center gap-6">{badges}</div>}
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center px-margin-mobile py-8 md:px-12 lg:px-24 xl:px-32 relative z-10 bg-surface">
        <div className="max-w-md w-full mx-auto">{children}</div>
      </div>
    </div>
  )
}
