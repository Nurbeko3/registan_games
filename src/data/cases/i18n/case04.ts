/** case04 "The Wilting Greenhouse" — uz/ru display translations. */

import type { CaseTranslations } from './types';

const case04L10n: CaseTranslations = {
  uz: {
    title: "So'lib borayotgan issiqxona",
    briefing:
      "Fan to'garagining B javondagi loviya o'simliklari so'lib boryapti, A javondagilari " +
      "esa gullab-yashnamoqda. Haqiqiy sababni aniqlash uchun jurnal va yozuvlarni o'qing.",
    sources: {
      s1: {
        title: 'Tajriba sozlamasi',
        body:
          "Ikki javon, bir xil loviya urug'lari, bir xil tuproq, har kuni bir xil miqdorda sug'oriladi.\n" +
          'A javon: janubiy deraza yonida.\n' +
          'B javon: baland shkaf ortidagi orqa burchakda.\n' +
          "Joylashuvidan tashqari hamma narsa bir xil.",
      },
      s2: {
        title: "Yorug'lik o'lchagich ko'rsatkichlari (lyuks)",
        body:
          "Peshinda o'lchangan kunlik yorug'lik:\n" +
          'A javon: 18 000 lyuks\n' +
          'B javon: 1 200 lyuks\n' +
          "Sog'lom loviya o'simliklariga kamida 10 000 lyuks kerak.",
      },
      s3: {
        title: "To'garak muhokamasi",
        body:
          'Lola: Balki B javonga ko\'proq suv kerakdir?\n' +
          "Ravi: Yo'q — sozlama yozuvida ikkala javon ham bir xil suv oladi deyilgan.\n" +
          "Lola: Unda yagona farq — har bir javon qancha yorug'lik olishida.\n" +
          'Ravi: To\'g\'ri. B javon shkaf ortida yashiringan.',
      },
    },
    questions: {
      q1: {
        prompt: "B javon peshinda qancha yorug'lik oladi?",
        choices: ['18 000 lyuks', '10 000 lyuks', '1 200 lyuks', "Qayd etilmagan"],
        evidencePassage: 'B javon: 1 200 lyuks',
      },
      q2: {
        prompt: "Sozlamaga ko'ra, javonlar o'rtasidagi YAGONA farq nima?",
        choices: ['Tuproq', 'Suv miqdori', "Urug'lar", 'Joylashuvi'],
        evidencePassage: 'Joylashuvidan tashqari hamma narsa bir xil.',
      },
      q3: {
        prompt:
          "Ko'rsatkichlar VA sog'lom o'simlik qoidasidan foydalanib, B javon yetarli yorug'lik oladimi?",
        choices: [
          "Ha — minimaldan ancha yuqori",
          "Yo'q — 1 200 lyuks kerakli 10 000 lyuksdan ancha past",
          "U aynan yetarli oladi",
          "Yorug'lik o'lchanmagan",
        ],
        evidencePassage: "Sog'lom loviya o'simliklariga kamida 10 000 lyuks kerak.",
      },
      q4: {
        prompt: "B javondagi so'lishning eng ehtimoliy sababi nima?",
        choices: [
          "Juda ko'p suv",
          "Yomon urug'lar",
          "Shkaf ortida yashiringani uchun juda kam yorug'lik",
          "Noto'g'ri tuproq",
        ],
        evidencePassage: "yagona farq — har bir javon qancha yorug'lik olishida",
      },
    },
  },
  ru: {
    title: 'Увядающая теплица',
    briefing:
      'Бобовые растения научного кружка на полке B всё время вянут, а на полке A — ' +
      'цветут. Прочитай журнал и заметки, чтобы выяснить настоящую причину.',
    sources: {
      s1: {
        title: 'Условия эксперимента',
        body:
          'Две полки, одинаковые семена бобов, одинаковая почва, поливают одинаково каждый день.\n' +
          'Полка A: у южного окна.\n' +
          'Полка B: в дальнем углу за высоким шкафом.\n' +
          'Всё одинаково, кроме расположения.',
      },
      s2: {
        title: 'Показания люксметра (люкс)',
        body:
          'Ежедневный замер света в полдень:\n' +
          'Полка A: 18 000 люкс\n' +
          'Полка B: 1 200 люкс\n' +
          'Здоровым бобам нужно не меньше 10 000 люкс.',
      },
      s3: {
        title: 'Обсуждение в кружке',
        body:
          'Лола: Может, полке B нужно больше воды?\n' +
          'Рави: Нет — в условиях сказано, что обе полки поливают одинаково.\n' +
          'Лола: Тогда единственное различие — сколько света получает каждая полка.\n' +
          'Рави: Верно. Полка B спрятана за шкафом.',
      },
    },
    questions: {
      q1: {
        prompt: 'Сколько света получает полка B в полдень?',
        choices: ['18 000 люкс', '10 000 люкс', '1 200 люкс', 'Не записано'],
        evidencePassage: 'Полка B: 1 200 люкс',
      },
      q2: {
        prompt: 'Согласно условиям, какое ЕДИНСТВЕННОЕ различие между полками?',
        choices: ['Почва', 'Количество воды', 'Семена', 'Расположение'],
        evidencePassage: 'Всё одинаково, кроме расположения.',
      },
      q3: {
        prompt:
          'Используя замеры И правило о здоровых растениях, достаточно ли света на полке B?',
        choices: [
          'Да — намного выше минимума',
          'Нет — 1 200 люкс намного ниже нужных 10 000 люкс',
          'Получает ровно столько, сколько нужно',
          'Свет не измеряли',
        ],
        evidencePassage: 'Здоровым бобам нужно не меньше 10 000 люкс.',
      },
      q4: {
        prompt: 'Какова наиболее вероятная причина увядания на полке B?',
        choices: [
          'Слишком много воды',
          'Плохие семена',
          'Слишком мало света, потому что она спрятана за шкафом',
          'Неподходящая почва',
        ],
        evidencePassage: 'единственное различие — сколько света получает каждая полка',
      },
    },
  },
};

export default case04L10n;
