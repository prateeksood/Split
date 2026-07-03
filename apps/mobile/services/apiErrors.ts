export function parseApiErrorMessage(body: string): string {
  if (!body.trim()) return 'Something went wrong. Please try again.';

  try {
    const json = JSON.parse(body) as { message?: string | string[] };
    if (Array.isArray(json.message)) return json.message.join('. ');
    if (typeof json.message === 'string' && json.message.trim()) return json.message;
  } catch {
    // plain text response
  }

  return body.length > 200 ? 'Something went wrong. Please try again.' : body;
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message && !error.message.startsWith('{')) {
    return error.message;
  }
  if (error instanceof Error) {
    return parseApiErrorMessage(error.message);
  }
  return 'Something went wrong. Please try again.';
}
