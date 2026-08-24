import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { ROLE_REDIRECTS } from '../../constants/roleRedirects';
import AppInput from '../ui/AppInput';
import { Sun, Moon } from 'lucide-react';

// Full-page navigations (not XHR), so a plain relative href is enough: Vite's
// dev proxy forwards /api/* to the backend the same way it does for fetch
// calls, and in production this is served from the same origin behind a
// reverse proxy - see vite.config.js and lib/api.js for the same assumption.
// The role is passed as a query param so the backend knows, once Google
// redirects back, which login page (and which required role) the click
// came from - see oauth.controller.js.
function getSocialIcons(role) {
  return [
    {
      id: 'google',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z" />
        </svg>
      ),
      href: `/api/auth/oauth/google?role=${role}`,
      bg: 'bg-[var(--color-bg)]',
    },
  ];
}

const OAUTH_ERROR_MESSAGES = {
  not_configured: 'Cette méthode de connexion n\'est pas encore activée.',
  access_denied: 'Connexion annulée.',
  invalid_state: 'La session de connexion a expiré, veuillez réessayer.',
  exchange_failed: 'La connexion a échoué, veuillez réessayer.',
  no_email: 'Ce compte ne fournit pas d\'adresse email accessible.',
  account_disabled: 'Ce compte a été désactivé. Contactez un administrateur.',
  not_registered_patient: 'Aucun compte patient n\'est associé à cette adresse Google. Créez un compte pour continuer.',
  not_registered_medecin: 'Aucun compte médecin traitant n\'est associé à cette adresse Google. Créez un compte pour continuer.',
  not_registered_professional: 'Aucun compte n\'est associé à cette adresse Google pour cet espace. Ces comptes sont créés par l\'administration IMSOP - contactez votre administrateur.',
};

const ROLE_IMAGES = {
  PATIENT: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80',
  SPECIALISTE: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80',
  MEDECIN_LOCAL: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80',
  COORDINATEUR: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80',
  ADMIN: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80',
};

const ROLE_LINKS = {
  PATIENT: { forgotLink: '/mot-de-passe-oublie', createLink: '/inscription' },
  SPECIALISTE: { forgotLink: '/mot-de-passe-oublie', createLink: null },
  // Unlike the international specialists, local doctors sign themselves up:
  // a patient can only designate a doctor who already has an account.
  MEDECIN_LOCAL: { forgotLink: '/mot-de-passe-oublie', createLink: '/inscription/medecin' },
  COORDINATEUR: { forgotLink: '/mot-de-passe-oublie', createLink: null },
  ADMIN: { forgotLink: '/mot-de-passe-oublie', createLink: null },
};

