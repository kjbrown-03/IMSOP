import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, BarChart3, ChevronRight, Loader2, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { api } from '../../lib/api'

const PERIODES = [6, 12, 24]
const BASE = '/coordinateur/statistiques'

// Pour la plupart des indicateurs, monter est bon. Pour ceux-ci, c'est
// descendre : un délai qui s'allonge ou des compléments plus fréquents sont
// des dégradations, et la couleur de la variation doit le dire.
const BAISSE_FAVORABLE = new Set(['delaiMoyen', 'tauxComplementsDemandes'])

// Devise mise en avant quand un indicateur en porte plusieurs.
const DEVISE_PRINCIPALE = 'XAF'

const STYLE_TON = {
  bon: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  mauvais: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
  neutre: 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300',
}
const ICONE_TON = { bon: TrendingUp, mauvais: TrendingDown, neutre: Minus }

/**
 * Les neuf indicateurs du MVP, en cartes.
 *
 * Deux vues sur la même adresse de base : la grille des neuf cartes, et — sur
 * `/statistiques/:cle` — la carte choisie en tête de page avec son détail
 * dessous. Une adresse par indicateur plutôt qu'un panneau : on peut la
 * partager, y revenir, et le bouton « précédent » du navigateur fait ce qu'on
 * attend de lui.
 */
