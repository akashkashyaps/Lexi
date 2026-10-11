"""Reading Tatoeba sentences: tokens, the kid-vocabulary check, and the subject at the start."""
import re

from lemminflect import getAllInflections

from .safety import unsafe, unsafe_sentence

DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
          'September', 'October', 'November', 'December']
NUMBERS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
           'eleven', 'twelve']
NAMES = {'Tom': 'he', 'John': 'he', 'Ken': 'he', 'Jack': 'he', 'Mike': 'he', 'Bob': 'he',
         'Mary': 'she', 'Jane': 'she', 'Lucy': 'she', 'Emily': 'she', 'Alice': 'she', 'Kate': 'she'}
PRONOUNS = {'I': 'I', 'you': 'you', 'he': 'he', 'she': 'she', 'it': 'it', 'we': 'we', 'they': 'they'}
DETS_SG = {'the', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that'}
DETS_PL = {'the', 'my', 'your', 'his', 'her', 'our', 'their', 'these', 'those'}
SHE_NOUNS = {'mother', 'mom', 'sister', 'girl', 'woman', 'aunt', 'grandmother', 'queen', 'lady',
             'daughter', 'princess', 'wife'}
HE_NOUNS = {'father', 'dad', 'brother', 'boy', 'man', 'uncle', 'grandfather', 'king', 'son',
            'prince', 'husband'}
PEOPLE = {'teacher', 'doctor', 'baby', 'friend', 'child', 'student', 'farmer', 'neighbor', 'cook',
          'driver', 'nurse', 'player', 'singer', 'pilot', 'dentist', 'person'}

SHAPE = re.compile(r"[A-Z][A-Za-z ,']*[a-z][.!?]")
TOKEN = re.compile(r"[A-Za-z]+(?:'clock)?|[,.!?]")


def kid_vocab(lex, lemmas):
    vocab = set()
    for w in lemmas:
        vocab.add(w)
        for forms in getAllInflections(w).values():
            vocab.update(forms)
    vocab.update(n.lower() for n in NUMBERS)
    vocab.update({"o'clock", 'a', 'an', 'the'})
    return {w for w in vocab if not unsafe(w)}


def tokenize(text, vocab, min_words=3, max_words=9):
    """Tokens of a short, kid-level sentence, or None."""
    text = text.strip()
    if not SHAPE.fullmatch(text) or "'" in text.replace("o'clock", '') or unsafe_sentence(text):
        return None
    toks = TOKEN.findall(text)
    words = [t for t in toks if t[0].isalpha()]
    if not (min_words <= len(words) <= max_words) or ''.join(toks) != text.replace(' ', ''):
        return None
    for i, t in enumerate(toks):
        if not t[0].isalpha() or t in NAMES or t in DAYS or t in MONTHS or t == 'I':
            continue
        low = t.lower() if i == 0 else t
        if low not in vocab:
            return None
    return toks


def join(toks):
    out = ''
    for t in toks:
        out += t if (t in ',.!?' or not out) else ' ' + t
    return out


def noun_number(lex, w):
    """'sg', 'pl' or None for a common noun we can be sure about."""
    if lex.brown_count(w) >= 5 and lex.share(w, 'noun') < 0.7:
        return None
    lem = lex.lemma(w, 'NOUN')
    if not lem:
        return None
    if lem == w:
        pl = lex.infl(w, 'NNS')
        return 'sg' if pl and pl != w and lex.raw[w]['NNS'] <= 0.1 * max(1, lex.raw[w]['NN']) else None
    return 'pl' if lex.infl(lem, 'NNS') == w else None


def subject(lex, toks, i=0):
    """Read a simple subject starting at toks[i]. Returns (end, pronoun, label) or None.

    pronoun is the one a child would swap in: I, you, he, she, it, we, they."""
    if i >= len(toks):
        return None
    t = toks[i]
    low = t if t == 'I' else t.lower()
    if low in PRONOUNS:
        return i + 1, PRONOUNS[low], None
    if t in NAMES:
        return i + 1, NAMES[t], t
    if low in DETS_SG | DETS_PL and i + 1 < len(toks):
        n = toks[i + 1]
        num = noun_number(lex, n) if n.isalpha() and n.islower() else None
        if num == 'sg' and low in DETS_SG:
            p = 'she' if n in SHE_NOUNS else 'he' if n in HE_NOUNS else 'one' if n in PEOPLE else 'it'
            return i + 2, p, (t[0].upper() + t[1:]) + ' ' + n
        if num == 'pl' and low in DETS_PL:
            return i + 2, 'they', (t[0].upper() + t[1:]) + ' ' + n
    return None
