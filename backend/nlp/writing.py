"""Deterministic offline engine for the English writing-practice feature.

Modeled on english.datpmt.com: Vietnamese -> English sentence-by-sentence
translation practice, plus paragraph writing and IELTS Task 2 essay grading.

Pure stdlib (re, random, difflib). No AI SDK, no network. This is the fallback
used whenever the cloud AI engine is off or fails, so the endpoints never 500.
"""

import re
import random
import difflib


# ─────────────────────────────────────────────────────────────────────────────
# Seed bank — real, natural Vietnamese -> English pairs, roughly graded by level.
# level key: b = beginner, i = intermediate, a = advanced
# ─────────────────────────────────────────────────────────────────────────────

SENTENCE_BANK = {
    "Personal & Communication": {
        "b": [
            ("Tôi tên là Nam.", "My name is Nam."),
            ("Rất vui được gặp bạn.", "Nice to meet you."),
            ("Bạn khỏe không?", "How are you?"),
            ("Tôi hai mươi tuổi.", "I am twenty years old."),
            ("Đây là bạn của tôi.", "This is my friend."),
            ("Hẹn gặp lại ngày mai.", "See you tomorrow."),
        ],
        "i": [
            ("Tôi đã không gặp bạn ấy suốt nhiều năm.", "I haven't seen her for many years."),
            ("Chúng tôi thường gọi điện cho nhau vào cuối tuần.", "We usually call each other on the weekend."),
            ("Xin lỗi vì đã trả lời tin nhắn muộn.", "Sorry for replying to your message late."),
            ("Anh ấy giới thiệu tôi với gia đình của anh ấy.", "He introduced me to his family."),
            ("Tôi rất trân trọng sự giúp đỡ của bạn.", "I really appreciate your help."),
            ("Hãy giữ liên lạc nhé.", "Let's keep in touch."),
        ],
        "a": [
            ("Mặc dù chúng tôi hiếm khi gặp nhau, tình bạn của chúng tôi vẫn bền chặt.",
             "Although we rarely meet, our friendship remains strong."),
            ("Tôi đánh giá cao việc bạn đã thẳng thắn chia sẻ quan điểm của mình.",
             "I appreciate you sharing your point of view so honestly."),
            ("Việc duy trì các mối quan hệ đòi hỏi sự nỗ lực từ cả hai phía.",
             "Maintaining relationships requires effort from both sides."),
            ("Cô ấy có khả năng khiến mọi người cảm thấy được lắng nghe.",
             "She has the ability to make everyone feel heard."),
        ],
    },
    "Everyday Life": {
        "b": [
            ("Tôi thức dậy lúc bảy giờ.", "I wake up at seven o'clock."),
            ("Tôi đánh răng mỗi sáng.", "I brush my teeth every morning."),
            ("Trời hôm nay đẹp.", "The weather is nice today."),
            ("Tôi thích đọc sách.", "I like reading books."),
            ("Chúng tôi ăn tối lúc bảy giờ.", "We have dinner at seven."),
            ("Tôi đi ngủ sớm.", "I go to bed early."),
        ],
        "i": [
            ("Tôi thường dọn dẹp nhà cửa vào Chủ nhật.", "I usually clean the house on Sundays."),
            ("Sau giờ làm, tôi hay đi dạo trong công viên.", "After work, I often take a walk in the park."),
            ("Tôi đang cố gắng hình thành thói quen tập thể dục.", "I am trying to build a habit of exercising."),
            ("Buổi sáng của tôi khá bận rộn.", "My mornings are quite busy."),
            ("Tôi tưới cây trước khi đi làm.", "I water the plants before going to work."),
        ],
        "a": [
            ("Cuộc sống thường nhật của tôi xoay quanh những thói quen nhỏ giúp tôi giữ cân bằng.",
             "My daily life revolves around small routines that keep me balanced."),
            ("Tôi nhận ra rằng việc lên kế hoạch từ tối hôm trước giúp buổi sáng bớt vội vã.",
             "I have realized that planning the night before makes mornings less hectic."),
            ("Dành thời gian cho bản thân giữa lịch trình bận rộn là điều thiết yếu.",
             "Making time for myself amid a busy schedule is essential."),
        ],
    },
    "Transportation & Travel": {
        "b": [
            ("Tôi đi làm bằng xe buýt.", "I go to work by bus."),
            ("Sân bay ở đâu?", "Where is the airport?"),
            ("Tôi muốn mua một vé.", "I want to buy a ticket."),
            ("Chuyến tàu đến lúc chín giờ.", "The train arrives at nine."),
            ("Tôi thích đi du lịch.", "I like traveling."),
        ],
        "i": [
            ("Chúng tôi bị lỡ chuyến bay vì tắc đường.", "We missed our flight because of the traffic."),
            ("Bạn có thể chỉ đường đến ga tàu không?", "Could you show me the way to the train station?"),
            ("Tôi đã đặt phòng khách sạn trước một tuần.", "I booked the hotel room a week in advance."),
            ("Chuyến đi kéo dài khoảng năm tiếng.", "The trip takes about five hours."),
        ],
        "a": [
            ("Du lịch không chỉ mở rộng tầm nhìn mà còn dạy ta biết trân trọng sự khác biệt.",
             "Traveling not only broadens our horizons but also teaches us to value differences."),
            ("Việc lên kế hoạch hành trình kỹ lưỡng có thể giúp tránh những rắc rối không đáng có.",
             "Planning an itinerary carefully can help avoid unnecessary trouble."),
        ],
    },
    "School & Education": {
        "b": [
            ("Tôi là một học sinh.", "I am a student."),
            ("Tôi học tiếng Anh mỗi ngày.", "I study English every day."),
            ("Lớp học bắt đầu lúc tám giờ.", "The class starts at eight."),
            ("Tôi thích môn Toán.", "I like math."),
            ("Cô giáo rất tốt bụng.", "The teacher is very kind."),
        ],
        "i": [
            ("Tôi phải nộp bài luận vào thứ Sáu.", "I have to submit my essay on Friday."),
            ("Kỳ thi cuối kỳ khiến tôi khá lo lắng.", "The final exam makes me quite nervous."),
            ("Chúng tôi làm việc theo nhóm cho dự án này.", "We work in groups for this project."),
            ("Tôi đang ôn tập cho bài kiểm tra ngày mai.", "I am reviewing for tomorrow's test."),
        ],
        "a": [
            ("Giáo dục nên khuyến khích tư duy phản biện thay vì chỉ ghi nhớ máy móc.",
             "Education should encourage critical thinking rather than rote memorization."),
            ("Việc học suốt đời ngày càng trở nên quan trọng trong thế giới thay đổi nhanh chóng.",
             "Lifelong learning is increasingly important in a rapidly changing world."),
        ],
    },
    "Work & Business": {
        "b": [
            ("Tôi làm việc ở một công ty.", "I work at a company."),
            ("Tôi bắt đầu làm việc lúc chín giờ.", "I start work at nine."),
            ("Đây là sếp của tôi.", "This is my boss."),
            ("Tôi có một cuộc họp hôm nay.", "I have a meeting today."),
        ],
        "i": [
            ("Tôi cần hoàn thành báo cáo trước hạn chót.", "I need to finish the report before the deadline."),
            ("Chúng tôi đang tìm cách cải thiện năng suất.", "We are looking for ways to improve productivity."),
            ("Cô ấy được thăng chức vào tháng trước.", "She was promoted last month."),
            ("Dự án này đòi hỏi sự phối hợp giữa các phòng ban.", "This project requires coordination between departments."),
        ],
        "a": [
            ("Một nhà lãnh đạo giỏi biết cách truyền cảm hứng và trao quyền cho đội ngũ của mình.",
             "A good leader knows how to inspire and empower their team."),
            ("Khả năng thích ứng với thay đổi là yếu tố then chốt để thành công trong kinh doanh.",
             "The ability to adapt to change is a key factor for success in business."),
        ],
    },
    "Public Services": {
        "b": [
            ("Bưu điện ở đâu?", "Where is the post office?"),
            ("Tôi cần gặp bác sĩ.", "I need to see a doctor."),
            ("Đồn cảnh sát gần đây không?", "Is the police station near here?"),
            ("Tôi muốn gửi một lá thư.", "I want to send a letter."),
        ],
        "i": [
            ("Tôi phải gia hạn hộ chiếu tại cơ quan chức năng.", "I have to renew my passport at the authority."),
            ("Thủ tục hành chính đôi khi mất khá nhiều thời gian.", "Administrative procedures sometimes take quite a lot of time."),
            ("Bạn cần điền vào mẫu đơn này.", "You need to fill out this form."),
        ],
        "a": [
            ("Các dịch vụ công hiệu quả góp phần nâng cao chất lượng cuộc sống của người dân.",
             "Efficient public services contribute to improving citizens' quality of life."),
            ("Việc số hóa thủ tục hành chính giúp giảm bớt gánh nặng giấy tờ.",
             "Digitizing administrative procedures helps reduce the burden of paperwork."),
        ],
    },
    "Health & Medicine": {
        "b": [
            ("Tôi bị đau đầu.", "I have a headache."),
            ("Tôi cần uống thuốc.", "I need to take medicine."),
            ("Hãy uống nhiều nước.", "Drink a lot of water."),
            ("Tôi cảm thấy mệt.", "I feel tired."),
        ],
        "i": [
            ("Bác sĩ khuyên tôi nên nghỉ ngơi nhiều hơn.", "The doctor advised me to rest more."),
            ("Tập thể dục thường xuyên giúp cải thiện sức khỏe.", "Exercising regularly helps improve health."),
            ("Tôi đã đặt lịch khám vào tuần sau.", "I made an appointment for next week."),
        ],
        "a": [
            ("Phòng bệnh hơn chữa bệnh, vì vậy lối sống lành mạnh là vô cùng quan trọng.",
             "Prevention is better than cure, so a healthy lifestyle is extremely important."),
            ("Sức khỏe tinh thần cũng cần được quan tâm như sức khỏe thể chất.",
             "Mental health deserves as much attention as physical health."),
        ],
    },
    "Shopping & Money": {
        "b": [
            ("Cái này giá bao nhiêu?", "How much is this?"),
            ("Tôi muốn mua cái áo này.", "I want to buy this shirt."),
            ("Nó quá đắt.", "It is too expensive."),
            ("Tôi trả bằng tiền mặt.", "I pay in cash."),
        ],
        "i": [
            ("Tôi đang cố gắng tiết kiệm tiền mỗi tháng.", "I am trying to save money every month."),
            ("Cửa hàng đang có chương trình giảm giá.", "The store is having a sale."),
            ("Bạn có thể giảm giá một chút không?", "Could you give me a small discount?"),
        ],
        "a": [
            ("Quản lý tài chính cá nhân một cách khôn ngoan giúp ta tránh khỏi nợ nần.",
             "Managing personal finances wisely helps us avoid debt."),
            ("Mua sắm bốc đồng thường dẫn đến những khoản chi tiêu không cần thiết.",
             "Impulsive shopping often leads to unnecessary spending."),
        ],
    },
    "Food & Drink": {
        "b": [
            ("Tôi đói bụng.", "I am hungry."),
            ("Tôi muốn một cốc cà phê.", "I want a cup of coffee."),
            ("Món này rất ngon.", "This dish is very delicious."),
            ("Bạn thích ăn gì?", "What do you like to eat?"),
        ],
        "i": [
            ("Tôi thích thử các món ăn từ nhiều nền văn hóa khác nhau.", "I like trying dishes from different cultures."),
            ("Chúng tôi thường nấu ăn tại nhà để tiết kiệm.", "We often cook at home to save money."),
            ("Nhà hàng này nổi tiếng với món hải sản.", "This restaurant is famous for its seafood."),
        ],
        "a": [
            ("Ẩm thực là một phần không thể thiếu trong bản sắc văn hóa của mỗi quốc gia.",
             "Cuisine is an indispensable part of each country's cultural identity."),
            ("Một chế độ ăn cân bằng đóng vai trò quan trọng đối với sức khỏe lâu dài.",
             "A balanced diet plays an important role in long-term health."),
        ],
    },
    "Entertainment & Leisure": {
        "b": [
            ("Tôi thích xem phim.", "I like watching movies."),
            ("Chúng tôi chơi bóng đá vào cuối tuần.", "We play football on the weekend."),
            ("Bài hát này hay quá.", "This song is so good."),
            ("Tôi thích nghe nhạc.", "I like listening to music."),
        ],
        "i": [
            ("Tôi dành thời gian rảnh để vẽ tranh.", "I spend my free time painting."),
            ("Bộ phim đó nhận được nhiều lời khen ngợi.", "That movie received a lot of praise."),
            ("Chúng tôi đã đi cắm trại vào kỳ nghỉ vừa rồi.", "We went camping during the last holiday."),
        ],
        "a": [
            ("Giải trí lành mạnh giúp ta tái tạo năng lượng sau những ngày làm việc căng thẳng.",
             "Healthy entertainment helps us recharge after stressful working days."),
            ("Việc theo đuổi một sở thích cá nhân có thể mang lại niềm vui và sự cân bằng.",
             "Pursuing a personal hobby can bring joy and balance."),
        ],
    },
    "Nature & Environment": {
        "b": [
            ("Cây xanh rất quan trọng.", "Trees are very important."),
            ("Chúng ta nên bảo vệ môi trường.", "We should protect the environment."),
            ("Trời hôm nay có mưa.", "It is raining today."),
            ("Tôi thích đi dạo trong rừng.", "I like walking in the forest."),
        ],
        "i": [
            ("Ô nhiễm không khí đang trở thành vấn đề nghiêm trọng.", "Air pollution is becoming a serious problem."),
            ("Chúng ta nên tái chế rác thải để bảo vệ hành tinh.", "We should recycle waste to protect the planet."),
            ("Rừng cung cấp oxy và môi trường sống cho động vật.", "Forests provide oxygen and habitats for animals."),
        ],
        "a": [
            ("Biến đổi khí hậu đòi hỏi hành động khẩn cấp từ mọi quốc gia trên thế giới.",
             "Climate change requires urgent action from every country in the world."),
            ("Việc bảo tồn đa dạng sinh học là điều thiết yếu cho sự cân bằng của hệ sinh thái.",
             "Preserving biodiversity is essential for the balance of the ecosystem."),
        ],
    },
    "Science & Technology": {
        "b": [
            ("Tôi thích dùng máy tính.", "I like using computers."),
            ("Điện thoại thông minh rất tiện lợi.", "Smartphones are very convenient."),
            ("Robot có thể giúp con người làm việc.", "Robots can help people work."),
            ("Internet kết nối mọi người.", "The internet connects people."),
        ],
        "i": [
            ("Công nghệ đang thay đổi cách chúng ta học tập.", "Technology is changing the way we learn."),
            ("Trí tuệ nhân tạo được ứng dụng trong nhiều lĩnh vực.", "Artificial intelligence is applied in many fields."),
            ("Nhiều công việc sẽ được tự động hóa trong tương lai.", "Many jobs will be automated in the future."),
        ],
        "a": [
            ("Sự phát triển của trí tuệ nhân tạo đặt ra nhiều câu hỏi về đạo đức và quyền riêng tư.",
             "The development of artificial intelligence raises many questions about ethics and privacy."),
            ("Những đột phá khoa học gần đây đã mở ra khả năng chữa trị nhiều căn bệnh nan y.",
             "Recent scientific breakthroughs have opened up the possibility of curing many incurable diseases."),
        ],
    },
    "Culture & Society": {
        "b": [
            ("Việt Nam có nhiều lễ hội.", "Vietnam has many festivals."),
            ("Gia đình rất quan trọng với tôi.", "Family is very important to me."),
            ("Mọi người nên tôn trọng lẫn nhau.", "People should respect each other."),
        ],
        "i": [
            ("Mỗi quốc gia có những phong tục và truyền thống riêng.", "Each country has its own customs and traditions."),
            ("Toàn cầu hóa ảnh hưởng đến văn hóa địa phương.", "Globalization affects local cultures."),
            ("Sự đa dạng văn hóa làm cho xã hội trở nên phong phú hơn.", "Cultural diversity makes society richer."),
        ],
        "a": [
            ("Việc gìn giữ bản sắc văn hóa trong thời đại toàn cầu hóa là một thách thức lớn.",
             "Preserving cultural identity in the age of globalization is a great challenge."),
            ("Bình đẳng xã hội là nền tảng cho sự phát triển bền vững của một quốc gia.",
             "Social equality is the foundation for the sustainable development of a nation."),
        ],
    },
    "Government & Politics": {
        "b": [
            ("Người dân có quyền bầu cử.", "Citizens have the right to vote."),
            ("Chính phủ ban hành luật mới.", "The government issues new laws."),
            ("Hòa bình rất quan trọng.", "Peace is very important."),
        ],
        "i": [
            ("Chính phủ cần lắng nghe ý kiến của người dân.", "The government needs to listen to citizens' opinions."),
            ("Các chính sách mới nhằm cải thiện đời sống người dân.", "The new policies aim to improve people's lives."),
            ("Tham nhũng làm suy yếu niềm tin của công chúng.", "Corruption undermines public trust."),
        ],
        "a": [
            ("Một hệ thống chính trị minh bạch là điều kiện tiên quyết cho sự phát triển của xã hội.",
             "A transparent political system is a prerequisite for the development of society."),
            ("Việc cân bằng giữa tự do cá nhân và lợi ích tập thể luôn là một bài toán khó.",
             "Balancing individual freedom and collective interest is always a difficult problem."),
        ],
    },
    "History & Geography": {
        "b": [
            ("Tôi thích học lịch sử.", "I like studying history."),
            ("Việt Nam nằm ở Đông Nam Á.", "Vietnam is located in Southeast Asia."),
            ("Sông Hồng chảy qua Hà Nội.", "The Red River flows through Hanoi."),
        ],
        "i": [
            ("Lịch sử giúp chúng ta hiểu về quá khứ.", "History helps us understand the past."),
            ("Mỗi vùng miền có đặc điểm địa lý riêng.", "Each region has its own geographical features."),
            ("Nhiều di tích lịch sử cần được bảo tồn.", "Many historical sites need to be preserved."),
        ],
        "a": [
            ("Việc nghiên cứu lịch sử cho phép chúng ta rút ra những bài học quý giá cho hiện tại.",
             "Studying history allows us to draw valuable lessons for the present."),
            ("Vị trí địa lý chiến lược đã định hình vận mệnh của nhiều quốc gia trong lịch sử.",
             "Strategic geographical location has shaped the destiny of many nations throughout history."),
        ],
    },
    "Sports & Fitness": {
        "b": [
            ("Tôi chơi bóng đá.", "I play football."),
            ("Tập thể dục tốt cho sức khỏe.", "Exercise is good for health."),
            ("Tôi đi bộ mỗi sáng.", "I walk every morning."),
        ],
        "i": [
            ("Chơi thể thao giúp giảm căng thẳng.", "Playing sports helps reduce stress."),
            ("Đội tuyển của chúng tôi đã giành chiến thắng.", "Our team won the match."),
            ("Tôi tập gym ba lần một tuần.", "I go to the gym three times a week."),
        ],
        "a": [
            ("Việc rèn luyện thể thao thường xuyên không chỉ cải thiện thể chất mà còn tăng cường tinh thần kỷ luật.",
             "Regular sports training not only improves physical health but also strengthens self-discipline."),
            ("Tinh thần thể thao dạy chúng ta cách chấp nhận thất bại và không ngừng cố gắng.",
             "Sportsmanship teaches us how to accept failure and keep trying."),
        ],
    },
    "Arts & Literature": {
        "b": [
            ("Tôi thích đọc sách.", "I like reading books."),
            ("Bức tranh này rất đẹp.", "This painting is very beautiful."),
            ("Cô ấy viết thơ.", "She writes poetry."),
        ],
        "i": [
            ("Văn học phản ánh đời sống xã hội.", "Literature reflects social life."),
            ("Nghệ thuật giúp con người thể hiện cảm xúc.", "Art helps people express emotions."),
            ("Tôi rất ấn tượng với tác phẩm của họa sĩ này.", "I am very impressed with this artist's work."),
        ],
        "a": [
            ("Văn học vĩ đại có khả năng vượt qua ranh giới thời gian và chạm đến trái tim của nhiều thế hệ.",
             "Great literature has the ability to transcend time and touch the hearts of many generations."),
            ("Nghệ thuật là tấm gương phản chiếu những giá trị và mâu thuẫn của xã hội đương đại.",
             "Art is a mirror reflecting the values and contradictions of contemporary society."),
        ],
    },
    "Religion & Spirituality": {
        "b": [
            ("Nhiều người đi chùa vào ngày lễ.", "Many people go to the temple on holidays."),
            ("Cô ấy cầu nguyện mỗi tối.", "She prays every evening."),
            ("Lòng tốt là điều quan trọng.", "Kindness is important."),
        ],
        "i": [
            ("Tín ngưỡng mang lại sự bình an trong tâm hồn.", "Faith brings peace to the soul."),
            ("Mỗi tôn giáo đều dạy con người sống hướng thiện.", "Every religion teaches people to live virtuously."),
            ("Thiền định giúp tôi giảm bớt lo âu.", "Meditation helps me reduce anxiety."),
        ],
        "a": [
            ("Sự khoan dung tôn giáo là nền tảng cho một xã hội hòa bình và đa dạng.",
             "Religious tolerance is the foundation for a peaceful and diverse society."),
            ("Đời sống tâm linh giúp con người tìm thấy ý nghĩa sâu sắc hơn trong cuộc sống.",
             "Spiritual life helps people find deeper meaning in life."),
        ],
    },
    "Law & Justice": {
        "b": [
            ("Mọi người phải tuân theo luật.", "Everyone must obey the law."),
            ("Cảnh sát bảo vệ người dân.", "The police protect the people."),
            ("Nói dối là sai.", "Lying is wrong."),
        ],
        "i": [
            ("Mọi công dân đều bình đẳng trước pháp luật.", "All citizens are equal before the law."),
            ("Hệ thống tư pháp cần công bằng và minh bạch.", "The justice system needs to be fair and transparent."),
            ("Luật pháp bảo vệ quyền lợi của người dân.", "The law protects citizens' rights."),
        ],
        "a": [
            ("Công lý không chỉ là trừng phạt kẻ có tội mà còn là bảo vệ quyền lợi của người vô tội.",
             "Justice is not only about punishing the guilty but also about protecting the rights of the innocent."),
            ("Một nền pháp quyền vững mạnh là điều kiện thiết yếu cho sự ổn định của xã hội.",
             "A strong rule of law is an essential condition for the stability of society."),
        ],
    },
    "Philosophy & Ethics": {
        "b": [
            ("Chúng ta nên trung thực.", "We should be honest."),
            ("Điều gì là đúng và điều gì là sai?", "What is right and what is wrong?"),
            ("Hãy đối xử tốt với người khác.", "Treat others well."),
        ],
        "i": [
            ("Đạo đức hướng dẫn hành vi của con người.", "Ethics guides human behavior."),
            ("Mỗi người có quan điểm riêng về hạnh phúc.", "Each person has their own view of happiness."),
            ("Triết học giúp chúng ta suy nghĩ sâu sắc hơn.", "Philosophy helps us think more deeply."),
        ],
        "a": [
            ("Những câu hỏi triết học về ý nghĩa cuộc sống đã thách thức nhân loại qua nhiều thế kỷ.",
             "Philosophical questions about the meaning of life have challenged humanity for centuries."),
            ("Đạo đức không phải lúc nào cũng rạch ròi, mà thường nằm ở những vùng xám phức tạp.",
             "Ethics is not always clear-cut, but often lies in complex gray areas."),
        ],
    },
    "Academic & Study": {
        "b": [
            ("Tôi học bài mỗi tối.", "I study every evening."),
            ("Môn Toán rất khó.", "Math is very difficult."),
            ("Tôi cần một cây bút.", "I need a pen."),
            ("Giáo viên của tôi rất tốt.", "My teacher is very good."),
            ("Tôi thích đọc sách.", "I like reading books."),
            ("Lớp học kết thúc lúc năm giờ.", "The class ends at five o'clock."),
            ("Bạn có làm bài tập về nhà không?", "Do you do your homework?"),
            ("Bài kiểm tra này dễ.", "This test is easy.")
        ],
        "i": [
            ("Tôi đang chuẩn bị cho kỳ thi cuối kỳ.", "I am preparing for the final exam."),
            ("Thư viện là một nơi yên tĩnh để học tập.", "The library is a quiet place to study."),
            ("Sinh viên nên tham gia vào các cuộc thảo luận trên lớp.", "Students should participate in class discussions."),
            ("Làm việc nhóm giúp cải thiện kỹ năng giao tiếp.", "Teamwork helps improve communication skills."),
            ("Tôi muốn đăng ký một khóa học tiếng Anh.", "I want to enroll in an English course."),
            ("Nghiên cứu yêu cầu rất nhiều thời gian và nỗ lực.", "Research requires a lot of time and effort."),
            ("Giáo sư đã đưa ra bài giảng rất thú vị.", "The professor gave a very interesting lecture."),
            ("Bạn cần nộp bài luận trước thứ sáu.", "You need to submit the essay by Friday.")
        ],
        "a": [
            ("Giáo dục đại học đóng một vai trò quan trọng trong việc định hình sự nghiệp của một cá nhân.", "Higher education plays a crucial role in shaping an individual's career."),
            ("Việc thu thập dữ liệu thực nghiệm là điều kiện tiên quyết cho bất kỳ nghiên cứu khoa học nào.", "Gathering empirical data is a prerequisite for any scientific research."),
            ("Chương trình giảng dạy nên được thiết kế để nuôi dưỡng tư duy phản biện.", "The curriculum should be designed to foster critical thinking."),
            ("Đạo văn bị nghiêm cấm trong các tổ chức học thuật.", "Plagiarism is strictly prohibited in academic institutions."),
            ("Tự học đòi hỏi tính kỷ luật cao và động lực nội tại vững vàng.", "Self-study requires a high degree of discipline and strong intrinsic motivation."),
            ("Các đánh giá đồng cấp giúp đảm bảo chất lượng của các ấn phẩm nghiên cứu.", "Peer reviews help ensure the quality of research publications."),
            ("Lý thuyết này cung cấp một khuôn khổ toàn diện để hiểu sự phát triển nhận thức.", "This theory provides a comprehensive framework for understanding cognitive development."),
            ("Sự hợp tác đa ngành thường dẫn đến những khám phá mang tính đột phá.", "Interdisciplinary collaboration often leads to breakthrough discoveries.")
        ]
    },
    "Health & Fitness": {
        "b": [
            ("Tôi tập thể dục mỗi ngày.", "I exercise every day."),
            ("Cô ấy đang ăn táo.", "She is eating an apple."),
            ("Nước rất tốt cho sức khỏe.", "Water is good for health."),
            ("Tôi cần ngủ sớm.", "I need to sleep early."),
            ("Bác sĩ nói tôi nên nghỉ ngơi.", "The doctor said I should rest."),
            ("Trái cây có nhiều vitamin.", "Fruits have many vitamins."),
            ("Anh ấy cảm thấy mệt mỏi.", "He feels tired."),
            ("Hút thuốc không tốt cho bạn.", "Smoking is not good for you.")
        ],
        "i": [
            ("Một chế độ ăn cân bằng là rất quan trọng để duy trì sức khỏe.", "A balanced diet is crucial for maintaining health."),
            ("Tập thể dục thường xuyên giúp giảm nguy cơ mắc bệnh tim.", "Regular exercise helps reduce the risk of heart disease."),
            ("Căng thẳng có thể có tác động tiêu cực đến sức khỏe tinh thần.", "Stress can have a negative impact on mental health."),
            ("Các bác sĩ khuyên nên uống ít nhất hai lít nước mỗi ngày.", "Doctors recommend drinking at least two liters of water daily."),
            ("Ngủ đủ giấc là cần thiết để cơ thể phục hồi.", "Getting enough sleep is necessary for the body to recover."),
            ("Ăn quá nhiều đường có thể dẫn đến bệnh béo phì.", "Consuming too much sugar can lead to obesity."),
            ("Yoga là một cách tuyệt vời để cải thiện sự linh hoạt và giảm căng thẳng.", "Yoga is a great way to improve flexibility and reduce stress."),
            ("Việc kiểm tra sức khỏe định kỳ có thể giúp phát hiện sớm các vấn đề y tế.", "Regular check-ups can help detect medical issues early.")
        ],
        "a": [
            ("Mối liên hệ phức tạp giữa sức khỏe thể chất và tinh thần ngày càng được y học hiện đại công nhận.", "The intricate relationship between physical and mental well-being is increasingly recognized by modern medicine."),
            ("Lối sống ít vận động phổ biến trong xã hội đương đại là một nguyên nhân chính gây ra các bệnh mãn tính.", "The sedentary lifestyle prevalent in contemporary society is a primary contributor to chronic diseases."),
            ("Các biện pháp chăm sóc sức khỏe dự phòng hiệu quả hơn nhiều so với việc điều trị các bệnh đã phát triển.", "Preventative healthcare measures are vastly more effective than treating fully developed illnesses."),
            ("Sự lạm dụng kháng sinh đã dẫn đến sự gia tăng đáng báo động của các vi khuẩn kháng thuốc.", "The overprescription of antibiotics has led to an alarming rise in drug-resistant superbugs."),
            ("Các sáng kiến sức khỏe cộng đồng đóng vai trò then chốt trong việc giảm thiểu sự lây lan của các bệnh truyền nhiễm.", "Public health initiatives play a pivotal role in mitigating the spread of infectious diseases."),
            ("Một cách tiếp cận toàn diện đối với sức khỏe kết hợp các lựa chọn chế độ ăn uống, hoạt động thể chất và quản lý căng thẳng.", "A holistic approach to wellness incorporates dietary choices, physical activity, and stress management."),
            ("Tính dẻo dai của hệ thần kinh cho phép não bộ thích nghi và tự cấu trúc lại sau khi bị chấn thương.", "Neuroplasticity allows the brain to adapt and rewire itself following a traumatic injury."),
            ("Việc thúc đẩy một nền văn hóa chăm sóc sức khỏe chủ động đòi hỏi phải có giáo dục và sự thay đổi hệ thống.", "Fostering a culture of proactive health management requires both education and systemic change.")
        ]
    },
    "Science & Technology": {
        "b": [
            ("Tôi đang sử dụng máy tính.", "I am using a computer."),
            ("Điện thoại của tôi ở trên bàn.", "My phone is on the table."),
            ("Internet rất chậm.", "The internet is very slow."),
            ("Rô-bốt có thể giúp việc nhà.", "Robots can help with housework."),
            ("Khoa học rất thú vị.", "Science is very interesting."),
            ("Tôi thích xem các chương trình về vũ trụ.", "I like watching programs about space."),
            ("Máy móc làm cho cuộc sống dễ dàng hơn.", "Machines make life easier."),
            ("Bóng đèn được phát minh từ lâu.", "The light bulb was invented a long time ago.")
        ],
        "i": [
            ("Công nghệ đang thay đổi nhanh chóng thế giới của chúng ta.", "Technology is rapidly changing our world."),
            ("Trí tuệ nhân tạo có thể thực hiện các nhiệm vụ phức tạp.", "Artificial intelligence can perform complex tasks."),
            ("Nhiều người tin tưởng vào điện thoại thông minh cho các hoạt động hàng ngày.", "Many people rely on smartphones for their daily activities."),
            ("Mạng xã hội đã kết nối mọi người trên toàn cầu.", "Social media has connected people globally."),
            ("Các nhà khoa học đang nghiên cứu các nguồn năng lượng tái tạo mới.", "Scientists are researching new renewable energy sources."),
            ("Bảo mật không gian mạng là một mối quan tâm lớn trong thời đại kỹ thuật số.", "Cybersecurity is a major concern in the digital age."),
            ("Thực tế ảo mang lại những trải nghiệm học tập phong phú.", "Virtual reality offers immersive learning experiences."),
            ("Tự động hóa có thể dẫn đến tình trạng mất việc làm trong một số ngành công nghiệp.", "Automation may lead to job displacement in certain industries.")
        ],
        "a": [
            ("Sự phát triển theo cấp số nhân của năng lực tính toán đã thúc đẩy những tiến bộ chưa từng có trong học máy.", "The exponential growth of computing power has catalyzed unprecedented advancements in machine learning."),
            ("Máy tính lượng tử có tiềm năng giải quyết các vấn đề mật mã học hiện không thể vượt qua.", "Quantum computing holds the potential to solve currently insurmountable cryptographic problems."),
            ("Những cân nhắc về đạo đức xung quanh chỉnh sửa gen đặt ra những câu hỏi sâu sắc về tương lai của nhân loại.", "The ethical considerations surrounding gene editing raise profound questions about the future of humanity."),
            ("Việc tích hợp liền mạch các thiết bị IoT hứa hẹn sẽ cách mạng hóa quy hoạch đô thị và quản lý tài nguyên.", "The seamless integration of IoT devices promises to revolutionize urban planning and resource management."),
            ("Khám phá không gian không chỉ mở rộng kiến thức khoa học của chúng ta mà còn thúc đẩy sự đổi mới công nghệ.", "Space exploration not only expands our scientific knowledge but also drives technological innovation."),
            ("Sự phụ thuộc quá mức vào công nghệ làm dấy lên những lo ngại chính đáng về quyền riêng tư dữ liệu và tự chủ cá nhân.", "The overreliance on technology sparks legitimate apprehensions regarding data privacy and personal autonomy."),
            ("Công nghệ chuỗi khối cung cấp một sổ cái phi tập trung và chống giả mạo cho các giao dịch an toàn.", "Blockchain technology provides a decentralized and tamper-proof ledger for secure transactions."),
            ("Khoảng cách kỹ thuật số làm trầm trọng thêm tình trạng bất bình đẳng kinh tế xã hội hiện có ở quy mô toàn cầu.", "The digital divide exacerbates existing socioeconomic inequalities on a global scale.")
        ]
    }
}


