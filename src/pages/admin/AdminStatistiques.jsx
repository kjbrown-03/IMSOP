import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, Table2 } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import StatBloc from '../../components/admin/StatBloc'
import BarresHorizontales from '../../components/admin/BarresHorizontales'
import { api } from '../../lib/api'

// Bornes de période proposées. `jours: null` = toute la vie de la plateforme.
const PERIODES = [
  { cle: 'tout', jours: null },
  { cle: 'douzeMois', jours: 365 },
  { cle: 'trenteJours', jours: 30 },
  { cle: 'septJours', jours: 7 },
]

function Section({ titre, sousTitre, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 sm:p-6 flex flex-col gap-4">
      <div>
        <h2 className="font-display font-bold text-slate-900 dark:text-white">{titre}</h2>
        {sousTitre && <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">{sousTitre}</p>}
      </div>
      {children}
    </section>
  )
}

function Vide({ children }) {
  return <p className="text-sm text-slate-400 dark:text-neutral-500 italic">{children}</p>
}

export default function AdminStatistiques() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const [periode, setPeriode] = useState('tout')
  const [donnees, setDonnees] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tableau, setTableau] = useState(false)

  const charger = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { jours } = PERIODES.find((p) => p.cle === periode)
      const params = {}
      if (jours) params.depuis = new Date(Date.now() - jours * 86400000).toISOString()
      const { data } = await api.get('/admin/statistiques', { params })
      setDonnees(data)
    } catch (err) {
      setError(err.response?.data?.message || t('admin.stats.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [periode, t])

  useEffect(() => {
    charger()
  }, [charger])

  const kpis = donnees?.kpis ?? []

  return (
    <AdminLayout>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {t('admin.stats.title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-neutral-400">{t('admin.stats.subtitle')}</p>
      </div>

      {/* Les filtres tiennent sur une seule ligne, au-dessus du contenu. */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODES.map((p) => (
          <button
            key={p.cle}
            onClick={() => setPeriode(p.cle)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              periode === p.cle
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700'
            }`}
          >
            {t(`admin.stats.periodes.${p.cle}`)}
          </button>
        ))}
        <button
          onClick={() => setTableau((v) => !v)}
          className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 transition-colors"
        >
          {tableau ? <BarChart3 className="w-4 h-4" /> : <Table2 className="w-4 h-4" />}
          {t(tableau ? 'admin.stats.vueGraphique' : 'admin.stats.vueTableau')}
        </button>
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-200 dark:border-neutral-700 p-8 text-center text-slate-500 dark:text-neutral-400">
          {t('admin.stats.loading')}
        </div>
      )}

      {error && !loading && (
        <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {donnees && !loading && (
        <>
          <Section titre={t('admin.stats.kpisTitle')} sousTitre={t('admin.stats.kpisSubtitle')}>
            {tableau ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-400 dark:text-neutral-500 border-b border-slate-200 dark:border-neutral-700">
                      <th className="py-2 pr-4 font-semibold">#</th>
                      <th className="py-2 pr-4 font-semibold">{t('admin.stats.indicateur')}</th>
                      <th className="py-2 font-semibold">{t('admin.stats.valeur')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.map((k) => (
                      <tr key={k.cle} className="border-b border-slate-100 dark:border-neutral-800 last:border-0">
                        <td className="py-2 pr-4 text-slate-400 dark:text-neutral-500 tabular-nums">{k.numero}</td>
                        <td className="py-2 pr-4 text-slate-700 dark:text-neutral-200">{t(`admin.stats.kpi.${k.cle}`)}</td>
                        <td className="py-2 text-slate-900 dark:text-white font-medium tabular-nums">
                          {!k.disponible
                            ? '—'
                            : Array.isArray(k.valeur)
                              ? k.valeur.map((v) => `${v.montant ?? '—'} ${v.devise}`).join(', ')
                              : k.valeur ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {kpis.map((k) => (
                  <StatBloc
                    key={k.cle}
                    label={t(`admin.stats.kpi.${k.cle}`)}
                    valeur={k.valeur}
                    unite={k.unite === 'pourcentage' ? '%' : k.unite === 'jours' ? t('admin.stats.jours') : null}
                    note={k.note}
                    approximation={k.approximation}
                    indisponible={!k.disponible}
                    raison={k.raison}
                  />
                ))}
              </div>
            )}
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section titre={t('admin.stats.activite')} sousTitre={t('admin.stats.specialitesDemandees')}>
              {donnees.activite.specialitesDemandees.length ? (
                <BarresHorizontales
                  donnees={donnees.activite.specialitesDemandees.map((s) => ({ libelle: s.libelle, valeur: s.nombre }))}
                />
              ) : (
                <Vide>{t('admin.stats.aucuneDonnee')}</Vide>
              )}
            </Section>

            <Section titre={t('admin.stats.paysPatients')}>
              {donnees.activite.paysPatients.length ? (
                <BarresHorizontales
                  donnees={donnees.activite.paysPatients.map((p) => ({ libelle: p.libelle.toUpperCase(), valeur: p.nombre }))}
                />
              ) : (
                <Vide>{t('admin.stats.aucuneDonnee')}</Vide>
              )}
            </Section>

            <Section titre={t('admin.stats.performance')} sousTitre={t('admin.stats.delaiParSpecialiste')}>
              {donnees.performance.delaiParSpecialiste.length ? (
                <BarresHorizontales
                  donnees={donnees.performance.delaiParSpecialiste.map((s) => ({
                    libelle: s.nom,
                    valeur: s.delaiMoyenJours,
                  }))}
                  formater={(v) => v?.toLocaleString(locale) ?? '—'}
                  suffixe={` ${t('admin.stats.jours')}`}
                />
              ) : (
                <Vide>{t('admin.stats.aucunRapportValide')}</Vide>
              )}
            </Section>

            <Section titre={t('admin.stats.finance')} sousTitre={t('admin.stats.revenusParSpecialite')}>
              {donnees.finance.revenusParSpecialite.length ? (
                <BarresHorizontales
                  donnees={donnees.finance.revenusParSpecialite.map((r) => ({
                    libelle: `${r.libelle} (${r.devise})`,
                    valeur: r.montant,
                  }))}
                />
              ) : (
                <Vide>{t('admin.stats.aucunPaiement')}</Vide>
              )}
            </Section>
          </div>

          <Section titre={t('admin.stats.qualite')}>
            <p className="text-sm text-slate-500 dark:text-neutral-400">
              {donnees.qualite.indisponible}
            </p>
          </Section>
        </>
      )}
    </AdminLayout>
  )
}
