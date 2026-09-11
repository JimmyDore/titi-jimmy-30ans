import { createHash } from 'node:crypto';

/** Fisher-Yates sur une copie : l'appelant garde son tableau intact. */
export function melanger(tableau, rng = Math.random) {
  const copie = [...tableau];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

/** Les questions d'une catégorie, dans l'ordre du fichier. */
export function vivier(contenu, categorieId) {
  return contenu.quizz.questions.filter((q) => q.categorie === categorieId);
}

/**
 * Chaque joueur reçoit son propre questionnaire : `tirage` questions piochées
 * dans chaque catégorie, puis le tout remélangé. Deux personnes assises côte à
 * côte n'ont donc pas les mêmes questions, mais elles en ont le même nombre et
 * la même répartition — le classement reste comparable.
 *
 * L'ordre est tiré une fois par joueur puis figé en base. Le recalculer à
 * chaque requête suffirait à casser la reprise : quelqu'un qui rafraîchit à la
 * question 12 retomberait sur un questionnaire réordonné, avec 11 réponses
 * rattachées à des questions qu'il n'a plus en face de lui.
 */
export function tirerOrdre(contenu, rng = Math.random) {
  const choisies = contenu.quizz.categories.flatMap((cat) =>
    melanger(vivier(contenu, cat.id), rng).slice(0, cat.tirage),
  );
  return {
    questions: melanger(choisies, rng).map((q) => ({
      id: q.id,
      options: melanger(q.options, rng).map((o) => o.id),
    })),
  };
}

/**
 * Le dénominateur du score (« 13 / 16 »). Il ne dépend pas de la taille du
 * vivier : ajouter dix questions de culture gé ne rallonge pas le quizz, ça le
 * diversifie. Une catégorie trop maigre pour honorer son `tirage` rend
 * simplement moins de questions — le quizz raccourcit, mais pour tout le monde
 * pareil.
 */
export function tailleQuizz(contenu) {
  return contenu.quizz.categories.reduce(
    (somme, cat) => somme + Math.min(cat.tirage, vivier(contenu, cat.id).length),
    0,
  );
}

/**
 * Le front corrige en local (0 ms, et ça continue de marcher si le wifi du
 * jardin tousse) en comparant le hash de son choix à celui de la bonne
 * réponse. Le sel vit en base, jamais dans le repo — sans lui, les hash d'un
 * repo public seraient calculables hors ligne.
 *
 * Ça reste de l'obfuscation, pas de la sécurité : avec le sel, un curieux peut
 * hasher les 4 options d'une question et trouver la bonne. C'est assumé — le
 * score du classement, lui, est recalculé côté serveur (`scorer`).
 */
export function hachage(questionId, optionId, sel) {
  return createHash('sha256').update(`${questionId}:${optionId}:${sel}`).digest('hex').slice(0, 32);
}

export function scorer(contenu, reponses) {
  const bonnes = new Map(contenu.quizz.questions.map((q) => [q.id, q.reponse]));
  let score = 0;
  for (const r of reponses) {
    if (bonnes.get(r.question_id) === r.option_id) score++;
  }
  return score;
}

/** Tirage pondéré : `poids` dans content.json permet de charger la roue sans toucher au code. */
export function tirerSegment(segments, rng = Math.random) {
  const total = segments.reduce((somme, s) => somme + s.poids, 0);
  let curseur = rng() * total;
  for (const s of segments) {
    curseur -= s.poids;
    if (curseur < 0) return s;
  }
  return segments[segments.length - 1];
}
