import { useEffect, useState } from 'react'

import { api, type Classements as Donnees } from '../api'
import Entete from '../components/Entete'
import { naviguer } from '../routeur'
import { classementGlobal } from '../scores'
import { lireJoueur } from '../storage'

type Onglet = 'quizz' | 'roue' | 'jeux'

export default function Classements() {
  // `?onglet=jeux&jeu=palet` : après une saisie de score, on atterrit
  // directement sur le classement du jeu qu'on vient de jouer.
  const [params] = useState(() => new URLSearchParams(window.location.search))
  const [onglet, setOnglet] = useState<Onglet>(() => {
    const demande = params.get('onglet')
    return demande === 'roue' || demande === 'jeux' ? demande : 'quizz'
  })
  const [jeuCle, setJeuCle] = useState<string | null>(() => params.get('jeu'))
  const [donnees, setDonnees] = useState<Donnees | null>(null)
  const moi = lireJoueur()?.pseudo
  const global = donnees && donnees.jeux.length > 0 ? classementGlobal(donnees.jeux) : undefined
  // Sans jeu demandé, ou si le jeu demandé n'a plus aucune partie, on ouvre sur le cumul.
  const jeu = donnees?.jeux.find((j) => j.cle === jeuCle) ?? global

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
        <Onglet actif={onglet === 'jeux'} onClick={() => setOnglet('jeux')}><span className="mr-2">🎯</span>Jeux</Onglet>
      </div>

      {/* Les pastilles restent hors de la liste qui défile : on change de jeu
          sans avoir à remonter. */}
      {onglet === 'jeux' && donnees && global && (
        <div className="-mx-5 flex shrink-0 gap-1.5 overflow-x-auto px-5 pt-3">
          {[global, ...donnees.jeux].map((j) => (
            <button
              // Comparaison par référence : un jeu dont l'id serait « global »
              // ne se confondrait pas avec le cumul.
              key={j === global ? ':global' : j.cle}
              onClick={() => setJeuCle(j === global ? null : j.cle)}
              className={`shrink-0 whitespace-nowrap rounded-full border-2 px-3 py-1 text-sm transition ${
                j === jeu ? 'border-or bg-or text-velours' : 'border-or/25 bg-carte font-semibold text-creme/70'
              }`}
            >
              {j.emoji} {j.nom}
            </button>
          ))}
        </div>
      )}

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

        {donnees && onglet === 'jeux' && (
          !jeu
            ? <div className="flex flex-col gap-3">
                <Vide texte="Aucune partie enregistrée. Le palet ne va pas se lancer tout seul." />
                <button className="bouton-or" onClick={() => naviguer('/scores')}>Rentrer un score</button>
              </div>
            : <>
                <p className="mb-3 text-xs text-creme/40">
                  {jeu.parties} partie{jeu.parties > 1 ? 's' : ''}{jeu === global && ', tous jeux confondus'} — classé
                  sur les <strong>victoires</strong>,
                  puis le moins de parties jouées.
                </p>
                <ol className="flex flex-col gap-2">
                  {jeu.joueurs.map((l, i) => (
                    <Ligne key={l.nom} rang={i + 1} pseudo={l.nom} moi={moi}
                      droite={`${l.victoires} victoire${l.victoires > 1 ? 's' : ''}`}
                      sous={`${l.parties} partie${l.parties > 1 ? 's' : ''}`} />
                  ))}
                </ol>
                <h3 className="mb-2 mt-5 text-xs uppercase tracking-[0.2em] text-creme/40">Dernières parties</h3>
                <ul className="flex flex-col gap-1.5">
                  {jeu.dernieres.map((d) => (
                    <li key={d.id} className="rounded-lg bg-black/20 px-3 py-2 text-sm">
                      {d.emoji && <span className="mr-1.5">{d.emoji}</span>}
                      <span className="font-semibold text-or">🏆 {d.gagnants.join(', ')}</span>
                      {d.scoreGagnants !== null
                        ? <span className="titre mx-1.5">{d.scoreGagnants} – {d.scorePerdants}</span>
                        : <span className="text-creme/40"> contre </span>}
                      <span className="text-creme/60">{d.perdants.join(', ')}</span>
                    </li>
                  ))}
                </ul>
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
      className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 transition ${
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
