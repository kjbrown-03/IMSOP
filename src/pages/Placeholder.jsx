export default function Placeholder({ title }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-background p-8">
      <div className="text-center max-w-md">
        <span className="material-symbols-outlined text-5xl text-primary mb-4 inline-block">
          construction
        </span>
        <h1 className="font-headline-md text-headline-md mb-2">{title}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Cet écran est en cours de construction.
        </p>
      </div>
    </div>
  )
}
