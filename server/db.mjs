import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';

/**
 * Quatre tables, aucun ORM. La base vit dans un volume Docker nommé qui
 * survit aux déploiements : ce qui est écrit ici tient jusqu'au bouton reset.
 */
export function ouvrirDb(chemin = ':memory:') {
  const db = new DatabaseSync(chemin);
  db.exec(`
    CREATE TABLE IF NOT EXISTS joueurs (
      id            TEXT PRIMARY KEY,
      pseudo        TEXT NOT NULL,
      -- Normalisé (minuscules, espaces réduits) : c'est LUI qui porte
      -- l'unicité, sinon « Kevin » et « kevin  » sont deux joueurs et ton
      -- panel admin devient illisible.
      pseudo_norm   TEXT NOT NULL UNIQUE,
      token         TEXT NOT NULL,
      ordre_json    TEXT NOT NULL,
      quizz_fini_at TEXT,
      score         INTEGER,
      cree_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS reponses (
      joueur_id   TEXT NOT NULL,
      question_id TEXT NOT NULL,
      option_id   TEXT NOT NULL,
      repondu_at  TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (joueur_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS tours (
      id         TEXT PRIMARY KEY,
      joueur_id  TEXT NOT NULL,
      segment_id TEXT NOT NULL,
      type       TEXT NOT NULL,
      label      TEXT NOT NULL,
      releve     INTEGER NOT NULL DEFAULT 0,
      tire_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS config (
      cle    TEXT PRIMARY KEY,
      valeur TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reponses_joueur ON reponses(joueur_id);
    CREATE INDEX IF NOT EXISTS idx_tours_joueur ON tours(joueur_id);
  `);
  return db;
}

/**
 * Le sel de hachage des réponses est tiré une fois et conservé en base : le
 * repo est public (il ne peut donc pas y vivre) et un tirage à chaque
 * démarrage invaliderait les hash déjà envoyés aux joueurs en cours de partie
 * — après un simple redéploiement, tout le monde aurait « faux » partout.
 * C'est aussi pour ça que le reset n'y touche pas.
 */
export function selQuizz(db) {
  const ligne = db.prepare('SELECT valeur FROM config WHERE cle = ?').get('quizz_sel');
  if (ligne) return ligne.valeur;
  const sel = randomBytes(24).toString('hex');
  db.prepare('INSERT INTO config (cle, valeur) VALUES (?, ?)').run('quizz_sel', sel);
  return sel;
}

export function normaliserPseudo(pseudo) {
  return String(pseudo ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function nettoyerPseudo(pseudo) {
  return String(pseudo ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);
}

export function creerJoueur(db, pseudo, ordre) {
  const id = randomUUID();
  const token = randomBytes(24).toString('hex');
  db.prepare(
    'INSERT INTO joueurs (id, pseudo, pseudo_norm, token, ordre_json) VALUES (?, ?, ?, ?, ?)',
  ).run(id, pseudo, normaliserPseudo(pseudo), token, JSON.stringify(ordre));
  return { id, pseudo, token };
}

export function joueurParPseudo(db, pseudo) {
  return db.prepare('SELECT * FROM joueurs WHERE pseudo_norm = ?').get(normaliserPseudo(pseudo));
}

export function joueurParToken(db, token) {
  if (!token) return undefined;
  return db.prepare('SELECT * FROM joueurs WHERE token = ?').get(token);
}

export function reponsesDe(db, joueurId) {
  return db.prepare('SELECT question_id, option_id FROM reponses WHERE joueur_id = ?').all(joueurId);
}

export function enregistrerReponse(db, joueurId, questionId, optionId) {
  // La première réponse fait foi : un double-tap sur un bouton, ou un retour
  // arrière du navigateur, ne doit pas permettre de corriger un mauvais choix.
  db.prepare(
    'INSERT INTO reponses (joueur_id, question_id, option_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
  ).run(joueurId, questionId, optionId);
}

export function terminerQuizz(db, joueurId, score) {
  db.prepare(
    "UPDATE joueurs SET quizz_fini_at = datetime('now'), score = ? WHERE id = ? AND quizz_fini_at IS NULL",
  ).run(score, joueurId);
}

export function ajouterTour(db, joueurId, segment) {
  const id = randomUUID();
  db.prepare('INSERT INTO tours (id, joueur_id, segment_id, type, label) VALUES (?, ?, ?, ?, ?)').run(
    id, joueurId, segment.id, segment.type, segment.label,
  );
  return id;
}

export function marquerReleve(db, tourId, joueurId) {
  const res = db.prepare('UPDATE tours SET releve = 1 WHERE id = ? AND joueur_id = ?').run(tourId, joueurId);
  return res.changes > 0;
}

/**
 * Ex aequo départagés à l'ordre d'arrivée : à score égal, celui qui a fini le
 * premier passe devant. Le chrono aurait puni ceux qui interrompent leur quizz
 * pour resservir des bières — c'est-à-dire tout le monde.
 */
export function classementQuizz(db) {
  return db.prepare(`
    SELECT pseudo, score, quizz_fini_at
    FROM joueurs
    WHERE quizz_fini_at IS NOT NULL
    ORDER BY score DESC, quizz_fini_at ASC
  `).all();
}

/** On classe sur les défis relevés, pas sur les tours : sinon le gagnant est celui qui spamme le bouton. */
export function classementRoue(db) {
  return db.prepare(`
    SELECT j.pseudo,
           COUNT(t.id)                                              AS tours,
           SUM(CASE WHEN t.type = 'defi' AND t.releve = 1 THEN 1 ELSE 0 END) AS releves,
           MAX(t.tire_at)                                           AS dernier
    FROM joueurs j
    JOIN tours t ON t.joueur_id = j.id
    GROUP BY j.id
    HAVING tours > 0
    ORDER BY releves DESC, tours DESC, dernier ASC
  `).all();
}

export function toursDe(db, joueurId) {
  return db.prepare('SELECT id, segment_id, type, label, releve, tire_at FROM tours WHERE joueur_id = ? ORDER BY tire_at DESC').all(joueurId);
}

export function dumpAdmin(db) {
  const joueurs = db.prepare(`
    SELECT id, pseudo, score, quizz_fini_at, cree_at,
           (SELECT COUNT(*) FROM reponses r WHERE r.joueur_id = joueurs.id) AS repondues,
           (SELECT COUNT(*) FROM tours t WHERE t.joueur_id = joueurs.id) AS tours,
           (SELECT COUNT(*) FROM tours t WHERE t.joueur_id = joueurs.id AND t.releve = 1) AS releves
    FROM joueurs ORDER BY cree_at DESC
  `).all();
  const tours = db.prepare('SELECT id, joueur_id, segment_id, type, label, releve, tire_at FROM tours ORDER BY tire_at DESC').all();
  const reponses = db.prepare('SELECT joueur_id, question_id, option_id, repondu_at FROM reponses').all();
  return { joueurs, tours, reponses };
}

/**
 * Le sel (table `config`) survit à tous les resets : l'effacer invaliderait
 * les hash détenus par les onglets déjà ouverts.
 */
export function reinitialiser(db, portee) {
  switch (portee) {
    case 'roue':
      db.exec('DELETE FROM tours');
      return true;
    case 'quizz':
      db.exec('DELETE FROM reponses; UPDATE joueurs SET quizz_fini_at = NULL, score = NULL;');
      return true;
    case 'joueurs':
    case 'tout':
      db.exec('DELETE FROM reponses; DELETE FROM tours; DELETE FROM joueurs;');
      return true;
    default:
      return false;
  }
}
