from deep_translator import GoogleTranslator
translator = GoogleTranslator(source='en', target='vi')
print("tiger ->", translator.translate("tiger"))
print("ameliorate ->", translator.translate("ameliorate"))
print("definition ->", translator.translate("A large carnivorous feline mammal of Asia, having a tawny coat with transverse black stripes."))
