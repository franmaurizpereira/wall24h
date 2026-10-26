import { httpError } from './errors.js';

// Lista de ejemplo para el MVP. Sustituir por un servicio de moderación real.
const DEFAULT_BANNED_WORDS = ['contenido_prohibido'];

function normalizeForMatch(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function bannedWords() {
  const extra = (process.env.MODERATION_BANNED_WORDS ?? '')
    .split(',')
    .map((word) => word.trim())
    .filter(Boolean);

  return [...DEFAULT_BANNED_WORDS, ...extra];
}

export async function moderate(text) {
  const normalized = normalizeForMatch(text);

  if (bannedWords().some((word) => normalized.includes(normalizeForMatch(word)))) {
    throw httpError(422, 'content_not_allowed', 'El contenido no está permitido');
  }
}
