import { useTranslation } from 'react-i18next'
import PageLegale from './PageLegale'

/**
 * Mentions légales : qui édite le service, qui l'héberge, comment le joindre.
 *
 * Les éléments d'identité (raison sociale, adresse, responsable de publication)
 * ne peuvent pas être devinés depuis le code : ils apparaissent entre crochets
 * dans les traductions tant qu'ils n'ont pas été renseignés.
 */
export default function MentionsLegales() {
  const { t } = useTranslation()
  const l = (cle) => t(`legal.mentions.${cle}`, { returnObjects: true })

  return (
    <PageLegale
      titre={t('legal.mentions.titre')}
      chapeau={t('legal.mentions.chapeau')}
      majLe={t('legal.majDate')}
      sections={[
        { titre: t('legal.mentions.s1.titre'), blocs: [l('s1.liste')] },
        { titre: t('legal.mentions.s2.titre'), blocs: [l('s2.p1'), l('s2.liste')] },
        { titre: t('legal.mentions.s3.titre'), blocs: [l('s3.p1')] },
        { titre: t('legal.mentions.s4.titre'), blocs: [l('s4.p1')] },
      ]}
    />
  )
}
