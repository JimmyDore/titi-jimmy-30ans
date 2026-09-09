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

      <div className="flex shrink-0 gap-2 rounded-2xl bg-white/5 p-1">
        <Onglet actif={onglet === 'quizz'} onClick={() => setOnglet('quizz')}>🧠 Quizz</Onglet>
        <Onglet actif={onglet === 'roue'} onClick={() => setOnglet('roue')}>🎡 Roue</Onglet>
      </div>

      {/* Seule la liste défile, dans son cadre : l'écran lui-même ne bouge pas. */}
      <div className="min-h-0 flex-1 overflow-y-auto pt-4">
        {!donnees && <p className="text-center text-white/50">Chargement…</p>}

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
                <p className="mb-3 text-xs text-white/40">
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
      className={`flex-1 rounded-xl px-4 py-2 font-semibold transition ${actif ? 'bg-or text-nuit' : 'text-white/60'}`}
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
    <li className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
      cest_moi ? 'border-or/60 bg-or/10' : 'border-white/10 bg-white/5'
    }`}>
      <span className="w-8 text-center text-lg">{medaille ?? rang}</span>
      <span className="flex-1">
        <span className="block font-semibold">{pseudo}{cest_moi && ' (toi)'}</span>
        {sous && <span className="block text-xs text-white/40">{sous}</span>}
      </span>
      <span className="font-bold text-or">{droite}</span>
    </li>
  )
}

function Vide({ texte }: { texte: string }) {
  return <p className="carte text-center text-white/60">{texte}</p>
}
