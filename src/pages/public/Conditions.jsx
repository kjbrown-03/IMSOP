import { useTranslation } from 'react-i18next'
import PageLegale from './PageLegale'

/**
 * Conditions d'utilisation.
 *
 * Le point le plus important y est dit sans détour : IMSOP organise un second
 * avis, il ne pose pas de diagnostic et ne remplace pas le médecin traitant.
 * Un service qui laisserait croire l'inverse exposerait des patients.
 */
export default function Conditions() {
  const { t } = useTranslation()
  const l = (cle) => t(`legal.conditions.${cle}`, { returnObjects: true })

  return (
    <PageLegale
      titre={t('legal.conditions.titre')}
      chapeau={t('legal.conditions.chapeau')}
      majLe={t('legal.majDate')}
      sections={[
        { titre: t('legal.conditions.s1.titre'), blocs: [l('s1.p1'), l('s1.p2')] },
        { titre: t('legal.conditions.s2.titre'), blocs: [l('s2.p1'), l('s2.liste')] },
        { titre: t('legal.conditions.s3.titre'), blocs: [l('s3.p1'), l('s3.liste')] },
        { titre: t('legal.conditions.s4.titre'), blocs: [l('s4.p1'), l('s4.p2')] },
        { titre: t('legal.conditions.s5.titre'), blocs: [l('s5.p1'), l('s5.liste')] },
        { titre: t('legal.conditions.s6.titre'), blocs: [l('s6.p1')] },
      ]}
    />
  )
}
