import { useEffect, useState } from 'react'

import { api, type EtatQuizz } from '../api'
import Entete from '../components/Entete'
import { naviguer } from '../routeur'
import type { Joueur } from '../storage'
import { bonneOption, correctionLocaleDispo, hacher } from '../verif'

type Retour = { choisi: string; juste: boolean; bonne: string | null; explication: string | null }

export default function Quizz({ joueur }: { joueur: Joueur }) {
  const [etat, setEtat] = useState<EtatQuizz | null>(null)
  const [index, setIndex] = useState(0)
  const [retour, setRetour] = useState<Retour | null>(null)
  const [scoreFinal, setScoreFinal] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    api.quizz()
      .then((e) => {
        setEtat(e)
        if (e.fini) setScoreFinal(e.score)
        // Reprise : on repart à la première question sans réponse. Quelqu'un qui
        // a fermé son onglet à la 12e retrouve la 12e, pas la 1re.
        const repondues = new Set(e.reponses.map((r) => r.questionId))
        const premiere = e.questions.findIndex((q) => !repondues.has(q.id))
        setIndex(premiere === -1 ? e.questions.length : premiere)
      })
      .catch(() => setErreur('Impossible de charger le quizz.'))
  }, [])

  if (erreur) return <Message texte={erreur} />
  if (!etat) return <Message texte="Chargement…" />

  if (scoreFinal !== null) {
    return <Resultat pseudo={joueur.pseudo} score={scoreFinal} total={etat.total} />
  }

  if (index >= etat.questions.length) {
    return <Fin surTerminer={async () => {
      try {
        const { score } = await api.finirQuizz()
        setScoreFinal(score)
      } catch { setErreur('Impossible d\'enregistrer ton score. Réessaie.') }
    }} />
  }

  const question = etat.questions[index]

  async function repondre(optionId: string) {
    if (retour) return
    // Correction locale d'abord : le joueur voit juste/faux immédiatement, sans
    // attendre le réseau. L'enregistrement part en arrière-plan.
    if (correctionLocaleDispo) {
      const hash = await hacher(question.id, optionId, etat!.sel)
      const bonne = await bonneOption(question.id, question.options, question.verif, etat!.sel)
      setRetour({ choisi: optionId, juste: hash === question.verif, bonne, explication: null })
      api.repondre(question.id, optionId)
        .then((r) => setRetour((p) => (p ? { ...p, explication: r.explication } : p)))
        .catch(() => { /* la réponse est perdue : le score serveur en tiendra compte */ })
    } else {
      const r = await api.repondre(question.id, optionId)
      setRetour({ choisi: optionId, juste: r.juste, bonne: null, explication: r.explication })
    }
    navigator.vibrate?.(30)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col p-6">
      <Entete titre="Le quizz" />
      <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-or transition-all duration-300"
          style={{ width: `${((index + (retour ? 1 : 0)) / etat.questions.length) * 100}%` }}
        />
      </div>
      <p className="mb-2 text-sm text-white/40">Question {index + 1} / {etat.questions.length}</p>
      <h2 className="mb-6 text-xl font-semibold leading-snug">{question.texte}</h2>

      <div className="flex flex-col gap-3">
        {question.options.map((o) => {
          const choisi = retour?.choisi === o.id
          const estBonne = retour?.bonne === o.id
          let style = 'bouton-fantome'
          if (retour) {
            if (estBonne || (choisi && retour.juste)) style = 'w-full rounded-2xl border border-emerald-400 bg-emerald-500/20 px-6 py-4 text-lg font-semibold'
            else if (choisi) style = 'w-full rounded-2xl border border-rose-400 bg-rose-500/20 px-6 py-4 text-lg font-semibold'
            else style = 'w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-lg text-white/40'
          }
          return (
            <button key={o.id} onClick={() => repondre(o.id)} disabled={!!retour} className={style}>
              {o.label}
            </button>
          )
        })}
      </div>

      {retour && (
        <div className="carte mt-6">
          <p className={`text-lg font-bold ${retour.juste ? 'text-emerald-300' : 'text-rose-300'}`}>
            {retour.juste ? 'Bien joué 🎉' : 'Raté 💀'}
          </p>
          {retour.explication && <p className="mt-2 text-white/80">{retour.explication}</p>}
          <button
            className="bouton-or mt-5"
            onClick={() => { setRetour(null); setIndex((i) => i + 1) }}
          >
            {index + 1 === etat.questions.length ? 'Voir mon score' : 'Question suivante'}
          </button>
        </div>
      )}
    </div>
  )
}

function Fin({ surTerminer }: { surTerminer: () => void }) {
  useEffect(() => { surTerminer() }, [])
  return <Message texte="On compte les points…" />
}

function Resultat({ pseudo, score, total }: { pseudo: string; score: number; total: number }) {
  const mot = score / total >= 0.8 ? 'Monstre.' : score / total >= 0.5 ? 'Correct.' : 'Aïe.'
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6 text-center">
      <p className="text-6xl">{score / total >= 0.8 ? '🏆' : score / total >= 0.5 ? '👏' : '🫠'}</p>
      <div>
        <p className="text-white/60">{pseudo}</p>
        <p className="titre text-6xl">{score} / {total}</p>
        <p className="mt-2 text-xl text-white/80">{mot}</p>
      </div>
      <p className="text-sm text-white/50">
        Une seule tentative par personne — c'est plié pour toi.
      </p>
      <button className="bouton-or" onClick={() => naviguer('/classements')}>Voir le classement</button>
      <button className="bouton-fantome" onClick={() => naviguer('/roue')}>Aller tourner la roue</button>
    </div>
  )
}

function Message({ texte }: { texte: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6 text-center text-white/70">
      {texte}
    </div>
  )
}
