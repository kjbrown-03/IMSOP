import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { nomPatient } from '../../lib/dossier'
import { api } from '../../lib/api'
import CoordinatorLayout from '../../components/layout/CoordinatorLayout'

export default function AffectationExpert() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { t } = useTranslation()
  const [dossier, setDossier] = useState(null)
  const [specialistes, setSpecialistes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [assigningId, setAssigningId] = useState(null)

  const URGENCE_LABEL = { NORMAL: null, PRIORITAIRE: t('coordinateur.assign.priority'), URGENT: t('coordinateur.assign.urgent') }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [{ data: dossierData }, { data: recommandations }] = await Promise.all([
          api.get(`/dossiers/${id}`),
          api.get(`/specialistes/recommandations/${id}`),
        ])
        if (cancelled) return
        setDossier(dossierData)
        setSpecialistes(recommandations)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || t('errors.caseNotFound'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, t])

  async function assign(specialisteId) {
    setAssigningId(specialisteId)
    try {
      await api.post(`/dossiers/${id}/assigner`, { specialisteId })
      navigate('/coordinateur/tableau-de-bord')
    } catch (err) {
      setError(err.response?.data?.message || t('coordinateur.assign.assignFailed'))
      setAssigningId(null)
    }
  }

  // Meme raison que RechercheExpertCoordinateur : l'en-tete maison ne proposait
  // qu'un retour au tableau de bord, sans acces au reste de la navigation.
  return (
    <CoordinatorLayout>
      <div className="w-full flex flex-col gap-stack-lg max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/coordinateur/tableau-de-bord')}
            aria-label={t('common.back')}
            className="shrink-0 text-primary hover:bg-surface-container-low transition-colors duration-200 p-2 rounded-full flex items-center justify-center"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-headline-md font-headline-md text-on-surface">{t('coordinateur.assign.title')}</h1>
        </div>

        <div className="flex flex-col gap-stack-lg w-full">
          {loading && (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-8 text-center text-on-surface-variant">
              {t('coordinateur.assign.loadingCase')}
            </div>
          )}

          {error && !loading && (
            <div className="bg-error-container text-on-error-container text-label-sm font-label-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {!loading && dossier && (
            <>
              <section className="bg-surface-container-lowest rounded-xl border border-outline-variant p-stack-md flex flex-col gap-stack-sm shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="font-headline-md text-headline-md text-primary">{t('coordinateur.assign.caseLabel')} #{dossier.reference}</h2>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                      {t('coordinateur.assign.patientLabel')} : {nomPatient(dossier, t)}
                    </p>
                  </div>
                  {URGENCE_LABEL[dossier.urgence] && (
                    <span className="bg-error-container text-on-error-container font-label-sm text-label-sm px-3 py-1 rounded-full uppercase tracking-wider font-bold">
                      {URGENCE_LABEL[dossier.urgence]}
                    </span>
                  )}
                </div>
                <div className="h-[1px] bg-outline-variant w-full my-3" />

                <div className="flex flex-col gap-4">
                  <div>
                    <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">{t('coordinateur.assign.specialiteLabel')}</p>
                    <p className="font-body-md text-body-md font-medium text-on-surface bg-surface-container-low p-3 rounded-lg border border-outline-variant/50">
                      {dossier.specialiteRequise}
                    </p>
                  </div>
                  <div>
                    <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">{t('coordinateur.assign.motifLabel')}</p>
                    <p className="font-body-md text-body-md font-medium text-on-surface bg-surface-container-low p-3 rounded-lg border border-outline-variant/50">
                      {dossier.motif}
                    </p>
                  </div>
                  {dossier.symptomes && (
                    <div>
                      <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">{t('coordinateur.assign.symptomsLabel')}</p>
                      <p className="font-body-md text-body-md text-on-surface bg-surface-container-low p-3 rounded-lg border border-outline-variant/50 leading-relaxed">
                        {dossier.symptomes}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section className="flex flex-col gap-stack-md pb-12">
                <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">medical_services</span> {t('coordinateur.assign.recommendedTitle')}
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant -mt-2">
                  {t('coordinateur.assign.recommendedSub')}
                </p>

                {specialistes.length === 0 ? (
                  <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-8 text-center text-on-surface-variant">
                    {t('coordinateur.assign.noneAvailable')}
                  </div>
                ) : (
                  <div className="flex flex-col gap-stack-md">
                    {specialistes.map((s) => (
                      <div
                        key={s.id}
                        className="bg-surface-container-lowest rounded-xl border-2 border-primary/20 p-stack-md flex flex-col gap-4 relative overflow-hidden group shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex flex-col md:flex-row gap-stack-md items-start md:items-center">
                          <div className="w-16 h-16 rounded-full bg-surface-container-high border-2 border-surface-container-high shrink-0 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[32px] text-outline">person</span>
                          </div>
                          <div className="flex flex-col flex-grow">
                            <h4 className="font-headline-md text-headline-md text-on-surface">{s.user.fullName}</h4>
                            <p className="font-body-md text-body-md font-medium text-primary">{s.specialite}</p>
                            <div className="flex items-center gap-4 mt-2">
                              {s.pays && (
                                <span className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                                  <span className="material-symbols-outlined text-[16px]">location_on</span> {s.pays}
                                </span>
                              )}
                              {s.langues && (
                                <span className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                                  <span className="material-symbols-outlined text-[16px]">language</span> {s.langues}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => assign(s.id)}
                            disabled={assigningId === s.id}
                            className="w-full md:w-auto bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-full hover:bg-primary-container hover:text-on-primary-container transition-colors duration-200 shrink-0 shadow-sm disabled:opacity-60"
                          >
                            {assigningId === s.id ? t('coordinateur.assign.assigning') : t('coordinateur.assign.assignThis')}
                          </button>
                        </div>
                        {s.bio && (
                          <div className="bg-primary/5 rounded-lg p-4 border border-primary/10 mt-2">
                            <p className="font-body-md text-body-md text-on-surface leading-relaxed">{s.bio}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </CoordinatorLayout>
  )
}