# Paragraph mode: coherent connected paragraphs, keyed by content type then level.
PARAGRAPH_BANK = {
    "Emails": {
        "b": [[
            ("Chào chị Lan,", "Hi Lan,"),
            ("Em viết thư này để hỏi về lớp học tiếng Anh.", "I am writing this email to ask about the English class."),
            ("Em muốn biết lớp học bắt đầu khi nào.", "I would like to know when the class starts."),
            ("Xin chị cho em biết học phí.", "Please let me know the tuition fee."),
            ("Cảm ơn chị rất nhiều.", "Thank you very much."),
        ]],
        "i": [[
            ("Kính gửi anh Minh,", "Dear Minh,"),
            ("Tôi viết thư để xác nhận cuộc họp vào thứ Năm tuần này.", "I am writing to confirm our meeting this Thursday."),
            ("Chúng ta sẽ thảo luận về kế hoạch dự án mới.", "We will discuss the plan for the new project."),
            ("Nếu anh cần thay đổi thời gian, xin hãy báo cho tôi.", "If you need to change the time, please let me know."),
            ("Tôi rất mong được gặp anh.", "I look forward to seeing you."),
            ("Trân trọng,", "Best regards,"),
        ]],
        "a": [[
            ("Kính gửi Quý khách hàng,", "Dear Valued Customer,"),
            ("Chúng tôi xin chân thành cảm ơn quý vị đã tin tưởng sử dụng dịch vụ của chúng tôi.",
             "We sincerely thank you for trusting and using our service."),
            ("Nhằm nâng cao trải nghiệm, chúng tôi vừa cập nhật một số tính năng mới.",
             "In order to improve your experience, we have just updated several new features."),
            ("Chúng tôi rất mong nhận được phản hồi quý báu từ quý vị.",
             "We would greatly appreciate your valuable feedback."),
            ("Xin trân trọng cảm ơn.", "Thank you very much."),
        ]],
    },
    "Diaries": {
        "b": [[
            ("Hôm nay là một ngày đẹp trời.", "Today is a beautiful day."),
            ("Tôi đi công viên với gia đình.", "I went to the park with my family."),
            ("Chúng tôi ăn kem và chụp ảnh.", "We ate ice cream and took photos."),
            ("Tôi cảm thấy rất vui.", "I felt very happy."),
        ]],
        "i": [[
            ("Hôm nay là một ngày khá bận rộn đối với tôi.", "Today was quite a busy day for me."),
            ("Buổi sáng tôi phải hoàn thành nhiều công việc ở cơ quan.", "In the morning I had to finish a lot of work at the office."),
            ("Đến chiều, tôi mới có chút thời gian để nghỉ ngơi.", "It was not until the afternoon that I had some time to rest."),
            ("Dù mệt, tôi vẫn thấy hài lòng với những gì mình đã làm.", "Although I was tired, I still felt satisfied with what I had done."),
        ]],
        "a": [[
            ("Nhìn lại một năm đã qua, tôi nhận ra mình đã trưởng thành hơn rất nhiều.",
             "Looking back on the past year, I realize that I have grown a lot."),
            ("Những khó khăn tưởng chừng không thể vượt qua đã dạy tôi bài học về sự kiên nhẫn.",
             "The difficulties that once seemed impossible taught me a lesson about patience."),
            ("Tôi biết ơn những người đã luôn ở bên cạnh và ủng hộ tôi.",
             "I am grateful to those who have always stood by me and supported me."),
            ("Tôi hy vọng năm tới sẽ mang đến nhiều cơ hội mới.",
             "I hope the coming year will bring many new opportunities."),
        ]],
    },
    "Essays": {
        "b": [[
            ("Đọc sách là một thói quen tốt.", "Reading books is a good habit."),
            ("Sách giúp chúng ta học được nhiều điều mới.", "Books help us learn many new things."),
            ("Tôi đọc sách mỗi ngày.", "I read books every day."),
            ("Vì vậy, tôi nghĩ ai cũng nên đọc sách.", "Therefore, I think everyone should read books."),
        ]],
        "i": [[
            ("Mạng xã hội đã trở thành một phần trong cuộc sống hằng ngày.", "Social media has become a part of daily life."),
            ("Một mặt, nó giúp con người kết nối dễ dàng hơn.", "On one hand, it helps people connect more easily."),
            ("Mặt khác, việc lạm dụng nó có thể gây lãng phí thời gian.", "On the other hand, overusing it can waste time."),
            ("Vì vậy, chúng ta nên sử dụng mạng xã hội một cách hợp lý.", "Therefore, we should use social media reasonably."),
        ]],
        "a": [[
            ("Trong thời đại công nghệ, trí tuệ nhân tạo đang thay đổi cách chúng ta làm việc.",
             "In the technological era, artificial intelligence is changing the way we work."),
            ("Một mặt, nó nâng cao hiệu suất và giải phóng con người khỏi những công việc lặp đi lặp lại.",
             "On one hand, it boosts productivity and frees humans from repetitive tasks."),
            ("Tuy nhiên, nó cũng đặt ra những lo ngại về việc làm và đạo đức.",
             "However, it also raises concerns about employment and ethics."),
            ("Do đó, việc phát triển công nghệ cần đi đôi với những quy định phù hợp.",
             "Therefore, technological development must go hand in hand with appropriate regulations."),
        ], [
            ("Học ngôn ngữ thứ hai ngày càng trở nên quan trọng trong một thế giới toàn cầu hóa.",
             "Learning a second language is becoming increasingly important in a globalized world."),
            ("Nó không chỉ mở ra cơ hội nghề nghiệp tốt hơn mà còn thúc đẩy sự hiểu biết văn hóa chéo.",
             "It not only opens up better career opportunities but also fosters cross-cultural understanding."),
            ("Hơn nữa, các nghiên cứu cho thấy những cá nhân song ngữ thường có chức năng nhận thức và kỹ năng giải quyết vấn đề tốt hơn.",
             "Furthermore, studies show that bilingual individuals often have better cognitive function and problem-solving skills."),
            ("Bất chấp những thách thức ban đầu, những lợi ích lâu dài của việc song ngữ là rất đáng kể.",
             "Despite the initial challenges, the long-term benefits of being bilingual are substantial.")
        ], [
            ("Sự giao thoa giữa y học và công nghệ đang mở ra một kỷ nguyên mới của chăm sóc sức khỏe.", "The intersection of medicine and technology is ushering in a new era of healthcare."),
            ("Với sự ra đời của các thiết bị đeo thông minh và trí tuệ nhân tạo, việc theo dõi và chẩn đoán bệnh chưa bao giờ dễ dàng đến thế.", "With the advent of smart wearables and artificial intelligence, tracking and diagnosing diseases has never been easier."),
            ("Tuy nhiên, điều này cũng đòi hỏi chúng ta phải giải quyết các vấn đề về quyền riêng tư dữ liệu y tế.", "However, this also requires us to address issues concerning medical data privacy."),
            ("Mặc dù có những rào cản, tiềm năng nâng cao chất lượng cuộc sống con người là vô hạn.", "Despite the hurdles, the potential to enhance human quality of life is limitless.")
        ]],
    },
    "Articles": {
        "b": [[
            ("Tập thể dục rất tốt cho sức khỏe.", "Exercise is very good for health."),
            ("Nó giúp cơ thể khỏe mạnh và tinh thần thoải mái.", "It keeps the body strong and the mind relaxed."),
            ("Bạn nên tập ít nhất ba lần một tuần.", "You should exercise at least three times a week."),
        ]],
        "i": [[
            ("Làm việc từ xa đang ngày càng trở nên phổ biến.", "Remote work is becoming increasingly popular."),
            ("Nó mang lại sự linh hoạt về thời gian và địa điểm.", "It offers flexibility in time and location."),
            ("Tuy nhiên, nó cũng đòi hỏi tính kỷ luật cao.", "However, it also requires a high level of discipline."),
            ("Nhìn chung, đây là một xu hướng đáng chú ý của tương lai.", "Overall, this is a notable trend of the future."),
        ]],
        "a": [[
            ("Biến đổi khí hậu là một trong những thách thức lớn nhất của nhân loại.",
             "Climate change is one of the greatest challenges facing humanity."),
            ("Nhiệt độ toàn cầu tăng lên đang gây ra những hậu quả nghiêm trọng.",
             "Rising global temperatures are causing serious consequences."),
            ("Các quốc gia cần hợp tác để giảm lượng khí thải.",
             "Countries need to cooperate to reduce emissions."),
            ("Mỗi cá nhân cũng có thể góp phần bằng những hành động nhỏ hằng ngày.",
             "Each individual can also contribute through small daily actions."),
        ]],
    },
    "Stories": {
        "b": [[
            ("Khi tôi còn nhỏ, tôi thường chơi ở công viên gần nhà.", "When I was little, I often played in the park near my house."),
            ("Một ngày nọ, tôi tìm thấy một con chó nhỏ đi lạc.", "One day, I found a small lost dog."),
            ("Tôi mang nó về nhà và cho nó ăn.", "I brought it home and fed it."),
            ("Từ đó, chúng tôi trở thành những người bạn tốt.", "Since then, we became good friends."),
        ]],
        "i": [[
            ("Tuần trước, tôi tình cờ gặp lại một người bạn học cũ tại quán cà phê.", "Last week, I bumped into an old classmate at a coffee shop."),
            ("Lúc đầu, tôi không nhận ra cậu ấy vì cậu ấy đã thay đổi quá nhiều.", "At first, I didn't recognize him because he had changed so much."),
            ("Chúng tôi đã trò chuyện hàng giờ về những kỷ niệm thời đi học.", "We chatted for hours about our school memories."),
            ("Đó thực sự là một cuộc hội ngộ đầy bất ngờ và thú vị.", "It was truly an unexpected and interesting reunion."),
        ]],
        "a": [[
            ("Chuyến đi phượt một mình tới vùng núi phía Bắc năm ngoái đã để lại cho tôi một bài học sâu sắc.",
             "My solo backpacking trip to the northern mountainous region last year left me with a profound lesson."),
            ("Khi xe bị hỏng giữa đường đèo vắng vẻ, tôi đã nghĩ mình sẽ phải ngủ lại ngoài trời.",
             "When my motorbike broke down in the middle of a deserted mountain pass, I thought I would have to sleep outdoors."),
            ("May mắn thay, một gia đình người dân tộc địa phương đã cho tôi tá túc và sửa xe giúp tôi.",
             "Fortunately, a local ethnic family offered me shelter and helped fix my bike."),
            ("Trải nghiệm đó đã dạy tôi rằng lòng tốt luôn tồn tại, ngay cả ở những nơi hoang vắng nhất.",
             "That experience taught me that kindness always exists, even in the most desolate places."),
        ]],
    },
    "Reports": {
        "b": [[
            ("Dự án mới đang diễn ra rất tốt.", "The new project is going very well."),
            ("Chúng tôi đã hoàn thành phần đầu tiên.", "We have finished the first part."),
            ("Tất cả mọi người đều làm việc chăm chỉ.", "Everyone is working hard."),
            ("Chúng tôi sẽ nộp báo cáo vào ngày mai.", "We will submit the report tomorrow."),
        ]],
        "i": [[
            ("Theo kết quả khảo sát gần đây, phần lớn khách hàng hài lòng với sản phẩm mới.", "According to the recent survey results, the majority of customers are satisfied with the new product."),
            ("Tuy nhiên, một số người phản ánh rằng giá cả còn khá cao.", "However, some people reported that the price is still quite high."),
            ("Chúng tôi đề xuất xem xét lại chiến lược định giá trong quý tới.", "We propose reviewing the pricing strategy in the next quarter."),
            ("Báo cáo chi tiết sẽ được gửi đến ban giám đốc vào cuối tuần.", "The detailed report will be sent to the board of directors by the end of the week."),
        ]],
        "a": [[
            ("Báo cáo này trình bày tóm tắt về tình hình biến động của thị trường bất động sản trong quý vừa qua.",
             "This report presents a summary of the real estate market fluctuations in the last quarter."),
            ("Dữ liệu chỉ ra rằng nhu cầu đối với các căn hộ tầm trung đã tăng đáng kể ở khu vực ngoại ô.",
             "The data indicates that the demand for mid-range apartments has increased significantly in suburban areas."),
            ("Đồng thời, chi phí vật liệu xây dựng tăng cao đã tạo ra áp lực không nhỏ lên biên lợi nhuận của các nhà thầu.",
             "At the same time, the rising cost of construction materials has put considerable pressure on the profit margins of contractors."),
            ("Chúng tôi khuyến nghị các công ty nên đa dạng hóa chuỗi cung ứng để giảm thiểu rủi ro trong tương lai.",
             "We recommend that companies diversify their supply chains to mitigate risks in the future."),
        ]],
    },
}


