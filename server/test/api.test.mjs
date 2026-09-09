import assert from 'node:assert/strict';
import test from 'node:test';

import { chargerContenu } from '../content.mjs';
import { ouvrirDb } from '../db.mjs';
import { creerApp } from '../index.mjs';
import { hachage, scorer, tirerSegment } from '../quizz.mjs';

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
  assert.equal(etat.questions.length, contenu.quizz.questions.length);
  // Les bonnes réponses ne partent jamais au navigateur, seulement leur hash.
  assert.equal(JSON.stringify(etat.questions).includes('"reponse"'), false);

  const bonnes = new Map(contenu.quizz.questions.map((q) => [q.id, q.reponse]));
  for (const q of etat.questions) {
    await appel('/api/quizz/reponses', {
      method: 'POST', headers: auth(joueur.token), corps: { questionId: q.id, optionId: bonnes.get(q.id) },
    });
  }
  const { corps: fin } = await appel('/api/quizz/fin', { method: 'POST', headers: auth(joueur.token) });
  assert.equal(fin.score, contenu.quizz.questions.length);

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
