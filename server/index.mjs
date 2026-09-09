import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { chargerContenu } from './content.mjs';
import { hachage, scorer, tirerOrdre, tirerSegment } from './quizz.mjs';
import {
  ajouterTour,
  classementQuizz,
  classementRoue,
  creerJoueur,
  dumpAdmin,
  enregistrerReponse,
  joueurParPseudo,
  joueurParToken,
  marquerReleve,
  nettoyerPseudo,
  ouvrirDb,
  reinitialiser,
  reponsesDe,
  selQuizz,
  terminerQuizz,
  toursDe,
} from './db.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DB_PATH ?? './data/titijimmy.db';
// Jamais de valeur par défaut : le repo est public. Sans ADMIN_CODE, le
// panneau reste fermé (503) plutôt que de s'ouvrir sur un code devinable.
const CODE_ADMIN = process.env.ADMIN_CODE ?? '';

/**
 * API des 30 ans. Aucune dépendance npm : node:http + node:sqlite.
 * `rng` est injectable pour que les tests ne dépendent pas du hasard.
 */
export function creerApp(db, contenu, deps = {}) {
  const rng = deps.rng ?? Math.random;
  const codeAdmin = deps.codeAdmin ?? CODE_ADMIN;
  const sel = selQuizz(db);

  return createServer(async (req, res) => {
    try {
      // Base fixe, et surtout pas l'en-tête `Host` : un `Host` malformé ferait
      // lever `new URL` et tuerait le process — donc la soirée de tout le monde.
      const chemin = new URL(req.url ?? '/', 'http://titijimmy.local').pathname;
      const seg = chemin.split('/').filter(Boolean);
      const methode = req.method ?? 'GET';

      if (seg[0] !== 'api') return json(res, 404, { erreur: 'inconnu' });
      const route = seg.slice(1);

      if (route[0] === 'health') return json(res, 200, { ok: true, questions: contenu.quizz.questions.length });

      // --- Joueurs ---------------------------------------------------------
      if (route[0] === 'joueurs' && route.length === 1 && methode === 'POST') {
        const corps = await lireJson(req);
        const pseudo = nettoyerPseudo(corps.pseudo);
        if (pseudo.length < 2) return json(res, 400, { erreur: 'pseudo_court' });
        if (joueurParPseudo(db, pseudo)) return json(res, 409, { erreur: 'pseudo_pris' });
        const joueur = creerJoueur(db, pseudo, tirerOrdre(contenu, rng));
        return json(res, 201, joueur);
      }

      if (route[0] === 'joueurs' && route[1] === 'moi' && methode === 'GET') {
        const joueur = joueurParToken(db, bearer(req));
        if (!joueur) return json(res, 401, { erreur: 'inconnu' });
        return json(res, 200, { id: joueur.id, pseudo: joueur.pseudo });
      }

      // --- Quizz -----------------------------------------------------------
      if (route[0] === 'quizz' && route.length === 1 && methode === 'GET') {
        const joueur = joueurParToken(db, bearer(req));
        if (!joueur) return json(res, 401, { erreur: 'inconnu' });
        return json(res, 200, etatQuizz(db, contenu, sel, joueur));
      }

      if (route[0] === 'quizz' && route[1] === 'reponses' && methode === 'POST') {
        const joueur = joueurParToken(db, bearer(req));
        if (!joueur) return json(res, 401, { erreur: 'inconnu' });
        if (joueur.quizz_fini_at) return json(res, 409, { erreur: 'deja_joue' });
        const { questionId, optionId } = await lireJson(req);
        const question = contenu.quizz.questions.find((q) => q.id === questionId);
        if (!question) return json(res, 400, { erreur: 'question_inconnue' });
        if (!question.options.some((o) => o.id === optionId)) return json(res, 400, { erreur: 'option_inconnue' });
        enregistrerReponse(db, joueur.id, questionId, optionId);
        return json(res, 200, {
          juste: question.reponse === optionId,
          // L'explication ne part qu'ici, jamais dans la liste des questions :
          // elle nomme la bonne réponse.
          explication: question.explication ?? null,
          repondues: reponsesDe(db, joueur.id).length,
        });
      }

      if (route[0] === 'quizz' && route[1] === 'fin' && methode === 'POST') {
        const joueur = joueurParToken(db, bearer(req));
        if (!joueur) return json(res, 401, { erreur: 'inconnu' });
        // Le score est recalculé ici à partir des réponses stockées : le front
        // corrige en local pour la vitesse, mais ne décide jamais du classement.
        const score = scorer(contenu, reponsesDe(db, joueur.id));
        terminerQuizz(db, joueur.id, score);
        const frais = joueurParToken(db, joueur.token);
        return json(res, 200, { score: frais.score, total: contenu.quizz.questions.length });
      }

      // --- Roue ------------------------------------------------------------
      if (route[0] === 'roue' && route.length === 1 && methode === 'GET') {
        return json(res, 200, {
          segments: contenu.roue.segments.map((s) => ({ id: s.id, label: s.label, emoji: s.emoji, type: s.type })),
        });
      }

      if (route[0] === 'roue' && route[1] === 'tours' && route.length === 2 && methode === 'POST') {
        const joueur = joueurParToken(db, bearer(req));
        if (!joueur) return json(res, 401, { erreur: 'inconnu' });
        // Le tirage est fait ici, pas dans le navigateur : le front se contente
        // d'animer la roue jusqu'au segment que le serveur a déjà enregistré.
        const segment = tirerSegment(contenu.roue.segments, rng);
        const id = ajouterTour(db, joueur.id, segment);
        return json(res, 201, {
          id,
          index: contenu.roue.segments.findIndex((s) => s.id === segment.id),
          segmentId: segment.id,
          label: segment.label,
          emoji: segment.emoji,
          consigne: segment.consigne,
          type: segment.type,
        });
      }

      if (route[0] === 'roue' && route[1] === 'tours' && route[3] === 'releve' && methode === 'POST') {
        const joueur = joueurParToken(db, bearer(req));
        if (!joueur) return json(res, 401, { erreur: 'inconnu' });
        if (!marquerReleve(db, route[2], joueur.id)) return json(res, 404, { erreur: 'tour_inconnu' });
        return json(res, 200, { ok: true });
      }

      if (route[0] === 'roue' && route[1] === 'mes-tours' && methode === 'GET') {
        const joueur = joueurParToken(db, bearer(req));
        if (!joueur) return json(res, 401, { erreur: 'inconnu' });
        return json(res, 200, { tours: toursDe(db, joueur.id) });
      }

      // --- Classements -----------------------------------------------------
      if (route[0] === 'classements' && methode === 'GET') {
        return json(res, 200, {
          quizz: classementQuizz(db),
          roue: classementRoue(db),
          total: contenu.quizz.questions.length,
        });
      }

      // --- Admin -----------------------------------------------------------
      if (route[0] === 'admin') {
        if (!codeAdmin) return json(res, 503, { erreur: 'admin_non_configure' });
        if (route[1] === 'verif' && methode === 'POST') {
          const { code } = await lireJson(req);
          const ok = String(code) === codeAdmin;
          return json(res, ok ? 200 : 401, { ok });
        }
        if (req.headers['x-admin-code'] !== codeAdmin) return json(res, 401, { erreur: 'code' });
        if (route[1] === 'donnees' && methode === 'GET') {
          return json(res, 200, { ...dumpAdmin(db), contenu });
        }
        if (route[1] === 'reset' && methode === 'POST') {
          const { portee } = await lireJson(req);
          if (!reinitialiser(db, portee)) return json(res, 400, { erreur: 'portee_inconnue' });
          return json(res, 200, { ok: true, portee });
        }
      }

      return json(res, 404, { erreur: 'inconnu' });
    } catch (err) {
      console.error(err);
      return json(res, 500, { erreur: 'serveur' });
    }
  });
}

