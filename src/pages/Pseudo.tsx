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
      <h1 className="enseigne shrink-0 pt-1 text-center text-[2.7rem]">Titi &amp; Djimi</h1>

      <div className="relative my-4 min-h-0 flex-1 -rotate-[1.5deg]">
        <img
          src="/mariage.jpg"
          alt="Titi et Djimi en tenue de mariage royal"
          className="h-full w-full rounded-lg border-4 border-or object-cover shadow-[0_6px_0_rgb(0,0,0,0.45)]"
        />
        <span className="ruban absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm">
          30 ans de règne
        </span>
      </div>

      <div className="carte shrink-0 p-4">
        <p className="mb-3 text-center text-creme/80">
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
