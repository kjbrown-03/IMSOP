import { Link } from 'react-router-dom'
import ThemeToggle from '../../components/ui/ThemeToggle'

export default function AccueilV2() {
  return (
    <div className="bg-background text-on-background font-body-lg text-body-lg min-h-screen flex flex-col transition-colors duration-300">
      <nav className="fixed top-0 w-full z-50 bg-surface border-b border-outline-variant px-4 md:px-margin-desktop h-16 flex justify-between items-center transition-colors duration-300">
        <span className="font-headline-md text-headline-md font-bold text-primary">IMSOP</span>
        <div className="flex items-center gap-2 md:gap-4">
          <ThemeToggle />
          <Link to="/connexion" className="text-primary text-sm font-label-md hover:bg-surface-container-low px-2 py-2 rounded-lg transition-colors">
            Se connecter
          </Link>
          <Link to="/inscription" className="bg-primary text-on-primary text-sm font-label-md px-4 py-2 rounded-full shadow-md hover:opacity-90 transition-opacity">
            Créer un compte
          </Link>
        </div>
      </nav>

      <main className="flex-1 pt-16">
        <section className="bg-surface-container-lowest px-margin-mobile md:px-margin-desktop py-16 md:py-24 border-b border-outline-variant">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-primary mb-6">
              L'expertise médicale internationale, accessible d'où que vous soyez
            </h1>
            <p className="text-body-lg text-on-surface-variant mb-10 max-w-2xl mx-auto">
              Obtenez un deuxième avis de spécialistes reconnus sans vous déplacer.
            </p>
            <Link to="/inscription" className="inline-block bg-primary text-on-primary font-label-md py-4 px-10 rounded-full shadow-lg hover:opacity-90 transition-opacity">
              Commencer mon dossier
            </Link>
          </div>
        </section>

        <section className="bg-background px-margin-mobile md:px-margin-desktop py-12">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: 'groups', value: '50+', label: 'Spécialistes Européens' },
              { icon: 'schedule', value: '48h', label: 'Réponse moyenne' },
              { icon: 'verified_user', value: '100%', label: 'Sécurisé et Confidentiel' },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-primary text-4xl mb-2">{s.icon}</span>
                <div className="font-headline-md text-primary">{s.value}</div>
                <div className="text-on-surface-variant">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface px-margin-mobile md:px-margin-desktop py-16 md:py-20">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-headline-md text-center text-on-surface mb-12">Comment obtenir votre avis</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              {[
                { n: 1, title: 'Inscription', text: 'Inscrivez-vous et décrivez votre cas médical en quelques minutes.' },
                { n: 2, title: 'Documents', text: 'Téléversez vos documents de manière sécurisée sur notre plateforme.' },
                { n: 3, title: 'Avis Expert', text: "Recevez l'avis d'un expert international directement dans votre espace." },
              ].map((step) => (
                <div key={step.n} className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-primary-container/10 text-primary flex items-center justify-center font-bold mb-4">
                    {step.n}
                  </div>
                  <h3 className="font-label-md mb-2">{step.title}</h3>
                  <p className="text-body-md text-on-surface-variant">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-margin-mobile md:px-margin-desktop py-16">
          <div className="max-w-4xl mx-auto bg-primary rounded-3xl p-8 md:p-16 text-center text-on-primary shadow-xl">
            <h2 className="font-headline-md mb-6">Prêt à obtenir un avis médical expert ?</h2>
            <p className="mb-10 opacity-90 max-w-xl mx-auto">
              Rejoignez des milliers de patients qui ont fait confiance à IMSOP pour leur santé.
            </p>
            <Link to="/inscription" className="inline-block bg-surface text-primary font-label-md py-4 px-10 rounded-full hover:bg-surface-container transition-colors">
              Créer mon compte patient
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-surface-container-high py-12 px-margin-mobile md:px-margin-desktop">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-outline-variant pb-8 mb-8">
            <span className="font-headline-md text-primary font-bold">IMSOP</span>
            <div className="flex flex-wrap justify-center gap-6 text-on-surface-variant font-label-md">
              <a className="hover:text-primary" href="#">Mentions légales</a>
              <a className="hover:text-primary" href="#">Politique de confidentialité</a>
              <a className="hover:text-primary" href="#">Contact</a>
            </div>
          </div>
          <p className="text-center text-sm text-on-surface-variant opacity-60">© 2026 IMSOP. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  )
}
