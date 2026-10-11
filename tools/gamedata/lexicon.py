"""Word facts: how Brown tags each word, what WordNet says, and which words are kid-level."""
from collections import Counter, defaultdict

from lemminflect import getAllLemmas, getInflection
from wordfreq import zipf_frequency

# Brown tag (suffixes like -TL stripped) -> word class used by the games
OPEN = {'NN': 'noun', 'NNS': 'noun', 'NN$': 'noun', 'NNS$': 'noun',
        'JJ': 'adjective', 'JJR': 'adjective', 'JJS': 'adjective', 'JJT': 'adjective',
        'RB': 'adverb', 'RBR': 'adverb', 'RBT': 'adverb',
        'PPS': 'pronoun', 'PPSS': 'pronoun', 'PPO': 'pronoun', 'PPL': 'pronoun', 'PPLS': 'pronoun',
        'PP$$': 'pronoun', 'PN': 'pronoun', 'WPS': 'pronoun', 'WPO': 'pronoun',
        'IN': 'preposition', 'RP': 'preposition', 'CC': 'conjunction', 'CS': 'conjunction'}
WN_POS = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 's': 'adjective', 'r': 'adverb'}
CLOSED = ('pronoun', 'preposition', 'conjunction')

# A word counts as kid-level if children learn it by this age (Kuperman norms),
# or it is among the most common words in English (Zipf scale; 5.5 ~ "go", "big").
KID_AGE = 7.5
VERY_COMMON = 5.3
CLOSED_COMMON = 4.3


def tag_class(tag):
    tag = tag.split('-')[0].rstrip('*')
    if '+' in tag or not tag:
        return None
    if tag.startswith(('VB', 'BE', 'HV', 'DO')) or tag == 'MD':
        return 'verb'
    return OPEN.get(tag, tag.lower())  # DT, AT, CD, RP, EX... are their own classes


class Lexicon:
    def __init__(self, aoa):
        from nltk.corpus import brown, wordnet as wn
        self.wn = wn
        self.aoa = aoa
        self.tags = defaultdict(Counter)      # word -> Counter(class)
        self.raw = defaultdict(Counter)       # word -> Counter(raw Brown tag)
        for word, tag in brown.tagged_words():
            if not word.isalpha():
                continue
            w = word if word == 'I' else word.lower()
            c = tag_class(tag)
            if c:
                self.tags[w][c] += 1
                self.raw[w][tag.split('-')[0]] += 1

    # ---- facts ----
    def share(self, w, cls):
        c = self.tags.get(w)
        return c[cls] / sum(c.values()) if c else 0.0

    def brown_count(self, w):
        return sum(self.tags[w].values()) if w in self.tags else 0

    def wn_counts(self, w):
        """WordNet POS -> SemCor sense-use count (+1 per synset so unseen senses still register)."""
        out = Counter()
        for lem in self.wn.lemmas(w):
            out[WN_POS[lem.synset().pos()]] += lem.count() + 1
        return out

    def zipf(self, w):
        return zipf_frequency(w, 'en')

    def kid_level(self, w):
        return self.aoa.get(w, 99) <= KID_AGE or self.zipf(w) >= VERY_COMMON

    def lemma(self, w, upos):
        lem = getAllLemmas(w).get(upos)
        return lem[0] if lem else None

    def infl(self, w, tag):
        f = getInflection(w, tag)
        return f[0] if f else None

    # ---- the clear-cut test ----
    def clear_class(self, w):
        """The one word class this word belongs to, or None if a child could fairly argue for another."""
        n = self.brown_count(w)
        wn = self.wn_counts(w)
        if n >= 5:
            cls, k = self.tags[w].most_common(1)[0]
            if k / n < (0.85 if cls in CLOSED else 0.93):
                return None
        elif wn and n == 0:
            cls = max(wn, key=wn.get)
        else:
            return None
        if cls in CLOSED:
            # Closed-class words whose open-class senses are actually used (e.g. "near", "like")
            # are out; rare WordNet entries like "he" = helium don't count.
            used = sum(lem.count() for lem in self.wn.lemmas(w))
            return cls if used < max(3, 0.02 * n) else None
        if cls not in WN_POS.values() or cls not in wn:
            return None
        tot = sum(wn.values())
        if (tot - wn[cls]) / tot > 0.08:
            return None
        return cls

    def is_base(self, w, cls):
        upos = {'noun': 'NOUN', 'verb': 'VERB', 'adjective': 'ADJ', 'adverb': 'ADV'}.get(cls)
        return upos is None or self.lemma(w, upos) in (None, w)
