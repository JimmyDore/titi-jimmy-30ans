import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';

/**
 * Six tables, aucun ORM. La base vit dans un volume Docker nommé qui
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
    CREATE TABLE IF NOT EXISTS parties (
      id             TEXT PRIMARY KEY,
      auteur_id      TEXT NOT NULL,
      jeu_id         TEXT NOT NULL,
      -- Libellé au moment de la saisie, ou le nom tapé pour un jeu à nom libre
      -- (« Uno ») : une partie reste lisible même si le jeu quitte content.json.
      jeu_nom        TEXT NOT NULL,
      -- Ce qui sépare les classements : l'id du jeu, ou « societe:uno » pour un
      -- nom libre — gagner au Uno ne fait pas monter au classement du Skyjo.
      jeu_cle        TEXT NOT NULL,
      score_gagnants INTEGER,
      score_perdants INTEGER,
      saisie_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    -- Des noms, pas des joueurs : la tante qui joue au palet sans téléphone
    -- compte aussi. Normalisés comme les pseudos, pour que « kevin » et
    -- « Kevin » cumulent leurs victoires.
    CREATE TABLE IF NOT EXISTS participants (
      partie_id TEXT NOT NULL,
      nom       TEXT NOT NULL,
      nom_norm  TEXT NOT NULL,
      gagne     INTEGER NOT NULL,
      PRIMARY KEY (partie_id, nom_norm)
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
  const camps = participantsParPartie(db);
  const parties = db.prepare(`
    SELECT p.id, p.jeu_id, p.jeu_nom, p.score_gagnants, p.score_perdants, p.saisie_at, j.pseudo AS auteur
    FROM parties p LEFT JOIN joueurs j ON j.id = p.auteur_id
    ORDER BY p.saisie_at DESC, p.rowid DESC
  `).all().map((p) => ({ ...p, ...repartir(camps.get(p.id)) }));
  return { joueurs, tours, reponses, parties };
}

export function enregistrerPartie(db, auteurId, partie) {
  const id = randomUUID();
  db.exec('BEGIN');
  try {
    db.prepare(
      'INSERT INTO parties (id, auteur_id, jeu_id, jeu_nom, jeu_cle, score_gagnants, score_perdants) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, auteurId, partie.jeuId, partie.jeuNom, partie.jeuCle, partie.scoreGagnants, partie.scorePerdants);
    const ajouter = db.prepare('INSERT INTO participants (partie_id, nom, nom_norm, gagne) VALUES (?, ?, ?, ?)');
    for (const nom of partie.gagnants) ajouter.run(id, nom, normaliserPseudo(nom), 1);
    for (const nom of partie.perdants) ajouter.run(id, nom, normaliserPseudo(nom), 0);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return id;
}

/** Sans `auteurId`, c'est l'admin : il supprime la partie de n'importe qui. */
export function supprimerPartie(db, partieId, auteurId = null) {
  const res = auteurId
    ? db.prepare('DELETE FROM parties WHERE id = ? AND auteur_id = ?').run(partieId, auteurId)
    : db.prepare('DELETE FROM parties WHERE id = ?').run(partieId);
  if (res.changes === 0) return false;
  db.prepare('DELETE FROM participants WHERE partie_id = ?').run(partieId);
  return true;
}

