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

  const questions = c?.quizz?.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('content.json : quizz.questions est vide');
  }
  for (const q of questions) {
    if (!q.id || !q.texte) throw new Error(`content.json : question sans id ou texte (${JSON.stringify(q)})`);
    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`content.json : question ${q.id} a moins de 2 options`);
    }
    exigerIdsUniques(q.options.map((o) => o.id), `question ${q.id}`);
    if (!q.options.some((o) => o.id === q.reponse)) {
      throw new Error(`content.json : question ${q.id} a une réponse ("${q.reponse}") qui ne correspond à aucune option`);
    }
  }
  exigerIdsUniques(questions.map((q) => q.id), 'quizz.questions');

  return c;
}

function exigerIdsUniques(ids, ou) {
  const vus = new Set();
  for (const id of ids) {
    if (vus.has(id)) throw new Error(`content.json : id dupliqué "${id}" dans ${ou}`);
    vus.add(id);
  }
}
