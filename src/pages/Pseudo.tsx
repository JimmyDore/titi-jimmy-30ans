import FormulairePseudo from '../components/FormulairePseudo'
import { naviguer } from '../routeur'
import type { Joueur } from '../storage'

export default function Pseudo({ destination, surCreation }: {
  destination: string
  surCreation: (joueur: Joueur) => void
}) {
  const jeu = destination === '/roue' ? 'la roue' : 'le quizz'
  return (
    <div className="ecran">
      <div className="shrink-0 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-or/70">Les 30 ans de</p>
        <h1 className="titre text-4xl">Titi &amp; Jimmy</h1>
      </div>
      <img
        src="/mariage.jpg"
        alt="Titi et Jimmy en tenue de mariage royal"
        className="my-4 min-h-0 w-full flex-1 rounded-3xl border border-or/30 object-cover shadow-2xl"
      />
      <div className="shrink-0 rounded-3xl border border-white/10 bg-carte/70 p-4 shadow-xl backdrop-blur">
        <p className="mb-3 text-center text-white/80">
          Un pseudo et tu enchaînes sur {jeu}.
        </p>
        <FormulairePseudo
          libelle={`C'est parti pour ${jeu}`}
          surCreation={(joueur) => { surCreation(joueur); naviguer(destination) }}
        />
      </div>
    </div>
  )
}
