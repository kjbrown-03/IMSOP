import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Pencil, X } from 'lucide-react'

/**
 * Liste déroulante qui se filtre à la frappe.
 *
 * Le `<select>` natif n'offre qu'une recherche par première lettre : sur les
 * vingt-cinq villes du Cameroun ou la trentaine de spécialités, on fait défiler
 * à l'aveugle. Ici le champ est une zone de saisie : on tape « yao », il reste
 * « Yaoundé ». La comparaison ignore les accents et la casse, sinon « Ngaoundere »
 * ne trouverait jamais « Ngaoundéré ».
 *
 * Avec `autreAutorise`, une dernière entrée « Autre » bascule le champ en
 * saisie libre : indispensable pour les spécialités, dont la liste ne peut pas
 * être exhaustive le jour où un candidat remplit le formulaire.
 */

const CHAMP =
  'w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 font-body-md text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all'

const sansAccent = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export default function ListeDeroulante({
  value,
  onChange,
  options,
  placeholder = '',
  required = false,
  disabled = false,
  autreAutorise = false,
  autreLabel = 'Autre — préciser',
  autreRetourLabel = 'Revenir à la liste',
  autrePlaceholder = '',
  videLabel = 'Aucun résultat',
  name,
}) {
  const listeId = useId()

  // Options normalisées : on accepte aussi bien ['Douala'] que [{ valeur, label }].
  const entrees = useMemo(
    () => (options || []).map((o) => (typeof o === 'string' ? { valeur: o, label: o } : o)),
    [options],
  )

  // Une valeur hors liste ne peut venir que d'une saisie libre : on rouvre le
  // champ dans l'état où le candidat l'a laissé (retour arrière du navigateur,
  // brouillon rechargé).
  const horsListe = Boolean(value) && !entrees.some((e) => e.valeur === value)
  const [libre, setLibre] = useState(autreAutorise && horsListe)

  const [ouvert, setOuvert] = useState(false)
  const [saisie, setSaisie] = useState('')
  const [surligne, setSurligne] = useState(0)

  const conteneur = useRef(null)
  const champLibre = useRef(null)

  const selection = entrees.find((e) => e.valeur === value)

  const filtrees = useMemo(() => {
    const q = sansAccent(saisie)
    if (!q) return entrees
    // Ce qui commence par la recherche d'abord : « Bafang » avant « Nkongsamba »
    // quand on tape « ba ».
    const debut = []
    const dedans = []
    for (const e of entrees) {
      const n = sansAccent(e.label)
      if (n.startsWith(q)) debut.push(e)
      else if (n.includes(q)) dedans.push(e)
    }
    return [...debut, ...dedans]
  }, [entrees, saisie])

  useEffect(() => setSurligne(0), [saisie, ouvert])

  // Clic à côté : on referme sans rien changer, la saisie en cours est
  // abandonnée — elle ne servait qu'à filtrer.
  useEffect(() => {
    if (!ouvert) return
    function auClic(e) {
      if (!conteneur.current?.contains(e.target)) {
        setOuvert(false)
        setSaisie('')
      }
    }
    document.addEventListener('mousedown', auClic)
    return () => document.removeEventListener('mousedown', auClic)
  }, [ouvert])

  function choisir(entree) {
    onChange(entree.valeur)
    setOuvert(false)
    setSaisie('')
  }

  function passerEnLibre() {
    setLibre(true)
    setOuvert(false)
    setSaisie('')
    onChange('')
    // Le champ n'existe pas encore au moment du clic.
    setTimeout(() => champLibre.current?.focus(), 0)
  }

  function revenirALaListe() {
    setLibre(false)
    onChange('')
  }

  function auClavier(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!ouvert) return setOuvert(true)
      const total = filtrees.length + (autreAutorise ? 1 : 0)
      if (!total) return
      setSurligne((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + total) % total)
      return
    }
    if (e.key === 'Enter' && ouvert) {
      e.preventDefault()
      if (surligne < filtrees.length) choisir(filtrees[surligne])
      else if (autreAutorise) passerEnLibre()
      return
    }
    if (e.key === 'Escape' && ouvert) {
      e.preventDefault()
      setOuvert(false)
      setSaisie('')
    }
  }

  // --- Saisie libre : le champ redevient un simple texte, avec un retour possible.
  if (libre) {
    return (
      <div className="flex flex-col gap-1.5">
        <input
          ref={champLibre}
          name={name}
          required={required}
          disabled={disabled}
          className={CHAMP}
          placeholder={autrePlaceholder || placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={revenirALaListe}
          className="self-start inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition-colors"
        >
          <X className="w-3 h-3" /> {autreRetourLabel}
        </button>
      </div>
    )
  }

  return (
    <div ref={conteneur} className="relative">
      {/* Pas de `required` natif ici : la zone de saisie visible se vide pendant
          qu'on filtre, et une doublure cachée ferait échouer la soumission sans
          message visible (le navigateur refuse de focaliser un champ masqué).
          C'est au formulaire de vérifier la valeur — voir `champsManquants`. */}
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={ouvert}
          aria-controls={listeId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          className={`${CHAMP} pr-10`}
          placeholder={selection ? selection.label : placeholder}
          value={ouvert ? saisie : selection?.label || ''}
          onChange={(e) => {
            setSaisie(e.target.value)
            setOuvert(true)
          }}
          onFocus={() => setOuvert(true)}
          onKeyDown={auClavier}
        />
        <ChevronDown
          className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none transition-transform ${ouvert ? 'rotate-180' : ''}`}
        />
      </div>

      {ouvert && (
        <ul
          id={listeId}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-outline-variant bg-surface-container shadow-lg py-1"
        >
          {filtrees.map((e, i) => (
            <li key={e.valeur}>
              <button
                type="button"
                role="option"
                aria-selected={e.valeur === value}
                onMouseEnter={() => setSurligne(i)}
                onClick={() => choisir(e)}
                className={`w-full text-left px-4 py-2.5 font-body-md text-body-md flex items-center justify-between gap-2 transition-colors ${
                  i === surligne ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface'
                }`}
              >
                <span>{e.label}</span>
                {e.valeur === value && <Check className="w-4 h-4 shrink-0" />}
              </button>
            </li>
          ))}

          {!filtrees.length && !autreAutorise && (
            <li className="px-4 py-2.5 font-body-md text-body-md text-on-surface-variant">{videLabel}</li>
          )}

          {autreAutorise && (
            <li className={filtrees.length ? 'border-t border-outline-variant mt-1 pt-1' : ''}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseEnter={() => setSurligne(filtrees.length)}
                onClick={passerEnLibre}
                className={`w-full text-left px-4 py-2.5 font-body-md text-body-md flex items-center gap-2 transition-colors ${
                  surligne === filtrees.length ? 'bg-secondary-container text-on-secondary-container' : 'text-primary'
                }`}
              >
                <Pencil className="w-4 h-4 shrink-0" /> {autreLabel}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
