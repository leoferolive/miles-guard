import type { NotifyChannel } from '@nossoradar/shared';

import { sql } from './client.js';

/** Barramento Postgres LISTEN/NOTIFY (ADR-0003). */

export async function notify(channel: NotifyChannel, payload = ''): Promise<void> {
  await sql.notify(channel, payload);
}

/** Escuta um canal; retorna a função para cancelar a escuta. */
export async function listen(
  channel: NotifyChannel,
  onNotify: (payload: string) => void,
): Promise<() => Promise<void>> {
  const { unlisten } = await sql.listen(channel, onNotify);
  return unlisten;
}
