import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, ShieldCheck, RotateCw } from 'lucide-react'

/**
 * Carte de paiement animée — reprise visuelle du composant « credit card form »
 * (dégradés flous en arrière-plan, bascule 3D, chiffres qui glissent).
 *
 * Différence essentielle avec l'original : elle n'affiche AUCUNE donnée bancaire
 * saisie par l'utilisateur. Le numéro de carte, la date d'expiration et le
 * cryptogramme ne transitent jamais par cette application — ils sont saisis sur
 * la page hébergée par CinetPay. Ce que la carte présente ici, c'est le PAIEMENT :
 * montant, référence du dossier, mode retenu.
 *
 * La bascule sert donc à quelque chose de réel : le recto porte le total, le
 * verso le détail ligne à ligne.
 */

const ANNEAU_1 = '#3E8C81'
const ANNEAU_2 = '#163A52'

function Anneaux() {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute -left-[17%] -top-11 h-[300px] w-[300px] rounded-full border-[16px]"
        style={{ borderColor: ANNEAU_1, filter: 'blur(13px)' }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -left-[200px] top-[55%] h-[300px] w-[300px] rounded-full border-[16px]"
        style={{ borderColor: ANNEAU_2, filter: 'blur(13px)' }}
      />
    </>
  )
}

/** Chiffres qui glissent vers le haut à mesure que le montant se précise. */
// Les montants en XAF se comptent en centaines de milliers : sans separateur,
// « 115000 » se lit mal, et se confond avec « 11500 » d'un coup d'oeil.
const formater = (n) => Number(n).toLocaleString('fr-FR')

function MontantAnime({ valeur }) {
  const caracteres = formater(valeur).split('')
  return (
    <span className="flex h-[38px] overflow-hidden" aria-label={formater(valeur)}>
      {caracteres.map((c, i) => (
        <span key={`${c}-${i}`} className="flex flex-col leading-[38px] h-[38px] transition-transform duration-300">
          <span className="h-[38px] block" aria-hidden>
            {c}
          </span>
        </span>
      ))}
    </span>
  )
}

export default function CartePaiement({ montantTotal, devise, reference, titulaire, methode, lignes = [] }) {
  const { t } = useTranslation()
  const [versoVisible, setVersoVisible] = useState(false)

  const face =
    'absolute inset-0 h-full w-full rounded-[20px] px-7 py-6 text-white overflow-hidden ' +
    'bg-gradient-to-br from-[#1B3B4B] to-[#08151D] shadow-[0_33px_50px_-15px_rgba(22,58,82,0.55)] ' +
    '[backface-visibility:hidden]'

  return (
    <div className="w-full max-w-[420px] mx-auto [perspective:1000px]">
      <div
        className="relative h-[233px] w-full transition-transform duration-700 [transform-style:preserve-3d]"
        style={{ transform: versoVisible ? 'rotateY(180deg)' : 'none' }}
      >
        {/* ---------- Recto : le montant ---------- */}
        <section className={face}>
          <Anneaux />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="font-semibold tracking-tight">IMSOP</span>
              <ShieldCheck className="h-6 w-6 opacity-80" />
            </div>

            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-white/60">
                {t('patient.payment.totalDue')}
              </p>
              <p className="flex items-baseline gap-2 text-[32px] font-bold tabular-nums">
                <MontantAnime valeur={montantTotal} />
                <span className="text-lg font-semibold text-white/70">{devise}</span>
              </p>
            </div>

            <div className="flex items-end justify-between text-[13px]">
              <div className="min-w-0">
                <p className="font-semibold uppercase tracking-wider text-white/60">
                  {t('patient.payment.cardHolder')}
                </p>
                <p className="truncate uppercase">{titulaire || '—'}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold uppercase tracking-wider text-white/60">
                  {t('patient.payment.cardReference')}
                </p>
                <p className="tabular-nums">{reference || '—'}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Verso : le détail ---------- */}
        <section className={`${face} [transform:rotateY(180deg)]`}>
          <Anneaux />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-white/60">
              {t('patient.payment.summaryTitle')}
            </p>
            <ul className="flex flex-col gap-1.5 text-sm">
              {lignes.map((l) => (
                <li key={l.libelle} className="flex justify-between gap-4">
                  <span className="text-white/75">{l.libelle}</span>
                  <span className="tabular-nums shrink-0">
                    {formater(l.montant)} {devise}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-white/15 pt-3 text-sm font-semibold">
              <span>{t('patient.payment.totalDue')}</span>
              <span className="tabular-nums">
                {formater(montantTotal)} {devise}
              </span>
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-white/55">
              <Lock className="h-3 w-3 shrink-0" />
              {methode}
            </p>
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={() => setVersoVisible((v) => !v)}
        className="mx-auto mt-4 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low"
      >
        <RotateCw className="h-3.5 w-3.5" />
        {t(versoVisible ? 'patient.payment.showTotal' : 'patient.payment.showBreakdown')}
      </button>
    </div>
  )
}
