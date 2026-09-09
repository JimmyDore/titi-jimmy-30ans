/**
 * Correction locale : le front hash le choix du joueur et le compare au hash
 * de la bonne réponse fourni par l'API. Aucun aller-retour réseau, donc aucune
 * attente entre deux questions même si le wifi du jardin sature.
 *
 * `crypto.subtle` n'existe que sur une origine sécurisée. En HTTPS (production)
 * et sur localhost c'est bon ; en testant depuis un téléphone sur l'IP locale
 * en http, non — d'où le repli sur la correction serveur.
 */
export const correctionLocaleDispo = typeof crypto !== 'undefined' && !!crypto.subtle;

export async function hacher(questionId: string, optionId: string, sel: string): Promise<string> {
  const donnees = new TextEncoder().encode(`${questionId}:${optionId}:${sel}`);
  const digest = await crypto.subtle.digest('SHA-256', donnees);
  return [...new Uint8Array(digest)].map((o) => o.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** Retrouve la bonne option pour l'afficher quand le joueur s'est trompé. */
export async function bonneOption(
  questionId: string, options: { id: string }[], verif: string, sel: string,
): Promise<string | null> {
  for (const o of options) {
    if ((await hacher(questionId, o.id, sel)) === verif) return o.id;
  }
  return null;
}
