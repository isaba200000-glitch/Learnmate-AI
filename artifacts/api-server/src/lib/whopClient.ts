import Whop from '@whop/sdk';

let clientPromise: Promise<Whop> | null = null;

async function initWhopClient(): Promise<Whop> {
  // On Render (or any non-Replit host) set WHOP_API_KEY directly in env vars.
  if (process.env.WHOP_API_KEY) {
    return new Whop({ apiKey: process.env.WHOP_API_KEY });
  }

  // Replit development: fetch credentials through the Replit connector proxy.
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      'Whop API key not configured. ' +
        'On Render set the WHOP_API_KEY environment variable. ' +
        'On Replit connect Whop via the Integrations tab.',
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=whop`,
    {
      headers: { Accept: 'application/json', X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!resp.ok) {
    throw new Error(
      `Failed to fetch Whop credentials: ${resp.status} ${resp.statusText}`,
    );
  }

  const data = (await resp.json()) as {
    items?: Array<{ settings?: { api_key?: string } }>;
  };
  const settings = data.items?.[0]?.settings;

  if (!settings?.api_key) {
    throw new Error(
      'Whop integration not connected or missing credentials. ' +
        'Connect Whop via the Integrations tab first.',
    );
  }

  return new Whop({ apiKey: settings.api_key });
}

export function getWhopClient(): Promise<Whop> {
  if (!clientPromise) {
    clientPromise = initWhopClient().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }

  return clientPromise;
}
