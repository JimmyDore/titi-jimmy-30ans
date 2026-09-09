import { naviguer } from '../routeur'

export default function Entete({ titre, retour = '/' }: { titre: string; retour?: string }) {
  return (
    <header className="mb-5 flex items-center gap-3">
      <button
        onClick={() => naviguer(retour)}
        aria-label="Retour"
        className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-white/80"
      >
        ←
      </button>
      <h1 className="titre text-2xl">{titre}</h1>
    </header>
  )
}
