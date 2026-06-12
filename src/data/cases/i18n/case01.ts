/** case01 "The Missing Mascot" — uz/ru display translations. */

import type { CaseTranslations } from './types';

const case01L10n: CaseTranslations = {
  uz: {
    title: "G'oyib bo'lgan talisman",
    briefing:
      "Sunnydale maktabining yumshoq boyo'g'li talismani — Huti — juma kuni " +
      "kuboklar javonidan g'oyib bo'ldi. Iplarni o'qing va uni kim hamda nima " +
      'uchun olganini aniqlang.',
    sources: {
      s1: {
        title: 'Kuboklar javonidagi xat',
        body:
          "Huti dam olish kunlari menda! Futbol finaliga chizayotgan plakatim uchun " +
          "talismanimiz kerak bo'ldi. Dushanba ertalab qaytarib olib kelaman, va'da beraman.\n\n" +
          "— Rasm to'garagi",
      },
      s2: {
        title: "Rasm to'garagi guruh chati",
        body:
          "Mia: Katta mo'yqalamlar kimda?\n" +
          "Sam: Menda. Bugun kechqurun boyo'g'li plakatini chizaman.\n" +
          'Mia: Hutini javondan sen oldingmi?\n' +
          "Sam: Ha, ranglarini ko'chirish uchun juma kuni olib turdim.\n" +
          "Mia: Zo'r. Final shanba kuni, shuning uchun plakat jumagacha tayyor bo'lishi kerak.",
      },
      s3: {
        title: "To'garak a'zosi kartasi — Sam",
        body:
          "Ism: Sam\nTo'garak: Rasm to'garagi\nRoli: Plakat rassomi\nYoqtirgan rangi: moviy-yashil\n" +
          "Eslatma: Sam bu chorakda Rasm to'garagiga qo'shildi va hayvonlarni chizishni yaxshi ko'radi.",
      },
    },
    questions: {
      q1: {
        prompt: 'Huti talismanini kim olib turdi?',
        choices: ['Mia', 'Sam', 'Futbol murabbiyi', 'Hech kim'],
        evidencePassage: "Ha, ranglarini ko'chirish uchun juma kuni olib turdim.",
      },
      q2: {
        prompt: 'Talisman nima uchun olingan edi?',
        choices: [
          'Hazil uchun yashirish maqsadida',
          'Futbol plakati uchun ishlatish maqsadida',
          'Tozalash uchun',
          'Birovga berish uchun',
        ],
        evidencePassage: 'Futbol finaliga chizayotgan plakatim uchun talismanimiz kerak',
      },
      q3: {
        prompt: "Olgan odam Hutini qachon olganini aytdi?",
        choices: ['Dushanba', 'Shanba', 'Juma', 'Yakshanba'],
        evidencePassage: 'juma kuni olib turdim',
      },
      q4: {
        prompt:
          "Xat VA chatdan foydalanib, plakat o'z vaqtida tugashi mumkin bo'lgan ENG oxirgi kun qaysi?",
        choices: ['Dushanba', 'Juma', 'Shanba', 'Yakshanba'],
        evidencePassage: "Final shanba kuni, shuning uchun plakat jumagacha tayyor bo'lishi kerak.",
      },
    },
  },
  ru: {
    title: 'Пропавший талисман',
    briefing:
      'Плюшевый талисман-совёнок школы Саннидейл по имени Хути в пятницу пропал ' +
      'с полки с кубками. Прочитай улики и выясни, кто его взял — и зачем.',
    sources: {
      s1: {
        title: 'Записка на полке с кубками',
        body:
          'Хути со мной на выходных! Наш талисман понадобился мне для плаката, ' +
          'который я рисую к финалу по футболу. В понедельник утром верну, обещаю.\n\n' +
          '— Кружок рисования',
      },
      s2: {
        title: 'Групповой чат кружка рисования',
        body:
          'Мия: У кого большие кисти?\n' +
          'Сэм: У меня. Сегодня вечером рисую плакат с совой.\n' +
          'Мия: Это ты взял Хути с полки?\n' +
          'Сэм: Да, я одолжил его в пятницу, чтобы срисовать цвета.\n' +
          'Мия: Класс. Финал в субботу, так что плакат нужен к пятнице.',
      },
      s3: {
        title: 'Карточка участника кружка — Сэм',
        body:
          'Имя: Сэм\nКружок: Рисование\nРоль: Художник плакатов\nЛюбимый цвет: бирюзовый\n' +
          'Заметка: Сэм вступил в кружок в этом семестре и любит рисовать животных.',
      },
    },
    questions: {
      q1: {
        prompt: 'Кто одолжил талисман Хути?',
        choices: ['Мия', 'Сэм', 'Футбольный тренер', 'Никто'],
        evidencePassage: 'Да, я одолжил его в пятницу, чтобы срисовать цвета.',
      },
      q2: {
        prompt: 'Зачем взяли талисман?',
        choices: [
          'Чтобы спрятать ради шутки',
          'Чтобы использовать для футбольного плаката',
          'Чтобы почистить',
          'Чтобы подарить',
        ],
        evidencePassage: 'понадобился мне для плаката, который я рисую к финалу по футболу',
      },
      q3: {
        prompt: 'Когда, по словам взявшего, он забрал Хути?',
        choices: ['В понедельник', 'В субботу', 'В пятницу', 'В воскресенье'],
        evidencePassage: 'я одолжил его в пятницу',
      },
      q4: {
        prompt:
          'Используя записку И чат, какой ПОСЛЕДНИЙ день, когда плакат можно закончить вовремя?',
        choices: ['Понедельник', 'Пятница', 'Суббота', 'Воскресенье'],
        evidencePassage: 'Финал в субботу, так что плакат нужен к пятнице.',
      },
    },
  },
};

export default case01L10n;
