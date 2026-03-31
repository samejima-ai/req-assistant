import { useEffect } from 'react';

const STORAGE_KEY = 'req-assistant-project';

/**
 * nodes/edges/messagesをlocalStorageに自動保存・復元する
 * @returns {{ savedData: {nodes, edges, messages} | null, clearSaved: () => void }}
 */
export function loadSavedProject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProject(nodes, edges, messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, messages }));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}

export function clearSavedProject() {
  localStorage.removeItem(STORAGE_KEY);
}
