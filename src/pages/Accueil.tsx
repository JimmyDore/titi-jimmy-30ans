import FormulairePseudo from '../components/FormulairePseudo'
import { naviguer } from '../routeur'
import type { Joueur } from '../storage'

export default function Accueil({ joueur, surCreation }: {
  joueur: Joueur | null
  surCreation: (joueur: Joueur) => void
}) {
  return (
    <div className="ecran">
      <header className="shrink-0 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-or/70">Les 30 ans de</p>
        <h1 className="titre text-4xl leading-tight">Titi &amp; Jimmy</h1>
      </header>

      {/* La photo est l'élastique de l'écran : elle prend ce qui reste après les
          boutons, jamais l'inverse. */}
      <img
        src="/mariage.jpg"
        alt="Titi et Jimmy en tenue de mariage royal"
        className="my-4 min-h-0 w-full flex-1 rounded-3xl border border-or/30 object-cover shadow-2xl"
      />

      {joueur ? (
        <nav className="flex shrink-0 flex-col gap-2.5">
          <Tuile emoji="🎡" titre="La roue des défis" texte="Tu tournes, tu assumes." onClick={() => naviguer('/roue')} />
          <Tuile emoji="🧠" titre="Le quizz" texte="Une seule tentative. Réfléchis." onClick={() => naviguer('/quizz')} />
          <Tuile emoji="🏆" titre="Les classements" texte="Qui gagne, qui se ridiculise." onClick={() => naviguer('/classements')} />
        </nav>
      ) : (
        <div className="shrink-0 rounded-3xl border border-white/10 bg-carte/70 p-4 shadow-xl backdrop-blur">
          <p className="mb-3 text-center text-white/80">Choisis un pseudo pour commencer.</p>
          <FormulairePseudo libelle="Entrer dans la fête" surCreation={surCreation} />
        </div>
      )}

      <footer className="shrink-0 pt-2 text-center">
        <button onClick={() => naviguer('/admin')} className="text-xs text-white/25">
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
      className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-carte/70 p-3.5 text-left shadow-lg backdrop-blur transition active:scale-[0.98]"
    >
      <span className="text-3xl">{emoji}</span>
      <span>
        <span className="block font-bold text-or">{titre}</span>
        <span className="block text-xs text-white/60">{texte}</span>
      </span>
    </button>
  )
}
