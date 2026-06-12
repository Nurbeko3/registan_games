/** case05 "The Locked Clubroom" — uz/ru display translations. */

import type { CaseTranslations } from './types';

const case05L10n: CaseTranslations = {
  uz: {
    title: "Qulflanmagan to'garak xonasi",
    briefing:
      "Kimdir shaxmat to'garagi xonasini tunda qulflamay qoldirdi va zaxira kalit " +
      "yo'qolgan. Uch a'zoda kalit bor edi. Jurnallarni o'qing va xonada eng oxirgi " +
      "kim bo'lganini aniqlang.",
    sources: {
      s1: {
        title: "Eshik ro'yxatga olish varaqasi",
        body:
          "Eng OXIRI ketgan kishi vaqtni yozib, eshikni qulflashi shart.\n" +
          'Dush 17:10 — Aziza (kirdi)\n' +
          'Dush 17:45 — Bek (kirdi)\n' +
          'Dush 18:30 — Aziza CHIQDI\n' +
          'Dush 18:55 — Bek CHIQDI\n' +
          '(18:55 dan keyin chiqish yozuvi yo\'q.)',
      },
      s2: {
        title: "O'sha kechagi to'garak chati",
        body:
          'Aziza: Men yarim oltida ketdim, Bek sen hali u yerda eding.\n' +
          'Bek: Men yettiga oz qolganda ketdim. Men chiqayotganimda Karl kirib keldi.\n' +
          'Karl: Ha, Bek ketgach kurtkamni olish uchun kirib o\'tdim.\n' +
          'Aziza: Karl, varaqani imzoladingmi?\n' +
          'Karl: ...imzolashni unutibman.',
      },
      s3: {
        title: 'Kalit egalari',
        body:
          "To'garak xonasi kaliti bor odamlar: Aziza, Bek, Karl.\n" +
          'Qoida: xonada eng OXIRGI odam eshikni qulflash uchun javobgar.\n' +
          'Zaxira kalit odatda xona ichidagi ilgakda osilib turadi.',
      },
    },
    questions: {
      q1: {
        prompt: "Ro'yxatga olish varaqasiga ko'ra, eng oxiri kim CHIQQAN?",
        choices: ['Aziza', 'Bek', 'Karl', 'Hech kim kirmagan'],
        evidencePassage: 'Dush 18:55 — Bek CHIQDI',
      },
      q2: {
        prompt: 'Chatda Bek chiqayotganda xonaga kim kirdi?',
        choices: ['Aziza', 'Dana', 'Karl', 'Murabbiy'],
        evidencePassage: 'Men chiqayotganimda Karl kirib keldi.',
      },
      q3: {
        prompt:
          'Varaqa Bekni oxiri chiqqan deb ko\'rsatadi, lekin chat Bekdan KEYIN kimdir kirganini aytadi. Aslida oxirgi marta xonada kim bo\'lgan?',
        choices: ['Aziza', 'Bek', 'Karl', 'Hech kim'],
        evidencePassage: "Bek ketgach kurtkamni olish uchun kirib o'tdim.",
      },
      q4: {
        prompt:
          "Uchala manbadan foydalanib, eshikni qulflash uchun kim javobgar edi — va nega varaqa chalg'ituvchi?",
        choices: [
          'Bek, chunki u oxiri chiqib ketgan',
          'Aziza, chunki u birinchi ketgan',
          'Karl, chunki u oxirgi marta ichkarida edi, lekin varaqani imzolamagan',
          "Hech kim, eshik o'zi qulflanadi",
        ],
        evidencePassage: '...imzolashni unutibman.',
      },
    },
  },
  ru: {
    title: 'Незапертая клубная комната',
    briefing:
      'Кто-то оставил комнату шахматного клуба незапертой на ночь, и запасной ключ ' +
      'пропал. Ключ был у троих участников. Прочитай записи и выясни, кто был внутри ' +
      'последним.',
    sources: {
      s1: {
        title: 'Лист отметок у двери',
        body:
          'Кто уходит ПОСЛЕДНИМ, должен записать время и запереть дверь.\n' +
          'Пн 17:10 — Азиза (вошла)\n' +
          'Пн 17:45 — Бек (вошёл)\n' +
          'Пн 18:30 — Азиза ВЫШЛА\n' +
          'Пн 18:55 — Бек ВЫШЕЛ\n' +
          '(После 18:55 отметок о выходе нет.)',
      },
      s2: {
        title: 'Чат клуба в тот вечер',
        body:
          'Азиза: Я ушла в полседьмого, Бек, ты ещё был там.\n' +
          'Бек: Я ушёл около семи. Карл вошёл как раз когда я уходил.\n' +
          'Карл: Да, я заглянул после ухода Бека, чтобы забрать куртку.\n' +
          'Азиза: Карл, ты расписался в листе?\n' +
          'Карл: ...я забыл.',
      },
      s3: {
        title: 'Владельцы ключей',
        body:
          'Люди с ключом от клубной комнаты: Азиза, Бек, Карл.\n' +
          'Правило: ПОСЛЕДНИЙ человек внутри отвечает за то, чтобы запереть дверь.\n' +
          'Запасной ключ обычно висит на крючке внутри комнаты.',
      },
    },
    questions: {
      q1: {
        prompt: 'Согласно листу отметок, кто ВЫШЕЛ последним?',
        choices: ['Азиза', 'Бек', 'Карл', 'Никто не входил'],
        evidencePassage: 'Пн 18:55 — Бек ВЫШЕЛ',
      },
      q2: {
        prompt: 'В чате — кто вошёл в комнату, когда Бек уходил?',
        choices: ['Азиза', 'Дана', 'Карл', 'Тренер'],
        evidencePassage: 'Карл вошёл как раз когда я уходил.',
      },
      q3: {
        prompt:
          'Лист показывает Бека последним вышедшим, но чат говорит, что кто-то вошёл ПОСЛЕ Бека. Кто на самом деле был внутри последним?',
        choices: ['Азиза', 'Бек', 'Карл', 'Никто'],
        evidencePassage: 'я заглянул после ухода Бека, чтобы забрать куртку',
      },
      q4: {
        prompt:
          'Используя все три источника, кто отвечал за то, чтобы запереть дверь — и почему лист вводит в заблуждение?',
        choices: [
          'Бек, потому что вышел последним по листу',
          'Азиза, потому что ушла первой',
          'Карл, потому что был внутри последним, но не расписался в листе',
          'Никто, дверь запирается сама',
        ],
        evidencePassage: '...я забыл.',
      },
    },
  },
};

export default case05L10n;
