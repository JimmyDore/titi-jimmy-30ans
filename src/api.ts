import { lireJoueur } from './storage';

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
  if (!res.ok) throw new ErreurApi(res.status, (corps as { erreur?: string }).erreur ?? 'inconnu');
  return corps as T;
}

export type Question = {
  id: string;
  type: 'duo' | 'qcm';
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

export type Classements = {
  quizz: { pseudo: string; score: number; quizz_fini_at: string }[];
  roue: { pseudo: string; tours: number; releves: number }[];
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
  classements: () => appeler<Classements>('/classements'),
  verifAdmin: (code: string) => appeler<{ ok: boolean }>('/admin/verif', { method: 'POST', corps: { code } }),
  donneesAdmin: (code: string) =>
    appeler<AdminDonnees>('/admin/donnees', { headers: { 'x-admin-code': code } }),
  resetAdmin: (code: string, portee: string) =>
    appeler<{ ok: boolean }>('/admin/reset', { method: 'POST', headers: { 'x-admin-code': code }, corps: { portee } }),
};

export type AdminDonnees = {
  joueurs: {
    id: string; pseudo: string; score: number | null; quizz_fini_at: string | null;
    cree_at: string; repondues: number; tours: number; releves: number;
  }[];
  tours: { id: string; joueur_id: string; label: string; type: string; releve: number; tire_at: string }[];
  reponses: { joueur_id: string; question_id: string; option_id: string }[];
  contenu: {
    quizz: { questions: { id: string; texte: string; reponse: string; options: { id: string; label: string }[] }[] };
  };
};
