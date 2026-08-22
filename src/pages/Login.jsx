import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { User, Stethoscope, Settings } from 'lucide-react';

export default function Login() {
    const [selectedRole, setSelectedRole] = useState('patient');
    const login = useStore((state) => state.login);
    const navigate = useNavigate();

    const handleLogin = (e) => {
        e.preventDefault();
        login(selectedRole);
        // Redirection selon le rôle
        if (selectedRole === 'patient') navigate('/patient/dashboard');
        else if (selectedRole === 'doctor') navigate('/doctor/dashboard');
        else navigate('/admin/dashboard');
    };

    return (
        <div className="max-w-md mx-auto mt-12 bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold text-center text-slate-900 mb-8">
                Connexion
            </h2>

            <div className="grid grid-cols-3 gap-2 mb-8">
                <button
                    type="button"
                    onClick={() => setSelectedRole('patient')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${selectedRole === 'patient'
                            ? 'border-sky-500 bg-sky-50 text-sky-700'
                            : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                >
                    <User className="w-6 h-6 mb-2" />
                    <span className="text-xs font-medium">Patient</span>
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedRole('doctor')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${selectedRole === 'doctor'
                            ? 'border-sky-500 bg-sky-50 text-sky-700'
                            : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                >
                    <Stethoscope className="w-6 h-6 mb-2" />
                    <span className="text-xs font-medium">Médecin</span>
                </button>
                <button
                    type="button"
                    onClick={() => setSelectedRole('admin')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${selectedRole === 'admin'
                            ? 'border-sky-500 bg-sky-50 text-sky-700'
                            : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                >
                    <Settings className="w-6 h-6 mb-2" />
                    <span className="text-xs font-medium">Admin</span>
                </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Email ou Numéro de téléphone
                    </label>
                    <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                        placeholder="Ex: jean.dupont@email.com"
                        required
                        defaultValue="demo@imsop.com"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Mot de passe
                    </label>
                    <input
                        type="password"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
                        placeholder="••••••••"
                        required
                        defaultValue="password"
                    />
                </div>

                <button
                    type="submit"
                    className="w-full mt-6 bg-sky-600 hover:bg-sky-700 text-white font-medium py-3.5 rounded-xl transition-colors text-lg shadow-sm"
                >
                    Se connecter
                </button>

                <p className="text-center text-sm text-slate-500 mt-4">
                    Nouveau sur la plateforme ?{' '}
                    <a href="#" className="text-sky-600 font-medium hover:underline">
                        Créer un compte
                    </a>
                </p>
            </form>
        </div>
    );
}
