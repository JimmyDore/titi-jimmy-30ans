import assert from 'node:assert/strict';
import test from 'node:test';

import { chargerContenu } from '../content.mjs';
import { ouvrirDb } from '../db.mjs';
import { creerApp } from '../index.mjs';
import { hachage, scorer, tailleQuizz, tirerOrdre, tirerSegment } from '../quizz.mjs';

const contenu = chargerContenu();

/** Un serveur éphémère par test : aucune base partagée, donc aucun ordre imposé. */
async function demarrer(deps = {}) {
  const db = ouvrirDb(':memory:');
  const app = creerApp(db, contenu, { codeAdmin: '4679', ...deps });
  await new Promise((ok) => app.listen(0, ok));
  const base = `http://127.0.0.1:${app.address().port}`;
  const appel = async (chemin, options = {}) => {
    const res = await fetch(base + chemin, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
      body: options.corps ? JSON.stringify(options.corps) : undefined,
    });
    return { code: res.status, corps: await res.json().catch(() => null) };
  };
  return { db, appel, fermer: () => new Promise((ok) => app.close(ok)) };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

test('un pseudo déjà pris est refusé', async () => {
  const { appel, fermer } = await demarrer();
  const premier = await appel('/api/joueurs', { method: 'POST', corps: { pseudo: 'Kevin' } });
  assert.equal(premier.code, 201);
  // Casse et espaces compris : « kevin » et « Kevin » sont la même personne.
  const second = await appel('/api/joueurs', { method: 'POST', corps: { pseudo: '  kevin ' } });
  assert.equal(second.code, 409);
  assert.equal(second.corps.erreur, 'pseudo_pris');
  await fermer();
});

test('le quizz ne se joue qu’une fois et le score est recalculé côté serveur', async () => {
  const { appel, fermer } = await demarrer();
  const { corps: joueur } = await appel('/api/joueurs', { method: 'POST', corps: { pseudo: 'Momo' } });
  const { corps: etat } = await appel('/api/quizz', { headers: auth(joueur.token) });
  assert.equal(etat.questions.length, tailleQuizz(contenu));
  // Les bonnes réponses ne partent jamais au navigateur, seulement leur hash.
  assert.equal(JSON.stringify(etat.questions).includes('"reponse"'), false);

  const bonnes = new Map(contenu.quizz.questions.map((q) => [q.id, q.reponse]));
  for (const q of etat.questions) {
    await appel('/api/quizz/reponses', {
      method: 'POST', headers: auth(joueur.token), corps: { questionId: q.id, optionId: bonnes.get(q.id) },
    });
  }
  const { corps: fin } = await appel('/api/quizz/fin', { method: 'POST', headers: auth(joueur.token) });
  assert.equal(fin.score, tailleQuizz(contenu));

  const encore = await appel('/api/quizz/reponses', {
    method: 'POST', headers: auth(joueur.token), corps: { questionId: etat.questions[0].id, optionId: 'titi' },
  });
  assert.equal(encore.code, 409);
  await fermer();
});

test('un quizz interrompu reprend avec les réponses déjà données', async () => {
  const { appel, fermer } = await demarrer();
  const { corps: joueur } = await appel('/api/joueurs', { method: 'POST', corps: { pseudo: 'Sarah' } });
  const { corps: avant } = await appel('/api/quizz', { headers: auth(joueur.token) });
  const premiere = avant.questions[0];
  await appel('/api/quizz/reponses', {
    method: 'POST', headers: auth(joueur.token), corps: { questionId: premiere.id, optionId: premiere.options[0].id },
  });
  const { corps: apres } = await appel('/api/quizz', { headers: auth(joueur.token) });
  assert.equal(apres.reponses.length, 1);
  // L'ordre est figé en base : sans ça, la reprise afficherait un autre questionnaire.
  assert.equal(apres.questions[0].id, premiere.id);
  await fermer();
});

