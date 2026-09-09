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
    <div className="ecran">
      <Entete
        titre="La roue des défis"
        action={
          <button onClick={() => naviguer('/classements')} aria-label="Voir les classements" className="rond text-lg">
            🏆
          </button>
        }
      />
      <p className="shrink-0 text-center text-xs text-creme/40">
        {joueur.pseudo} — autant de tours que tu veux. C'est toi qui vois.
      </p>

      {/* La roue prend tout l'espace qui reste et rien de plus : le SVG se
          recadre tout seul, donc le bouton reste sous le pouce sur un vieil
          iPhone comme sur un grand écran. */}
      <div className="relative -mx-3 min-h-0 flex-1 py-3">
        <svg
          viewBox="-112 -112 224 224"
          className="absolute inset-0 h-full w-full drop-shadow-2xl"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: tourne ? `transform ${DUREE_MS}ms cubic-bezier(0.16, 0.85, 0.24, 1)` : 'none',
          }}
        >
          {segments.map((s, i) => (
            <Quartier key={s.id} segment={s} index={i} nombre={segments.length} />
          ))}
          {/* La jante et ses ampoules tournent avec la roue : sans un repère qui
              défile, un disque de couleurs qui pivote ne se lit pas. */}
          <circle r="104" fill="none" stroke="#b8801a" strokeWidth="8" />
          {segments.map((_, i) => {
            const [x, y] = coord((i * 360) / segments.length + 180 / segments.length, 104)
            return <circle key={i} cx={x} cy={y} r="2.8" fill="#fff3e0" />
          })}
        </svg>
        {/* Curseur et moyeu dans un calque immobile qui partage le même viewBox :
            ils restent d'aplomb pendant que la roue tourne sous eux. */}
        <svg viewBox="-112 -112 224 224" className="pointer-events-none absolute inset-0 h-full w-full">
          <circle r="23" fill="#1b0912" stroke="#ffc53d" strokeWidth="3" />
          <text
            textAnchor="middle" y="8" fontSize="24" fill="#ffc53d"
            style={{ fontFamily: 'var(--font-titre)' }}
          >
            30
          </text>
          <path d="M -12 -111 L 12 -111 L 0 -86 Z" fill="#ffc53d" stroke="#1b0912" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>

      {erreur && <p className="shrink-0 pb-2 text-center text-sm text-rose-300">{erreur}</p>}

      <button onClick={tourner} disabled={tourne} className="bouton-or shrink-0">
        {tourne ? 'Ça tourne…' : 'Tourner la roue'}
      </button>

      {tour && (
        <Feuille
          tour={tour}
          releve={releve}
          surReleve={jeLaiFait}
          surFermer={() => setTour(null)}
          surRejouer={tourner}
        />
      )}
    </div>
  )
}

/**
 * Le résultat monte par-dessus la roue au lieu de s'ajouter dessous : on voit
 * son sort sans avoir à faire défiler quoi que ce soit, et « Retourner la
 * roue » est déjà là, à portée de pouce.
 */
function Feuille({ tour, releve, surReleve, surFermer, surRejouer }: {
  tour: Tour
  releve: boolean
  surReleve: () => void
  surFermer: () => void
  surRejouer: () => void
}) {
  const condamne = tour.type === 'defi'
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center">
      <button
        aria-label="Fermer"
        onClick={surFermer}
        className="absolute inset-0 animate-[fondu_.2s_ease-out] bg-velours/75 backdrop-blur-[2px]"
      />
      <div
        className="relative w-full max-w-md animate-[monter_.3s_cubic-bezier(.2,.9,.3,1)] overflow-hidden rounded-t-2xl border-t-4 border-or bg-carte text-center shadow-2xl"
      >
        {/* Le bandeau annonce la sentence avant même qu'on lise la consigne. */}
        <p
          className={`py-2 text-xs tracking-[0.25em] text-creme ${condamne ? 'bg-rouge' : 'bg-bleu-sombre'}`}
          style={{ fontFamily: 'var(--font-titre)' }}
        >
          {condamne ? 'PAR DÉCRET ROYAL' : 'GRÂCE ROYALE'}
        </p>
        <div className="px-6 pt-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          <p className="animate-[tampon_.45s_cubic-bezier(.2,1.4,.4,1)] text-6xl leading-none">{tour.emoji}</p>
          <p className="enseigne mt-3 text-4xl">{tour.label}</p>
          <p className="mt-3 text-creme/80">{tour.consigne}</p>
          <div className="mt-5 flex flex-col gap-2.5">
            {condamne && (
              <button onClick={surReleve} disabled={releve} className={releve ? 'bouton-fantome' : 'bouton-or'}>
                {releve ? '✅ Enregistré, respect' : 'J\'l\'ai fait 💪'}
              </button>
            )}
            <button onClick={surRejouer} className={condamne ? 'bouton-fantome' : 'bouton-or'}>
              Retourner la roue 🎡
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Quartier({ segment, index, nombre }: { segment: Segment; index: number; nombre: number }) {
  const pas = 360 / nombre
  const debut = index * pas
  const fin = debut + pas
  const centre = debut + pas / 2
  // Le bleu de l'écharpe est la seule couleur froide de la palette : elle
  // signale d'un coup d'œil le seul quartier où il n'y a rien à boire.
  const couleur = segment.type === 'sauve' ? '#17699e' : index % 2 === 0 ? '#c0182a' : '#5e1028'
  return (
    <g>
      <path d={secteur(debut, fin, 100)} fill={couleur} stroke="#ffc53d" strokeWidth="1.5" />
      <g transform={`rotate(${centre}) translate(0, -62)`}>
        <text textAnchor="middle" fontSize="22" transform="rotate(0)">{segment.emoji}</text>
        <text textAnchor="middle" y="19" fontSize="9" fill="#fff3e0" fontWeight="bold">{segment.label}</text>
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

function coord(angle: number, rayon: number): [number, number] {
  const rad = ((angle - 90) * Math.PI) / 180
  return [+(rayon * Math.cos(rad)).toFixed(2), +(rayon * Math.sin(rad)).toFixed(2)]
}

function point(angle: number, rayon: number) {
  return coord(angle, rayon).join(' ')
}
