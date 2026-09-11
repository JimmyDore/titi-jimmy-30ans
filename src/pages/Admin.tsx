import { useCallback, useEffect, useRef, useState } from 'react'

import { api, type AdminDonnees } from '../api'
import Entete from '../components/Entete'

const CLE_CODE = 'titijimmy.admin'

export default function Admin() {
  const [code, setCode] = useState<string | null>(() => sessionStorage.getItem(CLE_CODE))
  if (!code) return <Pave surCode={(c) => { sessionStorage.setItem(CLE_CODE, c); setCode(c) }} />
  return <Panneau code={code} surDeconnexion={() => { sessionStorage.removeItem(CLE_CODE); setCode(null) }} />
}

function Pave({ surCode }: { surCode: (code: string) => void }) {
  const [saisie, setSaisie] = useState('')
  const [erreur, setErreur] = useState(false)
  // Quatre chiffres tapés vite, c'est quatre clics à quelques millisecondes :
  // en lisant `saisie` du rendu courant, les trois derniers repartiraient de la
  // même valeur périmée. La ref porte la saisie, l'état ne sert qu'à l'affichage.
  const saisieRef = useRef('')

  async function tester(valeur: string) {
    try {
      await api.verifAdmin(valeur)
      surCode(valeur)
    } catch {
      setErreur(true)
      ecrire('')
      navigator.vibrate?.([80, 60, 80])
    }
  }

  function ecrire(valeur: string) {
    saisieRef.current = valeur
    setSaisie(valeur)
  }

  function taper(chiffre: string) {
    const suivant = (saisieRef.current + chiffre).slice(0, 4)
    setErreur(false)
    ecrire(suivant)
    if (suivant.length === 4) tester(suivant)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xs flex-col justify-center gap-8 p-6">
      <div className="text-center">
        <p className="text-4xl">🔒</p>
        <p className="mt-3 text-white/60">Code admin</p>
        <div className="mt-4 flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-4 w-4 rounded-full ${
              erreur ? 'bg-rose-400' : saisie.length > i ? 'bg-or' : 'bg-white/20'
            }`} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '←'].map((t, i) => (
          <button
            key={i}
            disabled={t === ''}
            onClick={() => (t === '←' ? ecrire(saisieRef.current.slice(0, -1)) : t && taper(t))}
            className={`rounded-2xl py-5 text-2xl font-semibold ${t === '' ? 'opacity-0' : 'border border-white/15 bg-white/5 active:bg-white/15'}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

function Panneau({ code, surDeconnexion }: { code: string; surDeconnexion: () => void }) {
  const [donnees, setDonnees] = useState<AdminDonnees | null>(null)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [resetEnCours, setResetEnCours] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [aSupprimer, setASupprimer] = useState<string | null>(null)

  const charger = useCallback(() => {
    api.donneesAdmin(code).then(setDonnees).catch(() => surDeconnexion())
  }, [code, surDeconnexion])

  useEffect(() => {
    charger()
    const t = window.setInterval(charger, 10_000)
    return () => window.clearInterval(t)
  }, [charger])

  if (!donnees) return <p className="p-6 text-white/60">Chargement…</p>

  const questions = new Map(donnees.contenu.quizz.questions.map((q) => [q.id, q]))
  // Le quizz de chacun ne fait pas la taille du vivier : c'est un tirage par
  // catégorie. Le dénominateur affiché ici doit être celui que le joueur voit.
  const total = donnees.contenu.quizz.categories.reduce((somme, cat) => {
    const dispo = donnees.contenu.quizz.questions.filter((q) => q.categorie === cat.id).length
    return somme + Math.min(cat.tirage, dispo)
  }, 0)

  const emojis = new Map(donnees.contenu.jeux.map((j) => [j.id, j.emoji]))

  async function supprimerPartie(id: string) {
    // Deux appuis : un tap malheureux ne doit pas effacer la victoire de quelqu'un.
    if (aSupprimer !== id) {
      setASupprimer(id)
      return
    }
    setASupprimer(null)
    await api.supprimerPartieAdmin(code, id).catch(() => {})
    charger()
  }

  async function lancerReset(portee: string) {
    await api.resetAdmin(code, portee)
    setResetEnCours(null)
    setConfirmation('')
    charger()
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col p-4">
      <Entete titre="Admin" />

      <div className="mb-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <Stat valeur={donnees.joueurs.length} libelle="joueurs" />
        <Stat valeur={donnees.joueurs.filter((j) => j.quizz_fini_at).length} libelle="quizz finis" />
        <Stat valeur={donnees.tours.length} libelle="tours de roue" />
        <Stat valeur={donnees.parties.length} libelle="parties de jeux" />
      </div>

      <h2 className="mb-2 mt-4 text-sm uppercase tracking-widest text-white/40">Joueurs</h2>
      <div className="flex flex-col gap-2">
        {donnees.joueurs.length === 0 && <p className="carte text-white/50">Personne pour l'instant.</p>}
        {donnees.joueurs.map((j) => {
          const sesTours = donnees.tours.filter((t) => t.joueur_id === j.id)
          const sesReponses = donnees.reponses.filter((r) => r.joueur_id === j.id)
          return (
            <div key={j.id} className="carte p-3">
              <button className="flex w-full items-center gap-3 text-left" onClick={() => setOuvert(ouvert === j.id ? null : j.id)}>
                <span className="flex-1 font-semibold">{j.pseudo}</span>
                <span className="whitespace-nowrap text-sm text-white/60">
                  🧠&nbsp;{j.quizz_fini_at ? `${j.score}/${total}` : j.repondues > 0 ? `en cours ${j.repondues}/${total}` : '—'}
                </span>
                <span className="whitespace-nowrap text-sm text-white/60">
                  🎡&nbsp;{j.tours} ({j.releves}&nbsp;✅)
                </span>
                <span className="text-white/30">{ouvert === j.id ? '▲' : '▼'}</span>
              </button>

              {ouvert === j.id && (
                <div className="mt-3 border-t border-white/10 pt-3 text-sm">
                  <p className="mb-2 text-white/40">Tours de roue</p>
                  {sesTours.length === 0 && <p className="text-white/40">Aucun.</p>}
                  <ul className="mb-4 flex flex-col gap-1">
                    {sesTours.map((t) => (
                      <li key={t.id} className="flex gap-2">
                        <span className="text-white/40">{t.tire_at.slice(11, 16)}</span>
                        <span>{t.label}</span>
                        {t.type === 'defi' && <span>{t.releve ? '✅ relevé' : '⏳ pas validé'}</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="mb-2 text-white/40">Réponses au quizz</p>
                  {sesReponses.length === 0 && <p className="text-white/40">Aucune.</p>}
                  <ul className="flex flex-col gap-1">
                    {sesReponses.map((r) => {
                      const q = questions.get(r.question_id)
                      const juste = q?.reponse === r.option_id
                      const label = q?.options.find((o) => o.id === r.option_id)?.label ?? r.option_id
                      return (
                        <li key={r.question_id} className={juste ? 'text-emerald-300' : 'text-rose-300'}>
                          {juste ? '✅' : '❌'} <span className="text-white/70">{q?.texte ?? r.question_id}</span> → {label}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <h2 className="mb-2 mt-8 text-sm uppercase tracking-widest text-white/40">Parties de jeux</h2>
      <div className="flex flex-col gap-2">
        {donnees.parties.length === 0 && <p className="carte text-white/50">Aucune partie saisie.</p>}
        {donnees.parties.map((p) => (
          <div key={p.id} className="carte flex items-center gap-3 p-3 text-sm">
            <span className="text-2xl">{emojis.get(p.jeu_id) ?? '🎲'}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {p.jeu_nom}
                <span className="ml-2 font-normal text-white/40">{heure(p.saisie_at)} · par {p.auteur ?? '?'}</span>
              </p>
              <p className="text-white/70">
                <span className="text-emerald-300">🏆 {p.gagnants.join(', ')}</span>
                {p.score_gagnants !== null ? ` ${p.score_gagnants} – ${p.score_perdants} ` : ' contre '}
                {p.perdants.join(', ')}
              </p>
            </div>
            <button
              onClick={() => supprimerPartie(p.id)}
              className={`shrink-0 rounded-xl border px-3 py-2 font-semibold ${
                aSupprimer === p.id ? 'border-rose-500/60 bg-rose-500/15 text-rose-200' : 'border-white/15 bg-white/5 text-white/60'
              }`}
            >
              {aSupprimer === p.id ? 'Sûr ?' : 'Supprimer'}
            </button>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-8 text-sm uppercase tracking-widest text-white/40">Remise à zéro</h2>
      <div className="carte flex flex-col gap-2">
        {resetEnCours === null ? (
          <>
            <BoutonReset onClick={() => setResetEnCours('roue')}>Effacer les tours de roue</BoutonReset>
            <BoutonReset onClick={() => setResetEnCours('quizz')}>Effacer les résultats du quizz</BoutonReset>
            <BoutonReset onClick={() => setResetEnCours('jeux')}>Effacer les scores des jeux</BoutonReset>
            <BoutonReset onClick={() => setResetEnCours('joueurs')}>Effacer les joueurs (et tout le reste)</BoutonReset>
            <BoutonReset onClick={() => setResetEnCours('tout')} danger>TOUT remettre à zéro</BoutonReset>
          </>
        ) : (
          <>
            <p className="text-white/80">
              Tape <strong className="text-or">RESET</strong> pour confirmer «&nbsp;{resetEnCours}&nbsp;». C'est définitif.
            </p>
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              className="rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-lg"
            />
            <button className="bouton-or" disabled={confirmation !== 'RESET'} onClick={() => lancerReset(resetEnCours)}>
              Confirmer
            </button>
            <button className="bouton-fantome" onClick={() => { setResetEnCours(null); setConfirmation('') }}>
              Annuler
            </button>
          </>
        )}
      </div>

      <button className="mt-8 text-xs text-white/30" onClick={surDeconnexion}>Se déconnecter de l'admin</button>
      <p className="mt-2 pb-6 text-center text-xs text-white/20">Rafraîchissement automatique toutes les 10 s.</p>
    </div>
  )
}

/** SQLite écrit en UTC : sans conversion, une partie de 21 h s'afficherait à 19 h. */
function heure(sqlite: string) {
  return new Date(`${sqlite.replace(' ', 'T')}Z`).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function Stat({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <div className="carte py-3">
      <p className="titre text-3xl">{valeur}</p>
      <p className="text-xs text-white/50">{libelle}</p>
    </div>
  )
}

function BoutonReset({ onClick, children, danger }: {
  onClick: () => void; children: React.ReactNode; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border px-5 py-3 text-left font-semibold ${
        danger ? 'border-rose-500/60 bg-rose-500/15 text-rose-200' : 'border-white/15 bg-white/5 text-white/80'
      }`}
    >
      {children}
    </button>
  )
}
