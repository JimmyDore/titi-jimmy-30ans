import { effacerJoueur, lireJoueur } from './storage';

export class ErreurApi extends Error {
  constructor(public code: number, public raison: string) {
    super(raison);
  }
}

async function appeler<T>(chemin: string, options: RequestInit & { corps?: unknown } = {}): Promise<T> {
  const joueur = lireJoueur();
  const res = await fetch(`/api${chemin}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(joueur ? { Authorization: `Bearer ${joueur.token}` } : {}),
      ...(options.headers ?? {}),
    },
    body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
  });
  const corps = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Un jeton que le serveur ne connaît plus — base remise à zéro depuis
    // /admin, ou conteneur reparti sur une base vide — laissait le joueur
    // coincé sur « Impossible de charger le quizz », sans même pouvoir
    // ressaisir un pseudo. On efface l'identité morte et on recharge : il
    // retombe sur l'écran pseudo, sur le jeu qu'il essayait d'ouvrir.
    // Les 401 de /admin, eux, sont un mauvais code et pas un jeton mort.
    if (res.status === 401 && joueur && !chemin.startsWith('/admin')) {
      effacerJoueur();
      location.reload();
    }
    throw new ErreurApi(res.status, (corps as { erreur?: string }).erreur ?? 'inconnu');
  }
  return corps as T;
}

export type Question = {
  id: string;
  type: 'duo' | 'qcm' | 'selpoivre';
  texte: string;
  options: { id: string; label: string }[];
  verif: string;
};

export type EtatQuizz = {
  sel: string;
  questions: Question[];
  reponses: { questionId: string; optionId: string }[];
  fini: boolean;
  score: number | null;
  total: number;
};

export type Tour = {
  id: string;
  index: number;
  segmentId: string;
  label: string;
  emoji: string;
  consigne: string;
  type: 'defi' | 'sauve';
};

export type Segment = { id: string; label: string; emoji: string; type: 'defi' | 'sauve' };

export type Jeu = { id: string; label: string; emoji: string; nomLibre: boolean };

export type CatalogueJeux = {
  jeux: Jeu[];
  /** Pseudos et noms déjà saisis, pour l'autocomplétion. */
  noms: string[];
  /** Les jeux à nom libre déjà joués (« Uno »…). */
  nomsJeux: { jeuId: string; nom: string }[];
};

export type NouvellePartie = {
  jeuId: string;
  nomJeu?: string;
  equipe: string[];
  adversaires: string[];
  gagne: boolean;
  scoreEquipe: number | null;
  scoreAdversaires: number | null;
};

export type ClassementJeu = {
  cle: string;
  jeuId: string;
  nom: string;
  emoji: string;
  parties: number;
  joueurs: { nom: string; victoires: number; parties: number }[];
  dernieres: {
    id: string; gagnants: string[]; perdants: string[];
    scoreGagnants: number | null; scorePerdants: number | null; saisieAt: string;
    /** Seulement dans le classement global, qui mélange les jeux. */
    emoji?: string;
  }[];
};

export type Classements = {
  quizz: { pseudo: string; score: number; quizz_fini_at: string }[];
  roue: { pseudo: string; tours: number; releves: number }[];
  jeux: ClassementJeu[];
  total: number;
};

export const api = {
  creerJoueur: (pseudo: string) =>
    appeler<{ id: string; pseudo: string; token: string }>('/joueurs', { method: 'POST', corps: { pseudo } }),
  quizz: () => appeler<EtatQuizz>('/quizz'),
  repondre: (questionId: string, optionId: string) =>
    appeler<{ juste: boolean; explication: string | null }>('/quizz/reponses', {
      method: 'POST', corps: { questionId, optionId },
    }),
  finirQuizz: () => appeler<{ score: number; total: number }>('/quizz/fin', { method: 'POST' }),
  roue: () => appeler<{ segments: Segment[] }>('/roue'),
  tourner: () => appeler<Tour>('/roue/tours', { method: 'POST' }),
  releve: (tourId: string) => appeler<{ ok: boolean }>(`/roue/tours/${tourId}/releve`, { method: 'POST' }),
  mesTours: () => appeler<{ tours: { id: string; label: string; type: string; releve: number; tire_at: string }[] }>('/roue/mes-tours'),
  jeux: () => appeler<CatalogueJeux>('/jeux'),
  enregistrerPartie: (partie: NouvellePartie) => appeler<{ id: string }>('/parties', { method: 'POST', corps: partie }),
  annulerPartie: (id: string) => appeler<{ ok: boolean }>(`/parties/${id}`, { method: 'DELETE' }),
  classements: () => appeler<Classements>('/classements'),
  verifAdmin: (code: string) => appeler<{ ok: boolean }>('/admin/verif', { method: 'POST', corps: { code } }),
  donneesAdmin: (code: string) =>
    appeler<AdminDonnees>('/admin/donnees', { headers: { 'x-admin-code': code } }),
  resetAdmin: (code: string, portee: string) =>
    appeler<{ ok: boolean }>('/admin/reset', { method: 'POST', headers: { 'x-admin-code': code }, corps: { portee } }),
  supprimerPartieAdmin: (code: string, id: string) =>
    appeler<{ ok: boolean }>(`/admin/parties/${id}`, { method: 'DELETE', headers: { 'x-admin-code': code } }),
};

export type AdminDonnees = {
  joueurs: {
    id: string; pseudo: string; score: number | null; quizz_fini_at: string | null;
    cree_at: string; repondues: number; tours: number; releves: number;
  }[];
  tours: { id: string; joueur_id: string; label: string; type: string; releve: number; tire_at: string }[];
  reponses: { joueur_id: string; question_id: string; option_id: string }[];
  parties: {
    id: string; jeu_id: string; jeu_nom: string; score_gagnants: number | null; score_perdants: number | null;
    saisie_at: string; auteur: string | null; gagnants: string[]; perdants: string[];
  }[];
  contenu: {
    jeux: { id: string; label: string; emoji: string }[];
    quizz: {
      categories: { id: string; label: string; tirage: number }[];
      questions: {
        id: string; texte: string; categorie: string; reponse: string;
        options: { id: string; label: string }[];
      }[];
    };
  };
};
