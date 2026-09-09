# Les 30 ans de Titi & Jimmy

Mini-site de soirée : une **roue des défis** et un **quizz**, un pseudo par
personne, deux classements publics et un panneau admin.

**En ligne :** https://30anstitietjimmy.jimmydore.fr

## Comment ça marche

Chacun scanne un QR code (`/roue` ou `/quizz`), choisit un pseudo — gardé dans
le localStorage de son téléphone — et joue.

- **Roue des défis** : autant de tours qu'on veut. Le tirage est fait *par le
  serveur* puis animé dans le navigateur, donc impossible de relancer un
  résultat qui ne plaît pas. Bouton « j'l'ai fait » pour valider le défi.
- **Quizz** : une seule tentative par pseudo, questions dans un ordre propre à
  chaque joueur, correction affichée immédiatement. Un quizz interrompu reprend
  exactement où il en était.
- **Classements** : le quizz se classe au score (ex aequo départagés à l'ordre
  d'arrivée), la roue au nombre de défis **relevés**.

## Éditer le contenu

Tout ce qui se lit à l'écran est dans **`content.json`**, à la racine. Aucune
autre modification n'est nécessaire pour ajouter une question ou un défi.

**Une question de quizz :**

```json
{
  "id": "anecdote-piscine",
  "type": "qcm",
  "texte": "Qui a fini dans la piscine tout habillé ?",
  "options": [{ "id": "a", "label": "Titi" }, { "id": "b", "label": "Djimi" }],
  "reponse": "a",
  "explication": "Titi. Il dit que c'est le carrelage."
}
```

`type` vaut `duo` (deux choix) ou `qcm` (quatre choix) — c'est purement
décoratif, le fonctionnement est identique. `reponse` doit correspondre à l'`id`
d'une option.

**Un segment de roue :**

```json
{ "id": "squats", "type": "defi", "label": "Squats", "emoji": "🏋️",
  "consigne": "5 squats, maintenant, devant tout le monde.", "poids": 1 }
```

`type` vaut `defi` (compté dans le classement) ou `sauve` (rien à faire).
`poids` règle la fréquence : un segment à `2` sort deux fois plus souvent qu'un
segment à `1`.

**Deux règles :**

1. **Ne jamais réutiliser un `id` déjà servi.** Les parties en cours y sont
   rattachées.
2. Le serveur **refuse de démarrer** si `content.json` est invalide (id
   dupliqué, réponse qui ne pointe sur aucune option…). Un déploiement rouge
   vaut mieux qu'un quizz à trous découvert le soir même.

Après édition : `git push` sur `main`, et c'est en ligne en ~2 minutes.

## Panneau admin

`/admin` (petit lien en bas de l'accueil), code à 4 chiffres. Le code vit
uniquement dans le secret GitHub `ADMIN_CODE` — il n'est **pas** dans ce dépôt,
qui est public.

On y voit qui a joué, le détail des réponses, tous les tours de roue, et quatre
boutons de remise à zéro (roue seule / quizz seul / joueurs / tout), chacun
protégé par une confirmation à taper.

## Développement

```bash
npm install
ADMIN_CODE=0000 npm run api   # API sur :8787
npm run dev                   # front sur :5173, /api est proxifié
```

Tests : `npm test` (front) et `cd server && node --test "test/*.test.mjs"` (API).

## QR codes

```bash
npm run qr        # écrit qr/*.svg et qr/*.png
```

La page `/print` produit directement trois feuilles A4 prêtes à imprimer
(roue, quizz, accueil) : `Cmd+P`, format A4.

## Déploiement

Push sur `main` → GitHub Actions → SSH sur le VPS Hetzner → `git pull` +
`docker compose up -d --build` → health check sur le domaine.

Deux conteneurs (`titijimmy-web` nginx, `titijimmy-api` Node), aucun port
publié : le seul Caddy de la machine (stack RaveTycoon) sert de reverse proxy
et gère le TLS. **La route du domaine vit dans `RaveTycoon/deploy/Caddyfile`**,
pas ici — une modification faite à la main sur le serveur serait écrasée au
prochain déploiement de RaveTycoon.

Secrets GitHub attendus : `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `ADMIN_CODE`.

La base SQLite vit dans le volume Docker `titijimmy-data` et survit aux
déploiements. Seuls les boutons de reset l'effacent.

## Une limite assumée

Le front corrige le quizz **en local** pour que ce soit instantané même avec un
réseau saturé : l'API envoie les questions sans les bonnes réponses, mais avec
un hash qui permet de vérifier un choix. Quelqu'un de motivé peut hasher les
quatre options d'une question et retrouver la bonne. Le score du classement,
lui, est toujours recalculé côté serveur. C'était le compromis choisi : la
vitesse pour 40 personnes plutôt que l'inviolabilité contre un seul tricheur.