/** Pseudos et noms déjà saisis : taper « kev » doit proposer « Kevin », pas créer un deuxième Kevin. */
export function nomsConnus(db) {
  return [...nomsAffiches(db).values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Les jeux à nom libre déjà joués, sous leur première orthographe. */
export function nomsJeuxLibres(db) {
  const vus = new Map();
  const lignes = db.prepare('SELECT jeu_id, jeu_nom, jeu_cle FROM parties WHERE jeu_cle <> jeu_id ORDER BY saisie_at, rowid').all();
  for (const p of lignes) {
    if (!vus.has(p.jeu_cle)) vus.set(p.jeu_cle, { jeuId: p.jeu_id, nom: p.jeu_nom });
  }
  return [...vus.values()];
}

/**
 * Un classement par jeu : les victoires d'abord, puis le moins de parties —
 * 3 sur 4 vaut mieux que 3 sur 10. En JS plutôt qu'en SQL parce qu'il faut
 * choisir un nom d'affichage par personne, et quelques centaines de parties
 * dans la soirée ne pèsent rien.
 */
export function classementJeux(db) {
  const affichage = nomsAffiches(db);
  const nomDe = (p) => affichage.get(p.nom_norm);
  const camps = participantsParPartie(db);
  const jeux = new Map();
  const parties = db.prepare(
    'SELECT id, jeu_id, jeu_nom, jeu_cle, score_gagnants, score_perdants, saisie_at FROM parties ORDER BY saisie_at, rowid',
  ).all();

  for (const partie of parties) {
    if (!jeux.has(partie.jeu_cle)) {
      jeux.set(partie.jeu_cle, {
        cle: partie.jeu_cle, jeuId: partie.jeu_id, nom: partie.jeu_nom, parties: 0, joueurs: new Map(), dernieres: [],
      });
    }
    const jeu = jeux.get(partie.jeu_cle);
    const siens = camps.get(partie.id) ?? [];
    jeu.parties += 1;
    for (const p of siens) {
      const ligne = jeu.joueurs.get(p.nom_norm) ?? { nom: nomDe(p), victoires: 0, parties: 0 };
      ligne.victoires += p.gagne;
      ligne.parties += 1;
      jeu.joueurs.set(p.nom_norm, ligne);
    }
    jeu.dernieres.push({
      id: partie.id,
      ...repartir(siens, nomDe),
      scoreGagnants: partie.score_gagnants,
      scorePerdants: partie.score_perdants,
      saisieAt: partie.saisie_at,
    });
  }

  return [...jeux.values()].map((jeu) => ({
    ...jeu,
    joueurs: [...jeu.joueurs.values()].sort(
      (a, b) => b.victoires - a.victoires || a.parties - b.parties || a.nom.localeCompare(b.nom, 'fr'),
    ),
    // Un fil des dernières parties, pas les archives de la soirée.
    dernieres: jeu.dernieres.slice(-5).reverse(),
  }));
}

/**
 * Le nom affiché d'une personne : son pseudo si elle en a un, sinon la première
 * orthographe saisie. Sans ça, le classement afficherait « kevin » ou « KEVIN »
 * selon qui a rempli la dernière partie.
 */
function nomsAffiches(db) {
  const noms = new Map();
  const saisis = db.prepare(`
    SELECT pa.nom, pa.nom_norm
    FROM participants pa JOIN parties p ON p.id = pa.partie_id
    ORDER BY p.saisie_at, p.rowid, pa.rowid
  `).all();
  for (const { nom, nom_norm } of saisis) {
    if (!noms.has(nom_norm)) noms.set(nom_norm, nom);
  }
  for (const j of db.prepare('SELECT pseudo, pseudo_norm FROM joueurs').all()) noms.set(j.pseudo_norm, j.pseudo);
  return noms;
}

/** Les participants de chaque partie, dans l'ordre où ils ont été saisis. */
function participantsParPartie(db) {
  const parPartie = new Map();
  for (const p of db.prepare('SELECT partie_id, nom, nom_norm, gagne FROM participants ORDER BY rowid').all()) {
    if (!parPartie.has(p.partie_id)) parPartie.set(p.partie_id, []);
    parPartie.get(p.partie_id).push(p);
  }
  return parPartie;
}

function repartir(participants = [], nomDe = (p) => p.nom) {
  return {
    gagnants: participants.filter((p) => p.gagne).map(nomDe),
    perdants: participants.filter((p) => !p.gagne).map(nomDe),
  };
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
    case 'jeux':
      db.exec('DELETE FROM participants; DELETE FROM parties;');
      return true;
    case 'joueurs':
    case 'tout':
      db.exec('DELETE FROM reponses; DELETE FROM tours; DELETE FROM participants; DELETE FROM parties; DELETE FROM joueurs;');
      return true;
    default:
      return false;
  }
}
