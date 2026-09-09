export const DUREE_MS = 4200

/**
 * Amène le segment tiré sous le curseur (midi) : cinq tours pour le spectacle,
 * puis l'ajustement qui tombe pile. Le petit décalage aléatoire évite que la
 * roue s'arrête toujours au milieu exact du quartier, ce qui trahirait que le
 * résultat était décidé avant l'animation.
 */
export function viser(rotationActuelle: number, index: number, nombre: number, alea = Math.random) {
  const pas = 360 / nombre
  const decalage = (alea() - 0.5) * pas * 0.6
  const cible = -(index * pas + pas / 2) + decalage
  const base = rotationActuelle + 5 * 360
  const residu = (((cible - base) % 360) + 360) % 360
  return base + residu
}

/** Quel segment se retrouve sous le curseur pour une rotation donnée. */
export function segmentSousCurseur(rotation: number, nombre: number) {
  const pas = 360 / nombre
  const angle = (((-rotation) % 360) + 360) % 360
  return Math.floor(angle / pas) % nombre
}

/**
 * Des tics de plus en plus espacés : la roue se sent ralentir dans la main,
 * même téléphone en silencieux et musique à fond.
 */
export function motifVibration(duree = DUREE_MS) {
  const motif: number[] = []
  let pause = 45
  let cumul = 0
  while (cumul < duree - 200) {
    motif.push(8, Math.round(pause))
    cumul += 8 + pause
    pause *= 1.18
  }
  return motif
}
