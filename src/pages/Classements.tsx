import { useEffect, useState } from 'react'

import { api, type Classements as Donnees } from '../api'
import Entete from '../components/Entete'
import { lireJoueur } from '../storage'

export default function Classements() {
  const [onglet, setOnglet] = useState<'quizz' | 'roue'>('quizz')
  const [donnees, setDonnees] = useState<Donnees | null>(null)
  const moi = lireJoueur()?.pseudo

  useEffect(() => {
    const charger = () => api.classements().then(setDonnees).catch(() => {})
    charger()
    // La journée est longue et les gens laissent l'onglet ouvert : sans ça,
    // le classement affiché à 15 h serait encore là à 22 h.
    const t = window.setInterval(charger, 15_000)
    return () => window.clearInterval(t)
  }, [])

  return (
    <div className="ecran">
      <Entete titre="Les classements" />

      <div className="flex shrink-0 gap-1.5 rounded-xl border-2 border-or/20 bg-black/25 p-1">
        <Onglet actif={onglet === 'quizz'} onClick={() => setOnglet('quizz')}><span className="mr-2">🧠</span>Quizz</Onglet>
        <Onglet actif={onglet === 'roue'} onClick={() => setOnglet('roue')}><span className="mr-2">🎡</span>Roue</Onglet>
      </div>

      {/* Seule la liste défile, dans son cadre : l'écran lui-même ne bouge pas. */}
      <div className="min-h-0 flex-1 overflow-y-auto pt-4">
        {!donnees && <p className="text-center text-creme/50">Chargement…</p>}

        {donnees && onglet === 'quizz' && (
          donnees.quizz.length === 0
            ? <Vide texte="Personne n'a encore fini le quizz. Sois le premier." />
            : <ol className="flex flex-col gap-2">
                {donnees.quizz.map((l, i) => (
                  <Ligne key={l.pseudo} rang={i + 1} pseudo={l.pseudo} moi={moi}
                    droite={`${l.score} / ${donnees.total}`} />
                ))}
              </ol>
        )}

        {donnees && onglet === 'roue' && (
          donnees.roue.length === 0
            ? <Vide texte="Personne n'a encore tourné. Lâches." />
            : <>
                <p className="mb-3 text-xs text-creme/40">
                  Classé sur les défis <strong>relevés</strong>, pas sur le nombre de tours.
                </p>
                <ol className="flex flex-col gap-2">
                  {donnees.roue.map((l, i) => (
                    <Ligne key={l.pseudo} rang={i + 1} pseudo={l.pseudo} moi={moi}
                      droite={`${l.releves ?? 0} relevé${(l.releves ?? 0) > 1 ? 's' : ''}`}
                      sous={`${l.tours} tour${l.tours > 1 ? 's' : ''}`} />
                  ))}
                </ol>
              </>
        )}
      </div>
    </div>
  )
}

function Onglet({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={actif ? { fontFamily: 'var(--font-titre)' } : undefined}
      className={`flex-1 rounded-lg px-4 py-2 transition ${
        actif ? 'bg-or text-velours shadow-[0_3px_0_var(--color-or-sombre)]' : 'font-semibold text-creme/55'
      }`}
    >
      {children}
    </button>
  )
}

function Ligne({ rang, pseudo, droite, sous, moi }: {
  rang: number; pseudo: string; droite: string; sous?: string; moi?: string
}) {
  const medaille = ['🥇', '🥈', '🥉'][rang - 1]
  const cest_moi = pseudo === moi
  return (
    <li className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 ${
      cest_moi ? 'border-or bg-or/15' : 'border-or/15 bg-carte'
    }`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
        medaille ? 'text-2xl' : 'border-2 border-or/25 bg-black/25 text-sm text-creme/60'
      }`}>
        {medaille ?? rang}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{pseudo}{cest_moi && ' (toi)'}</span>
        {sous && <span className="block text-xs text-creme/40">{sous}</span>}
      </span>
      <span className="shrink-0 text-lg text-or" style={{ fontFamily: 'var(--font-titre)' }}>{droite}</span>
    </li>
  )
}

function Vide({ texte }: { texte: string }) {
  return <p className="carte text-center text-creme/60">{texte}</p>
}
