/** case03 "The Postcard That Lied" — uz/ru display translations. */

import type { CaseTranslations } from './types';

const case03L10n: CaseTranslations = {
  uz: {
    title: "Yolg'on aytgan otkritka",
    briefing:
      "Muzey shahar soat minorasini \"butunlay yangi\" deb atagan eski otkritkani topdi. " +
      "Lekin u aslida qachon yozilgan? Boshqa yozuvlardan foydalanib, uni vaqt bo'yicha " +
      'joylashtiring.',
    sources: {
      s1: {
        title: 'Otkritka',
        body:
          "Rivertowndan salom! Bizning butunlay yangi soat minoramiz o'tgan oyda tugadi va " +
          'hamma uning jiringlashini eshitish uchun yig\'ildi. Buni yangi temir yo\'l ' +
          "vokzalidan jo'natdim. Koshki shu yerda bo'lsang! — T.",
      },
      s2: {
        title: 'Muzey xronologiya kartasi',
        body:
          "Rivertown muhim sanalari (to'qima):\n" +
          "• Soat minorasi tugatilgan: 1908 bahor\n" +
          "• Temir yo'l vokzali ochilgan: 1911\n" +
          '• Buyuk toshqin: 1925',
      },
      s3: {
        title: 'Kurator yozuvlari',
        body:
          'Mavzu: otkritka sanasini aniqlash\n\n' +
          "Yozuvchi uni temir yo'l vokzalidan jo'natganini eslatadi, vokzal esa 1911-yilgacha " +
          'mavjud emas edi. Demak, otkritka soat minorasini "butunlay yangi" desa-da, u ' +
          '1908-yilda yozilgan bo\'lishi mumkin emas. Vokzal sanasiga ishoning.',
      },
    },
    questions: {
      q1: {
        prompt: 'Xronologiya kartasiga ko\'ra, temir yo\'l vokzali qachon ochilgan?',
        choices: ['1908', '1911', '1925', "o'tgan oy"],
        evidencePassage: "Temir yo'l vokzali ochilgan: 1911",
      },
      q2: {
        prompt: "Otkritka yozuvchisi uni qayerdan jo'natganini aytadi?",
        choices: ['Soat minorasidan', "Yangi temir yo'l vokzalidan", 'Muzeydan', 'Daryodan'],
        evidencePassage: "Buni yangi temir yo'l vokzalidan jo'natdim.",
      },
      q3: {
        prompt:
          'Otkritka va xronologiyani birlashtirib, otkritka qaysi yildan oldin yozilgan BO\'LISHI MUMKIN EMAS?',
        choices: ['1908', '1911', '1925', '1900'],
        evidencePassage: "Temir yo'l vokzali ochilgan: 1911",
      },
      q4: {
        prompt: 'Nega otkritka soat minorasini "butunlay yangi" deb atashi xato?',
        choices: [
          "Minora umuman qurilmagan",
          'Vokzal 1911-yilda, minora 1908-yilda tugaganidan bir necha yil keyin ochilgan',
          'Toshqin uni vayron qilgan',
          "Yozuvchi shaharni o'ylab topgan",
        ],
        evidencePassage: 'vokzal esa 1911-yilgacha mavjud emas edi',
      },
    },
  },
  ru: {
    title: 'Открытка, которая солгала',
    briefing:
      'Музей нашёл старую открытку, где городская часовая башня названа "совершенно новой". ' +
      'Но когда её написали на самом деле? Используй другие записи, чтобы определить время.',
    sources: {
      s1: {
        title: 'Открытка',
        body:
          'Привет из Ривертауна! Наша совершенно новая часовая башня была достроена в прошлом ' +
          'месяце, и все собрались послушать её бой. Отправляю это с нового железнодорожного ' +
          'вокзала. Жаль, что тебя здесь нет! — Т.',
      },
      s2: {
        title: 'Карточка хронологии музея',
        body:
          'Ключевые даты Ривертауна (вымысел):\n' +
          '• Часовая башня достроена: весна 1908\n' +
          '• Железнодорожный вокзал открыт: 1911\n' +
          '• Великое наводнение: 1925',
      },
      s3: {
        title: 'Заметки куратора',
        body:
          'Тема: датировка открытки\n\n' +
          'Автор упоминает, что отправил её С железнодорожного вокзала, а вокзал не существовал ' +
          'до 1911 года. Поэтому, хотя открытка называет башню "совершенно новой", она не могла ' +
          'быть написана в 1908 году. Доверяй дате вокзала.',
      },
    },
    questions: {
      q1: {
        prompt: 'Согласно карточке хронологии, когда открылся железнодорожный вокзал?',
        choices: ['1908', '1911', '1925', 'в прошлом месяце'],
        evidencePassage: 'Железнодорожный вокзал открыт: 1911',
      },
      q2: {
        prompt: 'Откуда, по словам автора открытки, он её отправил?',
        choices: ['С часовой башни', 'С нового железнодорожного вокзала', 'Из музея', 'С реки'],
        evidencePassage: 'Отправляю это с нового железнодорожного вокзала.',
      },
      q3: {
        prompt:
          'Объединяя открытку и хронологию, раньше какого года открытка НЕ могла быть написана?',
        choices: ['1908', '1911', '1925', '1900'],
        evidencePassage: 'Железнодорожный вокзал открыт: 1911',
      },
      q4: {
        prompt: 'Почему открытка ошибается, называя башню "совершенно новой"?',
        choices: [
          'Башню вообще не строили',
          'Вокзал открылся в 1911, спустя годы после постройки башни в 1908',
          'Наводнение её разрушило',
          'Автор выдумал город',
        ],
        evidencePassage: 'вокзал не существовал до 1911 года',
      },
    },
  },
};

export default case03L10n;
