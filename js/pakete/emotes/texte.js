import { registriereTexte } from '../../sprache.js';

export const DE = {
  emotes: 'Emotes', chat: 'Schnell-Chat', schliessen: 'Schließen',
  gruppe: 'Emotes und Chat', an: 'Emotes und Schnell-Chat', anText: 'Zeigt die beiden Knöpfe in Partien.',
  daempfen: 'Emotes der Bots dämpfen', daempfenText: 'Bot-Antworten bleiben ruhiger und erscheinen als Text.',
  gesendet: '{text} gesendet', botSagt: '{name}: {text}',
  // Warum ein Knopf gerade gesperrt ist (SPIELKONZEPT 3.9)
  'grund.voll': 'Für diese Partie sind alle {n} Emotes verschickt.',
  'grund.fenster': 'Emotes gehen vor dem ersten Zug, direkt nach einem Zug von {name} und nach der Partie.',
  'grund.takt': 'Höchstens ein Emote alle {s} Sekunden. Gleich geht es wieder.',
  'grund.zuege.eins': 'Der nächste Satz geht nach deinem nächsten Zug.',
  'grund.zuege.mehr': 'Der nächste Satz geht nach {n} eigenen Zügen.',
  'grund.zuegeEnde': 'Ein Satz je {n} eigene Züge: In dieser Partie geht keiner mehr.',
  'grund.minute': 'Höchstens {n} Sätze je Minute. Gleich geht es wieder.',
  'emote.daumen': 'Daumen hoch', 'emote.applaus': 'Applaus', 'emote.staunen': 'Staunen', 'emote.denken': 'Nachdenken',
  'emote.respekt': 'Respekt', 'emote.hallo': 'Hallo', 'emote.gut': 'Gut gespielt', 'emote.uff': 'Uff',
  'chat.0': 'Viel Glück!', 'chat.1': 'Guter Zug!', 'chat.2': 'Ich überlege kurz.', 'chat.3': 'Gut gespielt!', 'chat.4': 'Danke!', 'chat.5': 'Noch eine?',
  // Antworten je Art der Eingabe; jede Antwort eines Topfs passt zu jeder Eingabe dieser Art
  'antwort.gruss.0': 'Hallo!', 'antwort.gruss.1': 'Schön, dass du da bist!', 'antwort.gruss.2': 'Viel Spaß dir!',
  'antwort.gleichfalls.0': 'Danke, dir auch!', 'antwort.gleichfalls.1': 'Dir auch, viel Spaß!', 'antwort.gleichfalls.2': 'Gleichfalls!',
  'antwort.dank.0': 'Danke!', 'antwort.dank.1': 'Danke, das freut mich.', 'antwort.dank.2': 'Danke, sehr nett von dir.',
  'antwort.gern.0': 'Gern!', 'antwort.gern.1': 'Gern geschehen!', 'antwort.gern.2': 'Sehr gern.',
  'antwort.trost.0': 'Passiert jedem.', 'antwort.trost.1': 'Kopf hoch, weiter geht’s.', 'antwort.trost.2': 'Ruhig bleiben, das wird.',
  'antwort.geduld.0': 'Lass dir Zeit.', 'antwort.geduld.1': 'Nur keine Eile.', 'antwort.geduld.2': 'Ich warte gern.',
  'antwort.spannend.0': 'Eine spannende Partie!', 'antwort.spannend.1': 'Spannend, oder?', 'antwort.spannend.2': 'Da ist was los!',
  'antwort.zusage.0': 'Gern, jederzeit!', 'antwort.zusage.1': 'Ich bin dabei!', 'antwort.zusage.2': 'Sehr gern, noch eine!',
  // Emote-Kreaturen (js/kreaturen-kunst.js), erst im Labor des Erfinder-Kontos
  kreaturen: 'Kreaturen', labor: 'Labor', keine: 'Keine', maskottchen: 'Maskottchen',
  begleiter: 'Emote-Kreatur', begleiterText: 'Zeigt Hallo, Staunen, Nachdenken und Gut gespielt als kleine Kreatur. Nur du siehst sie, solange sie im Labor sind.',
  kreaturenHinweis: 'Im Labor sieht sie nur dein Erfinder-Konto. Später schaltet jede Welt ihre Kreatur frei. Auswählen kannst du sie in den Einstellungen unter Emotes und Chat.',
  'kreatur.karo': 'Karo', 'kreatur.stups': 'Stups', 'kreatur.zinni': 'Zinni', 'kreatur.klippa': 'Klippa', 'kreatur.glimm': 'Glimm', 'kreatur.kronli': 'Kronli',
};

