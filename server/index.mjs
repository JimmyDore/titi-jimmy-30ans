import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { chargerContenu } from './content.mjs';
import { hachage, scorer, tailleQuizz, tirerOrdre, tirerSegment } from './quizz.mjs';
import {
  ajouterTour,
  classementJeux,
  classementQuizz,
  classementRoue,
  creerJoueur,
  dumpAdmin,
  enregistrerPartie,
  enregistrerReponse,
  joueurParPseudo,
  joueurParToken,
  marquerReleve,
  nettoyerPseudo,
  nomsConnus,
  nomsJeuxLibres,
  normaliserPseudo,
  ouvrirDb,
  reinitialiser,
  reponsesDe,
  selQuizz,
  supprimerPartie,
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
        return json(res, 200, { score: frais.score, total: tailleQuizz(contenu) });
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

      // --- Scores des jeux -------------------------------------------------
      if (route[0] === 'jeux' && route.length === 1 && methode === 'GET') {
        return json(res, 200, {
          jeux: contenu.jeux.map((j) => ({ id: j.id, label: j.label, emoji: j.emoji, nomLibre: Boolean(j.nomLibre) })),
          noms: nomsConnus(db),
          nomsJeux: nomsJeuxLibres(db),
        });
      }

      if (route[0] === 'parties' && route.length === 1 && methode === 'POST') {
        const joueur = joueurParToken(db, bearer(req));
        if (!joueur) return json(res, 401, { erreur: 'inconnu' });
        const partie = lirePartie(contenu, await lireJson(req));
        if (partie.erreur) return json(res, 400, { erreur: partie.erreur });
        return json(res, 201, { id: enregistrerPartie(db, joueur.id, partie) });
      }

      if (route[0] === 'parties' && route.length === 2 && methode === 'DELETE') {
        const joueur = joueurParToken(db, bearer(req));
        if (!joueur) return json(res, 401, { erreur: 'inconnu' });
        // Chacun n'annule que ses propres saisies : pour le reste, il y a l'admin.
        if (!supprimerPartie(db, route[1], joueur.id)) return json(res, 404, { erreur: 'partie_inconnue' });
        return json(res, 200, { ok: true });
      }

      // --- Classements -----------------------------------------------------
      if (route[0] === 'classements' && methode === 'GET') {
        return json(res, 200, {
          quizz: classementQuizz(db),
          roue: classementRoue(db),
          jeux: jeuxClasses(db, contenu),
          total: tailleQuizz(contenu),
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
        if (route[1] === 'parties' && route.length === 3 && methode === 'DELETE') {
          if (!supprimerPartie(db, route[2])) return json(res, 404, { erreur: 'partie_inconnue' });
          return json(res, 200, { ok: true });
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
        chapeau: q.chapeau ?? null,
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
    total: questions.length,
  };
}

const MAX_PAR_CAMP = 10;
const MAX_SCORE = 9999;

/**
 * Le formulaire parle du point de vue de celui qui tape (« mon équipe », « en
 * face », « gagné ? ») ; la base, elle, range en gagnants et perdants, qui ne
 * dépendent plus de qui a sorti son téléphone.
 */
function lirePartie(contenu, corps) {
  const jeu = contenu.jeux.find((j) => j.id === corps.jeuId);
  if (!jeu) return { erreur: 'jeu_inconnu' };
  let jeuNom = jeu.label;
  let jeuCle = jeu.id;
  if (jeu.nomLibre) {
    jeuNom = nettoyerPseudo(corps.nomJeu);
    if (jeuNom.length < 2) return { erreur: 'nom_jeu_court' };
    jeuCle = `${jeu.id}:${normaliserPseudo(jeuNom)}`;
  }

  const camp = (noms) => (Array.isArray(noms) ? noms.map(nettoyerPseudo) : []);
  const equipe = camp(corps.equipe);
  const adversaires = camp(corps.adversaires);
  if (equipe.length === 0 || adversaires.length === 0) return { erreur: 'camp_vide' };
  if (equipe.length > MAX_PAR_CAMP || adversaires.length > MAX_PAR_CAMP) return { erreur: 'trop_de_joueurs' };
  const tous = [...equipe, ...adversaires];
  if (tous.some((nom) => nom.length < 2)) return { erreur: 'nom_court' };
  // La même personne des deux côtés, c'est une faute de frappe, pas une partie.
  if (new Set(tous.map(normaliserPseudo)).size !== tous.length) return { erreur: 'nom_en_double' };

  if (typeof corps.gagne !== 'boolean') return { erreur: 'resultat_manquant' };
  const scoreEquipe = lireScore(corps.scoreEquipe);
  const scoreAdversaires = lireScore(corps.scoreAdversaires);
  if (scoreEquipe === undefined || scoreAdversaires === undefined) return { erreur: 'score_invalide' };
  if ((scoreEquipe === null) !== (scoreAdversaires === null)) return { erreur: 'score_incomplet' };

  return {
    jeuId: jeu.id,
    jeuNom,
    jeuCle,
    gagnants: corps.gagne ? equipe : adversaires,
    perdants: corps.gagne ? adversaires : equipe,
    scoreGagnants: corps.gagne ? scoreEquipe : scoreAdversaires,
    scorePerdants: corps.gagne ? scoreAdversaires : scoreEquipe,
  };
}

/** `null` : pas de score, un Loup-garou ne se compte pas. `undefined` : score invalide. */
function lireScore(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  return Number.isInteger(valeur) && valeur >= 0 && valeur <= MAX_SCORE ? valeur : undefined;
}

/**
 * Emoji et libellé sont relus dans content.json à chaque affichage : renommer
 * un jeu renomme son classement. Les jeux gardent l'ordre du fichier, pour que
 * les pastilles ne changent pas de place à chaque rafraîchissement.
 */
function jeuxClasses(db, contenu) {
  const parId = new Map(contenu.jeux.map((j, rang) => [j.id, { ...j, rang }]));
  const rang = (c) => parId.get(c.jeuId)?.rang ?? contenu.jeux.length;
  return classementJeux(db)
    .map((c) => {
      const jeu = parId.get(c.jeuId);
      return { ...c, emoji: jeu?.emoji ?? '🎲', nom: jeu && !jeu.nomLibre ? jeu.label : c.nom };
    })
    .sort((a, b) => rang(a) - rang(b));
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
