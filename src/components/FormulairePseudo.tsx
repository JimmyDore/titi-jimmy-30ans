import { useState } from 'react'

import { api, ErreurApi } from '../api'
import { ecrireJoueur, type Joueur } from '../storage'

export default function FormulairePseudo({ surCreation, libelle }: {
  surCreation: (joueur: Joueur) => void
  libelle: string
}) {
  const [pseudo, setPseudo] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  async function valider(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      const joueur = await api.creerJoueur(pseudo)
      ecrireJoueur(joueur)
      surCreation(joueur)
    } catch (err) {
      if (err instanceof ErreurApi && err.raison === 'pseudo_pris') {
        setErreur(`« ${pseudo.trim()} » est déjà pris. Ajoute un 2, ou trouve mieux.`)
      } else if (err instanceof ErreurApi && err.raison === 'pseudo_court') {
        setErreur('Il faut au moins 2 caractères.')
      } else {
        setErreur('Ça n\'est pas passé. Réessaie dans 2 secondes.')
      }
      setEnvoi(false)
    }
  }

  return (
    <form onSubmit={valider} className="flex flex-col gap-3">
      <input
        value={pseudo}
        onChange={(e) => setPseudo(e.target.value)}
        placeholder="Ton pseudo"
        maxLength={24}
        autoComplete="off"
        autoCapitalize="words"
        className="w-full rounded-2xl border border-white/15 bg-black/30 px-5 py-4 text-lg text-white placeholder-white/40 outline-none focus:border-or"
      />
      {erreur && <p className="px-1 text-sm text-rose-300">{erreur}</p>}
      <button type="submit" className="bouton-or" disabled={envoi || pseudo.trim().length < 2}>
        {envoi ? 'Une seconde…' : libelle}
      </button>
      <p className="px-1 text-xs text-white/40">
        Ton pseudo reste sur ton téléphone. Si tu vides ton navigateur, tu repars de zéro.
      </p>
    </form>
  )
}