import re

IELTS_TASK2_PROMPTS = {
    "opinion": [
        "Many people think that social media has a negative impact on society. To what extent do you agree or disagree?",
        "Some people believe that university students should pay all the costs of their studies. To what extent do you agree or disagree?",
        "Some argue that governments should invest more in public transport rather than building new roads. Do you agree or disagree?",
        "Some people think that environmental problems are too big for individuals to solve. To what extent do you agree or disagree?"
    ],
    "discussion": [
        "Some people believe that working from home is better than working in an office. Discuss the advantages and disadvantages and give your opinion.",
        "Some people think that universities should provide graduates with the knowledge and skills needed in the workplace. Others think that the true function of a university should be to give access to knowledge for its own sake. Discuss both views and give your own opinion.",
        "Some believe that studying history is a waste of time, while others think it is essential. Discuss both sides and give your opinion.",
        "Many people believe that technological developments have brought more problems than benefits. Others disagree. Discuss both views and give your own opinion."
    ],
    "problem_solution": [
        "In many countries, the amount of crime is increasing. What do you think are the main causes of crime? How can we deal with those causes?",
        "Traffic congestion is becoming a major problem in many cities. What are the causes of this? What solutions can you suggest?",
        "Many young people are finding it difficult to find jobs after graduating from university. What are the causes of this problem? What measures can be taken to solve it?",
        "Global warming is one of the biggest threats to our environment. What are the causes, and what solutions can you recommend?"
    ],
    "advantage_disadvantage": [
        "Nowadays, an increasing number of people are moving to urban areas. Do the advantages outweigh the disadvantages?",
        "More and more people are relying on the internet for information rather than traditional books. Do the advantages outweigh the disadvantages?",
        "Many people now buy goods and services online rather than in shops. Do the advantages outweigh the disadvantages?"
    ],
    "two_part": [
        "Many people prefer to watch foreign films rather than locally produced ones. Why could this be? Should the government provide more financial support to local film industries?",
        "People today are spending more of their free time watching television. Why is this? Is it a positive or negative development?",
        "Some parents buy their children whatever they ask for. Why do they do this? Is it a good way to raise children?"
    ],
}

