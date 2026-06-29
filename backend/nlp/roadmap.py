import json
from google.antigravity import LocalAgentConfig
import nlp.vietnamese as vi

async def generate_roadmap(text_content: str, api_key: str = None) -> list:
    """
    Generates a structured study roadmap based on the provided document text.
    Returns a list of dicts: [{"title": "Step 1", "description": "Learn this"}, ...]
    """
    prompt = f"""
    Bạn là một gia sư chuyên nghiệp. Dựa vào nội dung tài liệu học tập sau đây, 
    hãy tạo một Giáo Án (Roadmap) gồm các bước học tập logic, theo trình tự từ cơ bản đến nâng cao.

    Nội dung tài liệu (trích xuất):
    {text_content[:10000]}

    Trả về kết quả DƯỚI DẠNG MẢNG JSON, mỗi phần tử là một object có:
    - "title": Tên của bước học tập (ví dụ: "Khái niệm cơ bản")
    - "description": Mô tả ngắn gọn những gì cần học trong bước này (ví dụ: "Thuộc phần: Chương 1 - Giới thiệu")

    CHỈ TRẢ VỀ JSON hợp lệ, KHÔNG CÓ markdown format, không có code blocks (```json).
    """

    config = LocalAgentConfig()
    if api_key:
        config.api_key = api_key
    
    # We import agent_run dynamically to avoid circular imports if needed
    from main import agent_run
    
    try:
        response_text = await agent_run(config, prompt, structured=False, timeout=40)
        # Clean up markdown if the LLM still returns it
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        items = json.loads(response_text.strip())
        if isinstance(items, list):
            return items
        return [{"title": "Lỗi định dạng", "description": "LLM không trả về danh sách."}]
    except Exception as e:
        print(f"Error generating roadmap: {e}")
        # Fallback to a basic structure if LLM fails
        return [
            {"title": "Đọc hiểu cơ bản", "description": "Nắm vững các khái niệm nền tảng trong tài liệu."},
            {"title": "Đi sâu vào chi tiết", "description": "Học kỹ các phần quan trọng và định lý."},
            {"title": "Thực hành và Ôn tập", "description": "Làm bài tập và review lại kiến thức."}
        ]
