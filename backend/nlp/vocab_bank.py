"""Vocabulary Bank for Workflow study app.
Contains graded vocabulary (b=beginner, i=intermediate, a=advanced) categorized by topics.
Derived from Oxford 3000/5000, AWL, and IELTS vocabulary.
"""

VOCAB_BANK = {
    "Everyday Life & Communication": {
        "b": [
            {"word": "habit", "ipa": "/ˈhæbɪt/", "part_of_speech": "noun", "meaning_vi": "thói quen", "example_en": "Reading is a good habit.", "example_vi": "Đọc sách là một thói quen tốt."},
            {"word": "always", "ipa": "/ˈɔːlweɪz/", "part_of_speech": "adverb", "meaning_vi": "luôn luôn", "example_en": "I always wake up early.", "example_vi": "Tôi luôn thức dậy sớm."},
            {"word": "family", "ipa": "/ˈfæməli/", "part_of_speech": "noun", "meaning_vi": "gia đình", "example_en": "My family is very important to me.", "example_vi": "Gia đình rất quan trọng với tôi."},
            {"word": "friend", "ipa": "/frend/", "part_of_speech": "noun", "meaning_vi": "bạn bè", "example_en": "She is my best friend.", "example_vi": "Cô ấy là bạn thân nhất của tôi."},
            {"word": "routine", "ipa": "/ruːˈtiːn/", "part_of_speech": "noun", "meaning_vi": "thói quen hàng ngày", "example_en": "My morning routine includes jogging.", "example_vi": "Thói quen buổi sáng của tôi bao gồm chạy bộ."},
            {"word": "happy", "ipa": "/ˈhæpi/", "part_of_speech": "adjective", "meaning_vi": "hạnh phúc, vui vẻ", "example_en": "I feel happy today.", "example_vi": "Hôm nay tôi cảm thấy vui."},
            {"word": "listen", "ipa": "/ˈlɪsn/", "part_of_speech": "verb", "meaning_vi": "lắng nghe", "example_en": "I like to listen to music.", "example_vi": "Tôi thích nghe nhạc."},
            {"word": "speak", "ipa": "/spiːk/", "part_of_speech": "verb", "meaning_vi": "nói", "example_en": "Can you speak English?", "example_vi": "Bạn có thể nói tiếng Anh không?"},
            {"word": "learn", "ipa": "/lɜːn/", "part_of_speech": "verb", "meaning_vi": "học", "example_en": "I want to learn swimming.", "example_vi": "Tôi muốn học bơi."},
            {"word": "time", "ipa": "/taɪm/", "part_of_speech": "noun", "meaning_vi": "thời gian", "example_en": "What time is it?", "example_vi": "Bây giờ là mấy giờ?"},
            {"word": "home", "ipa": "/həʊm/", "part_of_speech": "noun", "meaning_vi": "nhà", "example_en": "I am going home.", "example_vi": "Tôi đang về nhà."},
            {"word": "food", "ipa": "/fuːd/", "part_of_speech": "noun", "meaning_vi": "thức ăn", "example_en": "This food is delicious.", "example_vi": "Thức ăn này rất ngon."},
            {"word": "water", "ipa": "/ˈwɔːtə/", "part_of_speech": "noun", "meaning_vi": "nước", "example_en": "Drink plenty of water.", "example_vi": "Hãy uống nhiều nước."},
            {"word": "sleep", "ipa": "/sliːp/", "part_of_speech": "verb", "meaning_vi": "ngủ", "example_en": "I need to sleep.", "example_vi": "Tôi cần đi ngủ."},
            {"word": "work", "ipa": "/wɜːk/", "part_of_speech": "verb", "meaning_vi": "làm việc", "example_en": "She works hard.", "example_vi": "Cô ấy làm việc chăm chỉ."}
        ],
        "i": [
            {"word": "frequent", "ipa": "/ˈfriːkwənt/", "part_of_speech": "adjective", "meaning_vi": "thường xuyên", "example_en": "He is a frequent visitor here.", "example_vi": "Anh ấy là khách đến thăm thường xuyên ở đây."},
            {"word": "interact", "ipa": "/ˌɪntərˈækt/", "part_of_speech": "verb", "meaning_vi": "tương tác", "example_en": "We need to interact more with our customers.", "example_vi": "Chúng ta cần tương tác nhiều hơn với khách hàng."},
            {"word": "maintain", "ipa": "/meɪnˈteɪn/", "part_of_speech": "verb", "meaning_vi": "duy trì", "example_en": "It's important to maintain a healthy lifestyle.", "example_vi": "Việc duy trì lối sống lành mạnh là rất quan trọng."},
            {"word": "opportunity", "ipa": "/ˌɒpəˈtjuːnəti/", "part_of_speech": "noun", "meaning_vi": "cơ hội", "example_en": "This is a great opportunity for you.", "example_vi": "Đây là một cơ hội tuyệt vời cho bạn."},
            {"word": "participate", "ipa": "/pɑːˈtɪsɪpeɪt/", "part_of_speech": "verb", "meaning_vi": "tham gia", "example_en": "Everyone is encouraged to participate in the event.", "example_vi": "Mọi người được khuyến khích tham gia sự kiện này."},
            {"word": "community", "ipa": "/kəˈmjuːnəti/", "part_of_speech": "noun", "meaning_vi": "cộng đồng", "example_en": "We should contribute to our community.", "example_vi": "Chúng ta nên đóng góp cho cộng đồng của mình."},
            {"word": "experience", "ipa": "/ɪkˈspɪəriəns/", "part_of_speech": "noun", "meaning_vi": "kinh nghiệm, trải nghiệm", "example_en": "I have five years of experience in this field.", "example_vi": "Tôi có 5 năm kinh nghiệm trong lĩnh vực này."},
            {"word": "challenge", "ipa": "/ˈtʃælɪndʒ/", "part_of_speech": "noun", "meaning_vi": "thử thách", "example_en": "Learning a new language is a challenge.", "example_vi": "Học một ngôn ngữ mới là một thử thách."},
            {"word": "purpose", "ipa": "/ˈpɜːpəs/", "part_of_speech": "noun", "meaning_vi": "mục đích", "example_en": "What is the purpose of your visit?", "example_vi": "Mục đích chuyến thăm của bạn là gì?"},
            {"word": "solution", "ipa": "/səˈluːʃn/", "part_of_speech": "noun", "meaning_vi": "giải pháp", "example_en": "We need to find a solution to this problem.", "example_vi": "Chúng ta cần tìm một giải pháp cho vấn đề này."},
            {"word": "benefit", "ipa": "/ˈbenɪfɪt/", "part_of_speech": "noun", "meaning_vi": "lợi ích", "example_en": "The new park will bring many benefits.", "example_vi": "Công viên mới sẽ mang lại nhiều lợi ích."},
            {"word": "improve", "ipa": "/ɪmˈpruːv/", "part_of_speech": "verb", "meaning_vi": "cải thiện", "example_en": "I want to improve my English skills.", "example_vi": "Tôi muốn cải thiện kỹ năng tiếng Anh của mình."},
            {"word": "discuss", "ipa": "/dɪˈskʌs/", "part_of_speech": "verb", "meaning_vi": "thảo luận", "example_en": "Let's discuss this tomorrow.", "example_vi": "Hãy thảo luận điều này vào ngày mai."},
            {"word": "decision", "ipa": "/dɪˈsɪʒn/", "part_of_speech": "noun", "meaning_vi": "quyết định", "example_en": "It was a difficult decision to make.", "example_vi": "Đó là một quyết định khó khăn."},
            {"word": "support", "ipa": "/səˈpɔːt/", "part_of_speech": "verb", "meaning_vi": "hỗ trợ", "example_en": "I will always support you.", "example_vi": "Tôi sẽ luôn hỗ trợ bạn."}
        ],
        "a": [
            {"word": "ubiquitous", "ipa": "/juːˈbɪkwɪtəs/", "part_of_speech": "adjective", "meaning_vi": "có mặt ở khắp nơi", "example_en": "Smartphones have become ubiquitous in modern society.", "example_vi": "Điện thoại thông minh đã trở nên phổ biến ở khắp nơi trong xã hội hiện đại."},
            {"word": "ephemeral", "ipa": "/ɪˈfemərəl/", "part_of_speech": "adjective", "meaning_vi": "phù du, chóng vánh", "example_en": "Fame in the world of social media is often ephemeral.", "example_vi": "Sự nổi tiếng trong thế giới mạng xã hội thường rất phù du."},
            {"word": "profound", "ipa": "/prəˈfaʊnd/", "part_of_speech": "adjective", "meaning_vi": "sâu sắc", "example_en": "The discovery had a profound impact on science.", "example_vi": "Khám phá này có tác động sâu sắc đến nền khoa học."},
            {"word": "resilient", "ipa": "/rɪˈzɪliənt/", "part_of_speech": "adjective", "meaning_vi": "kiên cường, mau phục hồi", "example_en": "Children are remarkably resilient after facing adversity.", "example_vi": "Trẻ em tỏ ra vô cùng kiên cường sau khi đối mặt với nghịch cảnh."},
            {"word": "meticulous", "ipa": "/məˈtɪkjələs/", "part_of_speech": "adjective", "meaning_vi": "tỉ mỉ, kỹ càng", "example_en": "She is meticulous about her daily schedule.", "example_vi": "Cô ấy rất tỉ mỉ về lịch trình hàng ngày của mình."},
            {"word": "eloquent", "ipa": "/ˈeləkwənt/", "part_of_speech": "adjective", "meaning_vi": "hùng hồn, lưu loát", "example_en": "He gave an eloquent speech about human rights.", "example_vi": "Anh ấy đã có một bài phát biểu hùng hồn về nhân quyền."},
            {"word": "pragmatic", "ipa": "/præɡˈmætɪk/", "part_of_speech": "adjective", "meaning_vi": "thực dụng, thực tế", "example_en": "We need to adopt a pragmatic approach to solve this.", "example_vi": "Chúng ta cần áp dụng một cách tiếp cận thực tế để giải quyết điều này."},
            {"word": "innovative", "ipa": "/ˈɪnəvətɪv/", "part_of_speech": "adjective", "meaning_vi": "mang tính đổi mới", "example_en": "The company is known for its innovative products.", "example_vi": "Công ty này nổi tiếng với các sản phẩm mang tính đổi mới."},
            {"word": "sustainable", "ipa": "/səˈsteɪnəbl/", "part_of_speech": "adjective", "meaning_vi": "bền vững", "example_en": "We must focus on sustainable development.", "example_vi": "Chúng ta phải tập trung vào phát triển bền vững."},
            {"word": "lucrative", "ipa": "/ˈluːkrətɪv/", "part_of_speech": "adjective", "meaning_vi": "sinh lợi", "example_en": "He decided to pursue a lucrative career in finance.", "example_vi": "Anh ấy quyết định theo đuổi một sự nghiệp sinh lợi trong ngành tài chính."},
            {"word": "ambiguous", "ipa": "/æmˈbɪɡjuəs/", "part_of_speech": "adjective", "meaning_vi": "mơ hồ", "example_en": "The ending of the movie was intentionally ambiguous.", "example_vi": "Cái kết của bộ phim được cố ý làm cho mơ hồ."},
            {"word": "consensus", "ipa": "/kənˈsensəs/", "part_of_speech": "noun", "meaning_vi": "sự đồng thuận", "example_en": "The committee reached a consensus on the new policy.", "example_vi": "Ủy ban đã đạt được sự đồng thuận về chính sách mới."},
            {"word": "intrinsic", "ipa": "/ɪnˈtrɪnsɪk/", "part_of_speech": "adjective", "meaning_vi": "thuộc bản chất, nội tại", "example_en": "Art has an intrinsic value beyond its price.", "example_vi": "Nghệ thuật có một giá trị nội tại vượt ngoài giá cả của nó."},
            {"word": "mitigate", "ipa": "/ˈmɪtɪɡeɪt/", "part_of_speech": "verb", "meaning_vi": "làm giảm nhẹ", "example_en": "Efforts are being made to mitigate the effects of the crisis.", "example_vi": "Những nỗ lực đang được thực hiện để làm giảm nhẹ tác động của cuộc khủng hoảng."},
            {"word": "scrutinize", "ipa": "/ˈskruːtənaɪz/", "part_of_speech": "verb", "meaning_vi": "xem xét kỹ lưỡng", "example_en": "The documents were carefully scrutinized by the lawyers.", "example_vi": "Các tài liệu đã được các luật sư xem xét kỹ lưỡng."}
        ]
    },
    "Education & Work": {
        "b": [
            {"word": "school", "ipa": "/skuːl/", "part_of_speech": "noun", "meaning_vi": "trường học", "example_en": "The school is near my house.", "example_vi": "Trường học ở gần nhà tôi."},
            {"word": "student", "ipa": "/ˈstjuːdnt/", "part_of_speech": "noun", "meaning_vi": "học sinh, sinh viên", "example_en": "He is a good student.", "example_vi": "Anh ấy là một học sinh giỏi."},
            {"word": "teacher", "ipa": "/ˈtiːtʃə/", "part_of_speech": "noun", "meaning_vi": "giáo viên", "example_en": "The teacher explains clearly.", "example_vi": "Giáo viên giảng bài rất rõ ràng."},
            {"word": "office", "ipa": "/ˈɒfɪs/", "part_of_speech": "noun", "meaning_vi": "văn phòng", "example_en": "I work in an office.", "example_vi": "Tôi làm việc trong một văn phòng."},
            {"word": "boss", "ipa": "/bɒs/", "part_of_speech": "noun", "meaning_vi": "sếp", "example_en": "My boss is very friendly.", "example_vi": "Sếp của tôi rất thân thiện."},
            {"word": "book", "ipa": "/bʊk/", "part_of_speech": "noun", "meaning_vi": "quyển sách", "example_en": "I am reading a book.", "example_vi": "Tôi đang đọc một quyển sách."},
            {"word": "pen", "ipa": "/pen/", "part_of_speech": "noun", "meaning_vi": "cây bút", "example_en": "Can I borrow your pen?", "example_vi": "Tôi có thể mượn cây bút của bạn không?"},
            {"word": "class", "ipa": "/klɑːs/", "part_of_speech": "noun", "meaning_vi": "lớp học", "example_en": "The class starts at 8 AM.", "example_vi": "Lớp học bắt đầu lúc 8 giờ sáng."},
            {"word": "homework", "ipa": "/ˈhəʊmwɜːk/", "part_of_speech": "noun", "meaning_vi": "bài tập về nhà", "example_en": "I have a lot of homework.", "example_vi": "Tôi có nhiều bài tập về nhà."},
            {"word": "test", "ipa": "/test/", "part_of_speech": "noun", "meaning_vi": "bài kiểm tra", "example_en": "We have a test tomorrow.", "example_vi": "Chúng tôi có một bài kiểm tra vào ngày mai."},
            {"word": "job", "ipa": "/dʒɒb/", "part_of_speech": "noun", "meaning_vi": "công việc", "example_en": "I love my job.", "example_vi": "Tôi yêu công việc của mình."},
            {"word": "company", "ipa": "/ˈkʌmpəni/", "part_of_speech": "noun", "meaning_vi": "công ty", "example_en": "She works for a big company.", "example_vi": "Cô ấy làm việc cho một công ty lớn."},
            {"word": "money", "ipa": "/ˈmʌni/", "part_of_speech": "noun", "meaning_vi": "tiền", "example_en": "I need to earn money.", "example_vi": "Tôi cần kiếm tiền."},
            {"word": "desk", "ipa": "/desk/", "part_of_speech": "noun", "meaning_vi": "bàn làm việc", "example_en": "My desk is tidy.", "example_vi": "Bàn làm việc của tôi gọn gàng."},
            {"word": "paper", "ipa": "/ˈpeɪpə/", "part_of_speech": "noun", "meaning_vi": "giấy", "example_en": "Write it on a piece of paper.", "example_vi": "Hãy viết nó lên một tờ giấy."}
        ],
        "i": [
            {"word": "assignment", "ipa": "/əˈsaɪnmənt/", "part_of_speech": "noun", "meaning_vi": "bài tập, nhiệm vụ", "example_en": "I have to submit my assignment by Friday.", "example_vi": "Tôi phải nộp bài tập của mình trước thứ Sáu."},
            {"word": "colleague", "ipa": "/ˈkɒliːɡ/", "part_of_speech": "noun", "meaning_vi": "đồng nghiệp", "example_en": "My colleague helped me with the project.", "example_vi": "Đồng nghiệp của tôi đã giúp tôi dự án này."},
            {"word": "promote", "ipa": "/prəˈməʊt/", "part_of_speech": "verb", "meaning_vi": "thăng chức, thúc đẩy", "example_en": "He was promoted to manager.", "example_vi": "Anh ấy đã được thăng chức lên làm quản lý."},
            {"word": "qualification", "ipa": "/ˌkwɒlɪfɪˈkeɪʃn/", "part_of_speech": "noun", "meaning_vi": "bằng cấp, trình độ", "example_en": "She has the right qualifications for the job.", "example_vi": "Cô ấy có đủ bằng cấp phù hợp cho công việc."},
            {"word": "deadline", "ipa": "/ˈdedlaɪn/", "part_of_speech": "noun", "meaning_vi": "hạn chót", "example_en": "We must meet the project deadline.", "example_vi": "Chúng ta phải kịp hạn chót của dự án."},
            {"word": "schedule", "ipa": "/ˈʃedjuːl/", "part_of_speech": "noun", "meaning_vi": "lịch trình", "example_en": "My schedule is fully booked.", "example_vi": "Lịch trình của tôi đã kín chỗ."},
            {"word": "interview", "ipa": "/ˈɪntəvjuː/", "part_of_speech": "noun", "meaning_vi": "cuộc phỏng vấn", "example_en": "I have a job interview tomorrow.", "example_vi": "Tôi có một cuộc phỏng vấn xin việc vào ngày mai."},
            {"word": "research", "ipa": "/rɪˈsɜːtʃ/", "part_of_speech": "noun", "meaning_vi": "nghiên cứu", "example_en": "He is doing research on cancer.", "example_vi": "Anh ấy đang thực hiện nghiên cứu về bệnh ung thư."},
            {"word": "presentation", "ipa": "/ˌpreznˈteɪʃn/", "part_of_speech": "noun", "meaning_vi": "bài thuyết trình", "example_en": "She gave a great presentation.", "example_vi": "Cô ấy đã có một bài thuyết trình tuyệt vời."},
            {"word": "semester", "ipa": "/sɪˈmestə/", "part_of_speech": "noun", "meaning_vi": "học kỳ", "example_en": "The new semester starts in September.", "example_vi": "Học kỳ mới bắt đầu vào tháng Chín."},
            {"word": "degree", "ipa": "/dɪˈɡriː/", "part_of_speech": "noun", "meaning_vi": "bằng cấp (đại học)", "example_en": "He holds a master's degree.", "example_vi": "Anh ấy có bằng thạc sĩ."},
            {"word": "evaluate", "ipa": "/ɪˈvæljueɪt/", "part_of_speech": "verb", "meaning_vi": "đánh giá", "example_en": "The teacher will evaluate our performance.", "example_vi": "Giáo viên sẽ đánh giá hiệu suất của chúng tôi."},
            {"word": "career", "ipa": "/kəˈrɪə/", "part_of_speech": "noun", "meaning_vi": "sự nghiệp", "example_en": "She wants a career in medicine.", "example_vi": "Cô ấy muốn một sự nghiệp trong ngành y."},
            {"word": "salary", "ipa": "/ˈsæləri/", "part_of_speech": "noun", "meaning_vi": "mức lương", "example_en": "They offered him a high salary.", "example_vi": "Họ đã đề nghị cho anh ấy một mức lương cao."},
            {"word": "skill", "ipa": "/skɪl/", "part_of_speech": "noun", "meaning_vi": "kỹ năng", "example_en": "Communication is an important skill.", "example_vi": "Giao tiếp là một kỹ năng quan trọng."}
        ],
        "a": [
            {"word": "pedagogy", "ipa": "/ˈpedəɡɒdʒi/", "part_of_speech": "noun", "meaning_vi": "sư phạm", "example_en": "The university course focuses on modern pedagogy.", "example_vi": "Khóa học đại học tập trung vào phương pháp sư phạm hiện đại."},
            {"word": "empirical", "ipa": "/ɪmˈpɪrɪkl/", "part_of_speech": "adjective", "meaning_vi": "dựa trên kinh nghiệm/thực nghiệm", "example_en": "The study was based on empirical evidence.", "example_vi": "Nghiên cứu được dựa trên bằng chứng thực nghiệm."},
            {"word": "delegate", "ipa": "/ˈdelɪɡeɪt/", "part_of_speech": "verb", "meaning_vi": "giao phó, ủy quyền", "example_en": "A good manager knows how to delegate tasks effectively.", "example_vi": "Một người quản lý giỏi biết cách giao phó nhiệm vụ một cách hiệu quả."},
            {"word": "remuneration", "ipa": "/rɪˌmjuːnəˈreɪʃn/", "part_of_speech": "noun", "meaning_vi": "tiền thù lao, sự trả công", "example_en": "They demanded fair remuneration for their work.", "example_vi": "Họ yêu cầu tiền thù lao công bằng cho công việc của mình."},
            {"word": "procrastinate", "ipa": "/prəʊˈkræstɪneɪt/", "part_of_speech": "verb", "meaning_vi": "trì hoãn", "example_en": "Students often procrastinate when facing difficult essays.", "example_vi": "Học sinh thường trì hoãn khi phải đối mặt với các bài luận khó."},
            {"word": "curriculum", "ipa": "/kəˈrɪkjələm/", "part_of_speech": "noun", "meaning_vi": "chương trình giảng dạy", "example_en": "The school introduced a new curriculum this year.", "example_vi": "Trường đã giới thiệu một chương trình giảng dạy mới trong năm nay."},
            {"word": "subordinate", "ipa": "/səˈbɔːdɪnət/", "part_of_speech": "noun", "meaning_vi": "cấp dưới", "example_en": "He has a good relationship with his subordinates.", "example_vi": "Anh ấy có mối quan hệ tốt với cấp dưới của mình."},
            {"word": "entrepreneur", "ipa": "/ˌɒntrəprəˈnɜː/", "part_of_speech": "noun", "meaning_vi": "nhà doanh nghiệp", "example_en": "She is a successful entrepreneur in the tech industry.", "example_vi": "Cô ấy là một nhà doanh nghiệp thành công trong ngành công nghệ."},
            {"word": "monopoly", "ipa": "/məˈnɒpəli/", "part_of_speech": "noun", "meaning_vi": "sự độc quyền", "example_en": "The company has a virtual monopoly on the market.", "example_vi": "Công ty này có sự độc quyền gần như tuyệt đối trên thị trường."},
            {"word": "plagiarism", "ipa": "/ˈpleɪdʒərɪzəm/", "part_of_speech": "noun", "meaning_vi": "đạo văn", "example_en": "Plagiarism is strictly forbidden in universities.", "example_vi": "Đạo văn bị nghiêm cấm hoàn toàn tại các trường đại học."},
            {"word": "vocational", "ipa": "/vəʊˈkeɪʃənl/", "part_of_speech": "adjective", "meaning_vi": "thuộc về học nghề", "example_en": "Vocational training prepares students for specific careers.", "example_vi": "Đào tạo nghề chuẩn bị cho sinh viên cho các nghề nghiệp cụ thể."},
            {"word": "synergy", "ipa": "/ˈsɪnədʒi/", "part_of_speech": "noun", "meaning_vi": "sự hiệp lực", "example_en": "The merger created a powerful synergy between the two firms.", "example_vi": "Việc sáp nhập đã tạo ra sự hiệp lực mạnh mẽ giữa hai công ty."},
            {"word": "hierarchy", "ipa": "/ˈhaɪərɑːki/", "part_of_speech": "noun", "meaning_vi": "hệ thống cấp bậc", "example_en": "The corporate hierarchy can be difficult to navigate.", "example_vi": "Hệ thống cấp bậc doanh nghiệp có thể rất khó để định hướng."},
            {"word": "cognitive", "ipa": "/ˈkɒɡnətɪv/", "part_of_speech": "adjective", "meaning_vi": "thuộc về nhận thức", "example_en": "Playing chess can improve cognitive skills.", "example_vi": "Chơi cờ vua có thể cải thiện kỹ năng nhận thức."},
            {"word": "apprentice", "ipa": "/əˈprentɪs/", "part_of_speech": "noun", "meaning_vi": "người học việc", "example_en": "He worked as an apprentice to a master carpenter.", "example_vi": "Anh ấy làm việc như một người học việc cho một thợ mộc bậc thầy."}
        ]
    },
    "Health & Fitness": {
        "b": [
            {"word": "health", "ipa": "/helθ/", "part_of_speech": "noun", "meaning_vi": "sức khỏe", "example_en": "Smoking is bad for your health.", "example_vi": "Hút thuốc có hại cho sức khỏe của bạn."},
            {"word": "body", "ipa": "/ˈbɒdi/", "part_of_speech": "noun", "meaning_vi": "cơ thể", "example_en": "You need to take care of your body.", "example_vi": "Bạn cần chăm sóc cơ thể của mình."},
            {"word": "doctor", "ipa": "/ˈdɒktə/", "part_of_speech": "noun", "meaning_vi": "bác sĩ", "example_en": "The doctor is seeing a patient.", "example_vi": "Bác sĩ đang khám cho một bệnh nhân."},
            {"word": "sick", "ipa": "/sɪk/", "part_of_speech": "adjective", "meaning_vi": "ốm, bệnh", "example_en": "I feel sick today.", "example_vi": "Hôm nay tôi cảm thấy ốm."},
            {"word": "medicine", "ipa": "/ˈmedsn/", "part_of_speech": "noun", "meaning_vi": "thuốc", "example_en": "Did you take your medicine?", "example_vi": "Bạn đã uống thuốc chưa?"},
            {"word": "exercise", "ipa": "/ˈeksəsaɪz/", "part_of_speech": "noun", "meaning_vi": "bài tập thể dục", "example_en": "Daily exercise is good for you.", "example_vi": "Tập thể dục hàng ngày tốt cho bạn."},
            {"word": "hospital", "ipa": "/ˈhɒspɪtl/", "part_of_speech": "noun", "meaning_vi": "bệnh viện", "example_en": "She works at a hospital.", "example_vi": "Cô ấy làm việc tại một bệnh viện."},
            {"word": "hurt", "ipa": "/hɜːt/", "part_of_speech": "verb", "meaning_vi": "làm đau, bị đau", "example_en": "My leg hurts.", "example_vi": "Chân tôi bị đau."},
            {"word": "diet", "ipa": "/ˈdaɪət/", "part_of_speech": "noun", "meaning_vi": "chế độ ăn", "example_en": "He is on a diet.", "example_vi": "Anh ấy đang ăn kiêng."},
            {"word": "strong", "ipa": "/strɒŋ/", "part_of_speech": "adjective", "meaning_vi": "mạnh mẽ, khỏe mạnh", "example_en": "He is very strong.", "example_vi": "Anh ấy rất khỏe."}
        ],
        "i": [
            {"word": "disease", "ipa": "/dɪˈziːz/", "part_of_speech": "noun", "meaning_vi": "căn bệnh", "example_en": "Heart disease is a major problem.", "example_vi": "Bệnh tim là một vấn đề lớn."},
            {"word": "symptom", "ipa": "/ˈsɪmptəm/", "part_of_speech": "noun", "meaning_vi": "triệu chứng", "example_en": "Fever is a symptom of many illnesses.", "example_vi": "Sốt là một triệu chứng của nhiều loại bệnh."},
            {"word": "treatment", "ipa": "/ˈtriːtmənt/", "part_of_speech": "noun", "meaning_vi": "sự điều trị", "example_en": "The treatment will last for six months.", "example_vi": "Sự điều trị sẽ kéo dài trong 6 tháng."},
            {"word": "surgery", "ipa": "/ˈsɜːdʒəri/", "part_of_speech": "noun", "meaning_vi": "phẫu thuật", "example_en": "He needs surgery on his knee.", "example_vi": "Anh ấy cần phẫu thuật đầu gối."},
            {"word": "nutrition", "ipa": "/njuˈtrɪʃn/", "part_of_speech": "noun", "meaning_vi": "dinh dưỡng", "example_en": "Good nutrition is essential for growing children.", "example_vi": "Dinh dưỡng tốt là thiết yếu đối với trẻ em đang lớn."},
            {"word": "recover", "ipa": "/rɪˈkʌvə/", "part_of_speech": "verb", "meaning_vi": "phục hồi", "example_en": "It takes time to recover from the flu.", "example_vi": "Cần có thời gian để phục hồi sau bệnh cúm."},
            {"word": "prevent", "ipa": "/prɪˈvent/", "part_of_speech": "verb", "meaning_vi": "ngăn ngừa", "example_en": "Vaccines help prevent diseases.", "example_vi": "Vắc xin giúp ngăn ngừa bệnh tật."},
            {"word": "mental", "ipa": "/ˈmentl/", "part_of_speech": "adjective", "meaning_vi": "thuộc về tinh thần", "example_en": "Mental health is as important as physical health.", "example_vi": "Sức khỏe tinh thần cũng quan trọng như sức khỏe thể chất."},
            {"word": "immune", "ipa": "/ɪˈmjuːn/", "part_of_speech": "adjective", "meaning_vi": "miễn dịch", "example_en": "Vitamin C boosts the immune system.", "example_vi": "Vitamin C tăng cường hệ thống miễn dịch."},
            {"word": "prescribe", "ipa": "/prɪˈskraɪb/", "part_of_speech": "verb", "meaning_vi": "kê đơn (thuốc)", "example_en": "The doctor will prescribe some antibiotics.", "example_vi": "Bác sĩ sẽ kê đơn thuốc kháng sinh."}
        ],
        "a": [
            {"word": "sedentary", "ipa": "/ˈsedntri/", "part_of_speech": "adjective", "meaning_vi": "ít vận động", "example_en": "A sedentary lifestyle can lead to obesity.", "example_vi": "Một lối sống ít vận động có thể dẫn đến béo phì."},
            {"word": "chronic", "ipa": "/ˈkrɒnɪk/", "part_of_speech": "adjective", "meaning_vi": "mãn tính", "example_en": "He suffers from chronic back pain.", "example_vi": "Anh ấy bị đau lưng mãn tính."},
            {"word": "metabolism", "ipa": "/məˈtæbəlɪzəm/", "part_of_speech": "noun", "meaning_vi": "sự trao đổi chất", "example_en": "Exercise speeds up your metabolism.", "example_vi": "Tập thể dục làm tăng tốc độ trao đổi chất của bạn."},
            {"word": "epidemic", "ipa": "/ˌepɪˈdemɪk/", "part_of_speech": "noun", "meaning_vi": "bệnh dịch", "example_en": "The flu epidemic spread rapidly.", "example_vi": "Bệnh dịch cúm lan rộng nhanh chóng."},
            {"word": "diagnosis", "ipa": "/ˌdaɪəɡˈnəʊsɪs/", "part_of_speech": "noun", "meaning_vi": "sự chẩn đoán", "example_en": "Early diagnosis is crucial for a successful cure.", "example_vi": "Việc chẩn đoán sớm là rất quan trọng cho một ca chữa trị thành công."},
            {"word": "therapeutic", "ipa": "/ˌθerəˈpjuːtɪk/", "part_of_speech": "adjective", "meaning_vi": "thuộc về điều trị, liệu pháp", "example_en": "Swimming can have a therapeutic effect.", "example_vi": "Bơi lội có thể mang lại tác dụng trị liệu."},
            {"word": "prognosis", "ipa": "/prɒɡˈnəʊsɪs/", "part_of_speech": "noun", "meaning_vi": "tiên lượng (bệnh)", "example_en": "The prognosis for the patient is generally good.", "example_vi": "Tiên lượng cho bệnh nhân nói chung là tốt."},
            {"word": "deteriorate", "ipa": "/dɪˈtɪəriəreɪt/", "part_of_speech": "verb", "meaning_vi": "trở nên tồi tệ hơn", "example_en": "Her condition began to deteriorate.", "example_vi": "Tình trạng của cô ấy bắt đầu xấu đi."},
            {"word": "longevity", "ipa": "/lɒnˈdʒevəti/", "part_of_speech": "noun", "meaning_vi": "sự trường thọ", "example_en": "A healthy diet promotes longevity.", "example_vi": "Một chế độ ăn uống lành mạnh thúc đẩy sự trường thọ."},
            {"word": "alleviate", "ipa": "/əˈliːvieɪt/", "part_of_speech": "verb", "meaning_vi": "làm giảm bớt", "example_en": "These pills will alleviate the pain.", "example_vi": "Những viên thuốc này sẽ làm giảm bớt cơn đau."}
        ]
    },
    "Science & Technology": {
        "b": [
            {"word": "computer", "ipa": "/kəmˈpjuːtə/", "part_of_speech": "noun", "meaning_vi": "máy tính", "example_en": "I use a computer for my work.", "example_vi": "Tôi sử dụng máy tính cho công việc của mình."},
            {"word": "phone", "ipa": "/fəʊn/", "part_of_speech": "noun", "meaning_vi": "điện thoại", "example_en": "Where is my phone?", "example_vi": "Điện thoại của tôi ở đâu?"},
            {"word": "internet", "ipa": "/ˈɪntənet/", "part_of_speech": "noun", "meaning_vi": "mạng internet", "example_en": "The internet is very fast here.", "example_vi": "Mạng internet ở đây rất nhanh."},
            {"word": "screen", "ipa": "/skriːn/", "part_of_speech": "noun", "meaning_vi": "màn hình", "example_en": "Look at the screen.", "example_vi": "Hãy nhìn vào màn hình."},
            {"word": "app", "ipa": "/æp/", "part_of_speech": "noun", "meaning_vi": "ứng dụng", "example_en": "I downloaded a new app.", "example_vi": "Tôi đã tải xuống một ứng dụng mới."},
            {"word": "machine", "ipa": "/məˈʃiːn/", "part_of_speech": "noun", "meaning_vi": "máy móc", "example_en": "This machine is very loud.", "example_vi": "Cái máy này rất ồn."},
            {"word": "battery", "ipa": "/ˈbætri/", "part_of_speech": "noun", "meaning_vi": "pin", "example_en": "My battery is low.", "example_vi": "Pin của tôi sắp hết."},
            {"word": "science", "ipa": "/ˈsaɪəns/", "part_of_speech": "noun", "meaning_vi": "khoa học", "example_en": "Science is my favorite subject.", "example_vi": "Khoa học là môn học yêu thích của tôi."},
            {"word": "space", "ipa": "/speɪs/", "part_of_speech": "noun", "meaning_vi": "không gian, vũ trụ", "example_en": "Astronauts travel to space.", "example_vi": "Các phi hành gia du hành vào vũ trụ."},
            {"word": "robot", "ipa": "/ˈrəʊbɒt/", "part_of_speech": "noun", "meaning_vi": "người máy", "example_en": "The robot can clean the floor.", "example_vi": "Người máy có thể lau nhà."}
        ],
        "i": [
            {"word": "device", "ipa": "/dɪˈvaɪs/", "part_of_speech": "noun", "meaning_vi": "thiết bị", "example_en": "This device tracks your heart rate.", "example_vi": "Thiết bị này theo dõi nhịp tim của bạn."},
            {"word": "software", "ipa": "/ˈsɒftweə/", "part_of_speech": "noun", "meaning_vi": "phần mềm", "example_en": "We need to install the new software.", "example_vi": "Chúng ta cần cài đặt phần mềm mới."},
            {"word": "experiment", "ipa": "/ɪkˈsperɪmənt/", "part_of_speech": "noun", "meaning_vi": "cuộc thí nghiệm", "example_en": "The scientists conducted an experiment.", "example_vi": "Các nhà khoa học đã tiến hành một cuộc thí nghiệm."},
            {"word": "invent", "ipa": "/ɪnˈvent/", "part_of_speech": "verb", "meaning_vi": "phát minh", "example_en": "Who invented the telephone?", "example_vi": "Ai đã phát minh ra điện thoại?"},
            {"word": "discover", "ipa": "/dɪˈskʌvə/", "part_of_speech": "verb", "meaning_vi": "khám phá", "example_en": "They discovered a new planet.", "example_vi": "Họ đã khám phá ra một hành tinh mới."},
            {"word": "database", "ipa": "/ˈdeɪtəbeɪs/", "part_of_speech": "noun", "meaning_vi": "cơ sở dữ liệu", "example_en": "The information is stored in a database.", "example_vi": "Thông tin được lưu trữ trong một cơ sở dữ liệu."},
            {"word": "connection", "ipa": "/kəˈnekʃn/", "part_of_speech": "noun", "meaning_vi": "sự kết nối", "example_en": "I have a slow internet connection.", "example_vi": "Tôi có kết nối internet chậm."},
            {"word": "digital", "ipa": "/ˈdɪdʒɪtl/", "part_of_speech": "adjective", "meaning_vi": "kỹ thuật số", "example_en": "We live in a digital age.", "example_vi": "Chúng ta đang sống trong thời đại kỹ thuật số."},
            {"word": "update", "ipa": "/ˌʌpˈdeɪt/", "part_of_speech": "verb", "meaning_vi": "cập nhật", "example_en": "Please update your password.", "example_vi": "Vui lòng cập nhật mật khẩu của bạn."},
            {"word": "network", "ipa": "/ˈnetwɜːk/", "part_of_speech": "noun", "meaning_vi": "mạng lưới", "example_en": "The computer is connected to the network.", "example_vi": "Máy tính được kết nối với mạng lưới."}
        ],
        "a": [
            {"word": "algorithm", "ipa": "/ˈælɡərɪðəm/", "part_of_speech": "noun", "meaning_vi": "thuật toán", "example_en": "The search engine uses a complex algorithm.", "example_vi": "Công cụ tìm kiếm sử dụng một thuật toán phức tạp."},
            {"word": "breakthrough", "ipa": "/ˈbreɪkθruː/", "part_of_speech": "noun", "meaning_vi": "bước đột phá", "example_en": "This is a major breakthrough in cancer research.", "example_vi": "Đây là một bước đột phá lớn trong nghiên cứu ung thư."},
            {"word": "hypothesis", "ipa": "/haɪˈpɒθəsɪs/", "part_of_speech": "noun", "meaning_vi": "giả thuyết", "example_en": "We need to test this hypothesis.", "example_vi": "Chúng ta cần kiểm tra giả thuyết này."},
            {"word": "obsolete", "ipa": "/ˈɒbsəliːt/", "part_of_speech": "adjective", "meaning_vi": "lỗi thời", "example_en": "Cassette tapes are now obsolete.", "example_vi": "Băng cassette bây giờ đã lỗi thời."},
            {"word": "encryption", "ipa": "/ɪnˈkrɪpʃn/", "part_of_speech": "noun", "meaning_vi": "sự mã hóa", "example_en": "End-to-end encryption protects your messages.", "example_vi": "Mã hóa đầu cuối bảo vệ tin nhắn của bạn."},
            {"word": "automation", "ipa": "/ˌɔːtəˈmeɪʃn/", "part_of_speech": "noun", "meaning_vi": "sự tự động hóa", "example_en": "Automation is changing the manufacturing industry.", "example_vi": "Tự động hóa đang thay đổi ngành công nghiệp sản xuất."},
            {"word": "infrastructure", "ipa": "/ˈɪnfrəstrʌktʃə/", "part_of_speech": "noun", "meaning_vi": "cơ sở hạ tầng", "example_en": "The city needs to upgrade its IT infrastructure.", "example_vi": "Thành phố cần nâng cấp cơ sở hạ tầng CNTT."},
            {"word": "paradigm", "ipa": "/ˈpærədaɪm/", "part_of_speech": "noun", "meaning_vi": "mô hình, hệ nhận thức", "example_en": "We are experiencing a paradigm shift in computing.", "example_vi": "Chúng ta đang trải qua một sự thay đổi mô hình trong điện toán."},
            {"word": "artificial", "ipa": "/ˌɑːtɪˈfɪʃl/", "part_of_speech": "adjective", "meaning_vi": "nhân tạo", "example_en": "Artificial intelligence is advancing rapidly.", "example_vi": "Trí tuệ nhân tạo đang tiến bộ nhanh chóng."},
            {"word": "quantum", "ipa": "/ˈkwɒntəm/", "part_of_speech": "noun", "meaning_vi": "lượng tử", "example_en": "Quantum mechanics describes the behavior of tiny particles.", "example_vi": "Cơ học lượng tử mô tả hành vi của các hạt nhỏ bé."}
        ]
    },
    "Travel & Tourism": {
        "b": [
            {"word": "travel", "ipa": "/ˈtrævl/", "part_of_speech": "verb", "meaning_vi": "đi du lịch", "example_en": "I love to travel.", "example_vi": "Tôi thích đi du lịch."},
            {"word": "hotel", "ipa": "/həʊˈtel/", "part_of_speech": "noun", "meaning_vi": "khách sạn", "example_en": "We stayed at a nice hotel.", "example_vi": "Chúng tôi đã ở một khách sạn đẹp."},
            {"word": "ticket", "ipa": "/ˈtɪkɪt/", "part_of_speech": "noun", "meaning_vi": "vé", "example_en": "I bought a plane ticket.", "example_vi": "Tôi đã mua một vé máy bay."},
            {"word": "luggage", "ipa": "/ˈlʌɡɪdʒ/", "part_of_speech": "noun", "meaning_vi": "hành lý", "example_en": "My luggage is heavy.", "example_vi": "Hành lý của tôi rất nặng."},
            {"word": "passport", "ipa": "/ˈpɑːspɔːt/", "part_of_speech": "noun", "meaning_vi": "hộ chiếu", "example_en": "Don't forget your passport.", "example_vi": "Đừng quên hộ chiếu của bạn."},
            {"word": "tourist", "ipa": "/ˈtʊərɪst/", "part_of_speech": "noun", "meaning_vi": "du khách", "example_en": "The city is full of tourists.", "example_vi": "Thành phố đầy du khách."},
            {"word": "map", "ipa": "/mæp/", "part_of_speech": "noun", "meaning_vi": "bản đồ", "example_en": "Can you read a map?", "example_vi": "Bạn có biết đọc bản đồ không?"},
            {"word": "flight", "ipa": "/flaɪt/", "part_of_speech": "noun", "meaning_vi": "chuyến bay", "example_en": "My flight was delayed.", "example_vi": "Chuyến bay của tôi đã bị hoãn."},
            {"word": "beach", "ipa": "/biːtʃ/", "part_of_speech": "noun", "meaning_vi": "bãi biển", "example_en": "We walked along the beach.", "example_vi": "Chúng tôi đã đi dạo dọc bãi biển."},
            {"word": "guide", "ipa": "/ɡaɪd/", "part_of_speech": "noun", "meaning_vi": "hướng dẫn viên", "example_en": "Our tour guide is friendly.", "example_vi": "Hướng dẫn viên du lịch của chúng tôi rất thân thiện."}
        ],
        "i": [
            {"word": "destination", "ipa": "/ˌdestɪˈneɪʃn/", "part_of_speech": "noun", "meaning_vi": "điểm đến", "example_en": "Paris is a popular tourist destination.", "example_vi": "Paris là một điểm đến du lịch nổi tiếng."},
            {"word": "itinerary", "ipa": "/aɪˈtɪnərəri/", "part_of_speech": "noun", "meaning_vi": "lịch trình", "example_en": "We have a busy itinerary for our trip.", "example_vi": "Chúng tôi có một lịch trình bận rộn cho chuyến đi."},
            {"word": "accommodation", "ipa": "/əˌkɒməˈdeɪʃn/", "part_of_speech": "noun", "meaning_vi": "chỗ ở", "example_en": "We booked our accommodation online.", "example_vi": "Chúng tôi đã đặt chỗ ở trực tuyến."},
            {"word": "souvenir", "ipa": "/ˌsuːvəˈnɪə/", "part_of_speech": "noun", "meaning_vi": "quà lưu niệm", "example_en": "I bought a souvenir for my friend.", "example_vi": "Tôi đã mua một món quà lưu niệm cho bạn tôi."},
            {"word": "reservation", "ipa": "/ˌrezəˈveɪʃn/", "part_of_speech": "noun", "meaning_vi": "sự đặt chỗ", "example_en": "I made a reservation at the restaurant.", "example_vi": "Tôi đã đặt chỗ tại nhà hàng."},
            {"word": "departure", "ipa": "/dɪˈpɑːtʃə/", "part_of_speech": "noun", "meaning_vi": "sự khởi hành", "example_en": "Our departure time is 8 AM.", "example_vi": "Giờ khởi hành của chúng tôi là 8 giờ sáng."},
            {"word": "arrival", "ipa": "/əˈraɪvl/", "part_of_speech": "noun", "meaning_vi": "sự đến nơi", "example_en": "We waited at the arrivals hall.", "example_vi": "Chúng tôi đã đợi ở sảnh đến."},
            {"word": "customs", "ipa": "/ˈkʌstəmz/", "part_of_speech": "noun", "meaning_vi": "hải quan", "example_en": "It took an hour to get through customs.", "example_vi": "Mất một giờ để qua hải quan."},
            {"word": "currency", "ipa": "/ˈkʌrənsi/", "part_of_speech": "noun", "meaning_vi": "tiền tệ", "example_en": "I need to exchange some currency.", "example_vi": "Tôi cần đổi một ít tiền tệ."},
            {"word": "explore", "ipa": "/ɪkˈsplɔː/", "part_of_speech": "verb", "meaning_vi": "khám phá", "example_en": "We explored the old town.", "example_vi": "Chúng tôi đã khám phá khu phố cổ."}
        ],
        "a": [
            {"word": "picturesque", "ipa": "/ˌpɪktʃəˈresk/", "part_of_speech": "adjective", "meaning_vi": "đẹp như tranh vẽ", "example_en": "We visited a picturesque village in the mountains.", "example_vi": "Chúng tôi đã đến thăm một ngôi làng đẹp như tranh vẽ trên núi."},
            {"word": "breathtaking", "ipa": "/ˈbreθteɪkɪŋ/", "part_of_speech": "adjective", "meaning_vi": "đẹp ngoạn mục", "example_en": "The view from the top is breathtaking.", "example_vi": "Khung cảnh từ trên đỉnh thật ngoạn mục."},
            {"word": "excursion", "ipa": "/ɪkˈskɜːʃn/", "part_of_speech": "noun", "meaning_vi": "chuyến tham quan ngắn", "example_en": "We went on a full-day excursion to the ruins.", "example_vi": "Chúng tôi đã đi một chuyến tham quan cả ngày đến khu di tích."},
            {"word": "tranquil", "ipa": "/ˈtræŋkwɪl/", "part_of_speech": "adjective", "meaning_vi": "yên tĩnh, thanh bình", "example_en": "I prefer tranquil places away from the city.", "example_vi": "Tôi thích những nơi thanh bình tránh xa thành phố."},
            {"word": "itinerant", "ipa": "/aɪˈtɪnərənt/", "part_of_speech": "adjective", "meaning_vi": "lưu động, hay di chuyển", "example_en": "He lived an itinerant lifestyle, moving from town to town.", "example_vi": "Anh ấy sống một lối sống lưu động, chuyển từ thị trấn này sang thị trấn khác."},
            {"word": "unspoiled", "ipa": "/ʌnˈspɔɪld/", "part_of_speech": "adjective", "meaning_vi": "nguyên sơ, không bị phá hoại", "example_en": "This island is known for its unspoiled beaches.", "example_vi": "Hòn đảo này nổi tiếng với những bãi biển hoang sơ."},
            {"word": "cosmopolitan", "ipa": "/ˌkɒzməˈpɒlɪtən/", "part_of_speech": "adjective", "meaning_vi": "mang tính quốc tế", "example_en": "London is a truly cosmopolitan city.", "example_vi": "London là một thành phố mang tính quốc tế thực sự."},
            {"word": "stopover", "ipa": "/ˈstɒpəʊvə/", "part_of_speech": "noun", "meaning_vi": "điểm dừng chân", "example_en": "We had a brief stopover in Dubai.", "example_vi": "Chúng tôi đã có một điểm dừng chân ngắn ở Dubai."},
            {"word": "exotic", "ipa": "/ɪɡˈzɒtɪk/", "part_of_speech": "adjective", "meaning_vi": "kỳ lạ, ngoại lai", "example_en": "They traveled to exotic locations around the world.", "example_vi": "Họ đã đi du lịch đến những địa điểm kỳ lạ trên khắp thế giới."},
            {"word": "embark", "ipa": "/ɪmˈbɑːk/", "part_of_speech": "verb", "meaning_vi": "lên tàu, bắt đầu", "example_en": "We are ready to embark on a new adventure.", "example_vi": "Chúng tôi đã sẵn sàng bắt đầu một cuộc phiêu lưu mới."}
        ]
    }
}
