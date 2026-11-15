import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, LocateFixed } from 'lucide-react'
import ListeDeroulante from '../ui/ListeDeroulante'
import { lieuLePlusProche, memoriserPosition } from '../../lib/lieuCameroun'

/**
 * Où se trouve la personne : pays de résidence, puis — au Cameroun — région,
 * département, arrondissement, chaque liste ne proposant que ce que contient
 * la précédente. Hors Cameroun, on garde la liste de villes : le découpage des
 * autres pays de la zone n'est pas encore saisi.
 *
 * `valeur` = { pays, ville, region, departement, arrondissement }. Changer un
 * niveau vide ceux d'en dessous : « Wouri » n'est pas dans la région du Centre,
 * et le serveur refuserait la recherche.
 *
 * Avec `geolocalisation`, un bouton demande la position au navigateur et
 * remplit les listes. La position ne quitte pas le téléphone : seul le nom de
 * l'arrondissement part avec la recherche (voir lieuLePlusProche).
 *
 * Avec `residence` (formulaire du patient), on sépare le pays où il VIT du pays
 * où il veut CONSULTER : un patient de Libreville peut chercher un praticien
 * au Cameroun. La destination ne propose que les pays où la mise en relation
 * est ouverte, puisque c'est là qu'on sait encaisser. `valeur.paysResidence`
 * porte la résidence, `valeur.pays` la destination.
 */
