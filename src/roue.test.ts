import { expect, test } from 'vitest'

import { motifVibration, segmentSousCurseur, viser } from './roue'

test('la roue s’arrête sur le segment tiré par le serveur', () => {
  const nombre = 8
  for (let index = 0; index < nombre; index++) {
    for (const alea of [0, 0.5, 0.999]) {
      // Une rotation de départ quelconque : la roue enchaîne les tours sans
      // repartir de zéro, l'ajustement doit en tenir compte.
      for (const depart of [0, 137.4, 5321.9]) {
        const rotation = viser(depart, index, nombre, () => alea)
        expect(segmentSousCurseur(rotation, nombre)).toBe(index)
        expect(rotation).toBeGreaterThan(depart + 4 * 360)
      }
    }
  }
})

test('le motif de vibration tient dans la durée de l’animation', () => {
  const total = motifVibration().reduce((somme, n) => somme + n, 0)
  expect(total).toBeLessThanOrEqual(4200)
  expect(total).toBeGreaterThan(3000)
})
