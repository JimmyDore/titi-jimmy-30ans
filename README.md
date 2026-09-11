# Les 30 ans de Titi & Djimi

Mini-site de soirée : une **roue des défis**, un **quizz** et des **scores de
jeux** (palet, Mölkky, beer pong…), un pseudo par personne, des classements
publics et un panneau admin.

**En ligne :** https://30anstitietjimmy.jimmydore.fr

## Comment ça marche

Chacun scanne un QR code (`/roue`, `/quizz` ou `/scores`), choisit un pseudo — gardé dans
le localStorage de son téléphone — et joue.

- **Roue des défis** : autant de tours qu'on veut. Le tirage est fait *par le
  serveur* puis animé dans le navigateur, donc impossible de relancer un
  résultat qui ne plaît pas. Bouton « j'l'ai fait » pour valider le défi.
- **Quizz** : une seule tentative par pseudo, questions dans un ordre propre à
  chaque joueur, correction affichée immédiatement. Un quizz interrompu reprend
  exactement où il en était.
- **Rentre ton score** (`/scores`) : on choisit un jeu (palet, Mölkky,
  cornhole… ou un jeu de société dont on tape le nom), les noms de chaque camp
  — libres, la tante sans téléphone compte aussi —, gagné ou perdu, et un score
  facultatif. L'auteur peut annuler sa saisie juste après l'avoir envoyée.
- **Classements** : le quizz se classe au score (ex aequo départagés à l'ordre
  d'arrivée), la roue au nombre de défis **relevés**, chaque jeu au nombre de
  **victoires** (à égalité, le moins de parties jouées passe devant), et
  « Global » additionne tous les jeux. Les noms sont comparés sans casse ni
  espaces en trop : « kevin » et « Kevin » cumulent.

## Éditer le contenu

Tout ce qui se lit à l'écran est dans **`content.json`**, à la racine. Aucune
autre modification n'est nécessaire pour ajouter une question ou un défi.

**Les catégories du quizz.** Personne ne joue tout le vivier : chaque joueur
reçoit un **tirage** de questions par catégorie, mélangé. Ajouter dix questions
de culture gé ne rallonge donc pas le quizz, ça le diversifie — deux personnes
assises côte à côte n'ont pas les mêmes.

```json
"categories": [
  { "id": "perso", "label": "Titi & Djimi", "tirage": 4 },
  { "id": "burger", "label": "Burger Quiz", "tirage": 8 },
  { "id": "culture", "label": "Culture gé", "tirage": 0 },
  { "id": "logique", "label": "Logique", "tirage": 4 }
]
```

`label` est le nom lisible de la catégorie, utilisé dans les messages du
serveur. Il ne s'affiche pas aux joueurs : la catégorie sert au tirage, pas au
jeu. `tirage` est le nombre de questions piochées : la répartition ci-dessus
fait un quizz de 16.

`tirage: 0` met une catégorie de côté — ses questions restent dans le fichier
mais ne sortent jamais. C'est la façon de remiser un paquet sans le supprimer,
et de le faire revenir en changeant un seul chiffre.

Une catégorie qui a moins de questions que son `tirage` ne bloque rien — elle en
rend moins, et le serveur le signale au démarrage.

**Une question de quizz :**

```json
{
  "id": "anecdote-piscine",
  "categorie": "perso",
  "type": "qcm",
  "texte": "Qui a fini dans la piscine tout habillé ?",
  "options": [{ "id": "a", "label": "Titi" }, { "id": "b", "label": "Djimi" }],
  "reponse": "a",
  "explication": "Titi. Il dit que c'est le carrelage."
}
```

`categorie` doit correspondre à l'`id` d'une catégorie déclarée plus haut : le
serveur refuse de démarrer sinon. `reponse` doit correspondre à l'`id` d'une
option.

`type` vaut `duo` (deux choix), `qcm` (choix multiples) ou `selpoivre` (deux
sujets et « Les deux ») — c'est purement décoratif, le fonctionnement est
identique. Rien n'impose quatre propositions : trois marchent très bien.

**Une question « sel ou poivre » :** le duo est porté par les propositions, pas
par l'énoncé — celui-ci n'est qu'une affirmation à ranger d'un côté ou de
l'autre, et la troisième option est toujours « Les deux ».

```json
{
  "id": "bq-sp-exemple",
  "categorie": "burger",
  "type": "selpoivre",
  "texte": "« Fait ses tournées sur une broche »",
  "options": [
    { "id": "sel", "label": "Pavarotti" },
    { "id": "poivre", "label": "Un poulet rôti" },
    { "id": "deux", "label": "Les deux" }
  ],
  "reponse": "poivre",
  "explication": "Le poulet rôti. Personne ne ficelle Pavarotti avant une tournée."
}
```

**Un segment de roue :**

```json
{ "id": "squats", "type": "defi", "label": "Squats", "emoji": "🏋️",
  "consigne": "5 squats, maintenant, devant tout le monde.", "poids": 1 }
```

`type` vaut `defi` (compté dans le classement) ou `sauve` (rien à faire).
`poids` règle la fréquence : un segment à `2` sort deux fois plus souvent qu'un
segment à `1`.

**Un jeu, pour « Rentre ton score » :**

```json
{ "id": "palet", "label": "Palet", "emoji": "🥏" }
```

Avec `"nomLibre": true`, le nom du jeu se tape au moment de la saisie (« Jeu de
société » → « Uno », « Skyjo »…) et chaque nom a son propre classement.
Renommer un `label` renomme le classement existant, sans perdre les parties.

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

On y voit qui a joué, le détail des réponses, tous les tours de roue, toutes
les parties saisies (supprimables une par une, pour la victoire inventée à
3 h du matin), et cinq boutons de remise à zéro (roue seule / quizz seul /
scores des jeux / joueurs / tout), chacun protégé par une confirmation à taper.

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

La page `/print` produit directement quatre feuilles A4 prêtes à imprimer
(roue, quizz, scores, accueil) : `Cmd+P`, format A4.

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
