import sys
import os
import json
import traceback

# Add backend directory to sys.path to allow correct imports
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from nlp.concept_map import (
    generate_offline_exam_prep,
    generate_offline_study_plan,
    generate_offline_learning_path,
    generate_offline_suggestions
)

# Test cases
TEST_CASES = {
    "empty": "",
    "spaces": "   \n   \t   ",
    "null_byte": "Hello\x00World",
    "special_chars": "!@#$%^&*()_+=-{}[]|\\:\";'<>,.?/~`",
    "html_tags": "<div>Hello <b>world</b>! <script>alert(1)</script></div>",
    "sql_injection": "'; DROP TABLE documents; --",
    "emojis": "🤖🚀🔥🌟💡📚🎓🔬🧩",
    "vietnamese": "Học máy (Machine Learning) là một lĩnh vực của trí tuệ nhân tạo liên quan đến việc phát triển các thuật toán cho phép máy tính tự học hỏi từ dữ liệu. Đây là tài liệu ôn thi học máy cực kỳ chi tiết cho sinh viên CNTT.",
    "chinese": "机器学习是人工智能的一个分支，它使计算机能够从数据中学习。这是关于机器学习的详细复习材料。",
    "arabic": "تعلم الآلة هو فرع من فروع الذكاء الاصطناعي يتيح للكمبيوتر التعلم من البيانات.",
    "cyrillic": "Машинное обучение — это область искусственного интеллекта, которая позволяет компьютерам обучаться на основе данных.",
    "mixed_unicode": "Machine Learning (Học máy - 机器学习) 🤖 is awesome! 📚",
    "very_long_above_limit": "This is a very long sentence about Machine Learning. " * 20000, # Approx 1.06MB (triggers spaCy E088)
    "very_long_below_limit": "This is a very long sentence about Machine Learning. " * 15000, # Approx 795KB (under spaCy limit)
    "very_long_vietnamese": "Học máy (Machine Learning) là một lĩnh vực của trí tuệ nhân tạo liên quan đến việc phát triển các thuật toán. " * 1000, # Approx 108KB
}



def validate_exam_prep(res):
    if not isinstance(res, dict): return False, "Result is not a dict"
    if "title" not in res or not isinstance(res["title"], str): return False, "Missing or invalid 'title'"
    if "markdown_content" not in res or not isinstance(res["markdown_content"], str): return False, "Missing or invalid 'markdown_content'"
    return True, ""

def validate_study_plan(res):
    if not isinstance(res, dict): return False, "Result is not a dict"
    if "title" not in res or not isinstance(res["title"], str): return False, "Missing or invalid 'title'"
    if "markdown_content" not in res or not isinstance(res["markdown_content"], str): return False, "Missing or invalid 'markdown_content'"
    return True, ""

def validate_learning_path(res):
    if not isinstance(res, dict): return False, "Result is not a dict"
    if "title" not in res or not isinstance(res["title"], str): return False, "Missing or invalid 'title'"
    if "description" not in res or not isinstance(res["description"], str): return False, "Missing or invalid 'description'"
    if "modules" not in res or not isinstance(res["modules"], list): return False, "Missing or invalid 'modules'"
    for i, mod in enumerate(res["modules"]):
        if not isinstance(mod, dict): return False, f"Module {i} is not a dict"
        if "title" not in mod or not isinstance(mod["title"], str): return False, f"Module {i} missing or invalid 'title'"
        if "topics" not in mod or not isinstance(mod["topics"], list): return False, f"Module {i} missing or invalid 'topics'"
        for j, top in enumerate(mod["topics"]):
            if not isinstance(top, dict): return False, f"Module {i} Topic {j} is not a dict"
            if "title" not in top or not isinstance(top["title"], str): return False, f"Module {i} Topic {j} missing or invalid 'title'"
            if "description" not in top or not isinstance(top["description"], str): return False, f"Module {i} Topic {j} missing or invalid 'description'"
            if "estimated_time" not in top or not isinstance(top["estimated_time"], str): return False, f"Module {i} Topic {j} missing or invalid 'estimated_time'"
    return True, ""

def validate_suggestions(res):
    if not isinstance(res, dict): return False, "Result is not a dict"
    for field in ["path_topic", "quiz_topic", "flashcard_topic"]:
        if field not in res or not isinstance(res[field], str):
            return False, f"Missing or invalid '{field}'"
    return True, ""

