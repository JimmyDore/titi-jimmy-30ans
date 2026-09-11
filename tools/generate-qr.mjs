import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

import qrcode from 'qrcode-generator';

/**
 * Génère les QR codes à imprimer : un SVG (pour l'impression, net à toutes les
 * tailles) et un PNG (pour le coller dans Canva ou l'envoyer par WhatsApp).
 *
 * Le PNG est encodé à la main — l'alternative serait une dépendance de plus
 * pour un script qu'on lance trois fois dans sa vie.
 */
const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const BASE = process.env.BASE_URL ?? 'https://30anstitietjimmy.jimmydore.fr';

const CIBLES = [
  { nom: 'qr-roue', url: `${BASE}/roue` },
  { nom: 'qr-quizz', url: `${BASE}/quizz` },
  { nom: 'qr-scores', url: `${BASE}/scores` },
  { nom: 'qr-accueil', url: BASE },
];

mkdirSync('qr', { recursive: true });

for (const { nom, url } of CIBLES) {
  // Correction d'erreur haute : l'affiche finira scotchée de travers, peut-être tachée.
  const qr = qrcode(0, 'H');
  qr.addData(url);
  qr.make();

  writeFileSync(`qr/${nom}.svg`, qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true }));
  writeFileSync(`qr/${nom}.png`, pngDepuisQr(qr, 12, 4));
  console.log(`qr/${nom}.svg + .png  →  ${url}`);
}

function pngDepuisQr(qr, taillePixel, margeModules) {
  const modules = qr.getModuleCount();
  const cote = (modules + margeModules * 2) * taillePixel;
  // Niveaux de gris 8 bits : un octet par pixel, 0 = noir, 255 = blanc.
  const lignes = Buffer.alloc(cote * (cote + 1), 0xff);
  for (let y = 0; y < cote; y++) {
    const debut = y * (cote + 1);
    lignes[debut] = 0; // filtre « None »
    for (let x = 0; x < cote; x++) {
      const col = Math.floor(x / taillePixel) - margeModules;
      const ligne = Math.floor(y / taillePixel) - margeModules;
      const noir = col >= 0 && ligne >= 0 && col < modules && ligne < modules && qr.isDark(ligne, col);
      lignes[debut + 1 + x] = noir ? 0x00 : 0xff;
    }
  }

  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(cote, 0);
  entete.writeUInt32BE(cote, 4);
  entete[8] = 8;  // profondeur
  entete[9] = 0;  // niveaux de gris
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau('IHDR', entete),
    morceau('IDAT', deflateSync(lignes, { level: 9 })),
    morceau('IEND', Buffer.alloc(0)),
  ]);
}

function morceau(type, donnees) {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length, 0);
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corps), 0);
  return Buffer.concat([longueur, corps, crc]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const octet of buf) c = TABLE[(c ^ octet) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
