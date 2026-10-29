import { registriereTexte } from '../../sprache.js';

export const DE = {
  emotes: 'Emotes', chat: 'Schnell-Chat', schliessen: 'Schließen', bereit: 'Noch einen Moment …',
  gruppe: 'Emotes und Chat', an: 'Emotes und Schnell-Chat', anText: 'Zeigt die beiden Knöpfe in Partien.',
  daempfen: 'Emotes der Bots dämpfen', daempfenText: 'Bot-Antworten bleiben ruhiger und erscheinen als Text.',
  gesendet: '{text} gesendet', botSagt: '{name}: {text}',
  'emote.daumen': 'Daumen hoch', 'emote.lachen': 'Lachen', 'emote.staunen': 'Staunen', 'emote.denken': 'Nachdenken',
  'emote.respekt': 'Respekt', 'emote.hallo': 'Hallo', 'emote.gut': 'Gut gespielt', 'emote.uff': 'Uff',
  'chat.0': 'Viel Glück!', 'chat.1': 'Guter Zug!', 'chat.2': 'Oh nein!', 'chat.3': 'Gut gespielt!', 'chat.4': 'Danke!', 'chat.5': 'Noch eine?',
  'antwort.1.0': 'Hallo!', 'antwort.1.1': 'Das macht Spaß!', 'antwort.1.2': 'Ein guter Zug!',
  'antwort.2.0': 'Respekt!', 'antwort.2.1': 'Ich denke nach …', 'antwort.2.2': 'Weiter geht’s!',
  'antwort.3.0': 'Sauber gespielt!', 'antwort.3.1': 'Das merke ich mir.', 'antwort.3.2': 'Stark!',
  'antwort.4.0': 'Ruhig bleiben.', 'antwort.4.1': 'Eine spannende Partie!', 'antwort.4.2': 'Gut gesehen!',
  'antwort.5.0': 'Respekt.', 'antwort.5.1': 'Präzise.', 'antwort.5.2': 'Gut gespielt.',
};

export const EN = {
  emotes: 'Emotes', chat: 'Quick chat', schliessen: 'Close', bereit: 'Just a moment …',
  gruppe: 'Emotes and chat', an: 'Emotes and quick chat', anText: 'Shows both buttons during games.',
  daempfen: 'Tone down bot emotes', daempfenText: 'Bot replies stay subtle and appear as text.',
  gesendet: '{text} sent', botSagt: '{name}: {text}',
  'emote.daumen': 'Thumbs up', 'emote.lachen': 'Laugh', 'emote.staunen': 'Surprised', 'emote.denken': 'Thinking',
  'emote.respekt': 'Respect', 'emote.hallo': 'Hello', 'emote.gut': 'Good game', 'emote.uff': 'Oof',
  'chat.0': 'Good luck!', 'chat.1': 'Good move!', 'chat.2': 'Oh no!', 'chat.3': 'Good game!', 'chat.4': 'Thanks!', 'chat.5': 'Another game?',
  'antwort.1.0': 'Hello!', 'antwort.1.1': 'This is fun!', 'antwort.1.2': 'Nice move!',
  'antwort.2.0': 'Respect!', 'antwort.2.1': 'Let me think …', 'antwort.2.2': 'On we go!',
  'antwort.3.0': 'Clean play!', 'antwort.3.1': 'I’ll remember that.', 'antwort.3.2': 'Strong!',
  'antwort.4.0': 'Stay calm.', 'antwort.4.1': 'An exciting game!', 'antwort.4.2': 'Good spot!',
  'antwort.5.0': 'Respect.', 'antwort.5.1': 'Precise.', 'antwort.5.2': 'Good game.',
};

registriereTexte('p-emotes', { de: DE, en: EN });
