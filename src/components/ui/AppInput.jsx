import React, { useState } from 'react';
import BasculeVisibilite from './BasculeVisibilite';

const AppInput = (props) => {
  const { label, placeholder, icon, ...rest } = props;
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  // Un champ de mot de passe reçoit sa bascule automatiquement : la page de
  // connexion n'a rien à déclarer, et le style du champ reste inchangé.
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const estMotDePasse = rest.type === 'password';
  const typeEffectif = estMotDePasse && motDePasseVisible ? 'text' : rest.type;

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  return (
    <div className="w-full min-w-[200px] relative">
      {label && 
        <label className='block mb-2 text-sm text-[var(--color-text-primary)]'>
          {label}
        </label>
      }
      <div className="relative w-full">
        <input
          className={`peer relative z-10 border-2 border-[var(--color-border)] h-12 w-full rounded-md bg-[var(--color-surface)] px-4 font-medium text-[var(--color-text-primary)] outline-none drop-shadow-sm transition-all duration-200 ease-in-out focus:bg-[var(--color-bg)] placeholder:font-medium placeholder:text-[var(--color-text-secondary)] ${estMotDePasse ? 'pr-12' : ''}`}
          placeholder={placeholder}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          {...rest}
          type={typeEffectif}
        />
        {isHovering && (
          <>
            <div
              className="absolute pointer-events-none top-0 left-0 right-0 h-[2px] z-20 rounded-t-md overflow-hidden"
              style={{
                background: `radial-gradient(30px circle at ${mousePosition.x}px 0px, var(--color-text-primary) 0%, transparent 70%)`,
              }}
            />
            <div
              className="absolute pointer-events-none bottom-0 left-0 right-0 h-[2px] z-20 rounded-b-md overflow-hidden"
              style={{
                background: `radial-gradient(30px circle at ${mousePosition.x}px 2px, var(--color-text-primary) 0%, transparent 70%)`,
              }}
            />
          </>
        )}
        {estMotDePasse ? (
          <BasculeVisibilite
            visible={motDePasseVisible}
            onToggle={() => setMotDePasseVisible((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20"
          />
        ) : (
          icon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 text-[var(--color-text-secondary)]">
              {icon}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default AppInput;
