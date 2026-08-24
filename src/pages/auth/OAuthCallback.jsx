import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { ROLE_REDIRECTS } from '../../constants/roleRedirects';

// The backend redirects here as a full page navigation after Google/LinkedIn
// hand back an authenticated user, with tokens in the URL *hash* rather than
// the query string - hashes never leave the browser (no server logs, no
// Referer header to a third party), which query params don't guarantee.
export default function OAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);

    // A professional account (specialiste/coordinateur/admin/medecin local)
    // still has to clear the platform's own 2FA - Google confirming their
    // identity isn't a substitute for it. Hand off to the same verification
    // screen the password login flow uses; it doesn't care which login
    // method produced the challenge.
    if (params.get('twoFactorRequired') === 'true') {
      const challengeToken = params.get('challengeToken');
      const role = params.get('role');
      navigate('/verification-2fa', { state: { challengeToken, role }, replace: true });
      return;
    }

    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (!accessToken || !refreshToken) {
      setError("La connexion a échoué : aucune session reçue.");
      return;
    }

    async function finish() {
      try {
        localStorage.setItem('imsop_access_token', accessToken);
        const { data: user } = await api.get('/auth/me');
        useAuthStore.getState()._persistSession({ accessToken, refreshToken, user });
        navigate(ROLE_REDIRECTS[user.role] || '/', { replace: true });
      } catch {
        setError('La connexion a échoué. Veuillez réessayer.');
      }
    }
    finish();
  }, [navigate]);

  return (
    <div className="min-h-screen w-full bg-[var(--color-bg)] flex flex-col items-center justify-center gap-4 p-4 transition-colors duration-300">
      {error ? (
        <>
          <p className="text-red-500 text-sm text-center max-w-sm">{error}</p>
          <button
            onClick={() => navigate('/connexion/patient', { replace: true })}
            className="text-sm font-bold text-[var(--color-text-primary)] hover:underline"
          >
            Retour à la connexion
          </button>
        </>
      ) : (
        <>
          <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
          <p className="text-sm text-[var(--color-text-secondary)]">Connexion en cours...</p>
        </>
      )}
    </div>
  );
}
