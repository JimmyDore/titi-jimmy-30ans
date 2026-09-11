import qrcode from 'qrcode-generator'

const BASE = 'https://30anstitietjimmy.jimmydore.fr'

/**
 * Une feuille A4 par jeu, une pour les scores (à scotcher près du palet ou de
 * la table de beer pong), une pour l'accueil. À imprimer depuis le navigateur
 * (Cmd+P) : les couleurs de fond sont volontairement absentes pour ne pas
 * vider une cartouche d'encre.
 */
export default function Impression() {
  return (
    <div className="bg-white text-black">
      <p className="sans-impression p-6 text-center text-sm text-gray-600">
        Cmd+P → « Imprimer » → format A4. Quatre pages : la roue, le quizz, les scores, l'accueil.
      </p>
      <Feuille
        emoji="🎡"
        titre="La roue des défis"
        soustitre="Tu tournes. Tu assumes."
        url={`${BASE}/roue`}
      />
      <Feuille
        emoji="🧠"
        titre="Le quizz"
        soustitre="Une seule tentative. Le classement est public."
        url={`${BASE}/quizz`}
      />
      <Feuille
        emoji="🎯"
        titre="Rentre ton score"
        soustitre="Palet, Mölkky, beer pong… Gagné ou perdu, ça reste gravé."
        url={`${BASE}/scores`}
        pied="Scanne à la fin de chaque partie : le jeu, les noms, qui a gagné. Le classement suit tout seul."
      />
      <Feuille
        emoji="🎉"
        titre="Les 30 ans de Titi & Djimi"
        soustitre="Les jeux, les scores, les classements : tout est là."
        url={BASE}
      />
    </div>
  )
}

function Feuille({
  emoji, titre, soustitre, url,
  pied = 'Scanne, mets ton pseudo, joue. Ton pseudo reste sur ton téléphone : tu peux revenir quand tu veux.',
}: {
  emoji: string; titre: string; soustitre: string; url: string; pied?: string
}) {
  return (
    <section
      className="mx-auto flex flex-col items-center justify-center gap-6 border-b border-dashed border-gray-300 p-10 text-center"
      style={{ minHeight: '297mm', width: '210mm', maxWidth: '100%', breakAfter: 'page' }}
    >
      <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Les 30 ans de Titi &amp; Djimi</p>
      <p style={{ fontSize: '90px', lineHeight: 1 }}>{emoji}</p>
      <h1 className="text-5xl" style={{ fontFamily: 'var(--font-titre)' }}>{titre}</h1>
      <p className="text-xl text-gray-700">{soustitre}</p>
      {/* Le SVG est en 100% × 100% : sans conteneur dimensionné, il s'effondre
          à zéro et la feuille part à l'imprimante sans son QR code. */}
      <div style={{ width: '260px', height: '260px' }} dangerouslySetInnerHTML={{ __html: svgQr(url) }} />
      <p className="text-lg font-mono text-gray-600">{url.replace('https://', '')}</p>
      <p className="max-w-md text-gray-600">{pied}</p>
    </section>
  )
}

function svgQr(url: string) {
  // Correction d'erreur haute : l'affiche va finir scotchée de travers sur une
  // porte de chiottes, potentiellement tachée. Elle doit rester lisible.
  const qr = qrcode(0, 'H')
  qr.addData(url)
  qr.make()
  return qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true })
}