test('chaque joueur a son propre tirage, mais la même répartition par catégorie', async () => {
  const parId = new Map(contenu.quizz.questions.map((q) => [q.id, q]));
  const repartition = (ordre) => {
    // Toutes les catégories partent à zéro : une catégorie mise de côté
    // (`tirage: 0`) doit apparaître à 0, pas disparaître du décompte.
    const compte = Object.fromEntries(contenu.quizz.categories.map((cat) => [cat.id, 0]));
    for (const q of ordre.questions) {
      const cat = parId.get(q.id).categorie;
      compte[cat] = (compte[cat] ?? 0) + 1;
    }
    return compte;
  };

  const attendu = Object.fromEntries(
    contenu.quizz.categories.map((cat) => [
      cat.id,
      Math.min(cat.tirage, contenu.quizz.questions.filter((q) => q.categorie === cat.id).length),
    ]),
  );

  const premier = tirerOrdre(contenu);
  const second = tirerOrdre(contenu);
  assert.deepEqual(repartition(premier), attendu);
  assert.deepEqual(repartition(second), attendu);

  // Deux voisins ne doivent pas pouvoir se souffler les réponses. Avec un
  // vivier de cette taille, deux tirages identiques sont improbables au point
  // qu'on peut l'affirmer en test.
  const signature = (ordre) => ordre.questions.map((q) => q.id).join(',');
  assert.notEqual(signature(premier), signature(second));

  // Une question tirée n'est jamais tirée deux fois pour le même joueur.
  const ids = premier.questions.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('la roue tourne autant de fois qu’on veut et le classement compte les défis relevés', async () => {
  const { appel, fermer } = await demarrer();
  const { corps: joueur } = await appel('/api/joueurs', { method: 'POST', corps: { pseudo: 'Bébert' } });
  const ids = [];
  for (let i = 0; i < 5; i++) {
    const { code, corps } = await appel('/api/roue/tours', { method: 'POST', headers: auth(joueur.token) });
    assert.equal(code, 201);
    if (corps.type === 'defi') ids.push(corps.id);
  }
  for (const id of ids) {
    const { code } = await appel(`/api/roue/tours/${id}/releve`, { method: 'POST', headers: auth(joueur.token) });
    assert.equal(code, 200);
  }
  const { corps: classements } = await appel('/api/classements');
  assert.equal(classements.roue[0].tours, 5);
  assert.equal(classements.roue[0].releves, ids.length);
  await fermer();
});

test('l’admin est fermé sans le bon code, et le reset efface ce qu’on lui demande', async () => {
  const { appel, fermer } = await demarrer();
  const { corps: joueur } = await appel('/api/joueurs', { method: 'POST', corps: { pseudo: 'Lulu' } });
  await appel('/api/roue/tours', { method: 'POST', headers: auth(joueur.token) });

  assert.equal((await appel('/api/admin/donnees')).code, 401);
  assert.equal((await appel('/api/admin/verif', { method: 'POST', corps: { code: '0000' } })).code, 401);
  assert.equal((await appel('/api/admin/verif', { method: 'POST', corps: { code: '4679' } })).code, 200);

  const admin = { 'x-admin-code': '4679' };
  const { corps: donnees } = await appel('/api/admin/donnees', { headers: admin });
  assert.equal(donnees.joueurs.length, 1);
  assert.equal(donnees.tours.length, 1);

  await appel('/api/admin/reset', { method: 'POST', headers: admin, corps: { portee: 'roue' } });
  const { corps: apresRoue } = await appel('/api/admin/donnees', { headers: admin });
  assert.equal(apresRoue.tours.length, 0);
  // Le reset « roue » ne touche pas aux joueurs : tu peux effacer les tours
  // sans obliger 40 personnes à ressaisir leur pseudo.
  assert.equal(apresRoue.joueurs.length, 1);

  await appel('/api/admin/reset', { method: 'POST', headers: admin, corps: { portee: 'tout' } });
  const { corps: apresTout } = await appel('/api/admin/donnees', { headers: admin });
  assert.equal(apresTout.joueurs.length, 0);
  await fermer();
});

test('le hash de vérification dépend du sel, et le tirage suit les poids', () => {
  assert.notEqual(hachage('q1', 'a', 'sel-1'), hachage('q1', 'a', 'sel-2'));
  assert.equal(scorer(contenu, [{ question_id: 'anecdote-maison', option_id: 'titi' }]), 1);
  assert.equal(scorer(contenu, [{ question_id: 'anecdote-maison', option_id: 'djimi' }]), 0);

  const segments = [{ id: 'a', poids: 1 }, { id: 'b', poids: 9 }];
  assert.equal(tirerSegment(segments, () => 0.05).id, 'a');
  assert.equal(tirerSegment(segments, () => 0.5).id, 'b');
});

test('une partie donne une victoire aux gagnants, une participation à tous, et chaque jeu a son classement', async () => {
  const { appel, fermer } = await demarrer();
  const { corps: kevin } = await appel('/api/joueurs', { method: 'POST', corps: { pseudo: 'Kevin' } });
  const saisir = async (corps) => {
    const { code } = await appel('/api/parties', { method: 'POST', headers: auth(kevin.token), corps });
    assert.equal(code, 201);
  };

  await saisir({ jeuId: 'palet', equipe: ['Kevin', 'Momo'], adversaires: ['Lulu'], gagne: true, scoreEquipe: 12, scoreAdversaires: 8 });
  // « kevin  » en minuscules est le même Kevin, et une défaite range le score côté gagnants.
  await saisir({ jeuId: 'palet', equipe: ['kevin  '], adversaires: ['Lulu'], gagne: false, scoreEquipe: 3, scoreAdversaires: 21 });
  // Les jeux de société sont classés sous leur nom : Uno et « uno » ensemble, Skyjo à part.
  await saisir({ jeuId: 'societe', nomJeu: 'Uno', equipe: ['Kevin'], adversaires: ['Lulu'], gagne: true });
  await saisir({ jeuId: 'societe', nomJeu: 'uno', equipe: ['Kevin'], adversaires: ['Lulu'], gagne: true });
  await saisir({ jeuId: 'societe', nomJeu: 'Skyjo', equipe: ['Lulu'], adversaires: ['Momo'], gagne: true });

  const { corps } = await appel('/api/classements');
  assert.deepEqual(corps.jeux.map((j) => j.nom), ['Palet', 'Uno', 'Skyjo']);

  const palet = corps.jeux[0];
  assert.equal(palet.parties, 2);
  // Tous à une victoire : le moins de parties passe devant, puis l'ordre alphabétique.
  assert.deepEqual(palet.joueurs.map((l) => [l.nom, l.victoires, l.parties]), [
    ['Momo', 1, 1], ['Kevin', 1, 2], ['Lulu', 1, 2],
  ]);
  assert.deepEqual(
    palet.dernieres.map((d) => [d.gagnants, d.perdants, d.scoreGagnants, d.scorePerdants]),
    [[['Lulu'], ['Kevin'], 21, 3], [['Kevin', 'Momo'], ['Lulu'], 12, 8]],
  );

  const uno = corps.jeux[1];
  assert.equal(uno.cle, 'societe:uno');
  assert.deepEqual(uno.joueurs.map((l) => [l.nom, l.victoires, l.parties]), [['Kevin', 2, 2], ['Lulu', 0, 2]]);

  const { corps: catalogue } = await appel('/api/jeux');
  assert.deepEqual(catalogue.noms, ['Kevin', 'Lulu', 'Momo']);
  assert.deepEqual(catalogue.nomsJeux.map((j) => j.nom), ['Uno', 'Skyjo']);
  await fermer();
});

test('une saisie incohérente est refusée, et chacun ne peut annuler que les siennes', async () => {
  const { appel, fermer } = await demarrer();
  const { corps: kevin } = await appel('/api/joueurs', { method: 'POST', corps: { pseudo: 'Kevin' } });
  const { corps: lulu } = await appel('/api/joueurs', { method: 'POST', corps: { pseudo: 'Lulu' } });
  const base = { jeuId: 'palet', equipe: ['Kevin'], adversaires: ['Lulu'], gagne: true };
  const refus = async (modif) => {
    const { code, corps } = await appel('/api/parties', { method: 'POST', headers: auth(kevin.token), corps: { ...base, ...modif } });
    assert.equal(code, 400);
    return corps.erreur;
  };

  assert.equal((await appel('/api/parties', { method: 'POST', corps: base })).code, 401);
  assert.equal(await refus({ jeuId: 'petanque' }), 'jeu_inconnu');
  assert.equal(await refus({ jeuId: 'societe' }), 'nom_jeu_court');
  assert.equal(await refus({ adversaires: [] }), 'camp_vide');
  assert.equal(await refus({ adversaires: ['KEVIN'] }), 'nom_en_double');
  assert.equal(await refus({ gagne: undefined }), 'resultat_manquant');
  assert.equal(await refus({ scoreEquipe: 12 }), 'score_incomplet');
  assert.equal(await refus({ scoreEquipe: -1, scoreAdversaires: 3 }), 'score_invalide');

  const { corps: saisie } = await appel('/api/parties', { method: 'POST', headers: auth(kevin.token), corps: base });
  // Lulu ne peut pas effacer la défaite que Kevin a saisie contre elle.
  assert.equal((await appel(`/api/parties/${saisie.id}`, { method: 'DELETE', headers: auth(lulu.token) })).code, 404);
  assert.equal((await appel(`/api/parties/${saisie.id}`, { method: 'DELETE', headers: auth(kevin.token) })).code, 200);
  assert.equal((await appel('/api/classements')).corps.jeux.length, 0);
  await fermer();
});

test('l’admin voit les parties, en supprime une, et le reset « jeux » ne touche qu’aux scores', async () => {
  const { appel, fermer } = await demarrer();
  const { corps: kevin } = await appel('/api/joueurs', { method: 'POST', corps: { pseudo: 'Kevin' } });
  const admin = { 'x-admin-code': '4679' };
  const saisir = () => appel('/api/parties', {
    method: 'POST', headers: auth(kevin.token),
    corps: { jeuId: 'beer-pong', equipe: ['Kevin'], adversaires: ['Tata Josette'], gagne: false },
  });
  const { corps: premiere } = await saisir();
  await saisir();

  const { corps: donnees } = await appel('/api/admin/donnees', { headers: admin });
  assert.equal(donnees.parties.length, 2);
  assert.deepEqual(donnees.parties[0].gagnants, ['Tata Josette']);
  assert.equal(donnees.parties[0].auteur, 'Kevin');

  assert.equal((await appel(`/api/admin/parties/${premiere.id}`, { method: 'DELETE', headers: admin })).code, 200);
  assert.equal((await appel('/api/admin/donnees', { headers: admin })).corps.parties.length, 1);

  await appel('/api/admin/reset', { method: 'POST', headers: admin, corps: { portee: 'jeux' } });
  const { corps: apres } = await appel('/api/admin/donnees', { headers: admin });
  assert.equal(apres.parties.length, 0);
  assert.equal(apres.joueurs.length, 1);
  await fermer();
});
