import { registriereTexte } from '../../sprache.js';

export const DE = {
  emotes: 'Emotes', chat: 'Schnell-Chat', schliessen: 'Schließen', bereit: 'Noch einen Moment …',
  gruppe: 'Emotes und Chat', an: 'Emotes und Schnell-Chat', anText: 'Zeigt die beiden Knöpfe in Partien.',
  daempfen: 'Emotes der Bots dämpfen', daempfenText: 'Bot-Antworten bleiben ruhiger und erscheinen als Text.',
  gesendet: '{text} gesendet', botSagt: '{name}: {text}',
  'emote.daumen': 'Daumen hoch', 'emote.applaus': 'Applaus', 'emote.staunen': 'Staunen', 'emote.denken': 'Nachdenken',
  'emote.respekt': 'Respekt', 'emote.hallo': 'Hallo', 'emote.gut': 'Gut gespielt', 'emote.uff': 'Uff',
  'chat.0': 'Viel Glück!', 'chat.1': 'Guter Zug!', 'chat.2': 'Ich überlege kurz.', 'chat.3': 'Gut gespielt!', 'chat.4': 'Danke!', 'chat.5': 'Noch eine?',
  // Antworten nach der Art der Eingabe: Gruss, Dank (auch auf Lob), Trost (auf ein Missgeschick), neutral
  'antwort.gruss.0': 'Hallo!', 'antwort.gruss.1': 'Schön, dass du da bist!', 'antwort.gruss.2': 'Viel Spaß dir!',
  'antwort.dank.0': 'Danke!', 'antwort.dank.1': 'Gern!', 'antwort.dank.2': 'Das freut mich.',
  'antwort.trost.0': 'Passiert jedem.', 'antwort.trost.1': 'Kopf hoch, weiter geht’s.', 'antwort.trost.2': 'Ruhig bleiben, das wird.',
  'antwort.neutral.0': 'Ich denke auch nach …', 'antwort.neutral.1': 'Eine spannende Partie!', 'antwort.neutral.2': 'Weiter geht’s!',
};

export const EN = {
  emotes: 'Emotes', chat: 'Quick chat', schliessen: 'Close', bereit: 'Just a moment …',
  gruppe: 'Emotes and chat', an: 'Emotes and quick chat', anText: 'Shows both buttons during games.',
  daempfen: 'Tone down bot emotes', daempfenText: 'Bot replies stay subtle and appear as text.',
  gesendet: '{text} sent', botSagt: '{name}: {text}',
  'emote.daumen': 'Thumbs up', 'emote.applaus': 'Applause', 'emote.staunen': 'Surprised', 'emote.denken': 'Thinking',
  'emote.respekt': 'Respect', 'emote.hallo': 'Hello', 'emote.gut': 'Good game', 'emote.uff': 'Oof',
  'chat.0': 'Good luck!', 'chat.1': 'Good move!', 'chat.2': 'Let me think for a moment.', 'chat.3': 'Good game!', 'chat.4': 'Thanks!', 'chat.5': 'Another game?',
  'antwort.gruss.0': 'Hello!', 'antwort.gruss.1': 'Good to see you!', 'antwort.gruss.2': 'Have fun!',
  'antwort.dank.0': 'Thanks!', 'antwort.dank.1': 'My pleasure!', 'antwort.dank.2': 'That’s kind of you.',
  'antwort.trost.0': 'Happens to everyone.', 'antwort.trost.1': 'Chin up, on we go.', 'antwort.trost.2': 'Stay calm, you’ve got this.',
  'antwort.neutral.0': 'Let me think too …', 'antwort.neutral.1': 'An exciting game!', 'antwort.neutral.2': 'On we go!',
};

registriereTexte('p-emotes', { de: DE, en: EN });
