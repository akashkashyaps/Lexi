"""Grammar Runner data: fill-the-gap questions made by rule from Tatoeba sentences."""
import random
from collections import Counter

from .catcher import MODALS
from .sentences import DAYS, MONTHS, NUMBERS, join, subject, tokenize

THIRD = {'he', 'she', 'it', 'one'}
SAY = {'he': 'he', 'she': 'she', 'it': 'it', 'one': 'he or she'}
OWN_TOPIC = MODALS | {'be', 'have', 'need', 'dare', 'ought'}
MARKERS = {'yesterday': 'Yesterday', 'ago': 'Ago'}
LAST = {'night', 'week', 'year', 'month', 'summer', 'winter', 'spring', 'weekend', *map(str.lower, DAYS)}
PER_CAT = 1500
PER_KEY = 5      # same topic + same answer + same next word: keep only a few
PER_KEY_PREP = 40  # in/on/at phrases come from a short list of patterns, so allow more each


def who(pron, label, plural_ok=True):
    """How the explanation names the subject: 'He', 'Tom = he', 'The shoes = they'."""
    if label is None:
        return pron if pron == 'I' else pron.capitalize()
    return label + ' = ' + ('more than one' if pron == 'they' else SAY[pron])


def gap(toks, i):
    return join(toks[:i] + ['___'] + toks[i + 1:])


# ---- the six topics; each returns (question, [right, wrong, wrong], why) or None ----

def q_s(lex, toks, kids):
    sub = subject(lex, toks)
    if not sub or sub[0] >= len(toks):
        return None
    i, pron, label = sub
    w = toks[i]
    lem = lex.lemma(w, 'VERB')
    if not lem or lem in OWN_TOPIC or lem not in kids or lex.share(w, 'verb') < (0.8 if label else 0.6):
        return None
    third, base, ing = lex.infl(lem, 'VBZ'), lem, lex.infl(lem, 'VBG')
    if not third or third == base or not ing:
        return None
    if pron in THIRD:
        if w != third:
            return None
        why = (who(pron, label) + ', so add -s: ' + SAY[pron] + ' ' + third + '.') if label else \
            'He, she, it: add -s. ' + pron.capitalize() + ' ' + third + '.'
        return gap(toks, i), [third, base, ing], why
    if w != base:
        return None
    lead = pron if pron == 'I' else pron.capitalize()
    why = (who(pron, label) + ', so no -s: they ' + base + '.') if label else lead + ': no -s. ' + lead + ' ' + base + '.'
    return gap(toks, i), [base, third, ing], why


def q_have(lex, toks, kids):
    sub = subject(lex, toks)
    if not sub or sub[0] >= len(toks) or toks[sub[0]] not in ('has', 'have'):
        return None
    i, pron, label = sub
    right = 'has' if pron in THIRD else 'have'
    if toks[i] != right:
        return None
    if label:
        why = who(pron, label) + ', so: ' + right + '.'
    else:
        why = 'He, she, it: has.' if right == 'has' else 'I, you, we, they: have.'
    return gap(toks, i), [right, 'have' if right == 'has' else 'has', 'having'], why


def q_be(lex, toks, kids):
    sub = subject(lex, toks)
    if not sub or sub[0] >= len(toks) or toks[sub[0]] not in ('am', 'is', 'are'):
        return None
    i, pron, label = sub
    right = 'am' if pron == 'I' else 'is' if pron in THIRD else 'are'
    if toks[i] != right:
        return None
    if label:
        why = who(pron, label) + ': ' + right + '.'
    else:
        why = {'am': 'I: am.', 'is': 'He, she, it: is.', 'are': 'We, you, they: are.'}[right]
    return gap(toks, i), [right] + [x for x in ('am', 'is', 'are') if x != right], why


def past_marker(toks):
    low = [t.lower() for t in toks]
    for k, t in enumerate(low):
        if t in MARKERS:
            return MARKERS[t]
        if t == 'last' and k + 1 < len(low) and low[k + 1] in LAST:
            return 'Last ' + toks[k + 1]
    return None


def q_past(lex, toks, kids):
    mark = past_marker(toks)
    if not mark:
        return None
    start = 0
    if toks[0].lower() == 'yesterday':
        start = 1
    elif toks[0].lower() == 'last':
        start = 2
    if start < len(toks) and toks[start] == ',':
        start += 1
    sub = subject(lex, toks, start)
    if not sub or sub[0] >= len(toks):
        return None
    i, w = sub[0], toks[sub[0]]
    lem = lex.lemma(w, 'VERB')
    if not lem or lem in MODALS or lem == 'be' or lem not in kids or lex.infl(lem, 'VBD') != w or w == lem:
        return None
    ing = lex.infl(lem, 'VBG')
    if not ing:
        return None
    # "They ___ they slept well last night": the time word belongs to a second clause,
    # so "say" would be right too. Only one-clause sentences.
    for t in toks[i + 1:]:
        if t in ('I', 'he', 'she', 'we', 'they') or (t.isalpha() and t.islower() and lex.lemma(t, 'VERB')
                                                     and lex.infl(lex.lemma(t, 'VERB'), 'VBD') == t
                                                     and lex.share(t, 'verb') >= 0.5):
            return None
    regular = w in (lem + 'ed', lem + 'd', lem[:-1] + 'ied', lem + lem[-1] + 'ed')
    why = (mark + ' = past. ' if mark != 'Ago' else '"Ago" means the past. ') + \
        ('Add -ed: ' + w + '.' if regular else lem + ' becomes ' + w + '.')
    return gap(toks, i), [w, lem, ing], why


