import { Link } from 'react-router-dom';
import { ShieldCheck, Stethoscope, Clock } from 'lucide-react';

export default function Home() {
    return (
        <div className="flex flex-col gap-12 py-8">
            <section className="text-center space-y-6">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
                    Votre santé mérite <br className="hidden sm:block" />
                    <span className="text-sky-600">une expertise sans frontières</span>
                </h1>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                    Obtenez un deuxième avis médical auprès de médecins spécialistes internationaux reconnus, sans avoir à vous déplacer.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <Link
                        to="/login"
                        className="w-full sm:w-auto px-8 py-4 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-medium shadow-md shadow-sky-600/20 transition-all text-lg"
                    >
                        Demander un avis
                    </Link>
                    <Link
                        to="/login"
                        className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-medium transition-all text-lg"
                    >
                        Espace professionnel
                    </Link>
                </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                    <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Stethoscope className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold text-lg text-slate-900 mb-2">Expertise mondiale</h3>
                    <p className="text-slate-600 text-sm">
                        Accès direct aux meilleurs spécialistes français et internationaux pour confirmer votre diagnostic.
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                    <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold text-lg text-slate-900 mb-2">100% Sécurisé</h3>
                    <p className="text-slate-600 text-sm">
                        Vos données médicales sont strictement confidentielles et protégées selon les normes de santé.
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                    <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold text-lg text-slate-900 mb-2">Rapide & Simple</h3>
                    <p className="text-slate-600 text-sm">
                        Soumettez votre dossier depuis votre téléphone et recevez un avis écrit complet rapidement.
                    </p>
                </div>
            </section>
        </div>
    );
}
