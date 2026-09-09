import { naviguer } from '../routeur'

export default function Entete({ titre, retour = '/', action }: {
  titre: string
  retour?: string
  action?: React.ReactNode
}) {
  return (
    <header className="flex shrink-0 items-center gap-2.5 pb-3">
      <button onClick={() => naviguer(retour)} aria-label="Retour" className="rond">
        ←
      </button>
      <h1 className="titre flex-1 truncate text-xl">{titre}</h1>
      {action}
    </header>
  )
}
