/**
 * Gabarit des écrans d'authentification et de candidature.
 *
 * Deux traitements de l'image selon la taille d'écran, parce que la place
 * disponible n'a rien à voir :
 *
 *  - à partir de `md`, un panneau latéral porte l'image en filigrane derrière
 *    le titre ;
 *  - en dessous, ce panneau disparaît et l'image reviendrait à zéro. Or c'est
 *    précisément là que la plupart des médecins remplissent le formulaire. On
 *    pose donc un bandeau compact en tête, avec un dégradé qui garantit la
 *    lisibilité du titre quelle que soit la photo.
 *
 * Le dégradé n'est pas décoratif : sans lui, un titre clair sur une zone claire
 * de la photo devient illisible, et c'est le genre de défaut qui n'apparaît que
 * sur certaines images.
 */
export default function AuthLayout({ heading, tagline, badges, children, bgImage }) {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col md:flex-row font-body-md">
      {/* --- Bandeau mobile ------------------------------------------------ */}
      {bgImage && (
        <div className="md:hidden relative h-40 shrink-0 overflow-hidden">
          <img src={bgImage} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/70 to-surface/20" />
          <div className="absolute inset-x-0 bottom-0 px-margin-mobile pb-3">
            <h2
              className="font-headline-md text-headline-md-mobile text-primary drop-shadow-sm"
              dangerouslySetInnerHTML={{ __html: heading }}
            />
          </div>
        </div>
      )}

      {/* --- Panneau latéral, à partir de md -------------------------------- */}
      <div className="hidden md:flex md:w-1/2 bg-surface-container flex-col justify-center items-center p-8 relative overflow-hidden">
        {bgImage && (
          <>
            <img src={bgImage} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
            {/* Le voile fait tenir le texte par-dessus la photo. Sans lui, le
                contraste dépend du cliché, donc du hasard. */}
            <div className="absolute inset-0 bg-surface-container/85" />
          </>
        )}
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
