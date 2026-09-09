import { useState } from 'react'

import Accueil from './pages/Accueil'
import Admin from './pages/Admin'
import Classements from './pages/Classements'
import Impression from './pages/Impression'
import Pseudo from './pages/Pseudo'
import Quizz from './pages/Quizz'
import Roue from './pages/Roue'
import { naviguer, useRoute } from './routeur'
import { lireJoueur, type Joueur } from './storage'

export default function App() {
  const chemin = useRoute()
  const [joueur, setJoueur] = useState<Joueur | null>(() => lireJoueur())

  // Les deux QR codes pointent droit sur un jeu. Quelqu'un qui scanne sans être
  // jamais venu passe par l'écran pseudo puis atterrit sur CE jeu, pas sur un
  // accueil qui lui redemanderait de choisir ce qu'il vient déjà de choisir.
  const besoinIdentite = chemin === '/roue' || chemin === '/quizz'
  if (besoinIdentite && !joueur) {
    return <Pseudo destination={chemin} surCreation={setJoueur} />
  }

  switch (chemin) {
    case '/roue':
      return <Roue joueur={joueur!} />
    case '/quizz':
      return <Quizz joueur={joueur!} />
    case '/classements':
      return <Classements />
    case '/admin':
      return <Admin />
    case '/print':
      return <Impression />
    case '/':
      return <Accueil joueur={joueur} surCreation={setJoueur} />
    default:
      return (
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
          <p className="text-6xl">🤷</p>
          <p className="text-white/70">Cette page n'existe pas. Tu as scanné quoi, exactement&nbsp;?</p>
          <button className="bouton-or" onClick={() => naviguer('/')}>Retour à l'accueil</button>
        </div>
      )
  }
}
