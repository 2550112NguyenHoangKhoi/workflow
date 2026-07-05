import re
from collections import Counter

STOPWORDS = {
    'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'what', 'which', 'this', 'that', 'these', 'those', 'then',
    'so', 'than', 'such', 'both', 'through', 'about', 'for', 'is', 'of', 'while', 'during', 'to', 'what', 'which', 'is',
    'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
    'should', 'can', 'could', 'may', 'might', 'must', 'ought', "i'm", "you're", "he's", "she's", "it's", "we're", "they're",
    "i've", "you've", "we've", "they've", "i'd", "you'd", "he'd", "she'd", "we'd", "they'd", "i'll", "you'll", "he'll",
    "she'll", "we'll", "they'll", "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't", "doesn't", "don't",
    "didn't", "won't", "wouldn't", "shan't", "shouldn't", "can't", "cannot", "couldn't", "mustn't", "let's", "that's",
    "who's", "what's", "here's", "there's", "when's", "where's", "why's", "how's", 'một', 'là', 'và', 'của', 'các', 'có',
    'được', 'cho', 'trong', 'đã', 'người', 'không', 'với', 'khi', 'này', 'những', 'để', 'như', 'trên', 'sẽ', 'từ', 'rằng',
    'tại', 'nhưng', 'cũng', 'theo', 'đến', 'ra', 'nhiều', 'chỉ', 'nếu', 'hoặc', 'vì', 'rất', 'về', 'lại', 'có_thể', 'vẫn',
    'sự', 'hơn', 'sau', 'việc', 'bởi', 'thì', 'làm', 'vào', 'phải', 'đều', 'đang', 'nên'
}

def _keywords(text: str, n: int = 8) -> list[str]:
    # lowercase, tokenize on \w+, drop stopwords and tokens < 3 chars, rank by frequency,
    # return the top n distinct keywords.
    words = re.findall(r'\w+', text.lower())
    filtered = [w for w in words if len(w) >= 3 and w not in STOPWORDS]
    counts = Counter(filtered)
    return [word for word, count in counts.most_common(n)]

def make_prompt(topic: str, context: str = "", level: str = "") -> dict:
    concept = topic if topic else "Chủ đề"
    if context:
        kws = _keywords(context, 5)
        key_points = kws if len(kws) >= 3 else kws + ["định nghĩa", "ví dụ thực tế", "tại sao quan trọng"]
        key_points = key_points[:6]
    else:
        kws = _keywords(topic, 3)
        key_points = kws + ["định nghĩa", "ví dụ thực tế", "tại sao quan trọng"]
        key_points = key_points[:6]
    
    question_vi = f"Hãy giải thích '{concept}' bằng lời của chính bạn, như thể bạn đang dạy cho một người bạn chưa biết gì về chủ đề này. Dùng ví dụ đơn giản."
    
    return {
        "concept": concept,
        "key_points": key_points,
        "question_vi": question_vi
    }

def evaluate(concept: str, key_points: list[str], explanation: str, context: str = "") -> dict:
    expl_words = set(_keywords(explanation, 40))
    explanation_lower = explanation.lower()
    
    covered = []
    gaps = []
    
    for kp in key_points:
        kp_words = set(_keywords(kp, 5))
        is_covered = False
        
        if re.search(r'\b' + re.escape(kp.lower()) + r'\b', explanation_lower):
            is_covered = True
        else:
            for w in kp_words:
                if w in expl_words or re.search(r'\b' + re.escape(w) + r'\b', explanation_lower):
                    is_covered = True
                    break
        
        if is_covered:
            covered.append(kp)
        else:
            gaps.append(kp)
            
    coverage = len(covered) / max(1, len(key_points))
    
    word_count = len(re.findall(r'\w+', explanation))
    length_factor = 1.0
    if word_count < 10:
        length_factor = 0.3
    elif word_count < 25:
        length_factor = 0.6
        
    understanding_score = int(round(min(100, coverage * 100) * length_factor))
    misconceptions = []
    
    if gaps:
        followup_question = f"Bạn chưa đề cập tới '{gaps[0]}'. Bạn có thể giải thích thêm về điều này không?"
    else:
        followup_question = "Bạn có thể cho một ví dụ thực tế khác để chứng minh bạn đã hiểu sâu không?"
        
    feedback_vi = (
        f"Mức độ hiểu: {understanding_score}%\n"
        f"Đã đề cập: {len(covered)}/{len(key_points)} điểm chính.\n"
    )
    if understanding_score >= 70:
        feedback_vi += "Rất tốt! Bạn đã nắm bắt được ý chính.\n"
    else:
        feedback_vi += "Hãy xem lại những phần còn thiếu để hiểu sâu hơn.\n"
        
    feedback_vi += "\n(Lưu ý: Đánh giá offline chỉ kiểm tra từ khóa. Hãy bật Cloud AI để nhận nhận xét chi tiết hơn.)"
    
    return {
        "understanding_score": understanding_score,
        "covered": covered,
        "gaps": gaps,
        "misconceptions": misconceptions,
        "followup_question": followup_question,
        "feedback_vi": feedback_vi
    }
