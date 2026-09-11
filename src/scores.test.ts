import { expect, test } from 'vitest'

import type { ClassementJeu } from './api'
import { ajouterNom, cleDuJeu, classementGlobal, suggestions } from './scores'

test('les suggestions ignorent casse et accents, et écartent les noms déjà placés', () => {
  const noms = ['Albert', 'Bébert', 'Bertrand', 'Kevin']
  expect(suggestions(noms, 'BEB', [])).toEqual(['Bébert'])
  // Ceux qui commencent par la saisie passent devant ceux qui la contiennent.
  expect(suggestions(noms, 'bert', [])).toEqual(['Bertrand', 'Albert', 'Bébert'])
  expect(suggestions(noms, 'bert', ['bertrand ', 'ALBERT'])).toEqual(['Bébert'])
  expect(suggestions(noms, '   ', [])).toEqual([])
})

test('un nom ne peut pas jouer des deux côtés', () => {
  expect(ajouterNom(['Kevin'], ['Lulu'], '  momo ')).toEqual({ camp: ['Kevin', 'momo'], erreur: null })
  // Un double tap sur « + » n'ajoute pas Kevin deux fois, et ne crie pas non plus.
  expect(ajouterNom(['Kevin'], ['Lulu'], 'kevin')).toEqual({ camp: ['Kevin'], erreur: null })
  expect(ajouterNom(['Kevin'], ['Lulu'], 'LULU').erreur).toBe("LULU est déjà de l'autre côté.")
  expect(ajouterNom(['Kevin'], [], 'x')).toEqual({ camp: ['Kevin'], erreur: null })
})

test('la clé du classement suit celle du serveur', () => {
  expect(cleDuJeu({ id: 'palet', nomLibre: false }, 'peu importe')).toBe('palet')
  expect(cleDuJeu({ id: 'societe', nomLibre: true }, '  Le   Uno ')).toBe('societe:le uno')
})

test('le classement global additionne victoires et parties de tous les jeux', () => {
  const partie = (id: string, saisieAt: string) => ({
    id, saisieAt, gagnants: [], perdants: [], scoreGagnants: null, scorePerdants: null,
  })
  const jeu = (cle: string, emoji: string, parties: number, joueurs: ClassementJeu['joueurs'], dernieres: ClassementJeu['dernieres']) =>
    ({ cle, jeuId: cle, nom: cle, emoji, parties, joueurs, dernieres })

  const global = classementGlobal([
    jeu('palet', '🥏', 2, [{ nom: 'Titi', victoires: 2, parties: 2 }, { nom: 'Kevin', victoires: 0, parties: 2 }],
      [partie('p2', '2026-09-12 21:10:00'), partie('p1', '2026-09-12 20:00:00')]),
    jeu('societe:uno', '🎲', 2, [
      { nom: 'Kevin', victoires: 1, parties: 2 }, { nom: 'Momo', victoires: 1, parties: 1 }, { nom: 'Lulu', victoires: 0, parties: 1 },
    ], [partie('u1', '2026-09-12 20:30:00')]),
  ])

  expect(global.parties).toBe(4)
  // Kevin et Momo ont une victoire chacun : Momo passe devant, il a joué moins.
  expect(global.joueurs.map((l) => [l.nom, l.victoires, l.parties])).toEqual([
    ['Titi', 2, 2], ['Momo', 1, 1], ['Kevin', 1, 4], ['Lulu', 0, 1],
  ])
  expect(global.dernieres.map((d) => [d.id, d.emoji])).toEqual([['p2', '🥏'], ['u1', '🎲'], ['p1', '🥏']])
})
