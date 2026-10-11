"""Words we keep out of a children's game even when they are kid-level vocabulary."""
from lemminflect import getAllLemmas

AVOID = set('''
kill murder die dead death gun shoot bomb war fight weapon knife blood
beer wine drunk alcohol cigarette smoke drug
hate stupid idiot dumb ugly fat fool shut
steal rob prison jail police devil hell damn god
divorce kiss naked pregnant marry marriage bride priest preach sermon pray
bullet army snot earwax swear scissor drown birth poison sexy
violence violent beaten attack crime criminal enemy punch slap
'''.split())


# Whole phrases that are fine word by word but not in a children's game
AVOID_PHRASES = ('grow a pair', 'needs a man', 'needs a woman', 'girlfriend', 'boyfriend')


def unsafe_sentence(text):
    low = text.lower()
    return any(p in low for p in AVOID_PHRASES)


def unsafe(word):
    w = word.lower()
    if w in AVOID:
        return True
    return any(lem in AVOID for lems in getAllLemmas(w).values() for lem in lems)
