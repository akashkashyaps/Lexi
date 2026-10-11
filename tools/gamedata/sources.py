"""Load and cache the raw sources: NLTK (WordNet, Brown), Tatoeba, Kuperman AoA."""
import bz2
import csv
import os
import urllib.request

TATOEBA_URL = 'https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2'
AOA_URL = ('https://raw.githubusercontent.com/concepticon/norare-data/master/'
           'datasets/Kuperman-2012-AoA/Kuperman-2012-AoA.tsv')


def fetch(url, path):
    if not os.path.exists(path):
        print('  downloading', url)
        urllib.request.urlretrieve(url, path)
    return path


def nltk_ready(cache):
    import nltk
    d = os.path.join(cache, 'nltk')
    os.makedirs(d, exist_ok=True)
    if d not in nltk.data.path:
        nltk.data.path.insert(0, d)
    for pkg in ('wordnet', 'brown'):
        try:
            nltk.data.find('corpora/' + pkg)
        except LookupError:
            nltk.download(pkg, download_dir=d, quiet=True)


def aoa_ratings(cache):
    """word -> mean age (years) at which children learn it."""
    path = fetch(AOA_URL, os.path.join(cache, 'kuperman_aoa.tsv'))
    out = {}
    with open(path, encoding='utf-8') as f:
        for row in csv.DictReader(f, delimiter='\t'):
            w, age = row['ENGLISH'].strip().lower(), row['ENGLISH_AOA_MEAN']
            if w.isalpha() and age not in ('', 'NA'):
                out[w] = min(out.get(w, 99.0), float(age))
    return out


def tatoeba_sentences(cache):
    path = fetch(TATOEBA_URL, os.path.join(cache, 'eng_sentences.tsv.bz2'))
    with bz2.open(path, 'rt', encoding='utf-8') as f:
        for line in f:
            parts = line.rstrip('\n').split('\t')
            if len(parts) == 3:
                yield parts[2]
