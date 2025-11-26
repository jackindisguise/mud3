/**
 * Registry: reservedNames - centralized name blocking system
 *
 * Provides a centralized location for checking if names are blocked.
 * The blocked names cache is built by the reservedNames package.
 *
 * @module registry/reservedNames
 */

/**
 * Set of blocked names (normalized to lowercase).
 * Populated from mob template display names and keywords.
 */
const BLOCKED_NAMES: Set<string> = new Set();

/**
 * Regex patterns for catching offensive names.
 * These patterns are case-insensitive and match common variations.
 */
const OFFENSIVE_PATTERNS: RegExp[] = [
	// Common slurs and offensive terms (mandatory shape with optional duplication and optional vowels)
	// N-word: [nm]+[i1]*[g6]+[ea34]*r+
	/[nm]+[i1]*[g6]+[ea34]*r+/i,
	// F-word: f+[ea34]*[g6]+[g6]?[o0]*t+
	/f+[ea34]*[g6]+[g6]?[o0]*t+/i,
	// K-word: k+[i1]*k+[ea34]*
	/k+[i1]*k+[ea34]*/i,
	// Spic: [s5]+p+[i1]*c+
	/[s5]+p+[i1]*c+/i,
	// Chink: ch+[i1]*n+k+
	/ch+[i1]*n+k+/i,
	// Wetback: w+[ea34]*t+b+a+c+k+
	/w+[ea34]*t+b+a+c+k+/i,
	// Tranny: t+[r4]+[ea34]*n+n+y+
	/t+[r4]+[ea34]*n+n+y+/i,
	// Retard: r+[ea34]*t+[ea34]*r+d+
	/r+[ea34]*t+[ea34]*r+d+/i,
	// Coon: [ck]+[o0]+n+
	/[ck]+[o0]+n+/i,
	// Jap: j+[ea34]*p+
	/j+[ea34]*p+/i,
	// Gook: g+[o0]*[o0]*k+
	/g+[o0]*[o0]*k+/i,
	// Jew: j+[ea34]*w+
	/j+[ea34]*w+/i,
	// Israel: [i1]*[s5]+r+[ea34]*[ea34]*l+
	/[i1]*[s5]+r+[ea34]*[ea34]*l+/i,
	// Nationalities and ethnic/racial terms
	// Chinese: ch+[i1]*n+[ea34]*[s5]+[ea34]*
	/ch+[i1]*n+[ea34]*[s5]+[ea34]*/i,
	// Japanese: j+[ea34]*p+[ea34]*n+[ea34]*[s5]+[ea34]*
	/j+[ea34]*p+[ea34]*n+[ea34]*[s5]+[ea34]*/i,
	// Korean: k+[o0]*r+[ea34]*[ea34]*n+
	/k+[o0]*r+[ea34]*[ea34]*n+/i,
	// Mexican: m+[ea34]*x+[i1]*c+[ea34]*n+
	/m+[ea34]*x+[i1]*c+[ea34]*n+/i,
	// Indian: [i1]*[n7]+d+[i1]*[ea34]*n+
	/[i1]*[n7]+d+[i1]*[ea34]*n+/i,
	// Arab: [ea34]*r+[ea34]*b+
	/[ea34]*r+[ea34]*b+/i,
	// Hispanic: h+[i1]*[s5]+p+[ea34]*n+[i1]*c+
	/h+[i1]*[s5]+p+[ea34]*n+[i1]*c+/i,
	// Latino: l+[ea34]*t+[i1]*n+[o0]*
	/l+[ea34]*t+[i1]*n+[o0]*/i,
	// Asian: [ea34]*[s5]+[i1]*[ea34]*n+
	/[ea34]*[s5]+[i1]*[ea34]*n+/i,
	// Black: b+l+[ea34]*c+k+
	/b+l+[ea34]*c+k+/i,
	// White: w+h+[i1]*t+[ea34]*
	/w+h+[i1]*t+[ea34]*/i,
	// African: [ea34]*f+r+[i1]*c+[ea34]*n+
	/[ea34]*f+r+[i1]*c+[ea34]*n+/i,
	// European: [ea34]*u+r+[o0]*p+[ea34]*[ea34]*n+
	/[ea34]*u+r+[o0]*p+[ea34]*[ea34]*n+/i,
	// Middle Eastern: m+[i1]*d+d+l+[ea34]*[ea34]*[ea34]*[s5]+t+
	/m+[i1]*d+d+l+[ea34]*[ea34]*[ea34]*[s5]+t+/i,
	// Native: n+[ea34]*t+[i1]*v+[ea34]*
	/n+[ea34]*t+[i1]*v+[ea34]*/i,
	// American: [ea34]*m+[ea34]*r+[i1]*c+[ea34]*n+
	/[ea34]*m+[ea34]*r+[i1]*c+[ea34]*n+/i,
	// Caucasian: c+[ea34]*u+c+[ea34]*[s5]+[i1]*[ea34]*n+
	/c+[ea34]*u+c+[ea34]*[s5]+[i1]*[ea34]*n+/i,
	// Religions and religious terms
	// Muslim: m+u*[s5]+l+[i1]*m+
	/m+u*[s5]+l+[i1]*m+/i,
	// Christian: ch+r+[i1]*[s5]+t+[i1]*[ea34]*n+
	/ch+r+[i1]*[s5]+t+[i1]*[ea34]*n+/i,
	// Islam/Islamic: [i1]*[s5]+l+[ea34]*m+([i1]*c+)?
	/[i1]*[s5]+l+[ea34]*m+([i1]*c+)?/i,
	// Christianity: ch+r+[i1]*[s5]+t+[i1]*[ea34]*n+[i1]*t+y+
	/ch+r+[i1]*[s5]+t+[i1]*[ea34]*n+[i1]*t+y+/i,
	// Judaism/Judaist: j+u*d+[ea34]*[i1]*[s5]+(m+|t+)
	/j+u*d+[ea34]*[i1]*[s5]+(m+|t+)/i,
	// Jewish/Judaic: j+[u0]*d+[ea34]*[i1]*[s5]+(h+|h+[i1]*c+)
	/j+[u0]*d+[ea34]*[i1]*[s5]+(h+|h+[i1]*c+)/i,
	// Hindu/Hinduism: h+[i1]*n+d+u*([i1]*[s5]+m+)?
	/h+[i1]*n+d+u*([i1]*[s5]+m+)?/i,
	// Buddhist/Buddhism: b+u*d+d+h+[i1]*[s5]+(t+|m+)
	/b+u*d+d+h+[i1]*[s5]+(t+|m+)/i,
	// Sikh/Sikhism: [s5]+[i1]*k+h+([i1]*[s5]+m+)?
	/[s5]+[i1]*k+h+([i1]*[s5]+m+)?/i,
	// Catholic: c+[ea34]*t+h+[o0]*l+[i1]*c+
	/c+[ea34]*t+h+[o0]*l+[i1]*c+/i,
	// Protestant: p+r+[o0]*t+[ea34]*[s5]+t+[ea34]*n+t+
	/p+r+[o0]*t+[ea34]*[s5]+t+[ea34]*n+t+/i,
	// Atheist: [ea34]*t+h+[ea34]*[i1]*[s5]+t+
	/[ea34]*t+h+[ea34]*[i1]*[s5]+t+/i,
	// Mormon: m+[o0]*r+m+[o0]*n+
	/m+[o0]*r+m+[o0]*n+/i,
	// Baptist: b+[ea34]*p+t+[i1]*[s5]+t+
	/b+[ea34]*p+t+[i1]*[s5]+t+/i,
	// Methodist: m+[ea34]*t+h+[o0]*d+[i1]*[s5]+t+
	/m+[ea34]*t+h+[o0]*d+[i1]*[s5]+t+/i,
	// Swear words
	// Fuck: f+u*[ck]+
	/f+[uoae0-9]*[ck]+/i,
	// Shit: [s5]+h+[i1]*t+
	/[s5]+h+[i1]*t+/i,
	// Ass: [ea34]*[s5]+[s5]+
	/[a4]*[s5]+[s5]+/i,
	// Bitch: b+[i1]*t+c+h+
	/b+[i1]*t+c+h+/i,
	// Cunt: c+u*n+t+
	/c+u*n+t+/i,
	// Pussy: p+u*[s5]+[s5]+y+
	/p+u*[s5]+[s5]+y+/i,
	// Dick: d+[i1]*c+k+
	/d+[i1]*c+k+/i,
	// Cock: c+[o0]*c+k+
	/c+[o0]*c+k+/i,
	// Whore: w+h+[o0]*r+[ea34]*
	/w+h+[o0]*r+[e3]*/i,
	// Slut: [s5]+l+u*t+
	/[s5]+l+u*t+/i,
];

