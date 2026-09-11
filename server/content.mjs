import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Tout le contenu éditable de la soirée tient dans un seul JSON, chargé au
 * démarrage. On le valide agressivement : une virgule oubliée par un humain
 * dans `content.json` doit faire échouer le conteneur au boot (donc le health
 * check de la CI, donc le déploiement), et pas produire un quizz à trous
 * découvert par 40 personnes le samedi soir.
 */
export function chargerContenu(chemin = process.env.CONTENT_PATH ?? join(HERE, '..', 'content.json')) {
  const brut = JSON.parse(readFileSync(chemin, 'utf8'));
  return validerContenu(brut);
}

export function validerContenu(c) {
  const segments = c?.roue?.segments;
  if (!Array.isArray(segments) || segments.length < 2) {
    throw new Error('content.json : roue.segments doit contenir au moins 2 segments');
  }
  for (const s of segments) {
    if (!s.id || !s.label) throw new Error(`content.json : segment sans id ou label (${JSON.stringify(s)})`);
    if (s.type !== 'defi' && s.type !== 'sauve') {
      throw new Error(`content.json : segment ${s.id} a un type invalide (attendu "defi" ou "sauve")`);
    }
    if (!Number.isFinite(s.poids) || s.poids <= 0) {
      throw new Error(`content.json : segment ${s.id} a un poids invalide`);
    }
  }
  exigerIdsUniques(segments.map((s) => s.id), 'roue.segments');

  const categories = c?.quizz?.categories;
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error('content.json : quizz.categories est vide');
  }
  for (const cat of categories) {
    if (!cat.id || !cat.label) throw new Error(`content.json : catégorie sans id ou label (${JSON.stringify(cat)})`);
    // `tirage: 0` est valide et volontaire : la catégorie garde ses questions
    // dans le fichier sans jamais sortir. C'est la façon de mettre un paquet
    // de côté pour plus tard sans le supprimer.
    if (!Number.isInteger(cat.tirage) || cat.tirage < 0) {
      throw new Error(`content.json : la catégorie ${cat.id} a un tirage invalide (attendu un entier positif ou zéro)`);
    }
  }
  exigerIdsUniques(categories.map((cat) => cat.id), 'quizz.categories');

  const questions = c?.quizz?.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('content.json : quizz.questions est vide');
  }
  const categoriesConnues = new Set(categories.map((cat) => cat.id));
  for (const q of questions) {
    if (!q.id || !q.texte) throw new Error(`content.json : question sans id ou texte (${JSON.stringify(q)})`);
    if (!categoriesConnues.has(q.categorie)) {
      throw new Error(
        `content.json : question ${q.id} a une catégorie inconnue ("${q.categorie}") — attendu l'un de : ${[...categoriesConnues].join(', ')}`,
      );
    }
    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`content.json : question ${q.id} a moins de 2 options`);
    }
    exigerIdsUniques(q.options.map((o) => o.id), `question ${q.id}`);
    // Une question `piege` est faite pour être perdue par tout le monde : sa
    // réponse ne doit désigner AUCUNE option. On le vérifie dans les deux sens,
    // sinon une faute de frappe sur `reponse` produirait silencieusement une
    // question invincible — exactement le bug que ce contrôle existe pour
    // attraper.
    const designe = q.options.some((o) => o.id === q.reponse);
    if (q.piege && designe) {
      throw new Error(
        `content.json : question ${q.id} est marquée "piege" mais sa réponse ("${q.reponse}") désigne une option — elle serait donc gagnable`,
      );
    }
    if (!q.piege && !designe) {
      throw new Error(`content.json : question ${q.id} a une réponse ("${q.reponse}") qui ne correspond à aucune option`);
    }
  }
  exigerIdsUniques(questions.map((q) => q.id), 'quizz.questions');

  // Une catégorie à court de questions n'est pas une erreur : le quizz
  // raccourcit d'autant, pour tout le monde de la même façon. Mais c'est
  // presque toujours un oubli, donc ça se voit dans les logs de démarrage.
  for (const cat of categories) {
    const dispo = questions.filter((q) => q.categorie === cat.id).length;
    if (dispo < cat.tirage) {
      console.warn(
        `content.json : la catégorie « ${cat.label} » ne compte que ${dispo} question(s) pour un tirage de ${cat.tirage} — le quizz sera plus court.`,
      );
    }
  }

  const jeux = c?.jeux;
  if (!Array.isArray(jeux) || jeux.length === 0) {
    throw new Error('content.json : jeux doit contenir au moins 1 jeu');
  }
  for (const j of jeux) {
    if (!j.id || !j.label || !j.emoji) throw new Error(`content.json : jeu sans id, label ou emoji (${JSON.stringify(j)})`);
    // `:` sépare l'id du nom dans la clé de classement des jeux à nom libre.
    if (j.id.includes(':')) throw new Error(`content.json : l'id du jeu ${j.id} ne doit pas contenir « : »`);
  }
  exigerIdsUniques(jeux.map((j) => j.id), 'jeux');

  return c;
}

function exigerIdsUniques(ids, ou) {
  const vus = new Set();
  for (const id of ids) {
    if (vus.has(id)) throw new Error(`content.json : id dupliqué "${id}" dans ${ou}`);
    vus.add(id);
  }
}
