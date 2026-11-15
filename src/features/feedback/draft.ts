// Черновик сообщения переживает закрытие окна и перезагрузку (localStorage; недоступен — просто не хранится).

const KEY = 'dota-lore-map.feedback.draft';

export function loadDraft(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveDraft(text: string) {
  try {
    if (text) window.localStorage.setItem(KEY, text);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Приватный режим или запрет хранилища: черновик живёт, только пока открыта страница.
  }
}
