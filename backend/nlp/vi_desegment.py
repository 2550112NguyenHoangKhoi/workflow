"""Re-insert spaces into glued Vietnamese text from poorly-extracted PDFs.

Dense Vietnamese cheat-sheet / exam PDFs often extract with spaces lost between
syllables ("Côngthức" -> "Công thức"). Vietnamese is written one syllable per
token and every syllable follows strict phonotactics, so a glued run of
Vietnamese letters can be re-split into valid syllables via dynamic programming.

Built by the Antigravity CLI (Gemini 3.1 Pro, High). Dependency-free (re only).
"""
import re

# Vietnamese vowels, both lowercase and uppercase
VOWELS = "aăâeêioôơuưyàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ"
VOWELS += VOWELS.upper()

# Valid onsets (initial consonants)
ONSET_LIST = ["ngh", "ch", "gh", "gi", "kh", "ng", "nh", "ph", "qu", "th", "tr",
              "b", "c", "d", "đ", "g", "h", "k", "l", "m", "n", "p", "q", "r", "s", "t", "v", "x"]
ONSET_RE = "(" + "|".join(ONSET_LIST) + ")?"

# Nucleus must contain at least one Vietnamese vowel
NUCLEUS_RE = f"[{VOWELS}]+"

# Valid codas (final consonants)
CODA_LIST = ["ch", "ng", "nh", "c", "m", "n", "p", "t"]
CODA_RE = "(" + "|".join(CODA_LIST) + ")?"

# Anchored syllable regex
SYLLABLE_RE = re.compile(f"^{ONSET_RE}{NUCLEUS_RE}{CODA_RE}$", re.IGNORECASE)


def is_valid_syllable(word: str) -> bool:
    if not (1 <= len(word) <= 7):
        return False
    return bool(SYLLABLE_RE.fullmatch(word))


def best_segmentation(token: str):
    """DP segmentation of a token into valid Vietnamese syllables.

    Optimises for: (1) fewest syllables, (2) max sum of squared syllable lengths
    (favours skewed splits like 'ma trận' over 'mat rận'), (3) longer syllables
    toward the left.
    """
    N = len(token)
    dp = [(False, 0, 0, (), ())] * (N + 1)
    dp[N] = (True, 0, 0, (), ())

    for i in range(N - 1, -1, -1):
        best = (False, -9999, -9999, (), ())
        for j in range(i + 1, min(i + 8, N + 1)):
            part = token[i:j]
            if is_valid_syllable(part) and dp[j][0]:
                cand_num = dp[j][1] - 1
                cand_sq = dp[j][2] + len(part) ** 2
                cand_words = (part,) + dp[j][4]
                cand_lengths = (len(part),) + dp[j][3]
                cand = (True, cand_num, cand_sq, cand_lengths, cand_words)
                if not best[0] or cand[1:] > best[1:]:
                    best = cand
        dp[i] = best

    if dp[0][0]:
        return dp[0][4]
    return None


def desegment(text: str) -> str:
    tokens = text.split()
    out_tokens = []

    for tk in tokens:
        punct_match = re.search(r'([.,;:!?]+)$', tk)
        if punct_match:
            punct = punct_match.group(1)
            core = tk[:-len(punct)]
        else:
            punct = ""
            core = tk

        if not core:
            out_tokens.append(tk)
            continue
        if is_valid_syllable(core):                       # already a valid single syllable
            out_tokens.append(tk)
            continue
        if re.search(r'[0-9=+\-*/<>^!\[\](){}]', core):    # math / numbers
            out_tokens.append(tk)
            continue
        if all(ord(c) < 128 for c in core):               # pure ASCII (English etc.)
            out_tokens.append(tk)
            continue

        seg = best_segmentation(core)
        if seg is not None:
            out_tokens.append(" ".join(seg) + punct)
        else:
            out_tokens.append(tk)                          # no valid split -> leave as-is

    return " ".join(out_tokens)


if __name__ == '__main__':
    for case in ['Côngthức', 'đápánkhác', 'cáchgiải', 'địnhthức', 'matrận',
                 'Đây là một câu bình thường.', 'A=2x+3']:
        print(f"'{case}' -> '{desegment(case)}'")