export const EN = {
  emotes: 'Emotes', chat: 'Quick chat', schliessen: 'Close',
  gruppe: 'Emotes and chat', an: 'Emotes and quick chat', anText: 'Shows both buttons during games.',
  daempfen: 'Tone down bot emotes', daempfenText: 'Bot replies stay subtle and appear as text.',
  gesendet: '{text} sent', botSagt: '{name}: {text}',
  'grund.voll': 'All {n} emotes for this game are used.',
  'grund.fenster': 'Emotes work before the first move, right after a move by {name} and after the game.',
  'grund.takt': 'At most one emote every {s} seconds. Ready again shortly.',
  'grund.zuege.eins': 'Your next phrase is ready after your next move.',
  'grund.zuege.mehr': 'Your next phrase is ready after {n} more moves of yours.',
  'grund.zuegeEnde': 'One phrase per {n} of your moves: no more in this game.',
  'grund.minute': 'At most {n} phrases per minute. Ready again shortly.',
  'emote.daumen': 'Thumbs up', 'emote.applaus': 'Applause', 'emote.staunen': 'Surprised', 'emote.denken': 'Thinking',
  'emote.respekt': 'Respect', 'emote.hallo': 'Hello', 'emote.gut': 'Good game', 'emote.uff': 'Oof',
  'chat.0': 'Good luck!', 'chat.1': 'Good move!', 'chat.2': 'Let me think for a moment.', 'chat.3': 'Good game!', 'chat.4': 'Thanks!', 'chat.5': 'Another game?',
  'antwort.gruss.0': 'Hello!', 'antwort.gruss.1': 'Good to see you!', 'antwort.gruss.2': 'Have fun!',
  'antwort.gleichfalls.0': 'Thanks, you too!', 'antwort.gleichfalls.1': 'You too, have fun!', 'antwort.gleichfalls.2': 'Same to you!',
  'antwort.dank.0': 'Thanks!', 'antwort.dank.1': 'Thanks, glad you think so.', 'antwort.dank.2': 'Thank you, that’s kind.',
  'antwort.gern.0': 'You’re welcome!', 'antwort.gern.1': 'My pleasure!', 'antwort.gern.2': 'Anytime!',
  'antwort.trost.0': 'Happens to everyone.', 'antwort.trost.1': 'Chin up, on we go.', 'antwort.trost.2': 'Stay calm, you’ve got this.',
  'antwort.geduld.0': 'Take your time.', 'antwort.geduld.1': 'No rush.', 'antwort.geduld.2': 'Happy to wait.',
  'antwort.spannend.0': 'An exciting game!', 'antwort.spannend.1': 'Exciting, isn’t it?', 'antwort.spannend.2': 'Lots going on!',
  'antwort.zusage.0': 'Sure, anytime!', 'antwort.zusage.1': 'Count me in!', 'antwort.zusage.2': 'Gladly, one more!',
  kreaturen: 'Creatures', labor: 'Lab', keine: 'None', maskottchen: 'Mascot',
  begleiter: 'Emote creature', begleiterText: 'Shows Hello, Surprised, Thinking and Good game as a little creature. Only you can see them while they are in the lab.',
  kreaturenHinweis: 'While they are in the lab, only your creator account can see them. Later each world unlocks its creature. Pick one in Settings under Emotes and chat.',
  'kreatur.karo': 'Karo', 'kreatur.stups': 'Stups', 'kreatur.zinni': 'Zinni', 'kreatur.klippa': 'Klippa', 'kreatur.glimm': 'Glimm', 'kreatur.kronli': 'Kronli',
};

registriereTexte('p-emotes', { de: DE, en: EN });
