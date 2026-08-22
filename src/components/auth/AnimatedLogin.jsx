import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import AppInput from '../ui/AppInput';
import { Sun, Moon } from 'lucide-react';

const socialIcons = [
  {
    id: 'google',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z" />
      </svg>
    ),
    href: '#',
    bg: 'bg-[var(--color-bg)]',
  },
  {
    id: 'linkedin',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <path fill="currentColor" d="M6.94 5a2 2 0 1 1-4-.002a2 2 0 0 1 4 .002M7 8.48H3V21h4zm6.32 0H9.34V21h3.94v-6.57c0-3.66 4.77-4 4.77 0V21H22v-7.93c0-6.17-7.06-5.94-8.72-2.91z" />
      </svg>
    ),
    href: '#',
    bg: 'bg-[var(--color-bg)]',
  }
];

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

const ROLE_REDIRECTS = {
  PATIENT: '/patient/dossiers',
  SPECIALISTE: '/specialiste/tableau-de-bord',
  MEDECIN_LOCAL: '/medecin/dossiers',
  COORDINATEUR: '/coordinateur/tableau-de-bord',
  ADMIN: '/admin/tableau-de-bord',
};

const AnimatedLogin = ({ role = 'PATIENT' }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const loading = useAuthStore((s) => s.loading);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const info = {
    title: t(`auth.animatedLogin.roles.${role}.title`),
    subtitle: t(`auth.animatedLogin.roles.${role}.subtitle`),
    image: ROLE_IMAGES[role] || ROLE_IMAGES.PATIENT,
    ...(ROLE_LINKS[role] || ROLE_LINKS.PATIENT),
  }

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

            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-500 text-sm rounded-lg px-4 py-3 text-center">
                {error}
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
                className="group relative flex justify-center items-center overflow-hidden rounded-lg bg-[var(--color-text-primary)] mt-6 px-4 py-3 text-sm font-bold text-[var(--color-bg)] transition-all duration-300 hover:scale-[1.02] hover:shadow-lg disabled:opacity-70 disabled:hover:scale-100"
              >
                <span className="relative z-10 px-2 py-1">
                  {loading ? t('auth.animatedLogin.submitting') : t('auth.animatedLogin.submit')}
                </span>
                <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-13deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-13deg)_translateX(100%)] z-0">
                  <div className="relative h-full w-8 bg-white/30" />
                </div>
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
