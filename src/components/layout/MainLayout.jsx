import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Activity, LogOut, User } from 'lucide-react';

export default function MainLayout() {
    const { isAuthenticated, user, logout } = useStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-sky-600">
                        <Activity className="h-8 w-8" />
                        <span className="text-xl font-semibold tracking-tight">IMSOP</span>
                    </Link>

                    <nav className="flex items-center gap-4">
                        {isAuthenticated ? (
                            <>
                                <div className="flex items-center gap-2 text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full text-sm font-medium">
                                    <User className="w-4 h-4" />
                                    <span className="hidden sm:inline">{user?.name}</span>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="p-2 text-slate-500 hover:text-red-600 transition-colors"
                                    aria-label="Se déconnecter"
                                >
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </>
                        ) : (
                            <Link
                                to="/login"
                                className="text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
                            >
                                Connexion
                            </Link>
                        )}
                    </nav>
                </div>
            </header>

            <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
                <Outlet />
            </main>

            <footer className="bg-white border-t border-slate-200 mt-auto">
                <div className="max-w-5xl mx-auto p-4 text-center text-sm text-slate-500">
                    © {new Date().getFullYear()} Plateforme Internationale de Deuxième Avis Médical - KJTECH
                </div>
            </footer>
        </div>
    );
}