export default function ChoixLieu({ referentiels, valeur, onChange, classeChamp, classeLibelle, geolocalisation = false, requis = false, residence = false }) {
  const { t } = useTranslation()
  const [geo, setGeo] = useState({ etat: 'repos' })

  const regions = referentiels?.decoupage?.cm ?? []
  const pays = referentiels?.pays ?? []
  const auCameroun = valeur.pays === 'cm'

  const departements = useMemo(
    () => regions.find((r) => r.nom === valeur.region)?.departements ?? [],
    [regions, valeur.region],
  )
  const arrondissements = useMemo(
    () => departements.find((d) => d.nom === valeur.departement)?.arrondissements ?? [],
    [departements, valeur.departement],
  )
  const villes = pays.find((p) => p.code === valeur.pays)?.villes ?? []
  const destinations = pays.filter((p) => p.ouvert)
  // Qui vit au Cameroun cherche au Cameroun : inutile de lui demander deux fois.
  const demanderDestination = residence && valeur.paysResidence && valeur.paysResidence !== 'cm'

  const VIDE_CM = { region: '', departement: '', arrondissement: '' }

  function changer(champ, v) {
    if (champ === 'paysResidence') {
      // Résidence au Cameroun : la destination suit. Ailleurs, on garde la
      // destination déjà choisie, ou la première ouverte.
      const destination = v === 'cm' ? 'cm' : (destinations.some((p) => p.code === valeur.pays) ? valeur.pays : destinations[0]?.code || '')
      if (destination === valeur.pays) return onChange({ ...valeur, paysResidence: v })
      return onChange({ ...valeur, paysResidence: v, pays: destination, ville: '', ...VIDE_CM })
    }
    if (champ === 'pays') return onChange({ ...valeur, pays: v, ville: '', ...VIDE_CM })
    if (champ === 'region') return onChange({ ...valeur, region: v, departement: '', arrondissement: '' })
    if (champ === 'departement') return onChange({ ...valeur, departement: v, arrondissement: '' })
    onChange({ ...valeur, [champ]: v })
  }

  function localiser() {
    if (!navigator.geolocation) return setGeo({ etat: 'erreur', message: t('annuaire.lieu.geoIndisponible') })
    setGeo({ etat: 'cours' })
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const lieu = lieuLePlusProche(regions, coords.latitude, coords.longitude)
        if (!lieu) return setGeo({ etat: 'erreur', message: t('annuaire.lieu.geoHorsCameroun') })
        memoriserPosition(coords.latitude, coords.longitude)
        onChange({ ...valeur, ...(residence ? { paysResidence: 'cm' } : {}), pays: 'cm', ville: '', ...lieu })
        setGeo({ etat: 'ok' })
      },
      (err) => setGeo({
        etat: 'erreur',
        message: err.code === err.PERMISSION_DENIED ? t('annuaire.lieu.geoRefusee') : t('annuaire.lieu.geoEchec'),
      }),
      // La précision d'un arrondissement suffit : inutile d'attendre le GPS fin,
      // qui peut prendre une minute en intérieur.
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    )
  }

  const libelle = classeLibelle || 'text-sm font-semibold'
  const facultatif = (
    <span className="font-normal text-[var(--color-text-secondary)]"> ({t('annuaire.recherche.optionnel')})</span>
  )
  const commun = { classeChamp, videLabel: t('annuaire.lieu.aucun'), placeholder: t('annuaire.lieu.taper') }

  return (
    <div className="flex flex-col gap-4">
      {/* Une fois la position obtenue, le bloc disparaît : les listes remplies
          suffisent à le montrer, un message de plus n'apprendrait rien. */}
      {geolocalisation && regions.length > 0 && geo.etat !== 'ok' && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary)]/5 p-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={localiser}
            disabled={geo.etat === 'cours'}
            className="self-start inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] text-white px-5 py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-60"
          >
            {geo.etat === 'cours' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
            {t('annuaire.lieu.geoBouton')}
          </button>
          <p className="text-xs text-[var(--color-text-secondary)]">{t('annuaire.lieu.geoAide')}</p>
          {geo.etat === 'erreur' && <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{geo.message}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {residence ? (
          <>
            <div className="flex flex-col gap-2">
              <span className={libelle}>{t('annuaire.lieu.paysResidence')}</span>
              <ListeDeroulante
                {...commun}
                ariaLabel={t('annuaire.lieu.paysResidence')}
                value={valeur.paysResidence}
                onChange={(v) => changer('paysResidence', v)}
                options={pays.map((p) => ({ valeur: p.code, label: p.nom }))}
                disabled={!referentiels}
              />
            </div>
            {demanderDestination && (
              <div className="flex flex-col gap-2">
                <span className={libelle}>{t('annuaire.lieu.paysDestination')}</span>
                <ListeDeroulante
                  {...commun}
                  ariaLabel={t('annuaire.lieu.paysDestination')}
                  value={valeur.pays}
                  onChange={(v) => changer('pays', v)}
                  options={destinations.map((p) => ({ valeur: p.code, label: p.nom }))}
                />
                <span className="text-xs text-[var(--color-text-secondary)]">{t('annuaire.lieu.paysDestinationAide')}</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <span className={libelle}>{t('annuaire.lieu.paysExercice')}</span>
            <ListeDeroulante
              {...commun}
              ariaLabel={t('annuaire.lieu.paysExercice')}
              value={valeur.pays}
              onChange={(v) => changer('pays', v)}
              options={pays.map((p) => ({ valeur: p.code, label: p.nom }))}
              disabled={!referentiels}
            />
          </div>
        )}

        {auCameroun ? (
          <>
            <div className="flex flex-col gap-2">
              <span className={libelle}>{t('annuaire.lieu.region')}</span>
              <ListeDeroulante
                {...commun}
                ariaLabel={t('annuaire.lieu.region')}
                value={valeur.region}
                onChange={(v) => changer('region', v)}
                options={regions.map((r) => r.nom)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className={libelle}>{t('annuaire.lieu.departement')}</span>
              <ListeDeroulante
                {...commun}
                ariaLabel={t('annuaire.lieu.departement')}
                value={valeur.departement}
                onChange={(v) => changer('departement', v)}
                options={departements.map((d) => d.nom)}
                disabled={!valeur.region}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className={libelle}>{t('annuaire.lieu.arrondissement')}{!requis && facultatif}</span>
              <ListeDeroulante
                {...commun}
                ariaLabel={t('annuaire.lieu.arrondissement')}
                value={valeur.arrondissement}
                onChange={(v) => changer('arrondissement', v)}
                options={arrondissements.map((a) => a.nom)}
                disabled={!valeur.departement}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <span className={libelle}>{t('annuaire.recherche.ville')}{facultatif}</span>
            <ListeDeroulante
              {...commun}
              ariaLabel={t('annuaire.recherche.ville')}
              value={valeur.ville}
              onChange={(v) => changer('ville', v)}
              options={villes}
              disabled={!valeur.pays}
            />
          </div>
        )}
      </div>
    </div>
  )
}
