import { Injectable, Logger } from '@nestjs/common';

export interface PushMessage {
  pushToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  /** Send an Expo push notification directly (no Redis queue). */
  async send(message: PushMessage): Promise<void> {
    const { pushToken, title, body, data } = message;

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          to: pushToken,
          title,
          body,
          data,
          sound: 'default',
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        const masked = pushToken ? `…${pushToken.slice(-6)}` : 'unknown';
        this.logger.warn(`Push failed for token ${masked}: ${err}`);
        return;
      }

      this.logger.log(`Push sent: ${title}`);
    } catch (err) {
      this.logger.warn(`Push request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