def run_stress_tests():
    results = {}
    failures = []
    
    # Test each function
    funcs = {
        "generate_offline_exam_prep": (generate_offline_exam_prep, validate_exam_prep),
        "generate_offline_study_plan": (generate_offline_study_plan, validate_study_plan),
        "generate_offline_learning_path": (lambda text: generate_offline_learning_path(text, db=None), validate_learning_path),
        "generate_offline_suggestions": (generate_offline_suggestions, validate_suggestions)
    }
    
    print("=" * 60)
    print("STARTING NLP FALLBACK FUNCTIONS STRESS TESTS")
    print("=" * 60)
    
    for func_name, (func, val_func) in funcs.items():
        results[func_name] = {}
        print(f"\nTesting {func_name}...")
        for case_name, text in TEST_CASES.items():
            print(f"  Case: {case_name} (length: {len(text)})... ", end="")
            try:
                # Truncate length display for output
                res = func(text)
                is_valid, err_msg = val_func(res)
                if is_valid:
                    results[func_name][case_name] = {"status": "PASS"}
                    print("PASS")
                else:
                    results[func_name][case_name] = {"status": "FAIL", "reason": f"Schema mismatch: {err_msg}", "output": str(res)[:200]}
                    failures.append((func_name, case_name, f"Schema mismatch: {err_msg}"))
                    print(f"FAIL (Schema: {err_msg})")
            except Exception as e:
                tb = traceback.format_exc()
                results[func_name][case_name] = {"status": "ERROR", "reason": str(e), "traceback": tb}
                failures.append((func_name, case_name, f"Exception: {str(e)}\n{tb}"))
                print("ERROR")
                
    print("\n" + "=" * 60)
    print("STRESS TEST SUMMARY")
    print("=" * 60)
    total_runs = len(funcs) * len(TEST_CASES)
    total_passed = total_runs - len(failures)
    print(f"Total test cases executed: {total_runs}")
    print(f"Passed: {total_passed}")
    print(f"Failed/Error: {len(failures)}")
    
    if failures:
        print("\nDetailed Failures:")
        for fn, case, err in failures:
            print(f"- {fn} under case '{case}':")
            print(f"  {err}")
    else:
        print("\nAll tests passed successfully with no errors or schema deviations!")
        
    # Also test generate_offline_learning_path with mock DB
    print("\nTesting generate_offline_learning_path with Mock DB...")
    class MockDoc:
        def __init__(self, filename, content):
            self.filename = filename
            self.content = content
            
    class MockDB:
        def __init__(self, docs):
            self._docs = docs
        def query(self, model):
            class Query:
                def __init__(self, docs):
                    self.docs = docs
                def all(self):
                    return self.docs
            return Query(self._docs)
            
    # 1. Standard Mock DB case
    mock_docs = [
        MockDoc("doc1.txt", "Học máy (Machine Learning) là một lĩnh vực của trí tuệ nhân tạo. Đây là tài liệu ôn tập Machine Learning rất hay."),
        MockDoc("doc2.txt", "Some other irrelevant document about space science and planets.")
    ]
    mock_db = MockDB(mock_docs)
    
    try:
        res = generate_offline_learning_path("Học máy", db=mock_db)
        is_valid, err_msg = validate_learning_path(res)
        if is_valid:
            print("  Mock DB Standard Case: PASS")
            results["generate_offline_learning_path_with_db"] = {"status": "PASS"}
        else:
            print(f"  Mock DB Standard Case: FAIL (Schema: {err_msg})")
            results["generate_offline_learning_path_with_db"] = {"status": "FAIL", "reason": err_msg}
    except Exception as e:
        print(f"  Mock DB Standard Case: ERROR ({e})")
        results["generate_offline_learning_path_with_db"] = {"status": "ERROR", "reason": str(e)}

    # 2. Very Long English Mock DB case
    mock_docs_long_en = [
        MockDoc("long_en.txt", "Machine learning is a subset of artificial intelligence. " * 50000),
        MockDoc("doc2.txt", "Some other irrelevant document about space science and planets.")
    ]
    mock_db_long_en = MockDB(mock_docs_long_en)
    
    try:
        res = generate_offline_learning_path("Machine learning", db=mock_db_long_en)
        is_valid, err_msg = validate_learning_path(res)
        if is_valid:
            print("  Mock DB Very Long English Case: PASS")
            results["generate_offline_learning_path_with_db_long_en"] = {"status": "PASS"}
        else:
            print(f"  Mock DB Very Long English Case: FAIL (Schema: {err_msg})")
            results["generate_offline_learning_path_with_db_long_en"] = {"status": "FAIL", "reason": err_msg}
    except Exception as e:
        print(f"  Mock DB Very Long English Case: ERROR ({e})")
        results["generate_offline_learning_path_with_db_long_en"] = {"status": "ERROR", "reason": str(e)}

    # 3. Very Long Vietnamese Mock DB case
    mock_docs_long_vi = [
        MockDoc("long_vi.txt", "Học máy (Machine Learning) là một lĩnh vực của trí tuệ nhân tạo. " * 1000),
        MockDoc("doc2.txt", "Some other irrelevant document about space science and planets.")
    ]
    mock_db_long_vi = MockDB(mock_docs_long_vi)
    
    try:
        res = generate_offline_learning_path("Học máy", db=mock_db_long_vi)
        is_valid, err_msg = validate_learning_path(res)
        if is_valid:
            print("  Mock DB Very Long Vietnamese Case: PASS")
            results["generate_offline_learning_path_with_db_long_vi"] = {"status": "PASS"}
        else:
            print(f"  Mock DB Very Long Vietnamese Case: FAIL (Schema: {err_msg})")
            results["generate_offline_learning_path_with_db_long_vi"] = {"status": "FAIL", "reason": err_msg}
    except Exception as e:
        print(f"  Mock DB Very Long Vietnamese Case: ERROR ({e})")
        results["generate_offline_learning_path_with_db_long_vi"] = {"status": "ERROR", "reason": str(e)}

        
    # Write report json
    with open("stress_test_report.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\nDetailed results written to stress_test_report.json")

if __name__ == "__main__":
    run_stress_tests()
