"""Word Catcher data: clear-cut words per part of speech, plus word-form pairs."""
from .lexicon import CLOSED, CLOSED_COMMON, KID_AGE
from .safety import unsafe

POS_ORDER = ('noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction')
MODALS = {'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must'}
NOT_ACTIONS = MODALS | {'be', 'have', 'do', 'dare', 'seem', 'ought'}
# Function words that pass the frequency test but are not words children are taught
TOO_ADULT = {'yeah', 'per', 'versus', 'whereas', 'concerning', 'including', 'whom', 'whoever',
             'thereby', 'hence', 'via', 'amongst', 'upon', 'according', 'depending', 'regarding',
             'despite', 'international', 'national', 'local', 'social', 'afford', 'arise', 'operate',
             'inhale', 'awaken', 'duly', 'gravely', 'commonly', 'mainly', 'readily', 'lately',
             'shortly', 'widely', 'similarly', 'separately', 'importantly', 'blindly', 'openly',
             'out'}  # "out" is a particle/adverb as often as a preposition
ODD_PAIRS = {'bore', 'lay', 'wound', 'ground'}
NO_THIRD_PERSON = {'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
                   'need', 'dare', 'ought', 'be', 'have', 'do'}


def candidates(lex):
    words = set(w for w in lex.aoa if lex.kid_level(w))
    for w in lex.tags:
        if lex.kid_level(w):
            words.add(w)
        elif lex.zipf(w) >= CLOSED_COMMON and lex.tags[w].most_common(1)[0][0] in CLOSED:
            words.add(w)
    # -ly adverbs built on a kid-level adjective: quickly, happily
    for w in list(lex.tags):
        if w.endswith('ly') and lex.zipf(w) >= 3.0:
            stem = w[:-2]
            stems = (stem, stem[:-1] + 'y' if stem.endswith('i') else stem, stem + 'e')
            if any(lex.aoa.get(s, 99) <= KID_AGE and lex.share(s, 'adjective') >= 0.5 for s in stems):
                words.add(w)
    words -= TOO_ADULT
    return {w for w in words if (w.isalpha() and w.islower() and len(w) > 1 or w == 'I') and not unsafe(w)}


def past_forms(lex, words):
    """Every word that is the past tense of some verb (so it can't safely be a 'now' word)."""
    out = set()
    for w in words:
        p = lex.infl(w, 'VBD')
        if p:
            out.add(p)
    return out


def build(lex):
    cands = candidates(lex)
    pos = {p: [] for p in POS_ORDER}
    for w in sorted(cands):
        cls = lex.clear_class(w)
        if cls in pos and lex.is_base(w, cls) and not (cls == 'verb' and w in NOT_ACTIONS):
            pos[cls].append(w)

    verbs = sorted(w for w in cands if lex.share(w, 'verb') >= 0.5 and lex.is_base(w, 'verb'))
    nouns = sorted(w for w in cands if lex.share(w, 'noun') >= 0.5 and lex.is_base(w, 'noun'))
    pasts = past_forms(lex, verbs)

    past, plural, he = [], [], []
    for v in verbs:
        p = lex.infl(v, 'VBD')
        lemmas = lex.lemma(v, 'VERB')
        risky_now = v in pasts or lemmas not in (None, v)   # "found", "saw", "put"
        p_is_verb = lex.brown_count(p) < 5 or lex.share(p, 'verb') >= 0.6 if p else False
        if (p and p != v and p_is_verb and p not in ODD_PAIRS and not risky_now and lex.zipf(p) >= 3.0
                and v not in MODALS and v != 'be' and not unsafe(p)):
            past.append([p, v])
        z = lex.infl(v, 'VBZ')
        if z and z != v and v not in NO_THIRD_PERSON and not risky_now and lex.zipf(z) >= 2.8:
            he.append([z, v])
    he += [['is', 'are'], ['has', 'have'], ['does', 'do']]

    for n in nouns:
        pl = lex.infl(n, 'NNS')
        if (pl and pl != n and lex.zipf(pl) >= 2.8 and lex.share(n, 'noun') >= 0.5
                and lex.raw[n]['NNS'] <= 0.2 * max(1, lex.raw[n]['NN']) and not unsafe(pl)):
            plural.append([pl, n])

    return {'pos': pos, 'past': past, 'plural': plural, 'he': he}