IELTS_MODEL_ESSAYS = {
    "opinion": [
        {
            "prompt": "Many people think that social media has a negative impact on society. To what extent do you agree or disagree?",
            "sentences": [
                ("Trong thời đại ngày nay, mạng xã hội đã trở thành một phần không thể thiếu trong giao tiếp hàng ngày của con người.", "In the contemporary era, social media has become an indispensable part of daily human communication."),
                ("Trong khi một số người lập luận rằng những nền tảng này gây ra tác động tiêu cực đến xã hội, tôi chỉ đồng ý một phần với quan điểm này.", "While some argue that these platforms exert a negative impact on society, I only partially agree with this perspective."),
                ("Một mặt, không thể phủ nhận rằng mạng xã hội có thể góp phần gây ra các vấn đề về sức khỏe tinh thần.", "On the one hand, it is undeniable that social media can contribute to mental health issues."),
                ("Nhiều người dùng, đặc biệt là thanh thiếu niên, thường so sánh cuộc sống của họ với những hình ảnh lý tưởng hóa được thấy trên mạng, dẫn đến cảm giác tự ti.", "Many users, particularly teenagers, frequently compare their lives to the idealized images seen online, leading to feelings of inadequacy."),
                ("Hơn nữa, sự lan truyền của tin giả và bắt nạt trên mạng đã trở thành những vấn đề đáng lo ngại đe dọa sự gắn kết xã hội.", "Furthermore, the spread of fake news and cyberbullying have become alarming issues that threaten social cohesion."),
                ("Mặt khác, mạng xã hội mang lại những lợi ích vô song về kết nối và trao đổi thông tin.", "On the other hand, social networks offer unparalleled benefits in terms of connectivity and information exchange."),
                ("Chúng cho phép mọi người duy trì liên lạc với gia đình và bạn bè bất chấp khoảng cách địa lý.", "They allow people to maintain contact with family and friends regardless of geographical distances."),
                ("Ngoài ra, các nền tảng này đóng vai trò là những công cụ mạnh mẽ để nâng cao nhận thức về các vấn đề toàn cầu quan trọng và huy động hỗ trợ cho các nỗ lực từ thiện.", "Additionally, these platforms serve as powerful tools for raising awareness about crucial global issues and mobilizing support for charitable causes."),
                ("Tóm lại, mặc dù mạng xã hội thực sự mang lại những rủi ro nhất định liên quan đến sức khỏe tinh thần và thông tin sai lệch, nhưng những lợi thế của nó trong việc thúc đẩy kết nối toàn cầu là cực kỳ quan trọng.", "In conclusion, although social media indeed poses certain risks related to mental well-being and misinformation, its advantages in fostering global connectivity are of paramount importance."),
                ("Do đó, các cá nhân nên sử dụng các nền tảng này một cách có trách nhiệm thay vì hoàn toàn xa lánh chúng.", "Therefore, individuals should utilize these platforms responsibly rather than completely shunning them.")
            ]
        },
        {
            "prompt": "Some people believe that university students should pay all the costs of their studies. To what extent do you agree or disagree?",
            "sentences": [
                ("Vấn đề tài trợ cho giáo dục đại học đã trở thành một chủ đề tranh luận sôi nổi.", "The issue of funding higher education has become a subject of intense debate."),
                ("Mặc dù một số cá nhân tin rằng sinh viên đại học phải chịu toàn bộ chi phí học tập của mình, tôi hoàn toàn không đồng ý với quan điểm này.", "Although some individuals believe that university students should bear the entire cost of their studies, I completely disagree with this viewpoint."),
                ("Thứ nhất, việc yêu cầu sinh viên tự chi trả toàn bộ học phí sẽ tạo ra một rào cản lớn đối với những người có hoàn cảnh khó khăn.", "Firstly, requiring students to fully self-fund their tuition would create a massive barrier for those from disadvantaged backgrounds."),
                ("Điều này có thể dẫn đến một xã hội nơi giáo dục chất lượng chỉ dành riêng cho tầng lớp đặc quyền, do đó làm gia tăng bất bình đẳng xã hội.", "This could result in a society where quality education is exclusively reserved for the privileged class, thereby exacerbating social inequality."),
                ("Mọi cá nhân, bất kể tình trạng tài chính của họ ra sao, đều xứng đáng có cơ hội bình đẳng để theo đuổi con đường học vấn cao hơn.", "Every individual, regardless of their financial status, deserves an equal opportunity to pursue higher education."),
                ("Thứ hai, chính phủ nên nhận ra rằng việc đầu tư vào giáo dục đại học mang lại những lợi ích đáng kể cho toàn bộ nền kinh tế.", "Secondly, governments should recognize that investing in higher education yields substantial benefits for the entire economy."),
                ("Lực lượng lao động có trình độ học vấn cao thúc đẩy sự đổi mới, tăng năng suất và đóng góp nhiều hơn vào doanh thu thuế.", "A highly educated workforce drives innovation, increases productivity, and contributes more to tax revenues."),
                ("Bằng cách trợ cấp học phí cho sinh viên, chính phủ thực chất đang bồi dưỡng nguồn vốn nhân lực sẽ chèo lái sự phát triển của quốc gia trong tương lai.", "By subsidizing student tuition, the government is essentially cultivating the human capital that will steer the nation's future development."),
                ("Tóm lại, tôi mạnh mẽ tin rằng giáo dục đại học không nên là một đặc quyền được xác định bởi sự giàu có.", "In conclusion, I strongly believe that university education should not be a privilege determined by wealth."),
                ("Thay vì dồn gánh nặng tài chính lên vai sinh viên, cả chính phủ và xã hội nên chia sẻ trách nhiệm này để thúc đẩy sự tiến bộ kinh tế và bình đẳng xã hội.", "Instead of placing the financial burden solely on students, both the government and society should share this responsibility to promote economic progress and social equity.")
            ]
        }
    ],
    "discussion": [
        {
            "prompt": "Some people believe that working from home is better than working in an office. Discuss the advantages and disadvantages and give your opinion.",
            "sentences": [
                ("Trong những năm gần đây, xu hướng làm việc từ xa đã thu hút được sự chú ý đáng kể trên toàn thế giới.", "In recent years, the trend of working remotely has gained significant traction worldwide."),
                ("Mặc dù một số người tin rằng làm việc tại nhà mang lại nhiều lợi ích hơn so với làm việc tại văn phòng truyền thống, vấn đề này vẫn còn gây nhiều tranh cãi.", "While some believe that working from home offers more benefits than a traditional office setting, this issue remains highly debated."),
                ("Bài viết này sẽ xem xét cả hai khía cạnh trước khi đưa ra quan điểm cá nhân.", "This essay will examine both sides before presenting a personal perspective."),
                ("Có một số lợi thế rõ ràng khi làm việc từ xa.", "There are several clear advantages to telecommuting."),
                ("Đầu tiên, nó mang lại cho nhân viên sự linh hoạt tuyệt vời, cho phép họ cân bằng hiệu quả giữa nghĩa vụ chuyên môn và cuộc sống cá nhân.", "Firstly, it provides employees with unparalleled flexibility, allowing them to effectively balance professional obligations and personal life."),
                ("Ngoài ra, việc loại bỏ thời gian đi lại hàng ngày giúp giảm căng thẳng và cắt giảm chi phí đi lại, điều này có thể nâng cao đáng kể sự hài lòng trong công việc.", "Additionally, the elimination of the daily commute reduces stress and cuts transportation costs, which can significantly enhance overall job satisfaction."),
                ("Tuy nhiên, môi trường văn phòng truyền thống cũng mang lại những lợi ích không thể thay thế.", "However, the traditional office environment also offers irreplaceable benefits."),
                ("Làm việc trong không gian chung thúc đẩy sự hợp tác tự nhiên và giao tiếp trực tiếp, những yếu tố rất quan trọng cho tinh thần đồng đội và đổi mới.", "Working in a shared space fosters spontaneous collaboration and face-to-face communication, which are crucial for teamwork and innovation."),
                ("Hơn nữa, ranh giới rõ ràng giữa công việc và gia đình giúp ngăn ngừa tình trạng kiệt sức, vì nhân viên có thể ngắt kết nối khỏi các nhiệm vụ công việc một khi họ rời khỏi nơi làm việc.", "Furthermore, a clear boundary between work and home helps prevent burnout, as employees can digitally disconnect from their tasks once they leave the workplace."),
                ("Theo ý kiến của tôi, một mô hình kết hợp dường như là cách tiếp cận lý tưởng nhất.", "In my opinion, a hybrid model appears to be the most ideal approach."),
                ("Bằng cách kết hợp sự tự do của làm việc từ xa với sự năng động hợp tác của văn phòng, các công ty có thể tối đa hóa năng suất đồng thời đảm bảo sức khỏe cho nhân viên.", "By combining the freedom of remote work with the collaborative dynamics of an office, companies can maximize productivity while ensuring employee well-being.")
            ]
        }
    ],
    "problem_solution": [
        {
            "prompt": "Traffic congestion is becoming a major problem in many cities. What are the causes of this? What solutions can you suggest?",
            "sentences": [
                ("Ùn tắc giao thông đã nổi lên như một trong những thách thức cấp bách nhất cản trở cư dân đô thị trên toàn cầu.", "Traffic congestion has emerged as one of the most pressing challenges hindering urban residents globally."),
                ("Vấn đề này bắt nguồn từ nhiều nguyên nhân khác nhau, nhưng một số biện pháp có thể được thực hiện để giải quyết tình hình.", "This problem stems from various causes, but several measures can be implemented to address the situation."),
                ("Lý do chính đằng sau việc kẹt xe ngày càng gia tăng là sự phụ thuộc quá mức vào các phương tiện cá nhân.", "The primary reason behind the growing traffic jams is the overreliance on private vehicles."),
                ("Khi dân số đô thị tăng lên, số lượng ô tô trên đường cũng tăng vọt, trong khi cơ sở hạ tầng hiện có thường không theo kịp tốc độ tăng trưởng này.", "As urban populations expand, the number of cars on the roads skyrockets, whereas existing infrastructure frequently fails to keep pace with this growth."),
                ("Hơn thế nữa, mạng lưới giao thông công cộng không đầy đủ và kém tin cậy ở nhiều thành phố buộc người dân phải sử dụng phương tiện riêng của họ để đi lại hàng ngày.", "Moreover, inadequate and unreliable public transportation networks in many cities compel people to use their own vehicles for their daily commute."),
                ("Để giải quyết vấn đề này, các chính phủ phải ưu tiên phát triển các hệ thống vận tải công cộng toàn diện.", "To tackle this issue, governments must prioritize the development of comprehensive mass transit systems."),
                ("Bằng cách đầu tư vào xe buýt hiệu quả, tàu điện ngầm và tàu điện, các nhà chức trách có thể khuyến khích công chúng sử dụng các phương thức này thay vì lái xe ô tô.", "By investing in efficient buses, subways, and trams, authorities can encourage the general public to utilize these modes instead of driving cars."),
                ("Một giải pháp thiết thực khác là thực hiện thu phí ùn tắc ở các trung tâm thành phố vào giờ cao điểm.", "Another practical solution is the implementation of congestion pricing in city centers during peak hours."),
                ("Chính sách này sẽ ngăn chặn những chuyến đi không cần thiết và thúc đẩy việc sử dụng chung xe, do đó làm giảm đáng kể khối lượng phương tiện.", "This policy would deter unnecessary trips and promote carpooling, thereby significantly reducing the volume of vehicles."),
                ("Tóm lại, mặc dù mật độ giao thông đông đúc là một vấn đề phức tạp được thúc đẩy bởi sự đô thị hóa nhanh chóng và việc sở hữu ô tô, nhưng nó có thể được giảm thiểu hiệu quả.", "In conclusion, although heavy traffic is a complex issue driven by rapid urbanization and car ownership, it can be effectively mitigated."),
                ("Cải thiện cơ sở hạ tầng công cộng và áp dụng phí sử dụng đường bộ là những bước thiết yếu hướng tới lưu thông đô thị mượt mà hơn.", "Improving public infrastructure and introducing road-usage charges are essential steps toward smoother urban mobility.")
            ]
        }
    ],
    "advantage_disadvantage": [
        {
            "prompt": "Nowadays, an increasing number of people are moving to urban areas. Do the advantages outweigh the disadvantages?",
            "sentences": [
                ("Sự dịch chuyển dân số từ nông thôn ra các trung tâm đô thị đã trở thành một xu hướng nổi bật trong xã hội hiện đại.", "The migration of populations from rural areas to urban centers has become a prominent trend in modern society."),
                ("Mặc dù sự dịch chuyển này đi kèm với những nhược điểm nhất định, tôi tin rằng những lợi ích nó mang lại vượt trội hơn hẳn những hạn chế.", "While this movement is accompanied by certain disadvantages, I firmly believe that the benefits it brings far outweigh the drawbacks."),
                ("Một mặt, quá trình đô thị hóa nhanh chóng đặt ra một số thách thức đáng kể.", "On the one hand, rapid urbanization poses several significant challenges."),
                ("Sự tập trung đông đúc người dân vào các thành phố dẫn đến áp lực lớn lên cơ sở hạ tầng, từ đó gây ra các vấn đề như ùn tắc giao thông nghiêm trọng và thiếu hụt nhà ở.", "The dense concentration of people in cities leads to immense pressure on infrastructure, which in turn causes issues such as severe traffic congestion and housing shortages."),
                ("Ngoài ra, chi phí sinh hoạt ở các đô thị lớn thường đắt đỏ, khiến những cá nhân có thu nhập thấp khó duy trì được một mức sống tươm tất.", "Additionally, the cost of living in metropolitan areas is generally exorbitant, making it difficult for low-income individuals to maintain a decent standard of living."),
                ("Mặt khác, những điểm cộng của việc sống ở thành phố là rất thuyết phục.", "On the other hand, the advantages of living in a city are highly compelling."),
                ("Lợi thế lớn nhất nằm ở vô số cơ hội nghề nghiệp mà các khu vực đô thị cung cấp.", "The most substantial benefit lies in the myriad of career opportunities that urban areas provide."),
                ("Các tập đoàn đa quốc gia và các doanh nghiệp lớn thường đặt trụ sở tại thành phố, tạo ra triển vọng việc làm tốt hơn và khả năng kiếm thu nhập cao hơn.", "Multinational corporations and large enterprises are usually headquartered in cities, generating better job prospects and higher earning potentials."),
                ("Thêm vào đó, cư dân thành thị được tiếp cận với chất lượng giáo dục và chăm sóc y tế vượt trội.", "Furthermore, urban dwellers have access to superior quality of education and healthcare."),
                ("Sự sẵn có của các bệnh viện trang bị tốt và các trường đại học uy tín đảm bảo một cuộc sống khỏe mạnh hơn và tương lai tươi sáng hơn cho các gia đình.", "The availability of well-equipped hospitals and prestigious universities ensures a healthier life and a brighter future for families."),
                ("Tóm lại, mặc dù tình trạng quá tải và chi phí cao là những nhược điểm rõ ràng của cuộc sống đô thị, nhưng những lợi ích to lớn về nghề nghiệp và dịch vụ thiết yếu làm cho sự dịch chuyển này hoàn toàn xứng đáng.", "In conclusion, despite the obvious drawbacks of overcrowding and high expenses associated with city life, the immense benefits regarding careers and essential services make this shift entirely worthwhile.")
            ]
        }
    ],
    "two_part": [
        {
            "prompt": "Many people prefer to watch foreign films rather than locally produced ones. Why could this be? Should the government provide more financial support to local film industries?",
            "sentences": [
                ("Trong những năm gần đây, khán giả trên toàn thế giới đã thể hiện sự yêu thích rõ rệt đối với phim quốc tế so với phim nội địa.", "In recent years, audiences worldwide have shown a distinct preference for international films over domestic ones."),
                ("Hiện tượng này bắt nguồn từ nhiều yếu tố khác nhau và việc chính phủ có nên tài trợ cho điện ảnh nước nhà hay không là một vấn đề cần cân nhắc kỹ lưỡng.", "This phenomenon stems from various factors, and whether governments should subsidize their national cinema is a matter requiring careful consideration."),
                ("Có một vài lý do chính giải thích tại sao phim nước ngoài thường thu hút được sự chú ý lớn hơn.", "There are several primary reasons explaining why foreign movies often garner greater attention."),
                ("Thứ nhất, các tác phẩm bom tấn của Hollywood thường sở hữu ngân sách khổng lồ, cho phép họ đầu tư vào các hiệu ứng hình ảnh ngoạn mục và dàn diễn viên nổi tiếng.", "Firstly, blockbuster productions from Hollywood typically possess enormous budgets, allowing them to invest in spectacular visual effects and renowned cast members."),
                ("Chất lượng sản xuất cao này mang lại trải nghiệm giải trí lôi cuốn mà nhiều phim địa phương có kinh phí thấp khó lòng sánh kịp.", "This high production quality delivers a captivating entertainment experience that many low-budget local films struggle to match."),
                ("Thứ hai, phim quốc tế thường khai thác những câu chuyện đa dạng và mới lạ, thỏa mãn trí tò mò của khán giả về những nền văn hóa khác nhau.", "Secondly, international movies frequently explore diverse and novel narratives, satisfying viewers' curiosity about different cultures."),
                ("Tuy nhiên, tôi tin chắc rằng chính phủ nên phân bổ nhiều hỗ trợ tài chính hơn cho các nhà làm phim trong nước.", "However, I firmly believe that governments should allocate more financial support to domestic filmmakers."),
                ("Ngành công nghiệp điện ảnh địa phương đóng vai trò vô giá trong việc gìn giữ và quảng bá bản sắc văn hóa của một quốc gia.", "The local film industry plays an invaluable role in preserving and promoting a nation's cultural identity."),
                ("Nếu không có sự hỗ trợ về mặt ngân sách, những nhà sáng tạo tài năng trong nước có thể không đủ nguồn lực để biến các ý tưởng độc đáo của họ thành hiện thực.", "Without fiscal backing, talented domestic creators might lack the resources to bring their unique concepts to fruition."),
                ("Sự tài trợ của nhà nước không chỉ giúp cải thiện chất lượng kỹ thuật mà còn tạo ra công ăn việc làm trong lĩnh vực nghệ thuật.", "State funding not only helps improve technical quality but also generates employment within the arts sector."),
                ("Nhìn chung, mặc dù sức hút của phim ngoại dựa trên kỹ xảo và kinh phí lớn là không thể phủ nhận, sự can thiệp và hỗ trợ tài chính từ chính phủ đối với phim nội địa là cực kỳ cần thiết để bảo vệ sự đa dạng văn hóa.", "Overall, although the appeal of foreign films based on heavy investments and effects is undeniable, government intervention and financial support for domestic cinema are absolutely vital to safeguard cultural diversity.")
            ]
        }
    ]
}

