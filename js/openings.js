// Eroeffnungs-Tabelle: Buchzuege und deutsche Namen. Zuege in englischer SAN.
// Erkennung ueber Stellungen (nicht nur Zugfolgen), damit Zugumstellungen passen.
// Englische Version (Teil 1): die Namen der Tabelle (und damit gespeicherte Partien und Analysen) bleiben deutsch.
// Angezeigt wird ueber eroeffnungsAnzeige(name): der Name in der eingestellten Sprache (Woerterbuch
// js/sprachen/eroeffnungen.js); unbekannte Namen kommen unveraendert zurueck.
import { Chess } from '../vendor/chess/chess.js';
import { t, texte, SPRACHEN } from './sprache.js';
import './sprachen/eroeffnungen.js';

// Buchzuege zaehlen nur in den ersten Halbzuegen (laengste Tabellenzeile: 16)
export const BUCH_GRENZE = 16;
// Namen werden etwas laenger gesucht (spaete Zugumstellung in eine benannte Stellung)
const NAMEN_GRENZE = 24;

export const EROEFFNUNGEN = [
  // ---------- Erster Zug von Weiss ----------
  { zuege: 'e4', name: 'Königsbauernspiel' },
  { zuege: 'd4', name: 'Damenbauernspiel' },
  { zuege: 'c4', name: 'Englische Eröffnung' },
  { zuege: 'Nf3', name: 'Réti-Eröffnung' },
  { zuege: 'f4', name: 'Bird-Eröffnung' },
  { zuege: 'b3', name: 'Nimzowitsch-Larsen-Angriff' },
  { zuege: 'g3', name: 'Benkö-Eröffnung' },
  { zuege: 'b4', name: 'Sokolski-Eröffnung' },
  { zuege: 'Nc3', name: 'Van-Geet-Eröffnung' },
  { zuege: 'e3', name: 'Van-’t-Kruijs-Eröffnung' },
  { zuege: 'd3', name: 'Mieses-Eröffnung' },
  { zuege: 'c3', name: 'Saragossa-Eröffnung' },
  { zuege: 'a3', name: 'Anderssen-Eröffnung' },
  { zuege: 'h3', name: 'Clemenz-Eröffnung' },
  { zuege: 'g4', name: 'Grob-Angriff' },
  { zuege: 'f3', name: 'Barnes-Eröffnung' },
  { zuege: 'a4', name: 'Ware-Eröffnung' },
  { zuege: 'h4', name: 'Kádas-Eröffnung' },
  { zuege: 'Na3', name: 'Durkin-Eröffnung' },
  { zuege: 'Nh3', name: 'Amar-Eröffnung' },

  // ---------- 1.e4: Antworten ----------
  { zuege: 'e4 e5', name: 'Offene Partie' },
  { zuege: 'e4 c5', name: 'Sizilianische Verteidigung' },
  { zuege: 'e4 e6', name: 'Französische Verteidigung' },
  { zuege: 'e4 c6', name: 'Caro-Kann-Verteidigung' },
  { zuege: 'e4 d5', name: 'Skandinavische Verteidigung' },
  { zuege: 'e4 Nf6', name: 'Aljechin-Verteidigung' },
  { zuege: 'e4 d6', name: 'Pirc-Verteidigung' },
  { zuege: 'e4 g6', name: 'Moderne Verteidigung' },
  { zuege: 'e4 Nc6', name: 'Nimzowitsch-Verteidigung' },
  { zuege: 'e4 b6', name: 'Owen-Verteidigung' },
  { zuege: 'e4 a6', name: 'St.-Georgs-Verteidigung' },

  // ---------- Offene Spiele ----------
  { zuege: 'e4 e5 Nf3', name: 'Königsspringerspiel' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5', name: 'Spanische Partie' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 a6', name: 'Spanische Partie: Morphy-Verteidigung' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6', name: 'Spanische Partie: Abtauschvariante' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O', name: 'Spanische Partie: Abtauschvariante' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6', name: 'Spanische Partie: Verbesserte Steinitz-Verteidigung' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7', name: 'Spanische Partie: Geschlossene Variante' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O', name: 'Spanische Partie: Geschlossene Hauptvariante' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5', name: 'Spanische Partie: Marshall-Angriff' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4', name: 'Spanische Partie: Offene Variante' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O b5 Bb3 Bb7', name: 'Spanische Partie: Archangelsk-Variante' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 Nf6', name: 'Spanische Partie: Berliner Verteidigung' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8', name: 'Spanische Partie: Berliner Mauer' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 f5', name: 'Spanische Partie: Schliemann-Verteidigung' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 d6', name: 'Spanische Partie: Steinitz-Verteidigung' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 Bc5', name: 'Spanische Partie: Klassische Verteidigung' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 Nd4', name: 'Spanische Partie: Bird-Verteidigung' },
  { zuege: 'e4 e5 Nf3 Nc6 Bb5 g6', name: 'Spanische Partie: Fianchetto-Verteidigung' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4', name: 'Italienische Partie' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4 Bc5', name: 'Italienische Partie: Giuoco Piano' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4', name: 'Italienische Partie: Hauptvariante' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3', name: 'Italienische Partie: Giuoco Pianissimo' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4 Bc5 d3', name: 'Italienische Partie: Giuoco Pianissimo' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4', name: 'Evans-Gambit' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3', name: 'Angenommenes Evans-Gambit' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4 Nf6', name: 'Zweispringerspiel im Nachzuge' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5', name: 'Zweispringerspiel: Springerangriff' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5', name: 'Zweispringerspiel: Hauptvariante' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7', name: 'Zweispringerspiel: Fegatello-Angriff' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 Bc5', name: 'Zweispringerspiel: Traxler-Gegenangriff' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3', name: 'Zweispringerspiel: Ruhige Variante' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d4', name: 'Zweispringerspiel: Moderner Angriff' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4 Be7', name: 'Ungarische Verteidigung' },
  { zuege: 'e4 e5 Nf3 Nc6 Bc4 Nd4', name: 'Blackburne-Schilling-Gambit' },
  { zuege: 'e4 e5 Nf3 Nc6 d4', name: 'Schottische Partie' },
  { zuege: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4', name: 'Schottische Partie: Hauptvariante' },
  { zuege: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5', name: 'Schottische Partie: Klassische Variante' },
  { zuege: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5', name: 'Schottische Partie: Mieses-Variante' },
  { zuege: 'e4 e5 Nf3 Nc6 d4 exd4 Bc4', name: 'Schottisches Gambit' },
  { zuege: 'e4 e5 Nf3 Nc6 d4 exd4 c3', name: 'Göring-Gambit' },
  { zuege: 'e4 e5 Nf3 Nc6 Nc3', name: 'Dreispringerspiel' },
  { zuege: 'e4 e5 Nf3 Nc6 Nc3 Nf6', name: 'Vierspringerspiel' },
  { zuege: 'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5', name: 'Vierspringerspiel: Spanische Variante' },
  { zuege: 'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Nd4', name: 'Vierspringerspiel: Rubinstein-Variante' },
  { zuege: 'e4 e5 Nf3 Nc6 Nc3 Nf6 d4', name: 'Vierspringerspiel: Schottische Variante' },
  { zuege: 'e4 e5 Nf3 Nc6 c3', name: 'Ponziani-Eröffnung' },
  { zuege: 'e4 e5 Nf3 Nf6', name: 'Russische Verteidigung' },
  { zuege: 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4', name: 'Russische Verteidigung: Klassische Variante' },
  { zuege: 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3', name: 'Russische Verteidigung: Hauptvariante' },
  { zuege: 'e4 e5 Nf3 Nf6 d4', name: 'Russische Verteidigung: Steinitz-Angriff' },
  { zuege: 'e4 e5 Nf3 d6', name: 'Philidor-Verteidigung' },
  { zuege: 'e4 e5 Nf3 d6 d4 exd4', name: 'Philidor-Verteidigung: Abtauschvariante' },
  { zuege: 'e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7', name: 'Philidor-Verteidigung: Hanham-Variante' },
  { zuege: 'e4 e5 Nf3 f5', name: 'Lettisches Gambit' },
  { zuege: 'e4 e5 Nf3 d5', name: 'Elefanten-Gambit' },
  { zuege: 'e4 e5 f4', name: 'Königsgambit' },
  { zuege: 'e4 e5 f4 exf4', name: 'Angenommenes Königsgambit' },
  { zuege: 'e4 e5 f4 exf4 Nf3 g5', name: 'Königsgambit: Klassische Verteidigung' },
  { zuege: 'e4 e5 f4 exf4 Nf3 d6', name: 'Königsgambit: Fischer-Verteidigung' },
  { zuege: 'e4 e5 f4 exf4 Bc4', name: 'Königsgambit: Läufergambit' },
  { zuege: 'e4 e5 f4 Bc5', name: 'Abgelehntes Königsgambit' },
  { zuege: 'e4 e5 f4 d5', name: 'Falkbeer-Gegengambit' },
  { zuege: 'e4 e5 Bc4', name: 'Läuferspiel' },
  { zuege: 'e4 e5 Bc4 Nf6', name: 'Läuferspiel: Berliner Verteidigung' },
  { zuege: 'e4 e5 Nc3', name: 'Wiener Partie' },
  { zuege: 'e4 e5 Nc3 Nc6', name: 'Wiener Partie: Max-Lange-Verteidigung' },
  { zuege: 'e4 e5 Nc3 Nf6 f4', name: 'Wiener Gambit' },
  { zuege: 'e4 e5 d4', name: 'Mittelgambit' },
  { zuege: 'e4 e5 d4 exd4 c3', name: 'Nordisches Gambit' },
  { zuege: 'e4 e5 Qh5', name: 'Parham-Angriff' },

  // ---------- Sizilianisch ----------
  { zuege: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3', name: 'Sizilianische Verteidigung: Offene Variante' },
  { zuege: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', name: 'Sizilianische Verteidigung: Najdorf-Variante' },
  { zuege: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3', name: 'Sizilianisch Najdorf: Englischer Angriff' },
  { zuege: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5', name: 'Sizilianisch Najdorf: Hauptvariante mit Lg5' },
  { zuege: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6', name: 'Sizilianische Verteidigung: Drachenvariante' },
  { zuege: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3', name: 'Sizilianisch Drache: Jugoslawischer Angriff' },
  { zuege: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6', name: 'Sizilianische Verteidigung: Scheveninger Variante' },
  { zuege: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6', name: 'Sizilianische Verteidigung: Klassische Variante' },
  { zuege: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6 Bg5', name: 'Sizilianisch: Richter-Rauser-Angriff' },
  { zuege: 'e4 c5 Nf3 d6 d4 cxd4 Qxd4', name: 'Sizilianische Verteidigung: Tschechower-Variante' },
  { zuege: 'e4 c5 Nf3 d6 Bb5+', name: 'Sizilianische Verteidigung: Moskauer Variante' },
  { zuege: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5', name: 'Sizilianische Verteidigung: Sweschnikow-Variante' },
  { zuege: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6', name: 'Sizilianische Verteidigung: Beschleunigter Drache' },
  { zuege: 'e4 c5 Nf3 Nc6 Bb5', name: 'Sizilianische Verteidigung: Rossolimo-Variante' },
  { zuege: 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6', name: 'Sizilianische Verteidigung: Kan-Variante' },
  { zuege: 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6', name: 'Sizilianische Verteidigung: Taimanow-Variante' },
  { zuege: 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6', name: 'Sizilianische Verteidigung: Vierspringervariante' },
  { zuege: 'e4 c5 Nf3 g6', name: 'Sizilianische Verteidigung: Hyperbeschleunigter Drache' },
  { zuege: 'e4 c5 Nf3 Nf6', name: 'Sizilianische Verteidigung: Nimzowitsch-Variante' },
  { zuege: 'e4 c5 Nc3', name: 'Sizilianische Verteidigung: Geschlossene Variante' },
  { zuege: 'e4 c5 Nc3 Nc6 g3', name: 'Sizilianisch, Geschlossene Variante: Hauptlinie' },
  { zuege: 'e4 c5 f4', name: 'Sizilianische Verteidigung: Grand-Prix-Angriff' },
  { zuege: 'e4 c5 c3', name: 'Sizilianische Verteidigung: Alapin-Variante' },
  { zuege: 'e4 c5 d4 cxd4 c3', name: 'Sizilianische Verteidigung: Morra-Gambit' },
  { zuege: 'e4 c5 b4', name: 'Sizilianische Verteidigung: Flügelgambit' },

  // ---------- Franzoesisch ----------
  { zuege: 'e4 e6 d4 d5 Nc3 Bb4', name: 'Französische Verteidigung: Winawer-Variante' },
  { zuege: 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3', name: 'Französisch Winawer: Hauptvariante' },
  { zuege: 'e4 e6 d4 d5 Nc3 Nf6', name: 'Französische Verteidigung: Klassische Variante' },
  { zuege: 'e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7', name: 'Französisch Klassisch: Steinitz-Variante' },
  { zuege: 'e4 e6 d4 d5 Nc3 dxe4', name: 'Französische Verteidigung: Rubinstein-Variante' },
  { zuege: 'e4 e6 d4 d5 Nd2', name: 'Französische Verteidigung: Tarrasch-Variante' },
  { zuege: 'e4 e6 d4 d5 e5', name: 'Französische Verteidigung: Vorstoßvariante' },
  { zuege: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6', name: 'Französisch Vorstoß: Hauptvariante' },
  { zuege: 'e4 e6 d4 d5 exd5 exd5', name: 'Französische Verteidigung: Abtauschvariante' },
  { zuege: 'e4 e6 Qe2', name: 'Französische Verteidigung: Tschigorin-Variante' },
  { zuege: 'e4 e6 d3 d5 Nd2', name: 'Königsindischer Angriff' },

  // ---------- Caro-Kann ----------
  { zuege: 'e4 c6 d4 d5 e5', name: 'Caro-Kann-Verteidigung: Vorstoßvariante' },
  { zuege: 'e4 c6 d4 d5 e5 Bf5', name: 'Caro-Kann Vorstoß: Hauptvariante' },
  { zuege: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5', name: 'Caro-Kann-Verteidigung: Klassische Variante' },
  { zuege: 'e4 c6 d4 d5 Nd2 dxe4 Nxe4 Bf5', name: 'Caro-Kann-Verteidigung: Klassische Variante' },
  { zuege: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7', name: 'Caro-Kann-Verteidigung: Karpow-Variante' },
  { zuege: 'e4 c6 d4 d5 exd5 cxd5', name: 'Caro-Kann-Verteidigung: Abtauschvariante' },
  { zuege: 'e4 c6 d4 d5 exd5 cxd5 c4', name: 'Caro-Kann-Verteidigung: Panow-Botwinnik-Angriff' },
  { zuege: 'e4 c6 Nc3 d5 Nf3', name: 'Caro-Kann-Verteidigung: Zweispringervariante' },
  { zuege: 'e4 c6 d4 d5 f3', name: 'Caro-Kann-Verteidigung: Fantasievariante' },

  // ---------- Skandinavisch, Aljechin, Pirc, Modern ----------
  { zuege: 'e4 d5 exd5 Qxd5', name: 'Skandinavische Verteidigung: Hauptvariante' },
  { zuege: 'e4 d5 exd5 Qxd5 Nc3 Qa5', name: 'Skandinavische Verteidigung: Klassische Variante (Da5)' },
  { zuege: 'e4 d5 exd5 Qxd5 Nc3 Qd6', name: 'Skandinavische Verteidigung: Moderne Variante (Dd6)' },
  { zuege: 'e4 d5 exd5 Qxd5 Nc3 Qd8', name: 'Skandinavische Verteidigung: Rückzugsvariante (Dd8)' },
  { zuege: 'e4 d5 exd5 Nf6', name: 'Skandinavische Verteidigung: Marshall-Variante' },
  { zuege: 'e4 Nf6 e5 Nd5 d4 d6 Nf3', name: 'Aljechin-Verteidigung: Moderne Variante' },
  { zuege: 'e4 Nf6 e5 Nd5 d4 d6 c4 Nb6 f4', name: 'Aljechin-Verteidigung: Vierbauernangriff' },
  { zuege: 'e4 Nf6 e5 Nd5 d4 d6 c4 Nb6 exd6', name: 'Aljechin-Verteidigung: Abtauschvariante' },
  { zuege: 'e4 d6 d4 Nf6 Nc3 g6', name: 'Pirc-Verteidigung: Hauptvariante' },
  { zuege: 'e4 d6 d4 Nf6 Nc3 g6 f4', name: 'Pirc-Verteidigung: Österreichischer Angriff' },
  { zuege: 'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2', name: 'Pirc-Verteidigung: Klassisches System' },
  { zuege: 'e4 d6 d4 Nf6 Nc3 g6 Be3', name: 'Pirc-Verteidigung: 150-Angriff' },
  { zuege: 'e4 g6 d4 Bg7 Nc3 d6', name: 'Moderne Verteidigung: Hauptvariante' },

  // ---------- 1.d4 d5 ----------
  { zuege: 'd4 d5 c4', name: 'Damengambit' },
  { zuege: 'd4 d5 c4 e6', name: 'Abgelehntes Damengambit' },
  { zuege: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7', name: 'Abgelehntes Damengambit: Klassische Variante' },
  { zuege: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7', name: 'Abgelehntes Damengambit: Orthodoxe Verteidigung' },
  { zuege: 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5', name: 'Abgelehntes Damengambit: Abtauschvariante' },
  { zuege: 'd4 d5 c4 e6 Nc3 Nf6 Nf3 Be7 Bf4', name: 'Abgelehntes Damengambit: Lf4-Variante' },
  { zuege: 'd4 d5 c4 e6 Nc3 Nf6 Nf3 Bb4', name: 'Abgelehntes Damengambit: Ragosin-Verteidigung' },
  { zuege: 'd4 d5 c4 e6 Nc3 Be7', name: 'Abgelehntes Damengambit: Alatorzew-Variante' },
  { zuege: 'd4 d5 c4 e6 Nc3 c5', name: 'Tarrasch-Verteidigung' },
  { zuege: 'd4 d5 c4 e6 Nf3 Nf6 g3', name: 'Katalanische Eröffnung' },
  { zuege: 'd4 Nf6 c4 e6 g3 d5', name: 'Katalanische Eröffnung' },
  { zuege: 'd4 d5 c4 dxc4', name: 'Angenommenes Damengambit' },
  { zuege: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5', name: 'Angenommenes Damengambit: Klassische Variante' },
  { zuege: 'd4 d5 c4 dxc4 e4', name: 'Angenommenes Damengambit: Zentrumsvariante' },
  { zuege: 'd4 d5 c4 c6', name: 'Slawische Verteidigung' },
  { zuege: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4', name: 'Slawische Verteidigung: Hauptvariante' },
  { zuege: 'd4 d5 c4 c6 cxd5 cxd5', name: 'Slawische Verteidigung: Abtauschvariante' },
  { zuege: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6', name: 'Halbslawische Verteidigung' },
  { zuege: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4', name: 'Halbslawische Verteidigung: Meraner Variante' },
  { zuege: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 Bg5', name: 'Halbslawische Verteidigung: Lg5-Variante' },
  { zuege: 'd4 d5 c4 Nc6', name: 'Tschigorin-Verteidigung' },
  { zuege: 'd4 d5 c4 e5', name: 'Albins Gegengambit' },
  { zuege: 'd4 d5 c4 Bf5', name: 'Baltische Verteidigung' },
  { zuege: 'd4 d5 Bf4', name: 'Londoner System' },
  { zuege: 'd4 d5 Nf3 Nf6 Bf4', name: 'Londoner System' },
  { zuege: 'd4 Nf6 Bf4', name: 'Londoner System' },
  { zuege: 'd4 Nf6 Nf3 e6 Bf4', name: 'Londoner System' },
  { zuege: 'd4 d5 Nf3 Nf6 e3 e6 Bd3', name: 'Colle-System' },
  { zuege: 'd4 d5 e4', name: 'Blackmar-Diemer-Gambit' },
  { zuege: 'd4 d5 Nc3 Nf6 Bg5', name: 'Veresov-Angriff' },
  { zuege: 'd4 d5 Bg5', name: 'Lewitzki-Angriff' },

  // ---------- Indische Verteidigungen ----------
  { zuege: 'd4 Nf6', name: 'Indische Verteidigung' },
  { zuege: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6', name: 'Königsindische Verteidigung' },
  { zuege: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5', name: 'Königsindische Verteidigung: Klassische Variante' },
  { zuege: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7', name: 'Königsindisch: Mar-del-Plata-Variante' },
  { zuege: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3', name: 'Königsindische Verteidigung: Sämisch-Variante' },
  { zuege: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f4', name: 'Königsindische Verteidigung: Vierbauernangriff' },
  { zuege: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Be2 O-O Bg5', name: 'Königsindische Verteidigung: Awerbach-Variante' },
  { zuege: 'd4 Nf6 c4 g6 Nf3 Bg7 g3 O-O Bg2 d6 O-O', name: 'Königsindische Verteidigung: Fianchetto-Variante' },
  { zuege: 'd4 Nf6 c4 g6 Nc3 d5', name: 'Grünfeld-Verteidigung' },
  { zuege: 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3', name: 'Grünfeld-Verteidigung: Abtauschvariante' },
  { zuege: 'd4 Nf6 c4 g6 Nc3 d5 Nf3 Bg7 Qb3', name: 'Grünfeld-Verteidigung: Russisches System' },
  { zuege: 'd4 Nf6 c4 g6 Nc3 d5 Bf4', name: 'Grünfeld-Verteidigung: Lf4-Variante' },
  { zuege: 'd4 Nf6 c4 e6 Nc3 Bb4', name: 'Nimzoindische Verteidigung' },
  { zuege: 'd4 Nf6 c4 e6 Nc3 Bb4 e3', name: 'Nimzoindische Verteidigung: Rubinstein-Variante' },
  { zuege: 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2', name: 'Nimzoindische Verteidigung: Klassische Variante' },
  { zuege: 'd4 Nf6 c4 e6 Nc3 Bb4 a3 Bxc3+ bxc3', name: 'Nimzoindische Verteidigung: Sämisch-Variante' },
  { zuege: 'd4 Nf6 c4 e6 Nc3 Bb4 f3', name: 'Nimzoindische Verteidigung: Kmoch-Variante' },
  { zuege: 'd4 Nf6 c4 e6 Nf3 b6', name: 'Damenindische Verteidigung' },
  { zuege: 'd4 Nf6 c4 e6 Nf3 b6 g3 Ba6', name: 'Damenindische Verteidigung: Nimzowitsch-Variante' },
  { zuege: 'd4 Nf6 c4 e6 Nf3 Bb4+', name: 'Bogoljubow-Indische Verteidigung' },
  { zuege: 'd4 Nf6 c4 e6 Nf3 c5 d5 b5', name: 'Blumenfeld-Gambit' },
  { zuege: 'd4 Nf6 c4 c5 d5 b5', name: 'Wolga-Gambit' },
  { zuege: 'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6', name: 'Moderne Benoni-Verteidigung' },
  { zuege: 'd4 Nf6 c4 e5', name: 'Budapester Gambit' },
  { zuege: 'd4 Nf6 c4 d6', name: 'Altindische Verteidigung' },
  { zuege: 'd4 Nf6 Bg5', name: 'Trompowsky-Angriff' },
  { zuege: 'd4 Nf6 Nf3 e6 Bg5', name: 'Torre-Angriff' },
  { zuege: 'd4 Nf6 Nf3 g6 Bg5', name: 'Torre-Angriff' },

  // ---------- Weitere Antworten auf 1.d4 ----------
  { zuege: 'd4 f5', name: 'Holländische Verteidigung' },
  { zuege: 'd4 f5 c4 Nf6 g3 e6 Bg2 d5', name: 'Holländische Verteidigung: Stonewall-Variante' },
  { zuege: 'd4 f5 c4 Nf6 g3 e6 Bg2 Be7', name: 'Holländische Verteidigung: Klassische Variante' },
  { zuege: 'd4 f5 c4 Nf6 g3 g6', name: 'Holländische Verteidigung: Leningrader Variante' },
  { zuege: 'd4 f5 e4', name: 'Staunton-Gambit' },
  { zuege: 'd4 e5', name: 'Englund-Gambit' },
  { zuege: 'd4 c5', name: 'Alt-Benoni-Verteidigung' },
  { zuege: 'd4 g6', name: 'Moderne Verteidigung' },

  // ---------- Englisch, Reti, Bird, Fluegel ----------
  { zuege: 'c4 e5', name: 'Englische Eröffnung: Umgekehrtes Sizilianisch' },
  { zuege: 'c4 e5 Nc3 Nf6 Nf3 Nc6', name: 'Englische Eröffnung: Vierspringervariante' },
  { zuege: 'c4 e5 Nc3 Nc6 g3 g6 Bg2 Bg7', name: 'Englische Eröffnung: Geschlossene Variante' },
  { zuege: 'c4 c5', name: 'Englische Eröffnung: Symmetrische Variante' },
  { zuege: 'c4 Nf6', name: 'Englische Eröffnung: Anglo-Indische Verteidigung' },
  { zuege: 'c4 e6', name: 'Englische Eröffnung: Agincourt-Verteidigung' },
  { zuege: 'c4 c6', name: 'Englische Eröffnung: Caro-Kann-Aufbau' },
  { zuege: 'c4 f5', name: 'Englische Eröffnung: Anglo-Holländische Verteidigung' },
  { zuege: 'Nf3 d5 c4', name: 'Réti-Eröffnung: Réti-Gambit' },
  { zuege: 'Nf3 d5 g3', name: 'Königsindischer Angriff' },
  { zuege: 'Nf3 Nf6 g3', name: 'Königsindischer Angriff' },
  { zuege: 'f4 e5', name: 'From-Gambit' },
  { zuege: 'f4 d5', name: 'Bird-Eröffnung: Holländische Variante' },
  { zuege: 'b3 e5', name: 'Nimzowitsch-Larsen-Angriff: Moderne Variante' },
];

// Stellungsschluessel: Brett, Zugrecht, Rochaderechte, en passant (ohne Zugzaehler)
export function stellungsSchluessel(fen) {
  return String(fen || '').trim().split(/\s+/).slice(0, 4).join(' ');
}

let INDEX = null;

// Baut einmalig (lazy) Buch-Stellungen und Namen ueber einen Zugbaum auf.
function index() {
  if (INDEX) return INDEX;
  const wurzel = { kinder: new Map(), name: null };
  for (const e of EROEFFNUNGEN) {
    let k = wurzel;
    for (const san of e.zuege.trim().split(/\s+/)) {
      if (!k.kinder.has(san)) k.kinder.set(san, { kinder: new Map(), name: null });
      k = k.kinder.get(san);
    }
    if (!k.name) k.name = e.name;
  }
  const buch = new Set();
  const namen = new Map();   // Stellung -> eigener Name aus der Tabelle
  const geerbt = new Map();  // Stellung -> Name des naechsten benannten Vorgaengers
  const fehler = [];
  const chess = new Chess();
  const lauf = (knoten, pfad, erbe) => {
    for (const [san, kind] of knoten.kinder) {
      let zug = null;
      try { zug = chess.move(san); } catch (e) { zug = null; }
      if (!zug) {
        fehler.push([...pfad, san].join(' '));
        continue;
      }
      const s = stellungsSchluessel(chess.fen());
      buch.add(s);
      if (kind.name && !namen.has(s)) namen.set(s, kind.name);
      const n = kind.name || erbe;
      if (n && !geerbt.has(s)) geerbt.set(s, n);
      lauf(kind, [...pfad, san], n);
      chess.undo();
    }
  };
  lauf(wurzel, [], null);
  INDEX = { buch, namen, geerbt, fehler };
  return INDEX;
}

// Fuer Tests: ungueltige Tabellenzeilen (sollte leer sein)
export function tabellenFehler() {
  return index().fehler.slice();
}

// eroeffnung(['e4','e5','Nf3', ...]) -> { name, buch: [true, true, ...], namen: [...] }
// name: tiefste erkannte benannte Stellung (null, wenn keine); buch[i]: Halbzug i ist ein
// Theoriezug; namen[i]: Name nach Halbzug i (Zusatzfeld fuer die Live-Anzeige).
export function eroeffnung(sanListe) {
  const idx = index();
  const liste = Array.isArray(sanListe)
    ? sanListe
    : String(sanListe || '').trim().split(/\s+/).filter(Boolean);
  const buch = liste.map(() => false);
  const namen = liste.map(() => null);
  let name = null;
  const chess = new Chess();
  for (let i = 0; i < liste.length && i < NAMEN_GRENZE; i++) {
    const san = String(liste[i] || '').replace(/[!?]+$/, '');
    let zug = null;
    try { zug = chess.move(san); } catch (e) { zug = null; }
    if (!zug) break;
    const s = stellungsSchluessel(chess.fen());
    if (i < BUCH_GRENZE && idx.buch.has(s)) buch[i] = true;
    const n = idx.namen.get(s) ?? idx.geerbt.get(s);
    if (n) name = n;
    namen[i] = name;
  }
  for (let i = 0; i < namen.length; i++) if (namen[i] == null && i > 0) namen[i] = namen[i - 1];
  return { name, buch, namen };
}

// Anzeigename einer Eroeffnung in der eingestellten Sprache. name: ein Name aus der Tabelle (deutsch, wie gespeichert)
// oder einer der Zusatznamen ("Unbekannte Eröffnung", "Eröffnungstheorie"); auch ein englischer Name wird erkannt.
// Auf Deutsch kommt ein deutscher Name unveraendert zurueck.
let NAMEN_SCHLUESSEL = null;   // Name (jede Sprache) -> Schluessel im Woerterbuch
export function eroeffnungsAnzeige(name) {
  if (typeof name !== 'string' || !name) return name;
  if (!NAMEN_SCHLUESSEL) {
    NAMEN_SCHLUESSEL = new Map();
    // Deutsch zuletzt: bei gleichem Text gewinnt der deutsche Eintrag
    for (const s of [...SPRACHEN].reverse()) {
      for (const [k, v] of Object.entries(texte(s))) if (k.startsWith('eroeffnungen.')) NAMEN_SCHLUESSEL.set(v, k);
    }
  }
  const k = NAMEN_SCHLUESSEL.get(name);
  return k ? t(k) : name;
}
