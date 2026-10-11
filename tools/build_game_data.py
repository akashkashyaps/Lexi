"""Build the arcade games' word and sentence data. Run once; no AI, no API keys.

    pip install -r tools/requirements-build.txt
    python tools/build_game_data.py

Downloads the sources into tools/.cache/ on first run (about 30 MB) and writes
static/games/data/word-catcher.json and static/games/data/grammar-runner.json.
The games fall back to their small built-in lists when these files are missing.
"""
import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from gamedata import catcher, runner, sources  # noqa: E402
from gamedata.lexicon import Lexicon  # noqa: E402
from gamedata.sentences import kid_vocab  # noqa: E402

CREDITS = {
    'word-catcher': 'Word classes from the Brown Corpus and WordNet (Princeton). Age-of-acquisition '
                    'ratings: Kuperman, Stadthagen-Gonzalez & Brysbaert (2012), via NoRaRe, CC BY 4.0.',
    'grammar-runner': 'Sentences from Tatoeba (tatoeba.org), CC BY 2.0 FR.',
}


def write(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    return os.path.getsize(path) // 1024


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--cache', default=os.path.join(HERE, '.cache'), help='where downloaded sources are kept')
    ap.add_argument('--out', default=os.path.join(HERE, '..', 'static', 'games', 'data'))
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    os.makedirs(args.out, exist_ok=True)
    t0 = time.time()

    print('Loading word sources...')
    sources.nltk_ready(args.cache)
    lex = Lexicon(sources.aoa_ratings(args.cache))

    print('Building Word Catcher words...')
    wc = catcher.build(lex)
    wc['credits'] = CREDITS['word-catcher']
    kb = write(os.path.join(args.out, 'word-catcher.json'), wc)
    for p, words in wc['pos'].items():
        print(f'  {p:12} {len(words):5}')
    for k in ('past', 'plural', 'he'):
        print(f'  {k + " pairs":12} {len(wc[k]):5}')
    print(f'  -> word-catcher.json ({kb} KB)')

    print('Building Grammar Runner questions from Tatoeba...')
    kids = catcher.candidates(lex)
    questions, found = runner.build(lex, kids, kid_vocab(lex, kids), sources.tatoeba_sentences(args.cache))
    kb = write(os.path.join(args.out, 'grammar-runner.json'),
               {'credits': CREDITS['grammar-runner'], 'questions': questions})
    for cat, n in found.items():
        kept = sum(1 for q in questions if q[0] == cat)
        print(f'  {cat:6} {kept:5} kept of {n} found')
    print(f'  -> grammar-runner.json ({kb} KB)')
    print(f'Done in {time.time() - t0:.0f}s')


if __name__ == '__main__':
    main()
