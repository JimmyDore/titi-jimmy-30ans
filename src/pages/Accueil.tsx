import FormulairePseudo from '../components/FormulairePseudo'
import { naviguer } from '../routeur'
import type { Joueur } from '../storage'

export default function Accueil({ joueur, surCreation }: {
  joueur: Joueur | null
  surCreation: (joueur: Joueur) => void
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="pt-4 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-or/70">Les 30 ans de</p>
        <h1 className="titre text-5xl leading-tight">Titi &amp; Jimmy</h1>
      </header>

      <img
        src="/mariage.jpg"
        alt="Titi et Jimmy en tenue de mariage royal"
        className="w-full rounded-3xl border border-or/30 object-cover shadow-2xl"
      />

      {joueur ? (
        <>
          <p className="text-center text-white/70">
            Salut <span className="font-bold text-or">{joueur.pseudo}</span>. Tu joues à quoi&nbsp;?
          </p>
          <nav className="flex flex-col gap-3">
            <Tuile emoji="🎡" titre="La roue des défis" texte="Tu tournes, tu assumes." onClick={() => naviguer('/roue')} />
            <Tuile emoji="🧠" titre="Le quizz" texte="Une seule tentative. Réfléchis." onClick={() => naviguer('/quizz')} />
            <Tuile emoji="🏆" titre="Les classements" texte="Qui gagne, qui se ridiculise." onClick={() => naviguer('/classements')} />
          </nav>
        </>
      ) : (
        <div className="carte">
          <p className="mb-4 text-center text-white/80">Choisis un pseudo pour commencer.</p>
          <FormulairePseudo libelle="Entrer dans la fête" surCreation={surCreation} />
        </div>
      )}

      <footer className="mt-auto pt-6 text-center">
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
    <button onClick={onClick} className="carte flex items-center gap-4 text-left transition active:scale-[0.98]">
      <span className="text-4xl">{emoji}</span>
      <span>
        <span className="block text-lg font-bold text-or">{titre}</span>
        <span className="block text-sm text-white/60">{texte}</span>
      </span>
    </button>
  )
}