/**
 * Regex patterns for catching well-known fantasy character names.
 * These patterns are case-insensitive and match common variations.
 */
const POP_NAME_PATTERNS: RegExp[] = [
	// Well-known fantasy character names
	// Gandalf: g+[ea34]+n+d+[ea34]+l+f+
	/g+[ea34]+n+d+[ea34]+l+f+/i,
	// Aragorn: [ea34]+r+[ea34]+g+[o0]+r+n+
	/[ea34]+r+[ea34]+g+[o0]+r+n+/i,
	// Legolas: l+[ea34]+g+[o0]+l+[ea34]+[s5]+
	/l+[ea34]+g+[o0]+l+[ea34]+[s5]+/i,
	// Frodo: f+r+[o0]+d+[o0]+
	/f+r+[o0]+d+[o0]+/i,
	// Sauron: [s5]+[ea34]+u+r+[o0]+n+
	/[s5]+[ea34]+u+r+[o0]+n+/i,
	// Saruman: [s5]+[ea34]+r+u+m+[ea34]+n+
	/[s5]+[ea34]+r+u+m+[ea34]+n+/i,
	// Gimli: g+[i1]+m+l+[i1]+
	/g+[i1]+m+l+[i1]+/i,
	// Boromir: b+[o0]+r+[o0]+m+[i1]+r+
	/b+[o0]+r+[o0]+m+[i1]+r+/i,
	// Gollum: g+[o0]+l+l+u+m+
	/g+[o0]+l+l+u+m+/i,
	// Bilbo: b+[i1]+l+b+[o0]+
	/b+[i1]+l+b+[o0]+/i,
	// Smaug: [s5]+m+[ea34]+u+g+
	/[s5]+m+[ea34]+u+g+/i,
	// Elrond: [ea34]+l+r+[o0]+n+d+
	/[ea34]+l+r+[o0]+n+d+/i,
	// Galadriel: g+[ea34]+l+[ea34]+d+r+[i1]+[ea34]+l+
	/g+[ea34]+l+[ea34]+d+r+[i1]+[ea34]+l+/i,
	// Arwen: [ea34]+r+w+[ea34]+n+
	/[ea34]+r+w+[ea34]+n+/i,
	// Eowyn: [ea34]+[o0]+w+[i1]+n+
	/[ea34]+[o0]+w+[i1]+n+/i,
	// Daenerys: d+[ea34]+n+[ea34]+r+[i1]+[s5]+
	/d+[ea34]+n+[ea34]+r+[i1]+[s5]+/i,
	// Tyrion: t+y+r+[i1]+[o0]+n+
	/t+y+r+[i1]+[o0]+n+/i,
	// Cersei: c+[ea34]+r+[s5]+[ea34]+[i1]+
	/c+[ea34]+r+[s5]+[ea34]+[i1]+/i,
	// Drizzt: d+r+[i1]+z+z+t+
	/d+r+[i1]+z+z+t+/i,
	// Elminster: [ea34]+l+m+[i1]+n+[s5]+t+[ea34]+r+
	/[ea34]+l+m+[i1]+n+[s5]+t+[ea34]+r+/i,
	// Raistlin: r+[ea34]+[i1]+[s5]+t+l+[i1]+n+
	/r+[ea34]+[i1]+[s5]+t+l+[i1]+n+/i,
	// Conan: c+[o0]+n+[ea34]+n+
	/c+[o0]+n+[ea34]+n+/i,
	// Merlin: m+[ea34]+r+l+[i1]+n+
	/m+[ea34]+r+l+[i1]+n+/i,
	// Arthur: [ea34]+r+t+h+u+r+
	/[ea34]+r+t+h+u+r+/i,
	// Lancelot: l+[ea34]+n+c+[ea34]+l+[o0]+t+
	/l+[ea34]+n+c+[ea34]+l+[o0]+t+/i,
	// Guinevere: g+u+[i1]+n+[ea34]+v+[ea34]+r+[ea34]+
	/g+u+[i1]+n+[ea34]+v+[ea34]+r+[ea34]+/i,
	// Morgana: m+[o0]+r+g+[ea34]+n+[ea34]+
	/m+[o0]+r+g+[ea34]+n+[ea34]+/i,
	// Dracula: d+r+[ea34]+c+u+l+[ea34]+
	/d+r+[ea34]+c+u+l+[ea34]+/i,
	// Van Helsing: v+[ea34]+n+h+[ea34]+l+[s5]+[i1]+n+g+
	/v+[ea34]+n+h+[ea34]+l+[s5]+[i1]+n+g+/i,
	// Naruto characters
	// Naruto: n+[ea34]+r+u+t+[o0]+
	/n+[ea34]+r+u+t+[o0]+/i,
	// Sasuke: [s5]+[ea34]+[s5]+u+k+[ea34]+
	/[s5]+[ea34]+[s5]+u+k+[ea34]+/i,
	// Sakura: [s5]+[ea34]+k+u+r+[ea34]+
	/[s5]+[ea34]+k+u+r+[ea34]+/i,
	// Kakashi: k+[ea34]+k+[ea34]+[s5]+h+[i1]+
	/k+[ea34]+k+[ea34]+[s5]+h+[i1]+/i,
	// Itachi: [i1]+t+[ea34]+ch+[i1]+
	/[i1]+t+[ea34]+ch+[i1]+/i,
	// Madara: m+[ea34]+d+[ea34]+r+[ea34]+
	/m+[ea34]+d+[ea34]+r+[ea34]+/i,
	// Obito: [o0]+b+[i1]+t+[o0]+
	/[o0]+b+[i1]+t+[o0]+/i,
	// Minato: m+[i1]+n+[ea34]+t+[o0]+
	/m+[i1]+n+[ea34]+t+[o0]+/i,
	// Jiraiya: j+[i1]+r+[ea34]+[i1]+y+[ea34]+
	/j+[i1]+r+[ea34]+[i1]+y+[ea34]+/i,
	// Tsunade: t+[s5]+u+n+[ea34]+d+[ea34]+
	/t+[s5]+u+n+[ea34]+d+[ea34]+/i,
	// Orochimaru: [o0]+r+[o0]+ch+[i1]+m+[ea34]+r+u+
	/[o0]+r+[o0]+ch+[i1]+m+[ea34]+r+u+/i,
	// Dragonball characters
	// Goku: g+[o0]+k+u+
	/g+[o0]+k+u+/i,
	// Vegeta: v+[ea34]+g+[ea34]+t+[ea34]+
	/v+[ea34]+g+[ea34]+t+[ea34]+/i,
	// Piccolo: p+[i1]+c+c+[o0]+l+[o0]+
	/p+[i1]+c+c+[o0]+l+[o0]+/i,
	// Gohan: g+[o0]+h+[ea34]+n+
	/g+[o0]+h+[ea34]+n+/i,
	// Goten: g+[o0]+t+[ea34]+n+
	/g+[o0]+t+[ea34]+n+/i,
	// Trunks: t+r+u+n+k+[s5]+
	/t+r+u+n+k+[s5]+/i,
	// Bulma: b+u+l+m+[ea34]+
	/b+u+l+m+[ea34]+/i,
	// Chi-Chi: ch+[i1]+ch+[i1]+
	/ch+[i1]+ch+[i1]+/i,
	// Krillin: k+r+[i1]+l+l+[i1]+n+
	/k+r+[i1]+l+l+[i1]+n+/i,
	// Yamcha: y+[ea34]+m+ch+[ea34]+
	/y+[ea34]+m+ch+[ea34]+/i,
	// Tien: t+[i1]+[ea34]+n+ (4 chars - whole word only)
	/^t+[i1]+[ea34]+n+$/i,
	// Master Roshi: m+[ea34]+[s5]+t+[ea34]+r+r+[o0]+[s5]+h+[i1]+
	/m+[ea34]+[s5]+t+[ea34]+r+r+[o0]+[s5]+h+[i1]+/i,
	// Frieza: f+r+[i1]+[ea34]+z+[ea34]+
	/f+r+[i1]+[ea34]+z+[ea34]+/i,
	// Cell: c+[ea34]+l+l+ (4 chars - whole word only)
	/^c+[ea34]+l+l+$/i,
	// Majin Buu: m+[ea34]+j+[i1]+n+b+u+u+
	/m+[ea34]+j+[i1]+n+b+u+u+/i,
	// Beerus: b+[ea34]+[ea34]+r+u+[s5]+
	/b+[ea34]+[ea34]+r+u+[s5]+/i,
	// Whis: w+h+[i1]+[s5]+ (4 chars - whole word only)
	/^w+h+[i1]+[s5]+$/i,
	// Bleach characters
	// Ichigo: [i1]+ch+[i1]+g+[o0]+
	/[i1]+ch+[i1]+g+[o0]+/i,
	// Rukia: r+u+k+[i1]+[ea34]+
	/r+u+k+[i1]+[ea34]+/i,
	// Renji: r+[ea34]+n+j+[i1]+
	/r+[ea34]+n+j+[i1]+/i,
	// Byakuya: b+y+[ea34]+k+u+y+[ea34]+
	/b+y+[ea34]+k+u+y+[ea34]+/i,
	// Aizen: [ea34]+[i1]+z+[ea34]+n+
	/[ea34]+[i1]+z+[ea34]+n+/i,
	// Kenpachi: k+[ea34]+n+p+[ea34]+ch+[i1]+
	/k+[ea34]+n+p+[ea34]+ch+[i1]+/i,
	// Zaraki: z+[ea34]+r+[ea34]+k+[i1]+
	/z+[ea34]+r+[ea34]+k+[i1]+/i,
	// Yamamoto: y+[ea34]+m+[ea34]+m+[o0]+t+[o0]+
	/y+[ea34]+m+[ea34]+m+[o0]+t+[o0]+/i,
	// Gintama characters
	// Gintoki: g+[i1]+n+t+[o0]+k+[i1]+
	/g+[i1]+n+t+[o0]+k+[i1]+/i,
	// Kagura: k+[ea34]+g+u+r+[ea34]+
	/k+[ea34]+g+u+r+[ea34]+/i,
	// Shinpachi: [s5]+h+[i1]+n+p+[ea34]+ch+[i1]+
	/[s5]+h+[i1]+n+p+[ea34]+ch+[i1]+/i,
	// Hijikata: h+[i1]+j+[i1]+k+[ea34]+t+[ea34]+
	/h+[i1]+j+[i1]+k+[ea34]+t+[ea34]+/i,
	// Katsura: k+[ea34]+t+[s5]+u+r+[ea34]+
	/k+[ea34]+t+[s5]+u+r+[ea34]+/i,
	// Inuyasha characters
	// Inuyasha: [i1]+n+u+y+[ea34]+[s5]+h+[ea34]+
	/[i1]+n+u+y+[ea34]+[s5]+h+[ea34]+/i,
	// Kagome: k+[ea34]+g+[o0]+m+[ea34]+
	/k+[ea34]+g+[o0]+m+[ea34]+/i,
	// Sesshomaru: [s5]+[ea34]+[s5]+[s5]+h+[o0]+m+[ea34]+r+u+
	/[s5]+[ea34]+[s5]+[s5]+h+[o0]+m+[ea34]+r+u+/i,
	// Miroku: m+[i1]+r+[o0]+k+u+
	/m+[i1]+r+[o0]+k+u+/i,
	// Sango: [s5]+[ea34]+n+g+[o0]+
	/[s5]+[ea34]+n+g+[o0]+/i,
	// Shippo: [s5]+h+[i1]+p+p+[o0]+
	/[s5]+h+[i1]+p+p+[o0]+/i,
	// Kikyo: k+[i1]+k+y+[o0]+
	/k+[i1]+k+y+[o0]+/i,
	// Naraku: n+[ea34]+r+[ea34]+k+u+
	/n+[ea34]+r+[ea34]+k+u+/i,
	// Koga: k+[o0]+g+[ea34]+ (4 chars - whole word only)
	/^k+[o0]+g+[ea34]+$/i,
	// Ayame: [ea34]+y+[ea34]+m+[ea34]+
	/[ea34]+y+[ea34]+m+[ea34]+/i,
	// Bankotsu: b+[ea34]+n+k+[o0]+t+[s5]+u+
	/b+[ea34]+n+k+[o0]+t+[s5]+u+/i,
	// Jakotsu: j+[ea34]+k+[o0]+t+[s5]+u+
	/j+[ea34]+k+[o0]+t+[s5]+u+/i,
	// Inu no Taisho: [i1]+n+u+n+[o0]+t+[ea34]+[i1]+[s5]+h+[o0]+
	/[i1]+n+u+n+[o0]+t+[ea34]+[i1]+[s5]+h+[o0]+/i,
	// Toga: t+[o0]+g+[ea34]+ (4 chars - whole word only)
	/^t+[o0]+g+[ea34]+$/i,
	// Pokemon characters
	// Ash: [ea34]+[s5]+h+ (3 chars - whole word only)
	/^[ea34]+[s5]+h+$/i,
	// Pikachu: p+[i1]+k+[ea34]+ch+u+
	/p+[i1]+k+[ea34]+ch+u+/i,
	// Charizard: ch+[ea34]+r+[i1]+z+[ea34]+r+d+
	/ch+[ea34]+r+[i1]+z+[ea34]+r+d+/i,
	// Blastoise: b+l+[ea34]+[s5]+t+[o0]+[i1]+[s5]+[ea34]+
	/b+l+[ea34]+[s5]+t+[o0]+[i1]+[s5]+[ea34]+/i,
	// Venusaur: v+[ea34]+n+u+[s5]+[ea34]+u+r+
	/v+[ea34]+n+u+[s5]+[ea34]+u+r+/i,
	// Mewtwo: m+[ea34]+w+t+w+[o0]+
	/m+[ea34]+w+t+w+[o0]+/i,
	// Mew: m+[ea34]+w+ (3 chars - whole word only)
	/^m+[ea34]+w+$/i,
	// Gary: g+[ea34]+r+y+
	/g+[ea34]+r+y+/i,
	// Misty: m+[i1]+[s5]+t+y+
	/m+[i1]+[s5]+t+y+/i,
	// Brock: b+r+[o0]+c+k+
	/b+r+[o0]+c+k+/i,
	// Team Rocket: t+[ea34]+[ea34]+m+r+[o0]+c+k+[ea34]+t+
	/t+[ea34]+[ea34]+m+r+[o0]+c+k+[ea34]+t+/i,
	// Jessie: j+[ea34]+[s5]+[s5]+[i1]+[ea34]+
	/j+[ea34]+[s5]+[s5]+[i1]+[ea34]+/i,
	// James: j+[ea34]+m+[ea34]+[s5]+
	/j+[ea34]+m+[ea34]+[s5]+/i,
	// Meowth: m+[ea34]+[o0]+w+t+h+
	/m+[ea34]+[o0]+w+t+h+/i,
	// Nintendo characters
	// Mario: m+[ea34]+r+[i1]+[o0]+
	/m+[ea34]+r+[i1]+[o0]+/i,
	// Luigi: l+u+[i1]+g+[i1]+
	/l+u+[i1]+g+[i1]+/i,
	// Peach: p+[ea34]+[ea34]+ch+
	/p+[ea34]+[ea34]+ch+/i,
	// Bowser: b+[o0]+w+[s5]+[ea34]+r+
	/b+[o0]+w+[s5]+[ea34]+r+/i,
	// Yoshi: y+[o0]+[s5]+h+[i1]+
	/y+[o0]+[s5]+h+[i1]+/i,
	// Donkey Kong: d+[o0]+n+k+[ea34]+y+k+[o0]+n+g+
	/d+[o0]+n+k+[ea34]+y+k+[o0]+n+g+/i,
	// Link: l+[i1]+n+k+ (4 chars - whole word only)
	/^l+[i1]+n+k+$/i,
	// Zelda: z+[ea34]+l+d+[ea34]+
	/z+[ea34]+l+d+[ea34]+/i,
	// Ganondorf: g+[ea34]+n+[o0]+n+d+[o0]+r+f+
	/g+[ea34]+n+[o0]+n+d+[o0]+r+f+/i,
	// Samus: [s5]+[ea34]+m+u+[s5]+
	/[s5]+[ea34]+m+u+[s5]+/i,
	// Metroid: m+[ea34]+t+r+[o0]+[i1]+d+
	/m+[ea34]+t+r+[o0]+[i1]+d+/i,
	// Kirby: k+[i1]+r+b+y+
	/k+[i1]+r+b+y+/i,
	// Pikmin: p+[i1]+k+m+[i1]+n+
	/p+[i1]+k+m+[i1]+n+/i,
	// Fox McCloud: f+[o0]+x+m+c+c+l+[o0]+u+d+
	/f+[o0]+x+m+c+c+l+[o0]+u+d+/i,
	// Captain Falcon: c+[ea34]+p+t+[ea34]+[i1]+n+f+[ea34]+l+c+[o0]+n+
	/c+[ea34]+p+t+[ea34]+[i1]+n+f+[ea34]+l+c+[o0]+n+/i,
	// Ness: n+[ea34]+[s5]+[s5]+ (4 chars - whole word only)
	/^n+[ea34]+[s5]+[s5]+$/i,
	// Pit: p+[i1]+t+ (3 chars - whole word only)
	/^p+[i1]+t+$/i,
	// Palutena: p+[ea34]+l+u+t+[ea34]+n+[ea34]+
	/p+[ea34]+l+u+t+[ea34]+n+[ea34]+/i,
	// Shulk: [s5]+h+u+l+k+
	/[s5]+h+u+l+k+/i,
	// Inkling: [i1]+n+k+l+[i1]+n+g+
	/[i1]+n+k+l+[i1]+n+g+/i,
	// Star Wars characters
	// Leia: l+[ea34]+[i1]+[ea34]+
	/l+[ea34]+[i1]+[ea34]+/i,
	// Han: h+[ea34]+n+ (3 chars - whole word only)
	/^h+[ea34]+n+$/i,
	// Solo: [s5]+[o0]+l+[o0]+
	/[s5]+[o0]+l+[o0]+/i,
	// Vader: v+[ea34]+d+[ea34]+r+
	/v+[ea34]+d+[ea34]+r+/i,
	// Anakin: [ea34]+n+[ea34]+k+[i1]+n+
	/[ea34]+n+[ea34]+k+[i1]+n+/i,
	// Obi-Wan: [o0]+b+[i1]+w+[ea34]+n+
	/[o0]+b+[i1]+w+[ea34]+n+/i,
	// Yoda: y+[o0]+d+[ea34]+
	/y+[o0]+d+[ea34]+/i,
	// Chewbacca: ch+[ea34]+w+b+[ea34]+c+c+[ea34]+
	/ch+[ea34]+w+b+[ea34]+c+c+[ea34]+/i,
	// R2-D2: r+2+d+2+
	/r+2+d+2+/i,
	// C-3PO: c+3+p+[o0]+
	/c+3+p+[o0]+/i,
	// Padme: p+[ea34]+d+m+[ea34]+
	/p+[ea34]+d+m+[ea34]+/i,
	// Amidala: [ea34]+m+[i1]+d+[ea34]+l+[ea34]+
	/[ea34]+m+[i1]+d+[ea34]+l+[ea34]+/i,
	// Mace Windu: m+[ea34]+c+[ea34]+w+[i1]+n+d+u+
	/m+[ea34]+c+[ea34]+w+[i1]+n+d+u+/i,
	// Qui-Gon: qu+[i1]+g+[o0]+n+
	/qu+[i1]+g+[o0]+n+/i,
	// Darth Maul: d+[ea34]+r+t+h+m+[ea34]+u+l+
	/d+[ea34]+r+t+h+m+[ea34]+u+l+/i,
	// Darth Sidious: d+[ea34]+r+t+h+[s5]+[i1]+d+[i1]+[o0]+u+[s5]+
	/d+[ea34]+r+t+h+[s5]+[i1]+d+[i1]+[o0]+u+[s5]+/i,
	// Palpatine: p+[ea34]+l+p+[ea34]+t+[i1]+n+[ea34]+
	/p+[ea34]+l+p+[ea34]+t+[i1]+n+[ea34]+/i,
	// Rey: r+[ea34]+y+ (3 chars - whole word only)
	/^r+[ea34]+y+$/i,
	// Finn: f+[i1]+n+n+ (4 chars - whole word only)
	/^f+[i1]+n+n+$/i,
	// Poe: p+[o0]+[ea34]+ (3 chars - whole word only)
	/^p+[o0]+[ea34]+$/i,
	// Kylo Ren: k+y+l+[o0]+r+[ea34]+n+
	/k+y+l+[o0]+r+[ea34]+n+/i,
	// Ben Solo: b+[ea34]+n+[s5]+[o0]+l+[o0]+
	/b+[ea34]+n+[s5]+[o0]+l+[o0]+/i,
	// Ahsoka: [ea34]+h+[s5]+[o0]+k+[ea34]+
	/[ea34]+h+[s5]+[o0]+k+[ea34]+/i,
	// Kanan: k+[ea34]+n+[ea34]+n+
	/k+[ea34]+n+[ea34]+n+/i,
	// Sabine: [s5]+[ea34]+b+[i1]+n+[ea34]+
	/[s5]+[ea34]+b+[i1]+n+[ea34]+/i,
	// Zeb: z+[ea34]+b+ (3 chars - whole word only)
	/^z+[ea34]+b+$/i,
	// Chopper: ch+[o0]+p+p+[ea34]+r+
	/ch+[o0]+p+p+[ea34]+r+/i,
	// Grogu: g+r+[o0]+g+u+
	/g+r+[o0]+g+u+/i,
	// Mando: m+[ea34]+n+d+[o0]+
	/m+[ea34]+n+d+[o0]+/i,
	// Din Djarin: d+[i1]+n+d+j+[ea34]+r+[i1]+n+
	/d+[i1]+n+d+j+[ea34]+r+[i1]+n+/i,
];

