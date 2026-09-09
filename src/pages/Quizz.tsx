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
    <div className="ecran">
      <Entete
        titre="Le quizz"
        action={
          <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/60">
            {index + 1}/{etat.questions.length}
          </span>
        }
      />
      <div className="h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-or transition-all duration-300"
          style={{ width: `${((index + (retour ? 1 : 0)) / etat.questions.length) * 100}%` }}
        />
      </div>
      <h2 className="shrink-0 pt-4 text-lg font-semibold leading-snug">{question.texte}</h2>

      {/* Les propositions occupent la place disponible et se resserrent quand la
          correction apparaît : la bonne réponse et l'explication restent
          visibles ensemble, sans un seul coup de pouce. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5 py-4">
        {question.options.map((o) => {
          const choisi = retour?.choisi === o.id
          const estBonne = retour?.bonne === o.id
          const base = 'flex min-h-12 max-h-[5.5rem] flex-1 items-center justify-center rounded-2xl px-4 text-center text-base font-semibold leading-tight transition'
          let style = `${base} border border-white/20 bg-white/5 text-white/90 active:scale-[0.98]`
          if (retour) {
            if (estBonne || (choisi && retour.juste)) style = `${base} border border-emerald-400 bg-emerald-500/20`
            else if (choisi) style = `${base} border border-rose-400 bg-rose-500/20`
            else style = `${base} border border-white/10 bg-white/5 text-white/40`
          }
          return (
            <button key={o.id} onClick={() => repondre(o.id)} disabled={!!retour} className={style}>
              {o.label}
            </button>
          )
        })}
      </div>

      {retour && (
        <div className="shrink-0 animate-[apparaitre_.25s_ease-out] rounded-2xl border border-white/10 bg-carte/80 p-4 shadow-xl backdrop-blur">
          <p className={`font-bold ${retour.juste ? 'text-emerald-300' : 'text-rose-300'}`}>
            {retour.juste ? 'Bien joué 🎉' : 'Raté 💀'}
          </p>
          {retour.explication && (
            <p className="mt-1 max-h-24 overflow-y-auto text-sm leading-snug text-white/75">{retour.explication}</p>
          )}
          <button
            className="bouton-or mt-3"
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
    <div className="ecran justify-center gap-6 text-center">
      <p className="text-6xl">{score / total >= 0.8 ? '🏆' : score / total >= 0.5 ? '👏' : '🫠'}</p>
      <div>
        <p className="text-white/60">{pseudo}</p>
        <p className="titre text-6xl">{score} / {total}</p>
        <p className="mt-2 text-xl text-white/80">{mot}</p>
      </div>
      <p className="text-sm text-white/50">
        Une seule tentative par personne — c'est plié pour toi.
      </p>
      <div className="flex flex-col gap-3">
        <button className="bouton-or" onClick={() => naviguer('/classements')}>Voir le classement</button>
        <button className="bouton-fantome" onClick={() => naviguer('/roue')}>Aller tourner la roue</button>
      </div>
    </div>
  )
}

function Message({ texte }: { texte: string }) {
  return (
    <div className="ecran items-center justify-center text-center text-white/70">
      {texte}
    </div>
  )
}
