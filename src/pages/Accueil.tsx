import FormulairePseudo from '../components/FormulairePseudo'
import { naviguer } from '../routeur'
import type { Joueur } from '../storage'

export default function Accueil({ joueur, surCreation }: {
  joueur: Joueur | null
  surCreation: (joueur: Joueur) => void
}) {
  return (
    <div className="ecran">
      <h1 className="enseigne shrink-0 pt-1 text-center text-[2.7rem]">Titi &amp; Djimi</h1>

      {/* La photo est l'élastique de l'écran : elle prend ce qui reste après les
          boutons, jamais l'inverse. Le cadre penché et le ruban en travers la
          traitent pour ce qu'elle est — un portrait officiel entièrement faux. */}
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

      {joueur ? (
        <nav className="flex shrink-0 flex-col gap-2.5">
          <Tuile emoji="🎡" titre="La roue des défis" texte="Tu tournes, tu assumes." onClick={() => naviguer('/roue')} />
          <Tuile emoji="🧠" titre="Le quizz" texte="Une seule tentative. Réfléchis." onClick={() => naviguer('/quizz')} />
          <Tuile emoji="🏆" titre="Les classements" texte="Qui gagne, qui se ridiculise." onClick={() => naviguer('/classements')} />
        </nav>
      ) : (
        <div className="carte shrink-0 p-4">
          <p className="mb-3 text-center text-creme/80">Choisis un pseudo pour commencer.</p>
          <FormulairePseudo libelle="Entrer dans la fête" surCreation={surCreation} />
        </div>
      )}

      <footer className="shrink-0 pt-2 text-center">
        <button onClick={() => naviguer('/admin')} className="text-xs text-creme/25">
          admin
        </button>
      </footer>
    </div>
  )
}

function Tuile({ emoji, titre, texte, onClick }: {
  emoji: string; titre: string; texte: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border-2 border-or/25 bg-carte p-3 text-left shadow-[0_4px_0_rgb(0,0,0,0.4)] transition active:translate-y-1 active:shadow-none"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-or/40 bg-or/15 text-2xl">
        {emoji}
      </span>
      <span>
        <span className="titre block text-lg">{titre}</span>
        <span className="block text-xs text-creme/55">{texte}</span>
      </span>
    </button>
  )
}
