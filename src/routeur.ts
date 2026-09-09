import { useEffect, useState } from 'react';

/**
 * Routeur maison : cinq pages, pas de dépendance. nginx renvoie index.html sur
 * tous les chemins (`try_files`), donc les liens directs des QR codes
 * (/roue, /quizz) arrivent bien ici.
 */
export function useRoute() {
  const [chemin, setChemin] = useState(() => window.location.pathname);
  useEffect(() => {
    const surRetour = () => setChemin(window.location.pathname);
    window.addEventListener('popstate', surRetour);
    return () => window.removeEventListener('popstate', surRetour);
  }, []);
  return chemin;
}

export function naviguer(chemin: string) {
  if (window.location.pathname === chemin) return;
  window.history.pushState({}, '', chemin);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}