SKIP_AFTER_A = {'few', 'lot', 'little', 'bit', 'couple', 'dozen', 'hundred', 'thousand', 'million'}


def q_art(lex, toks, kids):
    for i in range(1, len(toks) - 1):
        a, nxt = toks[i], toks[i + 1]
        if a not in ('a', 'an'):
            continue
        n = nxt.lower()
        if not nxt.isalpha() or n in SKIP_AFTER_A or n.startswith(('u', 'h', 'eu', 'one', 'once', 'y')):
            return None
        right = 'an' if n[0] in 'aeio' else 'a'
        if a != right:
            return None
        word = nxt[0].upper() + nxt[1:]
        after = toks[i + 2] if i + 2 < len(toks) else ''
        shown = nxt + ' ' + after if after.isalpha() and lex.share(n, 'adjective') >= 0.5 else nxt
        why = (word + ' starts with a vowel sound: an ' + shown + '.') if right == 'an' else \
            (word + ' does not start with a vowel sound: a ' + shown + '.')
        return gap(toks, i), [right, 'a' if right == 'an' else 'an', 'many'], why
    return None


PREP_RULES = []  # (prep, test(next tokens) -> bool, why template)


def prep_rule(prep, why):
    def deco(fn):
        PREP_RULES.append((prep, fn, why))
        return fn
    return deco


INSIDE = {'box', 'bag', 'kitchen', 'room', 'sky', 'pocket', 'fridge'}
SEASONS = {'summer', 'winter', 'spring', 'autumn'}
prep_rule('on', 'Days: on {0}.')(lambda r: r[0] in DAYS)
prep_rule('in', 'Months: in {0}.')(lambda r: r[0] in MONTHS)
prep_rule('in', 'Seasons: in {0}.')(lambda r: r[0] in SEASONS or (r[0] == 'the' and r[1:2] and r[1] in SEASONS))
prep_rule('in', 'Parts of the day: in {0}. (But: at night.)')(
    lambda r: r[0] == 'the' and r[1:2] and r[1] in ('morning', 'afternoon', 'evening') and r[2:3] != ['of'])
prep_rule('at', 'At for night: at night.')(lambda r: r[0] == 'night')
prep_rule('at', 'Exact times: at {0}.')(lambda r: r[0] in ('noon', 'midnight'))
prep_rule('at', 'Clock times: at {0}.')(lambda r: r[0] in NUMBERS and (len(r) == 1 or r[1] in (".", "!", "o'clock")))
prep_rule('at', 'We say: at home.')(lambda r: r[0] == 'home')
prep_rule('on', 'On top of a surface: on {0}.')(lambda r: r[0] == 'the' and r[1:2] and r[1] in ('table', 'floor'))
prep_rule('in', 'Inside something: in {0}.')(lambda r: r[0] == 'the' and r[1:2] and r[1] in INSIDE)


def q_prep(lex, toks, kids):
    for i in range(1, len(toks) - 1):
        p = toks[i]
        if p not in ('in', 'on', 'at'):
            continue
        rest = toks[i + 1:]
        for prep, test, why in PREP_RULES:
            if p == prep and test(rest):
                two = rest[0] == 'the' or rest[1:2] == ["o'clock"]
                phrase = ' '.join(rest[:2]) if two else rest[0]
                return gap(toks, i), [p] + [x for x in ('in', 'on', 'at') if x != p], why.format(phrase)
    return None


TOPICS = {'s': q_s, 'have': q_have, 'be': q_be, 'past': q_past, 'art': q_art, 'prep': q_prep}


def build(lex, kids, vocab, sentences, seed=7):
    found = {c: [] for c in TOPICS}
    seen = set()
    for text in sentences:
        toks = tokenize(text, vocab)
        if not toks:
            continue
        for cat, make in TOPICS.items():
            q = make(lex, toks, kids)
            if q and q[0] not in seen and len(set(q[1])) == 3:
                seen.add(q[0])
                found[cat].append((q, toks))
    rng = random.Random(seed)
    out = []
    for cat, items in found.items():
        rng.shuffle(items)
        items.sort(key=lambda x: len(x[1]))       # stable: shorter sentences first
        per_key, per_subj, kept = Counter(), Counter(), []
        for (q, ans, why), toks in items:
            blank = q.split().index(next(w for w in q.split() if w.startswith('___')))
            after = q.split()[blank + 1] if blank + 1 < len(q.split()) else ''
            key = (ans[0], after.strip('.,!?').lower())
            subj = q.split()[0]
            if per_key[key] >= (PER_KEY_PREP if cat == 'prep' else PER_KEY) or per_subj[subj] >= PER_CAT // 6:
                continue
            per_key[key] += 1
            per_subj[subj] += 1
            kept.append([cat, q, ans, why])
            if len(kept) >= PER_CAT:
                break
        rng.shuffle(kept)
        out += kept
    return out, {c: len(v) for c, v in found.items()}