export default function StatistiquesMensuelles() {
  const { t, i18n } = useTranslation()
  const { cle } = useParams()
  const navigate = useNavigate()

  const [nombreDeMois, setNombreDeMois] = useState(12)
  const [donnees, setDonnees] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    let annule = false
    setChargement(true)

    api
      .get('/admin/statistiques/mensuel', { params: { mois: nombreDeMois } })
      .then(({ data }) => {
        if (!annule) {
          setDonnees(data)
          setErreur(null)
        }
      })
      .catch((err) => {
        if (!annule) setErreur(err.response?.data?.message || t('coordinateur.stats.chargementEchoue'))
      })
      .finally(() => {
        if (!annule) setChargement(false)
      })

    return () => {
      annule = true
    }
  }, [nombreDeMois, t])

  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'

  function libelleMois(moisCle, long = false) {
    const [annee, mois] = moisCle.split('-').map(Number)
    return new Date(Date.UTC(annee, mois - 1, 1)).toLocaleDateString(locale, {
      month: long ? 'long' : 'short',
      year: long ? 'numeric' : '2-digit',
      timeZone: 'UTC',
    })
  }

  // Ramène chaque indicateur à un nombre comparable. Les montants par devise
  // sont projetés sur la devise principale : comparer deux listes n'aurait pas
  // de sens sur une carte.
  function valeurNumerique(kpi) {
    if (!kpi || kpi.valeur === null || kpi.valeur === undefined) return null
    if (kpi.unite !== 'montantParDevise') return kpi.valeur
    const principale = kpi.valeur.find((r) => r.devise === DEVISE_PRINCIPALE) ?? kpi.valeur[0]
    return principale ? principale.montant : null
  }

  function formater(kpi, valeur = valeurNumerique(kpi)) {
    if (valeur === null) return '—'
    switch (kpi.unite) {
      case 'pourcentage':
        return `${valeur} %`
      case 'jours':
        return t('coordinateur.stats.jours', { valeur })
      case 'note5':
        return `${valeur}/5`
      case 'montantParDevise': {
        const devise = kpi.valeur.find((r) => r.devise === DEVISE_PRINCIPALE)?.devise ?? kpi.valeur[0]?.devise ?? ''
        return `${valeur.toLocaleString(locale)} ${devise}`
      }
      default:
        return valeur.toLocaleString(locale)
    }
  }

  /**
   * Variation entre deux mois. En points pour un pourcentage (passer de 40 % à
   * 50 % est « +10 pts », pas « +25 % » — le second se lit mal), en pourcentage
   * relatif pour le reste.
   */
  function variation(kpi, actuel, precedent) {
    if (actuel === null || precedent === null) return null
    const ecart = Math.round((actuel - precedent) * 10) / 10
    if (kpi.unite === 'pourcentage') return { ecart, texte: `${ecart > 0 ? '+' : ''}${ecart} pts` }
    if (precedent === 0) return { ecart, texte: ecart > 0 ? `+${ecart}` : `${ecart}` }
    const relatif = Math.round((ecart / precedent) * 100)
    return { ecart, texte: `${relatif > 0 ? '+' : ''}${relatif} %` }
  }

  function tonalite(kpi, ecart) {
    if (ecart === 0) return 'neutre'
    const monte = ecart > 0
    const favorable = BAISSE_FAVORABLE.has(kpi.cle) ? !monte : monte
    return favorable ? 'bon' : 'mauvais'
  }

  const mois = donnees?.mois ?? []
  const courant = mois[mois.length - 1]
  const precedent = mois[mois.length - 2]
  const indicateurs = courant?.kpis ?? []

  const indexChoisi = cle ? indicateurs.findIndex((k) => k.cle === cle) : -1
  const kpiChoisi = indexChoisi >= 0 ? indicateurs[indexChoisi] : null

  // Une adresse qui ne correspond à aucun indicateur ramène à la grille plutôt
  // que d'afficher une page vide.
  //
  // Ce hook était déclaré plus bas, après les retours anticipés de chargement
  // et d'erreur : React comptait donc un hook de plus une fois les données
  // arrivées qu'au rendu précédent, levait « Rendered more hooks than during
  // the previous render » et l'écran restait blanc. Un hook ne vit jamais sous
  // un `return` conditionnel.
  useEffect(() => {
    if (cle && donnees && indexChoisi < 0) navigate(BASE, { replace: true })
  }, [cle, donnees, indexChoisi, navigate])

  if (chargement && !donnees) {
    return (
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 py-12 justify-center">
        <Loader2 className="w-5 h-5 animate-spin" /> {t('common.loading')}
      </div>
    )
  }

  if (erreur) {
    return (
      <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm font-medium rounded-2xl px-5 py-4">
        {erreur}
      </div>
    )
  }

  const outils = { libelleMois, formater, valeurNumerique, variation, tonalite, t }

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {kpiChoisi ? (
            <Link
              to={BASE}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> {t('coordinateur.stats.tousLesIndicateurs')}
            </Link>
          ) : null}
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary-600" />
            {kpiChoisi ? t(`coordinateur.stats.kpis.${kpiChoisi.cle}`) : t('coordinateur.stats.titre')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {courant && t('coordinateur.stats.moisEnCours', { mois: libelleMois(courant.mois, true) })}
          </p>
        </div>

        <div className="flex gap-2">
          {PERIODES.map((n) => (
            <button
              key={n}
              onClick={() => setNombreDeMois(n)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                nombreDeMois === n
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-white dark:bg-neutral-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-700'
              }`}
            >
              {t('coordinateur.stats.derniersMois', { count: n })}
            </button>
          ))}
        </div>
      </div>

      {kpiChoisi ? (
        <>
          {/* La carte choisie reste en tête : c'est le repère visuel entre la
              grille et le détail, et elle porte déjà le chiffre du mois. */}
          <div className="max-w-md">
            <CarteKpi kpi={kpiChoisi} precedent={precedent?.kpis[indexChoisi]} outils={outils} selectionnee />
          </div>
          <DetailKpi kpi={kpiChoisi} index={indexChoisi} mois={mois} outils={outils} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {indicateurs.map((kpi, index) => (
              <Link key={kpi.cle} to={`${BASE}/${kpi.cle}`} className="block">
                <CarteKpi kpi={kpi} precedent={precedent?.kpis[index]} outils={outils} rang={index} />
              </Link>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-6 leading-relaxed">
            {t('coordinateur.stats.avertissementCartes')}
          </p>
        </>
      )}
    </>
  )
}

function CarteKpi({ kpi, precedent, outils, rang = 0, selectionnee = false }) {
  const { formater, valeurNumerique, variation, tonalite, t } = outils
  const actuel = valeurNumerique(kpi)
  const avant = valeurNumerique(precedent)
  const delta = variation(kpi, actuel, avant)
  const ton = delta ? tonalite(kpi, delta.ecart) : 'neutre'
  const IconeTon = ICONE_TON[ton]

  return (
    <div
      className={`glass-card dark:bg-neutral-900 rounded-3xl p-5 flex flex-col gap-3 transition-all duration-300 group animate-fade-in-up ${
        selectionnee
          ? 'ring-2 ring-primary-500 shadow-xl'
          : 'hover:-translate-y-0.5 hover:shadow-xl dark:hover:shadow-black/40 cursor-pointer'
      }`}
      style={{ animationDelay: `${rang * 0.05}s` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t(`coordinateur.stats.kpis.${kpi.cle}`)}
        </span>
        {!selectionnee && (
          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-neutral-600 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors shrink-0" />
        )}
      </div>

      <div className="text-3xl font-display font-bold text-slate-900 dark:text-white tabular-nums">
        {formater(kpi)}
        {/* L'effectif fait partie de l'indicateur : une note moyenne sur trois
            avis n'est pas une satisfaction. */}
        {kpi.echantillon > 0 && kpi.unite === 'note5' && (
          <span className="text-sm font-semibold text-slate-400 dark:text-slate-500 ml-2">
            ({t('coordinateur.stats.avis', { count: kpi.echantillon })})
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs">
        {delta ? (
          <>
            <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold tabular-nums ${STYLE_TON[ton]}`}>
              <IconeTon className="w-3.5 h-3.5" /> {delta.texte}
            </span>
            <span className="text-slate-500 dark:text-slate-400">{t('coordinateur.stats.vsMoisPrecedent')}</span>
          </>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">{t('coordinateur.stats.pasDeReference')}</span>
        )}
      </div>
    </div>
  )
}

