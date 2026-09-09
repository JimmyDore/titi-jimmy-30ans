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
          <span
            className="shrink-0 rounded-full border-2 border-or/40 bg-carte px-3 py-1 text-sm text-or"
            style={{ fontFamily: 'var(--font-titre)' }}
          >
            {index + 1}/{etat.questions.length}
          </span>
        }
      />
      <div className="h-2 w-full shrink-0 overflow-hidden rounded-full border border-or/20 bg-black/30">
        <div
          className="h-full bg-or transition-all duration-300"
          style={{ width: `${((index + (retour ? 1 : 0)) / etat.questions.length) * 100}%` }}
        />
      </div>
      <h2 className="shrink-0 pt-4 text-xl font-semibold leading-snug text-creme">{question.texte}</h2>

      {/* Les propositions occupent la place disponible et se resserrent quand la
          correction apparaît : la bonne réponse et l'explication restent
          visibles ensemble, sans un seul coup de pouce. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5 py-4">
        {question.options.map((o) => {
          const choisi = retour?.choisi === o.id
          const estBonne = retour?.bonne === o.id
          const base = 'flex min-h-12 max-h-[5.5rem] flex-1 items-center justify-center rounded-xl border-2 px-4 text-center text-base font-semibold leading-tight transition'
          let style = `${base} border-or/40 bg-[#43182c] text-creme shadow-[0_4px_0_#150710] active:translate-y-1 active:shadow-none`
          if (retour) {
            if (estBonne || (choisi && retour.juste)) style = `${base} border-emerald-400 bg-emerald-500/25 text-creme`
            else if (choisi) style = `${base} border-rouge bg-rouge/25 text-creme`
            else style = `${base} border-or/10 bg-carte/50 text-creme/35`
          }
          return (
            <button key={o.id} onClick={() => repondre(o.id)} disabled={!!retour} className={style}>
              {o.label}
            </button>
          )
        })}
      </div>

      {retour && (
        <div className="shrink-0 animate-[apparaitre_.25s_ease-out] overflow-hidden rounded-2xl border-2 border-or/25 bg-carte shadow-[0_4px_0_rgb(0,0,0,0.4)]">
          <p
            className={`py-2 text-center text-sm tracking-[0.25em] text-creme ${retour.juste ? 'bg-emerald-600' : 'bg-rouge'}`}
            style={{ fontFamily: 'var(--font-titre)' }}
          >
            {retour.juste ? 'JUSTE 🎉' : 'RATÉ 💀'}
          </p>
          <div className="p-4">
            {retour.explication && (
              <p className="mb-3 max-h-24 overflow-y-auto text-sm leading-snug text-creme/75">{retour.explication}</p>
            )}
            <button
              className="bouton-or"
              onClick={() => { setRetour(null); setIndex((i) => i + 1) }}
            >
              {index + 1 === etat.questions.length ? 'Voir mon score' : 'Question suivante'}
            </button>
          </div>
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
  const part = score / total
  const mot = part >= 0.8 ? 'Monstre.' : part >= 0.5 ? 'Correct.' : 'Aïe.'
  return (
    <div className="ecran justify-center gap-6 text-center">
      <p className="animate-[tampon_.5s_cubic-bezier(.2,1.4,.4,1)] text-7xl leading-none">
        {part >= 0.8 ? '🏆' : part >= 0.5 ? '👏' : '🫠'}
      </p>
      <div>
        <p className="text-creme/60">{pseudo}</p>
        <p className="enseigne text-8xl">
          {score}<span className="text-3xl text-creme/50"> / {total}</span>
        </p>
        <p className="titre mt-2 text-3xl">{mot}</p>
      </div>
      <p className="text-sm text-creme/50">
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
    <div className="ecran items-center justify-center text-center text-creme/70">
      {texte}
    </div>
  )
}