IELTS_PROMPTS = [p for prompts in IELTS_TASK2_PROMPTS.values() for p in prompts]

IELTS_QUESTION_TYPES = {
    "opinion": {
        "label_vi": "Nêu ý kiến (Agree/Disagree)",
        "structure_hint": [
            "Mở bài: diễn giải lại đề và nêu rõ quan điểm của bạn (đồng ý / không đồng ý / một phần).",
            "Thân bài 1: lý do chính ủng hộ quan điểm, kèm ví dụ cụ thể.",
            "Thân bài 2: lý do thứ hai hoặc phản biện quan điểm đối lập.",
            "Kết bài: khẳng định lại quan điểm và tóm tắt lập luận.",
        ],
    },
    "discussion": {
        "label_vi": "Thảo luận",
        "structure_hint": [
            "Mở bài: diễn giải lại đề và nêu rõ bạn sẽ thảo luận cả hai khía cạnh cùng quan điểm cá nhân.",
            "Thân bài 1: phân tích góc nhìn thứ nhất (view A).",
            "Thân bài 2: phân tích góc nhìn thứ hai (view B) và lồng ghép ý kiến của bạn.",
            "Kết bài: tóm tắt lại hai góc nhìn và khẳng định lại quan điểm cá nhân.",
        ],
    },
    "problem_solution": {
        "label_vi": "Vấn đề - Giải pháp",
        "structure_hint": [
            "Mở bài: diễn giải lại đề và giới thiệu ngắn gọn các nguyên nhân, giải pháp chính.",
            "Thân bài 1: phân tích các nguyên nhân / vấn đề cốt lõi.",
            "Thân bài 2: đề xuất các giải pháp tương ứng, khả thi.",
            "Kết bài: tóm tắt lại vấn đề và tầm quan trọng của các giải pháp.",
        ],
    },
    "advantage_disadvantage": {
        "label_vi": "Lợi - Hại",
        "structure_hint": [
            "Mở bài: diễn giải lại đề và đưa ra nhận định tổng quan (lợi lớn hơn hại hay ngược lại).",
            "Thân bài 1: phân tích các ưu điểm / lợi ích nổi bật.",
            "Thân bài 2: phân tích các nhược điểm / tác hại, lý giải tại sao yếu tố kia quan trọng hơn.",
            "Kết bài: tóm tắt lại lợi/hại và khẳng định lại cán cân nghiêng về bên nào.",
        ],
    },
    "two_part": {
        "label_vi": "2 phần",
        "structure_hint": [
            "Mở bài: diễn giải lại đề và tóm tắt ngắn gọn câu trả lời cho cả hai câu hỏi.",
            "Thân bài 1: trả lời trực tiếp và đầy đủ cho câu hỏi thứ nhất.",
            "Thân bài 2: trả lời trực tiếp và đầy đủ cho câu hỏi thứ hai.",
            "Kết bài: tóm tắt lại hai câu trả lời một cách súc tích.",
        ],
    },
}