function DetailKpi({ kpi, index, mois, outils }) {
  const { libelleMois, formater, valeurNumerique, variation, tonalite, t } = outils
  const courant = mois[mois.length - 1]
  const precedent = mois[mois.length - 2]
  const actuel = valeurNumerique(kpi)
  const avant = valeurNumerique(precedent?.kpis[index])
  const delta = variation(kpi, actuel, avant)
  const ton = delta ? tonalite(kpi, delta.ecart) : 'neutre'
  const IconeTon = ICONE_TON[ton]

  // Historique : la hauteur de chaque barre est relative au maximum de la
  // série, pour que la forme se lise quel que soit l'ordre de grandeur.
  const serie = mois.map((m) => ({ mois: m.mois, valeur: valeurNumerique(m.kpis[index]) }))
  const maximum = Math.max(0, ...serie.map((p) => p.valeur ?? 0))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
      <section className="glass-card dark:bg-neutral-900 rounded-3xl p-6 flex flex-col gap-4 animate-fade-in-up">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('coordinateur.stats.comparaison')}
        </h3>

        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-slate-50 dark:bg-neutral-800/60 p-4">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {courant && libelleMois(courant.mois, true)} · {t('coordinateur.stats.enCours')}
            </div>
            <div className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {formater(kpi)}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-neutral-800/60 p-4">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {precedent ? libelleMois(precedent.mois, true) : '—'} · {t('coordinateur.stats.moisPrecedent')}
            </div>
            <div className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {precedent ? formater(kpi, avant) : '—'}
            </div>
          </div>
        </div>

        {delta ? (
          <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold tabular-nums self-start ${STYLE_TON[ton]}`}>
            <IconeTon className="w-4 h-4" />
            {delta.texte}
            <span className="font-medium opacity-80">{t('coordinateur.stats.vsMoisPrecedent')}</span>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('coordinateur.stats.pasDeReferenceDetail')}</p>
        )}

        {kpi.note && <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{kpi.note}</p>}

        {kpi.unite === 'montantParDevise' && kpi.valeur.length > 1 && (
          <ul className="text-sm text-slate-600 dark:text-slate-300 flex flex-col gap-1 border-t border-slate-100 dark:border-neutral-800 pt-3">
            {kpi.valeur.map((r) => (
              <li key={r.devise} className="flex justify-between">
                <span>{r.devise}</span>
                <span className="tabular-nums font-semibold">
                  {r.montant.toLocaleString()} · {r.dossiers} dossier(s)
                </span>
              </li>
            ))}
          </ul>
        )}

        {kpi.recusations > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('coordinateur.stats.recusations', { count: kpi.recusations })}
          </p>
        )}
      </section>

      <section className="glass-card dark:bg-neutral-900 rounded-3xl p-6 lg:col-span-2 animate-fade-in-up">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-6">
          {t('coordinateur.stats.historique', { count: mois.length })}
        </h3>

        {/* Barres en CSS : pas de bibliothèque pour neuf séries de douze points. */}
        <div className="flex items-end gap-1.5 h-48 border-b border-slate-200 dark:border-neutral-700 pb-px">
          {serie.map((point) => {
            const hauteur = point.valeur === null || maximum === 0 ? 0 : Math.max(4, (point.valeur / maximum) * 100)
            return (
              <div
                key={point.mois}
                className="flex-1 flex flex-col justify-end h-full"
                title={`${libelleMois(point.mois, true)} : ${point.valeur === null ? '—' : formater(kpi, point.valeur)}`}
              >
                <div
                  className={`w-full rounded-t-md transition-all ${
                    point.valeur === null
                      ? 'bg-slate-100 dark:bg-neutral-800'
                      : point.mois === courant?.mois
                        ? 'bg-primary-600 dark:bg-primary-400'
                        : 'bg-slate-300 dark:bg-neutral-600'
                  }`}
                  style={{ height: `${hauteur}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {serie.map((point) => (
            <div key={point.mois} className="flex-1 text-center text-[10px] text-slate-400 dark:text-slate-500 truncate">
              {libelleMois(point.mois)}
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-6 leading-relaxed">
          {t('coordinateur.stats.avertissementCartes')}
        </p>
      </section>
    </div>
  )
}