/**
 * Checks if a name is blocked.
 *
 * A name is blocked if:
 * 1. It matches the display name or any keyword of any mob template
 * 2. It matches any offensive pattern
 * 3. It matches any well-known fantasy character name pattern
 *
 * @param name The name to check
 * @returns true if the name is blocked, false otherwise
 *
 * @example
 * ```typescript
 * import { isNameBlocked } from "./registry/reservedNames.js";
 *
 * if (isNameBlocked("goblin")) {
 *   console.log("Name is blocked");
 * }
 * ```
 */
export function isNameBlocked(name: string): boolean {
	const normalizedName = name.trim().toLowerCase();
	if (normalizedName.length === 0) return false;

	// Check against blocked names cache
	if (BLOCKED_NAMES.has(normalizedName)) {
		return true;
	}

	// Check against offensive patterns
	for (const pattern of OFFENSIVE_PATTERNS) {
		if (pattern.test(normalizedName)) {
			return true;
		}
	}

	// Check against well-known fantasy character name patterns
	for (const pattern of POP_NAME_PATTERNS) {
		if (pattern.test(normalizedName)) {
			return true;
		}
	}

	return false;
}

/**
 * Add a name to the blocked names set.
 * @param name The name to add (will be normalized to lowercase)
 */
export function addBlockedName(name: string): void {
	const normalizedName = name.trim().toLowerCase();
	if (normalizedName.length > 0) {
		BLOCKED_NAMES.add(normalizedName);
	}
}

/**
 * Clear all blocked names.
 * Primarily used for testing or rebuilding the cache.
 */
export function clearBlockedNames(): void {
	BLOCKED_NAMES.clear();
}

/**
 * Get the number of blocked names.
 * @returns The count of blocked names
 */
export function getBlockedNameCount(): number {
	return BLOCKED_NAMES.size;
}