/**
 * Les questions partent SANS leur bonne réponse : seul le hash permet au front
 * de corriger en local. Les réponses déjà données sont renvoyées telles quelles
 * pour que quelqu'un qui a fermé son onglet à la question 12 la retrouve.
 */
function etatQuizz(db, contenu, sel, joueur) {
  const ordre = JSON.parse(joueur.ordre_json);
  const parId = new Map(contenu.quizz.questions.map((q) => [q.id, q]));
  const questions = ordre.questions
    // Une question retirée de content.json entre-temps disparaît proprement du
    // questionnaire d'un joueur déjà créé, au lieu de faire planter la page.
    .filter((o) => parId.has(o.id))
    .map((o) => {
      const q = parId.get(o.id);
      const optionsParId = new Map(q.options.map((opt) => [opt.id, opt]));
      return {
        id: q.id,
        type: q.type,
        texte: q.texte,
        options: o.options.filter((id) => optionsParId.has(id)).map((id) => ({ id, label: optionsParId.get(id).label })),
        verif: hachage(q.id, q.reponse, sel),
      };
    });
  return {
    sel,
    questions,
    reponses: reponsesDe(db, joueur.id).map((r) => ({ questionId: r.question_id, optionId: r.option_id })),
    fini: Boolean(joueur.quizz_fini_at),
    score: joueur.score,
    total: contenu.quizz.questions.length,
  };
}

function bearer(req) {
  const brut = req.headers.authorization ?? '';
  return brut.startsWith('Bearer ') ? brut.slice(7) : '';
}

function json(res, code, corps) {
  const charge = JSON.stringify(corps);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(charge);
}

async function lireJson(req) {
  const morceaux = [];
  for await (const m of req) {
    morceaux.push(m);
    // Personne n'envoie 100 ko pour un pseudo : au-delà, c'est quelqu'un qui joue.
    if (morceaux.reduce((n, c) => n + c.length, 0) > 100_000) throw new Error('corps trop gros');
  }
  if (morceaux.length === 0) return {};
  return JSON.parse(Buffer.concat(morceaux).toString('utf8'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const contenu = chargerContenu();
  if (!CODE_ADMIN) {
    // Mieux vaut un déploiement rouge tout de suite qu'un panneau admin
    // inaccessible découvert samedi soir.
    console.error('ADMIN_CODE absent : le panneau admin serait injoignable. Arrêt.');
    process.exit(1);
  }
  // En local la base vit dans ./data (gitignoré) ; en production c'est /data,
  // le volume Docker. Dans les deux cas le dossier peut ne pas exister encore.
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = ouvrirDb(DB_PATH);
  creerApp(db, contenu).listen(PORT, () => {
    console.log(`API des 30 ans sur :${PORT} (${contenu.quizz.questions.length} questions, ${contenu.roue.segments.length} segments)`);
  });
}