def _model_answer_skeleton(prompt: str, question_type: str) -> str:
    # Returns a 4-paragraph band-7 structural template in English that restates the prompt
    # and follows the structure_hint for that question_type. Plain prose, ~180 words.
    base = (
        "The issue of whether or how to address the prompt—\"{prompt}\"—is a matter of considerable debate. "
        "This essay will outline the main arguments and provide a reasoned perspective on the topic.\n\n"
        "On the one hand, there are several key points to consider. The primary argument in this regard is "
        "that it brings significant impacts on society and individuals. For instance, many studies have shown "
        "that clear policies or actions can facilitate positive outcomes. Consequently, this aspect cannot be ignored.\n\n"
        "On the other hand, an alternative perspective or further consideration is equally important. "
        "It is crucial to recognize that the situation is complex and may involve some drawbacks or secondary causes. "
        "A prominent example of this would be the challenges faced by various communities when dealing with this trend.\n\n"
        "In conclusion, the debate surrounding this topic involves multifaceted arguments. Weighing both sides carefully, "
        "it is evident that a balanced approach is necessary. Therefore, future efforts should take all these factors into account."
    )
    return base.format(prompt=prompt)

# IELTS Task 1: describe visual data (charts, graphs, tables, processes) in a formal report.
# Offline we can't render a real chart, so each prompt describes the data verbally — the
# learner still practices the Task 1 language (overview, trends, comparisons).
IELTS_TASK1_PROMPTS = [
    "The chart below shows the percentage of households with internet access in four countries "
    "(the USA, the UK, Japan, and India) in 2000, 2010, and 2020. Summarise the information by "
    "selecting and reporting the main features, and make comparisons where relevant.",
    "The line graph shows the number of international tourists visiting a coastal city each month "
    "over one year. Summarise the main trends and make comparisons where relevant.",
    "The table below gives information about the average monthly spending on food, housing, "
    "transport, and entertainment by three age groups. Summarise the main features and make comparisons.",
    "The diagram illustrates the process of how recycled paper is produced, from used paper "
    "collection to the finished product. Summarise the process by describing the main stages.",
    "The bar chart compares the amount of electricity generated from coal, gas, nuclear, and "
    "renewable sources in a country in 1995 and 2020. Summarise the main features and make comparisons.",
]

