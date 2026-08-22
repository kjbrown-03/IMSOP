import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialisation avec la clé de .env.local
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

export async function matchCaseWithSpecialists(patientCase, specialists) {
  const prompt = `
Tu es le coordinateur médical de la plateforme IMSOP (International Medical Second Opinion Platform).
Ton rôle est d'analyser le dossier médical d'un patient et de trouver les 2 meilleurs médecins spécialistes parmi la base de données fournie.

=== DOSSIER DU PATIENT ===
- Motif de consultation : ${patientCase.motif}
- Symptômes : ${patientCase.symptomes}
- Antécédents médicaux : ${patientCase.antecedents}
- Traitement en cours : ${patientCase.traitement}

=== LISTE DES SPÉCIALISTES DISPONIBLES ===
${JSON.stringify(specialists, null, 2)}

=== MISSION ===
1. Analyse les symptômes du patient pour déterminer la spécialité médicale requise.
2. Cherche dans la liste des spécialistes ceux qui correspondent le mieux (spécialité, expertise, disponibilité).
3. Sélectionne les 2 meilleurs profils.
4. Tu DOIS ABSOLUMENT renvoyer un tableau JSON strictement avec cette structure, sans aucun autre texte (pas de markdown \`\`\`json etc) :
[
  {
    "id": 1, 
    "reason": "Explication détaillée de pourquoi ce médecin est le meilleur choix pour ce cas précis (en tenant compte de son expertise)."
  },
  {
    "id": 4, 
    "reason": "..."
  }
]
`

  try {
    const result = await model.generateContent(prompt)
    const responseText = result.response.text().trim()
    
    // Nettoyage au cas où Gemini renvoie du markdown
    let jsonStr = responseText
    if (jsonStr.startsWith('\`\`\`json')) {
      jsonStr = jsonStr.replace(/\`\`\`json\n?/, '').replace(/\`\`\`$/, '')
    } else if (jsonStr.startsWith('\`\`\`')) {
      jsonStr = jsonStr.replace(/\`\`\`\n?/, '').replace(/\`\`\`$/, '')
    }
    
    const matches = JSON.parse(jsonStr)
    return matches
  } catch (error) {
    console.error("Erreur lors de l'appel à Gemini:", error)
    // Fallback de sécurité si l'API échoue
    return [
      { id: 1, reason: "Sélectionné par défaut suite à une erreur réseau de l'algorithme." },
      { id: 2, reason: "Alternative proposée par défaut." }
    ]
  }
}
