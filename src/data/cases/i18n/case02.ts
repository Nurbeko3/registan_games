/** case02 "The Overdue Library Book" — uz/ru display translations. */

import type { CaseTranslations } from './types';

const case02L10n: CaseTranslations = {
  uz: {
    title: "Muddati o'tgan kutubxona kitobi",
    briefing:
      "Kutubxona vulqonlar haqidagi kitob uch kun kechikkan va jarima to'lanishi " +
      "kerak deydi. O'quvchi esa kitobni o'z vaqtida qaytarganini aytadi. Yozuvlarni " +
      "o'qing va kim haq ekanini aniqlang.",
    sources: {
      s1: {
        title: 'Kutubxona ijara yozuvi',
        body:
          'Kitob: "Olov tog\'lari"\nIjarachi: karta #2207\nOlingan: 2-mart\n' +
          "Qaytarish muddati: 16-mart\nQaytarilgan: qayd etilmagan\nJarima: 3 kun × 200 so'm",
      },
      s2: {
        title: 'Ijarachidan email',
        body:
          'Mavzu: Men vulqon kitobini qaytardim!\n\n' +
          "Salom, menimcha xatolik bor. Men \"Olov tog'lari\"ni muddatidan bir kun oldin, " +
          '15-mart kuni qaytarish qutisiga tashladim. Buni do\'stim Dana ko\'rdi. ' +
          'Iltimos, qutini tekshiring — balki u qayta skanerlanmagandir.',
      },
      s3: {
        title: 'Dana bilan chat',
        body:
          'Kutubxonachi: Dana, vulqon kitobi qaytarilganini ko\'rdingmi?\n' +
          'Dana: Ha. Biz 15-mart kuni birga kirdik va men uning qaytarish qutisiga tushganini ko\'rdim.\n' +
          'Kutubxonachi: Quti 17-mart kuni bo\'shatilgan, shuning uchun skanerlanmagan kitob u yerda bir necha kun yotishi mumkin edi.',
      },
    },
    questions: {
      q1: {
        prompt: 'Kitobni qaytarish muddati qaysi sana edi?',
        choices: ['2-mart', '15-mart', '16-mart', '17-mart'],
        evidencePassage: 'Qaytarish muddati: 16-mart',
      },
      q2: {
        prompt: 'Ijarachi uni qaysi sanada qaytarganini aytmoqda?',
        choices: ['15-mart', '16-mart', '17-mart', '2-mart'],
        evidencePassage: 'muddatidan bir kun oldin, 15-mart kuni qaytarish qutisiga tashladim',
      },
      q3: {
        prompt:
          'Ijara yozuvi va emailni solishtirib, kitob muddatidan OLDIN qaytarilganmi?',
        choices: [
          "Yo'q — u uch kun kechikkan",
          'Ha — 15-mart qaytarilgan, muddati 16-mart',
          'U umuman olinmagan',
          'Muddati 2-mart edi',
        ],
        evidencePassage: 'muddatidan bir kun oldin, 15-mart kuni qaytarish qutisiga tashladim',
      },
      q4: {
        prompt: "Kitob o'z vaqtida qaytarilgan bo'lsa ham, nega kutubxonada \"Qaytarilgan\" sanasi bo'lmasligi mumkin?",
        choices: [
          "Ijarachi uni o'zida saqlab qoldi",
          "Qaytarish qutisi faqat 17-mart kuni bo'shatilgan, shuning uchun skanerlanmagan kitob u yerda yotgan",
          'Dana kitobni yashirgan',
          "Kitob vulqonda yo'qolgan",
        ],
        evidencePassage: "Quti 17-mart kuni bo'shatilgan, shuning uchun skanerlanmagan kitob u yerda bir necha kun yotishi mumkin edi.",
      },
    },
  },
  ru: {
    title: 'Просроченная библиотечная книга',
    briefing:
      'Библиотека утверждает, что книга о вулканах просрочена на три дня и нужно ' +
      'заплатить штраф. Ученик говорит, что вернул её вовремя. Прочитай записи и ' +
      'реши, кто прав.',
    sources: {
      s1: {
        title: 'Запись о выдаче книги',
        body:
          'Книга: "Огненные горы"\nЧитатель: билет #2207\nВыдана: 2 марта\n' +
          'Срок возврата: 16 марта\nВозврат: не отмечен\nШтраф: 3 дня × 200 сум',
      },
      s2: {
        title: 'Письмо от читателя',
        body:
          'Тема: Я вернул книгу о вулканах!\n\n' +
          'Здравствуйте, думаю, тут ошибка. Я опустил "Огненные горы" в ящик возврата ' +
          '15 марта, за день до срока. Мой друг Дана видел это. ' +
          'Пожалуйста, проверьте ящик — возможно, её не отсканировали обратно.',
      },
      s3: {
        title: 'Чат с Даной',
        body:
          'Библиотекарь: Дана, ты видел, как вернули книгу о вулканах?\n' +
          'Дана: Да. Мы вошли вместе 15 марта, и я видел, как она попала в ящик возврата.\n' +
          'Библиотекарь: Ящик опустошали 17 марта, так что неотсканированная книга могла лежать там несколько дней.',
      },
    },
    questions: {
      q1: {
        prompt: 'Какого числа книгу нужно было вернуть?',
        choices: ['2 марта', '15 марта', '16 марта', '17 марта'],
        evidencePassage: 'Срок возврата: 16 марта',
      },
      q2: {
        prompt: 'Какого числа, по словам читателя, он её вернул?',
        choices: ['15 марта', '16 марта', '17 марта', '2 марта'],
        evidencePassage: '15 марта, за день до срока',
      },
      q3: {
        prompt:
          'Сравнивая запись о выдаче и письмо, была ли книга возвращена ДО срока?',
        choices: [
          'Нет — она опоздала на три дня',
          'Да — возвращена 15 марта, срок 16 марта',
          'Её вообще не брали',
          'Срок был 2 марта',
        ],
        evidencePassage: '15 марта, за день до срока',
      },
      q4: {
        prompt: 'Почему у библиотеки может не быть даты "Возврата", даже если книгу вернули вовремя?',
        choices: [
          'Читатель оставил её себе',
          'Ящик возврата опустошали только 17 марта, так что неотсканированная книга лежала там',
          'Дана спрятал книгу',
          'Книга потерялась в вулкане',
        ],
        evidencePassage: 'Ящик опустошали 17 марта, так что неотсканированная книга могла лежать там несколько дней.',
      },
    },
  },
};

export default case02L10n;