# IELTS band descriptors (condensed, per criterion) shown alongside a learner's score so the
# feedback is actionable rather than a bare number.
IELTS_BAND_DESCRIPTORS = {
    "task_response": {
        5: "Đáp ứng đề bài một phần; quan điểm chưa rõ ràng hoặc thiếu phát triển.",
        6: "Trả lời đúng trọng tâm đề bài; ý được phát triển nhưng đôi chỗ chưa sâu.",
        7: "Trả lời đầy đủ mọi phần của đề; quan điểm rõ ràng, ý được phát triển tốt.",
        8: "Trả lời sâu sắc, ý tưởng được mở rộng và hỗ trợ thuyết phục.",
    },
    "coherence": {
        5: "Sắp xếp ý còn rời rạc; dùng từ nối chưa hợp lý.",
        6: "Bố cục mạch lạc; dùng từ nối tương đối hiệu quả.",
        7: "Ý tưởng liên kết logic; đoạn văn rõ ràng, dùng từ nối linh hoạt.",
        8: "Liên kết tự nhiên, mạch lạc xuyên suốt, phân đoạn khéo léo.",
    },
    "lexical": {
        5: "Vốn từ hạn chế, lặp từ; đôi khi dùng sai từ.",
        6: "Vốn từ đủ dùng; có một số từ vựng học thuật.",
        7: "Vốn từ phong phú, dùng linh hoạt; ít lỗi collocations.",
        8: "Vốn từ rộng và chính xác, dùng thành ngữ tự nhiên.",
    },
    "grammar": {
        5: "Câu đơn là chủ yếu; nhiều lỗi ngữ pháp gây khó hiểu.",
        6: "Kết hợp câu đơn và phức; lỗi ngữ pháp không cản trở nghĩa.",
        7: "Đa dạng cấu trúc câu; phần lớn câu không mắc lỗi.",
        8: "Cấu trúc đa dạng, linh hoạt và chính xác cao.",
    },
}

_LEVEL_MAP = {"beginner": "b", "intermediate": "i", "advanced": "a"}
_LINKING_WORDS = [
    "however", "therefore", "moreover", "in addition", "for example", "for instance",
    "on the other hand", "on one hand", "furthermore", "as a result", "in conclusion",
    "firstly", "secondly", "finally", "nevertheless", "besides", "consequently",
]


def _lvl(level: str) -> str:
    return _LEVEL_MAP.get((level or "").strip().lower(), "i")


def _pairs_to_sentences(pairs):
    return [{"vi": vi, "reference_en": en, "hint": ""} for vi, en in pairs]


