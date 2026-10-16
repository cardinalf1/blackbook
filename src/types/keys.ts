// How a saved API key (Groq or Desmos) is kept on this computer. The key itself never leaves the
// local program; the page only learns whether one is saved and how it is protected.

/** 'encrypted': sealed with the operating system's key store. 'file': a plain file only this user can read. */
export type KeyProtection = 'encrypted' | 'file';

export const KEY_PROTECTION_NOTE: Record<KeyProtection, string> = {
  encrypted: "Saved encrypted with your computer's own key store.",
  file: "Saved in a file in Blackbook's data folder. This computer could not encrypt it, so keep your user account private.",
};
