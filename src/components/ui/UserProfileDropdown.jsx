import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, UserCog, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export default function UserProfileDropdown() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  // Le composant sert des en-têtes où l'avatar est tantôt à gauche (coque
  // patient), tantôt à droite (coques spécialiste/coordinateur). Un alignement
  // figé faisait sortir le panneau de l'écran dans l'un des deux cas : on
  // choisit le côté d'après la place réellement disponible.
  const [alignRight, setAlignRight] = useState(true);

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const PANEL_WIDTH = 256; // w-64
    const MARGIN = 8;
    const rect = buttonRef.current.getBoundingClientRect();
    const tientADroite = rect.left + PANEL_WIDTH <= window.innerWidth - MARGIN;
    const tientAGauche = rect.right - PANEL_WIDTH >= MARGIN;
    setAlignRight(tientAGauche || !tientADroite);
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 w-10 shrink-0 rounded-full overflow-hidden bg-slate-100 dark:bg-neutral-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-neutral-700 transition-colors text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-neutral-700 shadow-sm"
      >
        {user?.avatarUrl ? (
          <img className="w-full h-full object-cover" src={user.avatarUrl} alt="Profil" />
        ) : (
          <User className="w-5 h-5" />
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className={`absolute ${alignRight ? 'right-0' : 'left-0'} mt-2 w-64 max-w-[calc(100vw-1rem)] bg-white dark:bg-neutral-900 rounded-2xl shadow-lg shadow-slate-900/5 dark:shadow-black/40 border border-slate-100 dark:border-neutral-800 overflow-hidden z-50 animate-fade-in origin-top`}
        >
          <div className="p-4 bg-slate-50 dark:bg-neutral-800 border-b border-slate-100 dark:border-neutral-800">
            <div className="font-bold text-slate-900 dark:text-white truncate">{user?.fullName || t('shell.userMenu.user')}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 truncate">{user?.email || t('shell.userMenu.notProvided')}</div>
            <div className="mt-2 text-xs font-semibold px-2.5 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full inline-block border border-primary-200 dark:border-primary-800/50">
              {user?.role || 'PATIENT'}
            </div>
          </div>

          <div className="p-2">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/profil');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
            >
              <UserCog className="w-4 h-4" />
              {t('profile.title')}
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {t('shell.userMenu.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
