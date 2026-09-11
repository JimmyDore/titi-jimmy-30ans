import { useEffect, useState } from 'react'

import { api, ErreurApi, type CatalogueJeux, type Jeu } from '../api'
import Entete from '../components/Entete'
import { naviguer } from '../routeur'
import { ajouterNom, cleDuJeu, suggestions } from '../scores'
import type { Joueur } from '../storage'

type Etape = 'jeu' | 'joueurs' | 'resultat' | 'enregistre'
const ETAPES: Etape[] = ['jeu', 'joueurs', 'resultat']

const CHAMP = 'w-full min-w-0 rounded-xl border-2 border-or/30 bg-black/30 px-4 py-2.5 text-lg text-creme placeholder-creme/35 outline-none focus:border-or'

/**
 * Trois étapes courtes plutôt qu'un long formulaire : chacune tient sur l'écran,
 * et on la remplit d'une main, l'autre tenant encore le palet.
 */
export default function Scores({ joueur }: { joueur: Joueur }) {
  const [catalogue, setCatalogue] = useState<CatalogueJeux | null>(null)
  const [etape, setEtape] = useState<Etape>('jeu')
  const [jeu, setJeu] = useState<Jeu | null>(null)
  const [nomJeu, setNomJeu] = useState('')
  const [equipe, setEquipe] = useState<string[]>([joueur.pseudo])
  const [adversaires, setAdversaires] = useState<string[]>([])
  const [saisieEquipe, setSaisieEquipe] = useState('')
  const [saisieAdversaires, setSaisieAdversaires] = useState('')
  const [gagne, setGagne] = useState<boolean | null>(null)
  const [scoreEquipe, setScoreEquipe] = useState('')
  const [scoreAdversaires, setScoreAdversaires] = useState('')
  const [partieId, setPartieId] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Rechargé après chaque saisie : les noms qu'on vient de taper deviennent
  // des suggestions pour la partie suivante.
  const chargerCatalogue = () => api.jeux().then(setCatalogue)

  useEffect(() => {
    chargerCatalogue().catch(() => setErreur('Impossible de charger les jeux.'))
  }, [])

  if (!catalogue) return <Message texte={erreur ?? 'Chargement…'} />

  const nomDuJeu = jeu?.nomLibre ? nomJeu.trim() : jeu?.label ?? ''
  const places = [...equipe, ...adversaires]
  const plusieurs = equipe.length > 1

  function choisirJeu(j: Jeu) {
    setJeu(j)
    setErreur(null)
    // Un jeu de société a d'abord besoin de son nom ; les autres enchaînent.
    if (!j.nomLibre) setEtape('joueurs')
  }

  function ajouter(cote: 'equipe' | 'adversaires', saisie: string) {
    const [camp, autre] = cote === 'equipe' ? [equipe, adversaires] : [adversaires, equipe]
    const resultat = ajouterNom(camp, autre, saisie)
    setErreur(resultat.erreur)
    if (resultat.erreur) return
    if (cote === 'equipe') {
      setEquipe(resultat.camp)
      setSaisieEquipe('')
    } else {
      setAdversaires(resultat.camp)
      setSaisieAdversaires('')
    }
  }

  function versResultat() {
    // Un nom tapé mais jamais validé d'un « + » est un nom qu'on voulait ajouter.
    const e = ajouterNom(equipe, adversaires, saisieEquipe)
    const a = ajouterNom(adversaires, e.camp, saisieAdversaires)
    if (e.erreur || a.erreur) {
      setErreur(e.erreur ?? a.erreur)
      return
    }
    setEquipe(e.camp)
    setAdversaires(a.camp)
    setSaisieEquipe('')
    setSaisieAdversaires('')
    setErreur(null)
    setEtape('resultat')
  }

  async function enregistrer() {
    if (!jeu || gagne === null) return
    setEnvoi(true)
    setErreur(null)
    try {
      const { id } = await api.enregistrerPartie({
        jeuId: jeu.id,
        nomJeu: jeu.nomLibre ? nomJeu : undefined,
        equipe,
        adversaires,
        gagne,
        scoreEquipe: scoreEquipe === '' ? null : Number(scoreEquipe),
        scoreAdversaires: scoreAdversaires === '' ? null : Number(scoreAdversaires),
      })
      setPartieId(id)
      setEtape('enregistre')
      navigator.vibrate?.(gagne ? [120, 60, 120] : 60)
      chargerCatalogue().catch(() => {})
    } catch (err) {
      setErreur(messageErreur(err))
    } finally {
      setEnvoi(false)
    }
  }

  async function annuler() {
    if (!partieId) return
    try {
      await api.annulerPartie(partieId)
      // Retour au résultat, tout est encore rempli : on corrige et on renvoie.
      setPartieId(null)
      setErreur(null)
      setEtape('resultat')
    } catch {
      setErreur('Impossible d\'annuler. Demande à l\'admin.')
    }
  }

  function rejouer(memesJoueurs: boolean) {
    setGagne(null)
    setScoreEquipe('')
    setScoreAdversaires('')
    setPartieId(null)
    setErreur(null)
    if (memesJoueurs) {
      setEtape('resultat')
      return
    }
    setJeu(null)
    setNomJeu('')
    setEquipe([joueur.pseudo])
    setAdversaires([])
    setEtape('jeu')
  }

  if (etape === 'enregistre' && jeu && gagne !== null) {
    const avecScore = scoreEquipe !== '' && scoreAdversaires !== ''
    return (
      <div className="ecran justify-center gap-6 text-center">
        <p className="animate-[tampon_.5s_cubic-bezier(.2,1.4,.4,1)] text-7xl leading-none">{gagne ? '🏆' : '💀'}</p>
        <div>
          <p className="text-creme/60">{jeu.emoji} {nomDuJeu}</p>
          <p className="enseigne mt-2 text-6xl">{gagne ? 'Victoire' : 'Défaite'}</p>
          {avecScore && <p className="titre mt-2 text-3xl">{scoreEquipe} – {scoreAdversaires}</p>}
          <p className="mt-3 text-sm text-creme/70">
            <strong>{equipe.join(', ')}</strong> contre <strong>{adversaires.join(', ')}</strong>
          </p>
        </div>
        <p className="text-sm text-creme/50">
          {gagne ? 'Consigné au registre royal.' : 'Consigné quand même. Le registre n\'oublie rien.'}
        </p>
        {erreur && <p className="text-sm text-rose-300">{erreur}</p>}
        <div className="flex flex-col gap-3">
          <button className="bouton-or" onClick={() => rejouer(true)}>La revanche 🔁</button>
          <div className="grid grid-cols-2 gap-3">
            <button className="bouton-fantome" onClick={() => rejouer(false)}>Autre partie</button>
            <button
              className="bouton-fantome"
              onClick={() => naviguer(`/classements?onglet=jeux&jeu=${encodeURIComponent(cleDuJeu(jeu, nomJeu))}`)}
            >
              Classement
            </button>
          </div>
          <button className="text-sm text-creme/40 underline" onClick={annuler}>Oups, annuler cette saisie</button>
        </div>
      </div>
    )
  }

  const nomsDejaJoues = catalogue.nomsJeux.filter((n) => n.jeuId === jeu?.id).map((n) => n.nom)
  const propositionsJeu = nomJeu.trim() ? suggestions(nomsDejaJoues, nomJeu, []) : nomsDejaJoues.slice(0, 6)

  return (
    <div className="ecran">
      <Entete
        titre="Rentre ton score"
        action={
          <button onClick={() => naviguer('/classements?onglet=jeux')} aria-label="Voir les classements" className="rond text-lg">
            🏆
          </button>
        }
      />
      <div className="flex shrink-0 gap-1.5">
        {ETAPES.map((e, i) => (
          <span key={e} className={`h-1.5 flex-1 rounded-full ${i <= ETAPES.indexOf(etape) ? 'bg-or' : 'bg-black/30'}`} />
        ))}
      </div>

      {etape === 'jeu' && (
        <>
          <h2 className="shrink-0 pt-4 text-xl font-semibold text-creme">À quoi vous avez joué ?</h2>
          <div className="grid min-h-0 flex-1 grid-cols-2 content-center gap-2.5 overflow-y-auto py-4">
            {catalogue.jeux.map((j, i) => (
              <button
                key={j.id}
                onClick={() => choisirJeu(j)}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-3 shadow-[0_4px_0_rgb(0,0,0,0.4)] transition active:translate-y-1 active:shadow-none ${
                  jeu?.id === j.id ? 'border-or bg-or/20' : 'border-or/25 bg-carte'
                } ${i === catalogue.jeux.length - 1 && catalogue.jeux.length % 2 === 1 ? 'col-span-2' : ''}`}
              >
                <span className="text-3xl leading-none">{j.emoji}</span>
                <span className="font-semibold leading-tight">{j.label}</span>
              </button>
            ))}
          </div>
          {jeu?.nomLibre && (
            <form
              onSubmit={(e) => { e.preventDefault(); if (nomJeu.trim().length >= 2) setEtape('joueurs') }}
              className="carte flex shrink-0 animate-[apparaitre_.25s_ease-out] flex-col gap-2.5 p-3"
            >
              <input
                autoFocus
                value={nomJeu}
                onChange={(e) => setNomJeu(e.target.value)}
                placeholder="Quel jeu ? Uno, Skyjo…"
                maxLength={24}
                autoComplete="off"
                autoCapitalize="words"
                className={CHAMP}
              />
              {propositionsJeu.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {propositionsJeu.map((nom) => (
                    <Pastille key={nom} onClick={() => { setNomJeu(nom); setEtape('joueurs') }}>{nom}</Pastille>
                  ))}
                </div>
              )}
              <button type="submit" className="bouton-or" disabled={nomJeu.trim().length < 2}>Suivant</button>
            </form>
          )}
        </>
      )}

      {etape === 'joueurs' && jeu && (
        <>
          <Rappel emoji={jeu.emoji} nom={nomDuJeu} surClic={() => setEtape('jeu')} />
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 overflow-y-auto py-3">
            <Camp
              titre={plusieurs ? 'Ton équipe' : 'Toi'}
              noms={equipe}
              saisie={saisieEquipe}
              surSaisie={setSaisieEquipe}
              surAjout={(nom) => ajouter('equipe', nom)}
              surRetrait={(nom) => setEquipe(equipe.filter((n) => n !== nom))}
              propositions={suggestions(catalogue.noms, saisieEquipe, places)}
              placeholder={equipe.length ? 'Un coéquipier ?' : 'Ton nom'}
            />
            <p className="titre shrink-0 text-center text-lg">contre</p>
            <Camp
              titre="En face"
              noms={adversaires}
              saisie={saisieAdversaires}
              surSaisie={setSaisieAdversaires}
              surAjout={(nom) => ajouter('adversaires', nom)}
              surRetrait={(nom) => setAdversaires(adversaires.filter((n) => n !== nom))}
              propositions={suggestions(catalogue.noms, saisieAdversaires, places)}
              placeholder={adversaires.length ? 'Un de plus ?' : 'Nom de l\'adversaire'}
            />
          </div>
          {erreur && <p className="shrink-0 pb-2 text-center text-sm text-rose-300">{erreur}</p>}
          <Navigation
            surRetour={() => setEtape('jeu')}
            surSuivant={versResultat}
            desactive={
              (equipe.length === 0 && saisieEquipe.trim().length < 2)
              || (adversaires.length === 0 && saisieAdversaires.trim().length < 2)
            }
          >
            Suivant
          </Navigation>
        </>
      )}

      {etape === 'resultat' && jeu && (
        <>
          <Rappel emoji={jeu.emoji} nom={nomDuJeu} surClic={() => setEtape('jeu')} />
          <p className="shrink-0 pt-2 text-sm text-creme/70">
            <strong>{equipe.join(', ')}</strong> contre <strong>{adversaires.join(', ')}</strong>
          </p>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-y-auto py-4">
            <div className="grid grid-cols-2 gap-2.5">
              <Verdict victoire actif={gagne === true} onClick={() => setGagne(true)}>
                {plusieurs ? 'On a gagné' : 'J\'ai gagné'}
              </Verdict>
              <Verdict victoire={false} actif={gagne === false} onClick={() => setGagne(false)}>
                {plusieurs ? 'On a perdu' : 'J\'ai perdu'}
              </Verdict>
            </div>
            <div className="carte p-3">
              <p className="mb-2 text-center text-xs uppercase tracking-[0.2em] text-creme/50">Score — facultatif</p>
              <div className="flex items-start gap-2">
                <ChampScore libelle={plusieurs ? 'Vous' : 'Toi'} valeur={scoreEquipe} surChange={setScoreEquipe} />
                <span className="titre pt-2 text-2xl">–</span>
                <ChampScore libelle="En face" valeur={scoreAdversaires} surChange={setScoreAdversaires} />
              </div>
              {(scoreEquipe === '') !== (scoreAdversaires === '') && (
                <p className="mt-2 text-center text-xs text-creme/50">Les deux scores, ou aucun.</p>
              )}
            </div>
          </div>
          {erreur && <p className="shrink-0 pb-2 text-center text-sm text-rose-300">{erreur}</p>}
          <Navigation
            surRetour={() => setEtape('joueurs')}
            surSuivant={enregistrer}
            desactive={gagne === null || (scoreEquipe === '') !== (scoreAdversaires === '') || envoi}
          >
            {envoi ? 'Une seconde…' : 'Enregistrer'}
          </Navigation>
        </>
      )}
    </div>
  )
}

function Camp({ titre, noms, saisie, surSaisie, surAjout, surRetrait, propositions, placeholder }: {
  titre: string
  noms: string[]
  saisie: string
  surSaisie: (valeur: string) => void
  surAjout: (nom: string) => void
  surRetrait: (nom: string) => void
  propositions: string[]
  placeholder: string
}) {
  return (
    <div className="carte shrink-0 p-3">
      <p className="titre mb-2 text-sm">{titre}</p>
      {noms.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {noms.map((nom) => (
            <button
              key={nom}
              onClick={() => surRetrait(nom)}
              aria-label={`Retirer ${nom}`}
              className="rounded-full border-2 border-or/40 bg-or/15 px-3 py-1 text-sm font-semibold"
            >
              {nom} <span className="text-creme/50">×</span>
            </button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); surAjout(saisie) }} className="flex gap-2">
        <input
          value={saisie}
          onChange={(e) => surSaisie(e.target.value)}
          placeholder={placeholder}
          maxLength={24}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          className={CHAMP}
        />
        <button type="submit" disabled={saisie.trim().length < 2} aria-label="Ajouter" className="rond h-12 w-12 text-2xl disabled:opacity-40">
          +
        </button>
      </form>
      {propositions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {propositions.map((nom) => <Pastille key={nom} onClick={() => surAjout(nom)}>+ {nom}</Pastille>)}
        </div>
      )}
    </div>
  )
}

function Rappel({ emoji, nom, surClic }: { emoji: string; nom: string; surClic: () => void }) {
  return (
    <button
      onClick={surClic}
      className="mt-3 shrink-0 self-start rounded-full border border-or/30 bg-black/25 px-3 py-1 text-sm text-creme/85"
    >
      {emoji} {nom} <span className="text-creme/40">· changer</span>
    </button>
  )
}

function Verdict({ victoire, actif, onClick, children }: {
  victoire: boolean; actif: boolean; onClick: () => void; children: React.ReactNode
}) {
  const couleur = victoire ? 'border-emerald-400 bg-emerald-600' : 'border-rouge bg-rouge'
  return (
    <button
      onClick={onClick}
      style={{ fontFamily: 'var(--font-titre)' }}
      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-4 text-creme shadow-[0_4px_0_rgb(0,0,0,0.4)] transition active:translate-y-1 active:shadow-none ${
        actif ? couleur : 'border-or/25 bg-carte text-creme/75'
      }`}
    >
      <span className="text-4xl leading-none">{victoire ? '🏆' : '💀'}</span>
      <span className="text-lg">{children}</span>
    </button>
  )
}

function ChampScore({ libelle, valeur, surChange }: { libelle: string; valeur: string; surChange: (v: string) => void }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <input
        value={valeur}
        onChange={(e) => surChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        inputMode="numeric"
        placeholder="—"
        aria-label={`Score ${libelle}`}
        style={{ fontFamily: 'var(--font-titre)' }}
        className="w-full rounded-xl border-2 border-or/30 bg-black/30 py-1.5 text-center text-3xl text-or outline-none placeholder-creme/25 focus:border-or"
      />
      <span className="text-xs text-creme/50">{libelle}</span>
    </label>
  )
}

function Navigation({ surRetour, surSuivant, desactive, children }: {
  surRetour: () => void; surSuivant: () => void; desactive: boolean; children: React.ReactNode
}) {
  return (
    <div className="flex shrink-0 gap-2.5">
      <div className="w-16 shrink-0">
        <button onClick={surRetour} aria-label="Étape précédente" className="bouton-fantome px-0">←</button>
      </div>
      <button onClick={surSuivant} disabled={desactive} className="bouton-or flex-1">{children}</button>
    </div>
  )
}

function Pastille({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-creme/20 bg-white/5 px-3 py-1 text-sm text-creme/80 active:bg-white/15"
    >
      {children}
    </button>
  )
}

function messageErreur(err: unknown) {
  switch (err instanceof ErreurApi ? err.raison : '') {
    case 'nom_en_double': return 'Quelqu\'un apparaît deux fois. Vérifie les noms.'
    case 'score_incomplet': return 'Mets les deux scores, ou aucun.'
    case 'score_invalide': return 'Ce score n\'a pas l\'air réel.'
    case 'nom_jeu_court': return 'Donne le nom du jeu.'
    case 'camp_vide': return 'Il faut au moins un nom de chaque côté.'
    default: return 'Ça n\'est pas passé. Réessaie dans 2 secondes.'
  }
}

function Message({ texte }: { texte: string }) {
  return (
    <div className="ecran items-center justify-center text-center text-creme/70">
      {texte}
    </div>
  )
}