def generate_lesson(mode: str, level: str, category: str = "", topic: str = "",
                    num_sentences: int = 10, task: str = "task2", question_type: str = "") -> dict:
    mode = (mode or "sentence").strip().lower()
    lvl = _lvl(level)

    if mode == "ielts":
        task = (task or "task2").strip().lower()
        
        q_type = ""
        struct_hint = []
        if task == "task2":
            if question_type in IELTS_MODEL_ESSAYS:
                q_type = question_type
            else:
                q_type = random.choice(list(IELTS_MODEL_ESSAYS.keys()))
            struct_hint = IELTS_QUESTION_TYPES[q_type]["structure_hint"]
            model_essay = random.choice(IELTS_MODEL_ESSAYS[q_type])
            prompt = model_essay["prompt"]
            sentences = [{"vi": vi, "reference_en": en, "hint": ""} for vi, en in model_essay["sentences"]]
        else:
            bank = IELTS_TASK1_PROMPTS
            struct_hint = [
                "Câu mở đầu: Paraphrase đề bài (biểu đồ thể hiện điều gì).",
                "Câu tổng quan (Overview): Nêu 2-3 xu hướng hoặc đặc điểm nổi bật nhất.",
                "Thân bài 1: So sánh và mô tả số liệu chi tiết phần 1.",
                "Thân bài 2: So sánh và mô tả số liệu chi tiết phần 2 (không đưa ý kiến cá nhân)."
            ]
            
            prompt = random.choice(bank)
            if topic:
                # bias toward a prompt containing a topic keyword, if any match
                matches = [p for p in bank if topic.lower() in p.lower()]
                if matches:
                    prompt = random.choice(matches)
            sentences = []
        # Task 1 asks for at least 150 words; Task 2 at least 250.
        return {
            "mode": "ielts", "level": level, "category": "", "task": task,
            "sentences": sentences, "ielts_prompt": prompt,
            "min_words": 150 if task == "task1" else 250,
            "question_type": q_type,
            "structure_hint": struct_hint
        }

    if mode == "paragraph":
        content_type = category if category in PARAGRAPH_BANK else random.choice(list(PARAGRAPH_BANK))
        by_level = PARAGRAPH_BANK[content_type]
        paragraphs = by_level.get(lvl) or next(iter(by_level.values()))
        chosen = random.choice(paragraphs)
        return {
            "mode": "paragraph", "level": level, "category": content_type,
            "sentences": _pairs_to_sentences(chosen),
            "ielts_prompt": "", "min_words": 0,
        }

    # sentence mode
    if category in SENTENCE_BANK:
        by_level = SENTENCE_BANK[category]
        pool = list(by_level.get(lvl, []))
        # top up from other levels of the same category if not enough
        if len(pool) < num_sentences:
            for lk in ("b", "i", "a"):
                if lk != lvl:
                    pool.extend(by_level.get(lk, []))
    else:
        pool = []
        for cat in SENTENCE_BANK.values():
            pool.extend(cat.get(lvl, []))

    random.shuffle(pool)
    chosen = pool[:max(1, num_sentences)]
    return {
        "mode": "sentence", "level": level, "category": category,
        "sentences": _pairs_to_sentences(chosen),
        "ielts_prompt": "", "min_words": 0,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Grading
# ─────────────────────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s']", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _tokens(text: str):
    return _normalize(text).split()


def grade_sentence(vi: str, reference_en: str, user_en: str, level: str = "") -> dict:
    ref_norm = _normalize(reference_en)
    usr_norm = _normalize(user_en)
    ref_tokens = ref_norm.split()
    usr_tokens = usr_norm.split()

    if not usr_norm:
        return {
            "score": 0.0,
            "corrected": reference_en,
            "errors": [{"type": "empty", "vi_explanation": "Bạn chưa nhập câu trả lời."}],
            "tip_vi": "Hãy thử dịch câu tiếng Việt sang tiếng Anh trước khi kiểm tra.",
            "reference_en": reference_en,
        }

    token_ratio = difflib.SequenceMatcher(None, ref_tokens, usr_tokens).ratio()
    char_ratio = difflib.SequenceMatcher(None, ref_norm, usr_norm).ratio()
    similarity = (token_ratio * 0.7) + (char_ratio * 0.3)
    score = max(0.0, min(10.0, round(similarity * 10, 1)))

    errors = []
    ref_set = set(ref_tokens)
    usr_set = set(usr_tokens)
    missing = [w for w in ref_tokens if w not in usr_set][:5]
    extra = [w for w in usr_tokens if w not in ref_set][:5]

    if missing:
        errors.append({
            "type": "missing_words",
            "vi_explanation": "Thiếu hoặc khác từ so với đáp án: " + ", ".join(missing),
        })
    if extra:
        errors.append({
            "type": "extra_words",
            "vi_explanation": "Có từ không khớp với đáp án: " + ", ".join(extra),
        })
    if ref_tokens and abs(len(usr_tokens) - len(ref_tokens)) > max(2, len(ref_tokens) // 3):
        errors.append({
            "type": "length",
            "vi_explanation": "Độ dài câu chênh lệch khá nhiều so với câu mẫu.",
        })

    if score >= 9.0:
        corrected = user_en.strip()
        tip = "Rất tốt! Câu của bạn gần như chính xác."
        errors = []
    else:
        corrected = reference_en
        tip = "Hãy so sánh câu của bạn với câu mẫu và chú ý các từ còn thiếu."

    accuracy = int(max(0, min(100, round(score * 10))))
    is_good = score >= 8.0
    suggestion = reference_en if not is_good else ""
    improvements = []
    if not is_good:
        for err in errors:
            improvements.append(err["vi_explanation"])

    return {
        "score": score,
        "corrected": corrected,
        "errors": errors,
        "tip_vi": tip,
        "reference_en": reference_en,
        "accuracy": accuracy,
        "is_good": is_good,
        "suggestion": suggestion,
        "improvements": improvements,
    }


def _band_descriptor(criterion: str, band: float) -> str:
    """Nearest descriptor at or below the given band, for actionable feedback."""
    table = IELTS_BAND_DESCRIPTORS.get(criterion, {})
    key = max((k for k in table if k <= band), default=min(table) if table else None)
    return table.get(key, "") if key is not None else ""


def grade_ielts(prompt: str, essay: str, task: str = "task2", question_type: str = "") -> dict:
    task = (task or "task2").strip().lower()
    min_words = 150 if task == "task1" else 250
    words = _tokens(essay)
    word_count = len(words)
    sentences = [s for s in re.split(r"[.!?]+", essay) if s.strip()]
    sentence_count = max(1, len(sentences))
    unique = len(set(words))
    diversity = (unique / word_count) if word_count else 0.0
    avg_sentence_len = word_count / sentence_count
    essay_lower = essay.lower()
    linking_count = sum(1 for w in _LINKING_WORDS if w in essay_lower)

    if word_count == 0:
        return {
            "band": 0.0, "task_response": 0.0, "coherence": 0.0,
            "lexical": 0.0, "grammar": 0.0, "task": task,
            "feedback_vi": f"Bạn chưa viết bài luận nào. Hãy viết ít nhất {min_words} từ cho IELTS {task.upper()}.",
            "improved_intro": "Chưa có nội dung để nhận xét.",
            "descriptors": {},
            "annotations": [],
            "vocabulary": [],
            "model_answer": "",
            "structure": {},
            "question_type": question_type,
        }

    # Structure checks
    paragraphs = [p for p in re.split(r"\n\s*\n|\n", essay) if p.strip()]
    num_paragraphs = len(paragraphs)
    has_intro = num_paragraphs >= 1
    has_body = num_paragraphs >= 2
    has_conclusion = num_paragraphs >= 3
    
    structure_info = {
        "intro": "Có vẻ có đoạn mở bài." if has_intro else "Thiếu đoạn mở bài rõ ràng.",
        "body": "Có đoạn thân bài." if has_body else "Thiếu đoạn thân bài.",
        "conclusion": "Có vẻ có đoạn kết bài." if has_conclusion else "Thiếu đoạn kết bài rõ ràng."
    }

    # Annotations
    annotations = []
    import collections
    from nlp.vietnamese import VIETNAMESE_STOPWORDS
    for s in sentences:
        if len(annotations) >= 6:
            break
        s_words = s.split()
        if len(s_words) > 30:
            annotations.append({"original": s.strip(), "issue_vi": "Câu quá dài, nên tách thành 2 câu ngắn hơn.", "suggestion": s.strip()})
            continue
        if len(s_words) < 4:
            annotations.append({"original": s.strip(), "issue_vi": "Câu quá ngắn / thiếu thông tin.", "suggestion": s.strip()})
            continue
        if re.search(r"\b(don't|can't|it's|won't|isn't|aren't|haven't|hasn't|didn't|couldn't|wouldn't|shouldn't)\b", s.lower()):
            annotations.append({"original": s.strip(), "issue_vi": "Tránh viết tắt trong văn học thuật.", "suggestion": re.sub(r"\b(don't)\b", "do not", s, flags=re.IGNORECASE).strip()})
            continue
        if s.strip().lower().startswith(("and ", "but ", "so ")):
            annotations.append({"original": s.strip(), "issue_vi": "Không nên bắt đầu câu bằng And/But/So trong IELTS.", "suggestion": s.strip()})
            continue
            
        # check repetition
        counts = collections.Counter([w.lower() for w in s_words if len(w) > 3 and w.lower() not in {"this", "that", "with", "from"}]) # simple heuristic
        repeated = [w for w, c in counts.items() if c >= 3]
        if repeated:
            annotations.append({"original": s.strip(), "issue_vi": f"Lặp từ '{repeated[0]}', hãy dùng từ đồng nghĩa.", "suggestion": s.strip()})
            continue

    # Vocabulary upgrades
    upgrade_map = {
        "good": ("beneficial", "Tốt -> Có lợi"),
        "bad": ("detrimental", "Xấu -> Gây hại"),
        "big": ("substantial", "Lớn -> Đáng kể"),
        "a lot of": ("a considerable amount of", "Nhiều -> Một lượng đáng kể"),
        "many people": ("a significant number of people", "Nhiều người -> Một số lượng lớn người"),
        "very": ("considerably", "Rất -> Đáng kể"),
        "think": ("argue", "Nghĩ -> Cho rằng"),
        "important": ("crucial", "Quan trọng -> Thiết yếu"),
        "get": ("obtain", "Lấy/Được -> Đạt được"),
        "help": ("facilitate", "Giúp đỡ -> Tạo điều kiện"),
        "problem": ("issue", "Vấn đề -> Vấn đề (học thuật hơn)"),
        "in my opinion": ("from my perspective", "Theo ý tôi -> Từ góc nhìn của tôi"),
        "nowadays": ("in contemporary society", "Ngày nay -> Trong xã hội đương đại"),
        "more and more": ("an increasing number of", "Ngày càng nhiều -> Số lượng ngày càng tăng")
    }
    
    vocabulary = []
    for basic, (better, note_vi) in upgrade_map.items():
        if len(vocabulary) >= 8:
            break
        if re.search(r'\b' + re.escape(basic) + r'\b', essay_lower):
            vocabulary.append({"basic": basic, "better": better, "note_vi": note_vi})

    model_answer = _model_answer_skeleton(prompt, question_type)

    def _band_step(x):
        return max(0.0, min(9.0, round(x * 2) / 2))

    # task_response: driven by hitting the word-count requirement for the task
    task_response = _band_step(4.5 + min(4.0, (word_count / min_words) * 4.0) - (0 if word_count >= min_words else 1.5))
    # coherence: linking words + reasonable paragraphing signal (sentence count)
    coherence = _band_step(4.0 + min(3.0, linking_count * 0.6) + min(1.5, sentence_count / 8))
    # lexical: vocabulary diversity
    lexical = _band_step(3.5 + diversity * 7.0)
    # grammar: reasonable average sentence length (10-22 words is a sweet spot)
    if 10 <= avg_sentence_len <= 22:
        grammar = _band_step(6.5)
    elif avg_sentence_len < 10:
        grammar = _band_step(5.0)
    else:
        grammar = _band_step(5.5)

    band = round(((task_response + coherence + lexical + grammar) / 4) * 2) / 2

    feedback = (
        f"• Số từ: {word_count} (yêu cầu tối thiểu {min_words}). "
        + ("Đạt yêu cầu độ dài." if word_count >= min_words else "Bài viết còn quá ngắn so với yêu cầu.") + "\n"
        f"• Độ đa dạng từ vựng: {diversity:.0%}. "
        + ("Tốt." if diversity >= 0.5 else "Nên dùng từ vựng phong phú hơn, tránh lặp từ.") + "\n"
        f"• Số từ nối (linking words): {linking_count}. "
        + ("Liên kết ý tốt." if linking_count >= 4 else "Nên dùng thêm từ nối để bài mạch lạc hơn.") + "\n"
        f"• Độ dài câu trung bình: {avg_sentence_len:.1f} từ/câu. "
        + ("Hợp lý." if 10 <= avg_sentence_len <= 22 else "Nên điều chỉnh độ dài câu cho cân đối.")
    )

    intro_sentences = sentences[:2]
    improved_intro = ". ".join(s.strip() for s in intro_sentences).strip()
    if improved_intro and not improved_intro.endswith("."):
        improved_intro += "."
    if not improved_intro:
        improved_intro = "Hãy mở bài bằng cách diễn giải lại đề và nêu quan điểm của bạn."

    descriptors = {
        "task_response": _band_descriptor("task_response", task_response),
        "coherence": _band_descriptor("coherence", coherence),
        "lexical": _band_descriptor("lexical", lexical),
        "grammar": _band_descriptor("grammar", grammar),
    }

    return {
        "band": band,
        "task_response": task_response,
        "coherence": coherence,
        "lexical": lexical,
        "grammar": grammar,
        "task": task,
        "feedback_vi": feedback,
        "improved_intro": improved_intro,
        "descriptors": descriptors,
        "annotations": annotations,
        "vocabulary": vocabulary,
        "model_answer": model_answer,
        "structure": structure_info,
        "question_type": question_type,
    }



def lookup_word(word: str, sentence_en: str = "") -> dict:
    w = (word or "").strip().strip(".,!?;:\"'()").lower()
    return {
        "word": w,
        "ipa": "",
        "part_of_speech": "",
        "meaning_vi": "Bật chế độ AI (Cloud API) trong Cài đặt để xem nghĩa, phiên âm và ví dụ chi tiết.",
        "example_en": sentence_en or "",
        "example_vi": "",
    }


def vocab_bank(text: str, limit: int = 12) -> list[dict]:
    words = _tokens(text)
    stopwords = {"a", "an", "the", "and", "or", "but", "if", "because", "as", "what",
                 "when", "where", "how", "who", "which", "this", "that", "these", "those",
                 "then", "just", "so", "than", "such", "both", "through", "about", "for",
                 "is", "of", "while", "during", "to", "what", "which", "is", "are", "was",
                 "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
                 "will", "would", "shall", "should", "may", "might", "must", "can", "could",
                 "of", "in", "to", "for", "with", "on", "at", "from", "by", "about", "as",
                 "into", "like", "through", "after", "over", "between", "out", "against",
                 "during", "without", "before", "under", "around", "among", "i", "you", "he",
                 "she", "it", "we", "they", "me", "him", "her", "us", "them", "my", "your",
                 "his", "its", "our", "their", "mine", "yours", "hers", "ours", "theirs", "not",
                 "very", "too", "much", "many", "some", "any", "all", "every", "each"}
    
    unique_words = []
    seen = set()
    for w in words:
        w_clean = w.lower().strip(".,!?:;\"'()[]{}-")
        if w_clean and w_clean not in stopwords and len(w_clean) > 3 and w_clean not in seen:
            unique_words.append(w_clean)
            seen.add(w_clean)
            if len(unique_words) >= limit:
                break
    
    res = []
    for w in unique_words:
        res.append({
            "word": w,
            "ipa": "",
            "part_of_speech": "",
            "meaning_vi": "Bật AI (Cloud) để xem nghĩa chi tiết.",
            "example_en": ""
        })
    return res