const AnimatedLogin = ({ role = 'PATIENT' }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const loading = useAuthStore((s) => s.loading);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const oauthErrorCode = searchParams.get('oauthError');
  const oauthError = oauthErrorCode
    ? OAUTH_ERROR_MESSAGES[oauthErrorCode] || 'La connexion a échoué, veuillez réessayer.'
    : null;

  const info = {
    title: t(`auth.animatedLogin.roles.${role}.title`),
    subtitle: t(`auth.animatedLogin.roles.${role}.subtitle`),
    image: ROLE_IMAGES[role] || ROLE_IMAGES.PATIENT,
    ...(ROLE_LINKS[role] || ROLE_LINKS.PATIENT),
  }
  const socialIcons = getSocialIcons(role);

  const handleMouseMove = (e) => {
    const leftSection = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - leftSection.left,
      y: e.clientY - leftSection.top
    });
  };

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);

  async function onSubmit(e) {
    e.preventDefault();
    const result = await login(email, password, role);
    if (result?.twoFactorRequired) {
      navigate('/verification-2fa', { state: { challengeToken: result.challengeToken, role } });
    } else if (result?.ok) {
      navigate(ROLE_REDIRECTS[role] || '/');
    }
  }

  return (
    <div className="min-h-screen w-full bg-[var(--color-bg)] flex items-center justify-center p-4 transition-colors duration-300">
      <div className='w-[95%] lg:w-[80%] xl:w-[70%] max-w-[1200px] flex justify-between min-h-[600px] bg-[var(--color-surface)] rounded-3xl shadow-2xl overflow-hidden border border-[var(--color-border)]'>
        
        {/* Left Form Section */}
        <div
          className='w-full lg:w-1/2 px-6 sm:px-12 py-10 relative overflow-hidden flex flex-col justify-center'
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Animated Glow Effect */}
          <div
            className={`absolute pointer-events-none w-[500px] h-[500px] bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-transparent rounded-full blur-3xl transition-opacity duration-200 z-0 ${
              isHovering ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              transform: `translate(${mousePosition.x - 250}px, ${mousePosition.y - 250}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          />
          
          <div className="relative z-10 w-full max-w-sm mx-auto">
            <div className="text-center mb-8">
              <h1 className='text-3xl md:text-4xl font-extrabold text-[var(--color-heading)] tracking-tight mb-2'>
                {info.title}
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {info.subtitle}
              </p>
            </div>

            {/* Social Logins */}
            <div className="flex items-center justify-center mb-8">
              <ul className="flex gap-4">
                {socialIcons.map((social) => (
                  <li key={social.id} className="list-none">
                    <a
                      href={social.href}
                      className={`w-[3rem] h-[3rem] bg-[var(--color-muted-surface)] rounded-full flex justify-center items-center relative z-[1] border-2 border-[var(--color-border)] overflow-hidden group`}
                    >
                      <div
                        className={`absolute inset-0 w-full h-full bg-[var(--color-text-primary)] scale-y-0 origin-bottom transition-transform duration-500 ease-in-out group-hover:scale-y-100`}
                      />
                      <span className="text-[1.5rem] text-[var(--color-text-primary)] transition-all duration-500 ease-in-out z-[2] group-hover:text-[var(--color-bg)]">
                        {social.icon}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center mb-6">
              <div className="flex-grow border-t border-[var(--color-border)]"></div>
              <span className="flex-shrink-0 mx-4 text-xs text-[var(--color-text-secondary)] uppercase">
                {t('auth.animatedLogin.orEmail')}
              </span>
              <div className="flex-grow border-t border-[var(--color-border)]"></div>
            </div>

            {(error || oauthError) && (
              <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-500 text-sm rounded-lg px-4 py-3 text-center">
                {error || oauthError}
              </div>
            )}

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <AppInput 
                placeholder={t('common.email')} 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <AppInput 
                placeholder={t('common.password')} 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              
              <div className="flex justify-between items-center mt-2">
                <Link to={info.forgotLink} className='text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors'>
                  {t('auth.animatedLogin.forgotPassword')}
                </Link>
              </div>

              <button 
                disabled={loading}
                className="group relative flex justify-center items-center overflow-hidden rounded-lg bg-[var(--color-muted-surface)] border border-[var(--color-border)] mt-6 px-4 py-3 text-sm font-bold transition-all duration-300 disabled:opacity-70 z-[1]"
              >
                <div className="absolute inset-0 w-full h-full bg-[var(--color-text-primary)] scale-y-0 origin-bottom transition-transform duration-500 ease-in-out group-hover:scale-y-100 z-[-1]" />
                <span className="relative z-10 px-2 py-1 text-[var(--color-text-primary)] transition-colors duration-500 ease-in-out group-hover:text-[var(--color-bg)]">
                  {loading ? t('auth.animatedLogin.submitting') : t('auth.animatedLogin.submit')}
                </span>
              </button>
            </form>

            {info.createLink && (
              <div className="mt-8 text-center">
                <span className="text-sm text-[var(--color-text-secondary)]">{t('auth.animatedLogin.newPatient')} </span>
                <Link to={info.createLink} className="text-sm font-bold text-[var(--color-text-primary)] hover:underline">
                  {t('auth.animatedLogin.createAccount')}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Image Section */}
        <div className='hidden lg:block w-1/2 relative overflow-hidden bg-black/10'>
          <img
            src={info.image}
            alt="Medical background"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105 opacity-80"
          />
          {/* Subtle gradient overlay to blend with dark theme */}
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-surface)] to-transparent opacity-80"></div>
        </div>
      </div>
    </div>
  );
};

export default AnimatedLogin;
