const stopWords = new Set([
  "a","about","above","after","again","against","all","also","am","an","and","any","are","as","at","be","because",
  "been","before","being","below","between","both","but","by","can","could","did","do","does","doing","down","during",
  "each","few","for","from","further","had","has","have","having","he","her","here","hers","herself","him","himself",
  "his","how","i","if","in","into","is","it","its","itself","just","me","more","most","my","myself","no","nor","not",
  "of","off","on","once","only","or","other","our","ours","ourselves","out","over","own","same","she","should","so",
  "some","such","than","that","the","their","theirs","them","themselves","then","there","these","they","this","those",
  "through","to","too","under","until","up","very","was","we","were","what","when","where","which","while","who","why",
  "will","with","you","your","yours","yourself","yourselves","afin","ainsi","alors","au","aucun","aussi","autre","avant",
  "avec","avoir","bon","car","ce","cela","ces","ceux","chaque","ci","comme","comment","dans","des","du","dedans","dehors",
  "depuis","devrait","doit","donc","dos","droite","debut","elle","elles","en","encore","essai","est","et","eu","fait",
  "faites","fois","font","force","haut","hors","ici","il","ils","je","juste","la","le","les","leur","ma","maintenant",
  "mais","mes","mine","moins","mon","mot","meme","ni","nommes","notre","nous","nouveaux","ou","par","parce","parole",
  "pas","personnes","peut","peu","piece","plupart","pour","pourquoi","quand","que","quel","quelle","quelles","quels",
  "qui","sa","sans","ses","seulement","si","sien","son","sont","sous","soyez","sujet","sur","ta","tandis","tellement",
  "tels","tes","ton","tous","tout","trop","tres","tu","valeur","voie","voient","vont","votre","vous","vu",
]);

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

export function extractKeywords(value) {
  return unique(
    normalizeText(value)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !stopWords.has(token)),
  );
}

function normalizePhrase(value) {
  return normalizeText(value);
}

export function deriveExpectedKeywords(referenceAnswer, override = {}) {
  if (override.replace?.length) return unique(override.replace.map(normalizePhrase));
  const removed = new Set((override.remove || []).map(normalizePhrase));
  return unique([
    ...extractKeywords(referenceAnswer),
    ...(override.add || []).map(normalizePhrase),
  ]).filter((keyword) => !removed.has(keyword));
}
