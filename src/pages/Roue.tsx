import { useEffect, useRef, useState } from 'react'

import { api, type Segment, type Tour } from '../api'
import Entete from '../components/Entete'
import { naviguer } from '../routeur'
import { DUREE_MS, motifVibration, viser } from '../roue'
import type { Joueur } from '../storage'

export default function Roue({ joueur }: { joueur: Joueur }) {
  const [segments, setSegments] = useState<Segment[]>([])
  const [rotation, setRotation] = useState(0)
  const [tourne, setTourne] = useState(false)
  const [tour, setTour] = useState<Tour | null>(null)
  const [releve, setReleve] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const minuteur = useRef<number | undefined>(undefined)

  useEffect(() => {
    api.roue().then((r) => setSegments(r.segments)).catch(() => setErreur('Impossible de charger la roue.'))
    return () => window.clearTimeout(minuteur.current)
  }, [])

  async function tourner() {
    if (tourne || segments.length === 0) return
    setErreur(null)
    setTour(null)
    setReleve(false)
    setTourne(true)
    try {
      // Le serveur tire ET enregistre avant l'animation : la roue ne fait
      // qu'illustrer un résultat déjà écrit en base. Impossible de « retenter »
      // en coupant le wifi au bon moment.
      const resultat = await api.tourner()
      setRotation((actuelle) => viser(actuelle, resultat.index, segments.length))
      navigator.vibrate?.(motifVibration())
      minuteur.current = window.setTimeout(() => {
        setTour(resultat)
        setTourne(false)
        navigator.vibrate?.(resultat.type === 'defi' ? [180, 80, 180] : 60)
      }, DUREE_MS)
    } catch {
      setErreur('Le serveur n\'a pas répondu. Réessaie.')
      setTourne(false)
    }
  }

  async function jeLaiFait() {
    if (!tour) return
    setReleve(true)
    try { await api.releve(tour.id) } catch { setReleve(false) }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col p-6">
      <Entete titre="La roue des défis" />
      <p className="mb-4 text-sm text-white/50">
        {joueur.pseudo} — autant de tours que tu veux. C'est toi qui vois.
      </p>

      <div className="relative mx-auto aspect-square w-full max-w-[340px]">
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1 text-4xl drop-shadow">▼</div>
        <svg
          viewBox="-110 -110 220 220"
          className="h-full w-full drop-shadow-2xl"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: tourne ? `transform ${DUREE_MS}ms cubic-bezier(0.16, 0.85, 0.24, 1)` : 'none',
          }}
        >
          {segments.map((s, i) => (
            <Quartier key={s.id} segment={s} index={i} nombre={segments.length} />
          ))}
          <circle r="20" fill="#12091c" stroke="#f5c451" strokeWidth="3" />
        </svg>
      </div>

      <button onClick={tourner} disabled={tourne} className="bouton-or mt-8">
        {tourne ? 'Ça tourne…' : 'Tourner la roue'}
      </button>
      {erreur && <p className="mt-3 text-center text-sm text-rose-300">{erreur}</p>}

      {tour && (
        <div className="carte mt-6 text-center">
          <p className="text-6xl">{tour.emoji}</p>
          <p className="titre mt-2 text-3xl">{tour.label}</p>
          <p className="mt-3 text-white/80">{tour.consigne}</p>
          {tour.type === 'defi' && (
            <button onClick={jeLaiFait} disabled={releve} className={releve ? 'bouton-fantome mt-5' : 'bouton-or mt-5'}>
              {releve ? '✅ Enregistré, respect' : 'J\'l\'ai fait 💪'}
            </button>
          )}
        </div>
      )}

      <button onClick={() => naviguer('/classements')} className="bouton-fantome mt-8 mb-2">
        Voir les classements
      </button>
    </div>
  )
}

function Quartier({ segment, index, nombre }: { segment: Segment; index: number; nombre: number }) {
  const pas = 360 / nombre
  const debut = index * pas
  const fin = debut + pas
  const centre = debut + pas / 2
  const couleur = segment.type === 'sauve' ? '#1f7a5a' : index % 2 === 0 ? '#3b1259' : '#7a1d5c'
  return (
    <g>
      <path d={secteur(debut, fin, 100)} fill={couleur} stroke="#f5c451" strokeWidth="1.2" />
      <g transform={`rotate(${centre}) translate(0, -62)`}>
        <text textAnchor="middle" fontSize="20" transform="rotate(0)">{segment.emoji}</text>
        <text textAnchor="middle" y="18" fontSize="9" fill="#fff" fontWeight="bold">{segment.label}</text>
      </g>
    </g>
  )
}

/** Secteur circulaire centré sur 0,0, angle 0 = midi, sens horaire. */
function secteur(debut: number, fin: number, rayon: number) {
  const p1 = point(debut, rayon)
  const p2 = point(fin, rayon)
  const grand = fin - debut > 180 ? 1 : 0
  return `M 0 0 L ${p1} A ${rayon} ${rayon} 0 ${grand} 1 ${p2} Z`
}

function point(angle: number, rayon: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  return `${(rayon * Math.cos(rad)).toFixed(2)} ${(rayon * Math.sin(rad)).toFixed(2)}`
}
