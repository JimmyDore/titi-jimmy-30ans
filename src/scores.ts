import type { ClassementJeu } from './api'

/**
 * Même nettoyage que le serveur (`nettoyerPseudo` / `normaliserPseudo`) : le
 * front doit refuser « Kevin » contre « kevin » avant l'envoi, pas après.
 */
export function nettoyerNom(nom: string) {
  return nom.trim().replace(/\s+/g, ' ').slice(0, 24)
}

export function normaliserNom(nom: string) {
  return nom.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Sans casse ni accents, pour la recherche seulement : taper « bebert » doit trouver « Bébert ». */
function plier(texte: string) {
  return normaliserNom(texte).normalize('NFD').replace(/\p{M}/gu, '')
}

/** Les noms qui contiennent la saisie, ceux qui commencent par elle en premier. */
export function suggestions(noms: string[], saisie: string, exclus: string[], max = 5) {
  const cherche = plier(saisie)
  if (!cherche) return []
  const pris = new Set(exclus.map(normaliserNom))
  const trouves = noms.filter((nom) => !pris.has(normaliserNom(nom)) && plier(nom).includes(cherche))
  const debut = trouves.filter((nom) => plier(nom).startsWith(cherche))
  const milieu = trouves.filter((nom) => !plier(nom).startsWith(cherche))
  return [...debut, ...milieu].slice(0, max)
}

/**
 * Ajoute un nom à un camp. Un doublon dans le même camp est ignoré en silence
 * (double tap) ; dans le camp d'en face, c'est une erreur à montrer.
 */
export function ajouterNom(camp: string[], autreCamp: string[], saisie: string): { camp: string[]; erreur: string | null } {
  const nom = nettoyerNom(saisie)
  if (nom.length < 2) return { camp, erreur: null }
  const norme = normaliserNom(nom)
  if (camp.some((n) => normaliserNom(n) === norme)) return { camp, erreur: null }
  if (autreCamp.some((n) => normaliserNom(n) === norme)) {
    return { camp, erreur: `${nom} est déjà de l'autre côté.` }
  }
  return { camp: [...camp, nom], erreur: null }
}

/** La clé de classement que le serveur calculera pour cette partie. */
export function cleDuJeu(jeu: { id: string; nomLibre: boolean }, nomJeu: string) {
  return jeu.nomLibre ? `${jeu.id}:${normaliserNom(nettoyerNom(nomJeu))}` : jeu.id
}

/**
 * Tous les jeux additionnés. Calculé ici plutôt que par l'API : le serveur
 * envoie déjà chaque classement, et une personne porte le même nom affiché
 * d'un jeu à l'autre, donc on peut cumuler par nom.
 */
export function classementGlobal(jeux: ClassementJeu[]): ClassementJeu {
  const parNom = new Map<string, { nom: string; victoires: number; parties: number }>()
  for (const jeu of jeux) {
    for (const ligne of jeu.joueurs) {
      const cumul = parNom.get(ligne.nom) ?? { nom: ligne.nom, victoires: 0, parties: 0 }
      cumul.victoires += ligne.victoires
      cumul.parties += ligne.parties
      parNom.set(ligne.nom, cumul)
    }
  }
  return {
    cle: 'global',
    jeuId: 'global',
    nom: 'Global',
    emoji: '🏅',
    parties: jeux.reduce((total, jeu) => total + jeu.parties, 0),
    // Même règle que chaque jeu : les victoires, puis le moins de parties.
    joueurs: [...parNom.values()].sort(
      (a, b) => b.victoires - a.victoires || a.parties - b.parties || a.nom.localeCompare(b.nom, 'fr'),
    ),
    // Chaque jeu envoie ses 5 dernières parties : les 5 dernières tous jeux
    // confondus sont forcément dans le lot.
    dernieres: jeux
      .flatMap((jeu) => jeu.dernieres.map((d) => ({ ...d, emoji: jeu.emoji })))
      .sort((a, b) => b.saisieAt.localeCompare(a.saisieAt))
      .slice(0, 5),
  }
}
