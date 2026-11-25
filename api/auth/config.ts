import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getEnvConfig, setNoStoreHeaders } from './_utils';

export default function handler(req: VercelRequest, res: VercelResponse): void {
  setNoStoreHeaders(res);

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { clientId } = getEnvConfig();
  if (!clientId) {
    res.status(500).json({
      error: 'GOOGLE_CLIENT_ID_MISSING',
      message:
        'La variable d’environnement GOOGLE_CLIENT_ID n’est pas configurée sur le serveur Vercel.',
    });
    return;
  }

  res.status(200).json({ clientId });
}
