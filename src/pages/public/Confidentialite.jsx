import { useTranslation } from 'react-i18next'
import PageLegale from './PageLegale'

/**
 * Politique de confidentialité.
 *
 * Exigée par Google pour publier l'application OAuth, mais surtout par le fait
 * qu'IMSOP traite des données de santé : un patient doit pouvoir lire, avant de
 * déposer un dossier, ce qu'on collecte, qui le lit et combien de temps on le
 * garde.
 *
 * Le contenu décrit ce que le code fait réellement — durées, destinataires,
 * hébergement. Les mentions entre crochets dans les traductions sont les seuls
 * éléments que le code ne peut pas connaître (raison sociale, adresse) : elles
 * doivent être remplies avant toute ouverture au public.
 */
export default function Confidentialite() {
  const { t } = useTranslation()
  const l = (cle) => t(`legal.confidentialite.${cle}`, { returnObjects: true })

  return (
    <PageLegale
      titre={t('legal.confidentialite.titre')}
      chapeau={t('legal.confidentialite.chapeau')}
      majLe={t('legal.majDate')}
      sections={[
        { titre: t('legal.confidentialite.s1.titre'), blocs: [l('s1.p1'), l('s1.liste')] },
        { titre: t('legal.confidentialite.s2.titre'), blocs: [l('s2.p1'), l('s2.liste')] },
        { titre: t('legal.confidentialite.s3.titre'), blocs: [l('s3.p1'), l('s3.liste'), l('s3.p2')] },
        { titre: t('legal.confidentialite.s4.titre'), blocs: [l('s4.p1'), l('s4.liste')] },
        { titre: t('legal.confidentialite.s5.titre'), blocs: [l('s5.p1'), l('s5.p2')] },
        { titre: t('legal.confidentialite.s6.titre'), blocs: [l('s6.p1'), l('s6.liste'), l('s6.p2')] },
        { titre: t('legal.confidentialite.s7.titre'), blocs: [l('s7.p1')] },
      ]}
    />
  )
}
