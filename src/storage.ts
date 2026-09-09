/**
 * L'identité tient dans le localStorage : un pseudo et un jeton secret. Le
 * jeton est la seule preuve d'identité — vider son navigateur ou passer en
 * navigation privée, c'est repartir de zéro sous un autre pseudo (« Kevin2 »),
 * assumé au moment de la conception.
 */
export type Joueur = { id: string; pseudo: string; token: string };

const CLE = 'titijimmy.joueur';

export function lireJoueur(): Joueur | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const j = JSON.parse(brut) as Joueur;
    return j?.token && j?.pseudo ? j : null;
  } catch {
    // Safari en navigation privée peut jeter sur localStorage : pas d'identité,
    // mais surtout pas d'écran blanc.
    return null;
  }
}

export function ecrireJoueur(joueur: Joueur) {
  try {
    localStorage.setItem(CLE, JSON.stringify(joueur));
  } catch { /* tant pis, la session ne survivra pas au rechargement */ }
}

export function effacerJoueur() {
  try { localStorage.removeItem(CLE); } catch { /* idem */ }
}
