// Interface language: English (default) and Ukrainian.
//
//   t('plan.run')                       -> 'Run Shift' / 'Запустити зміну'
//   t('hud.shift', { n: 2, total: 4 })  -> templates with {params}
//   missionText(mission, 'title')       -> English comes from missions.js, Ukrainian from here
//   moduleText(key, 'name')
//   feedbackText(message)               -> translates simulation messages (English source strings)
//   setLanguage('uk'); onLanguageChange(cb); getLanguage()
//
// English strings for missions, modules and simulation reports stay in missions.js /
// simulation.js (unchanged). NASA and Opportunity are kept as names.

const STORAGE_KEY = 'jamt-language';
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Українська' },
];

const en = {
  'app.title': 'Junior Astronaut Mission Trainer',
  'intro.tagline': 'Train on the Moon and Mars. Bring your skills back to Earth.',
  'intro.start': 'Start Training',

  'hud.tablet': 'Tablet',
  'hud.tabletLabel': 'Mission Tablet (T)',
  'hud.settings': 'Settings',
  'hud.shift': 'Shift {n} / {total}',
  'hud.complete': 'Complete',
  'hud.review': 'Review',
  'hud.openResults': 'Open the tablet to see what happened.',
  'hud.trainingComplete': 'Training Complete',
  'hud.openFinal': 'Open the tablet to see your results.',
  'hud.selected': 'Selected: {list} · open the tablet to run the shift',
  'hud.help': 'WASD to move · Hold LMB to look · Click a module to pick it · T for tablet',
  'hud.helpMoon': 'WASD to move · Space to jump · Hold LMB to look · Click a module to pick it · T for tablet',
  'scene.label': 'First-person base. W A S D to move, Space to jump on the Moon, hold the left mouse button and drag to look, arrow keys to look, E to select the module in the centre, T for the tablet.',
  'scene.unavailable': 'The 3D view is unavailable. Use the Mission Tablet to plan each shift.',

  'tablet.label': 'Mission Tablet',
  'tablet.back': 'Back to Base',
  'tablet.idleTitle': 'MISSION TABLET',
  'tablet.idleStatus': 'Base link ready',
  'tablet.unit': 'FIELD UNIT 01',

  'warmup.title': 'Before you launch',
  'warmup.sub': 'Warm-up · no hints, just your best plan',
  'warmup.lead': 'You have 6 battery units. String lights cost 3 now. Your weather radio needs 4 tonight.',
  'warmup.q1': 'What would you do?',
  'warmup.save': 'Save the battery for tonight',
  'warmup.spend': 'Turn on the string lights now',
  'warmup.q2': 'Why?',
  'warmup.later': 'The radio needs enough energy later',
  'warmup.now': 'The lights can use the energy right now',
  'warmup.begin': 'Begin Moon Mission',

  'plan.shiftOf': 'Shift {n} of {total}',
  'plan.lastShift': 'What changed last shift',
  'plan.title': 'Plan this shift',
  'plan.energy': 'Energy: {n}',
  'plan.planned': 'Planned: {n}',
  'plan.batteryAfter': 'Battery after shift: {n}',
  'plan.air': 'Air: {n}',
  'plan.water': 'Water: {n}',
  'plan.samples': 'Samples: {n}',
  'plan.food': 'Food: {n}',
  'plan.growth': 'Crop growth: {n}/2',
  'plan.harvests': 'Harvests: {n}',
  'plan.cost': '{n} energy',
  'plan.unavailable': 'Unavailable this shift.',
  'plan.selected': 'Selected',
  'plan.warning': 'Your plan needs more energy than you have.',
  'plan.hintButton': 'Get a Hint',
  'plan.hint': 'The pump needs 5 energy after sunset. Check how much you can keep in the battery.',
  'plan.run': 'Run Shift',

  'predict.label': 'Predict the battery after this shift',
  'predict.notSet': 'Not set',
  'predict.optional': 'Optional',
  'predict.zero': '0 · Empty battery',
  'predict.choose': 'Choose {n}',
  'predict.valueText': '{n} energy',
  'predict.unit': 'energy',
  'predict.emptyUnit': 'empty battery',
  'predict.help': 'Drag the slider or use the arrow keys.',

  'science.summary': 'How NASA data shapes this mission',
  'science.link': 'Read the NASA/JPL mission update',

  'result.won': 'Mission Complete',
  'result.review': 'Review Your Plan',
  'result.happened': 'What happened',
  'result.next': 'Next Mission',
  'result.retry': 'Retry Mission',
  'earth.question': 'Why was it important to save energy before sunset?',
  'earth.answerPump': 'The pump would need power after sunset.',
  'earth.answerLab': 'The lab needed all of the power right away.',

  'complete.title': 'Training Complete',
  'complete.sub': 'You kept the Earth station running by planning ahead.',
  'complete.scores': 'Before training: {b} / 2 · First Earth attempt: {f} / 2 · Final Earth attempt: {e} / 2',
  'complete.hints': 'Earth hints: {h} · Earth retries: {r}',
  'complete.home': 'Try it at home',
  'complete.homeText': 'With a grown-up, make a plan for a power outage. Decide when you would need a flashlight and a charged phone. What should you keep in reserve?',
  'complete.again': 'Play Again',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.close': 'Close',

  'map.lifeSupport': 'LIFE SUPPORT',
  'map.scienceLab': 'SCIENCE LAB',
  'map.solarArray': 'SOLAR ARRAY',
  'map.solarOutput': 'Solar output',
  'map.inSunlight': 'In sunlight',
  'map.inShadow': 'In shadow',
  'map.selected': 'Selected',

  'feedback.prediction': 'You predicted {p} energy. Your battery now has {b}.',
};

const uk = {
  'app.title': 'Тренажер юного астронавта',
  'intro.tagline': 'Тренуйся на Місяці й Марсі. Повертай навички на Землю.',
  'intro.start': 'Почати тренування',

  'hud.tablet': 'Планшет',
  'hud.tabletLabel': 'Планшет місії (T)',
  'hud.settings': 'Налаштування',
  'hud.shift': 'Зміна {n} / {total}',
  'hud.complete': 'Виконано',
  'hud.review': 'Перегляд',
  'hud.openResults': 'Відкрий планшет, щоб побачити, що сталося.',
  'hud.trainingComplete': 'Тренування завершено',
  'hud.openFinal': 'Відкрий планшет, щоб побачити результати.',
  'hud.selected': 'Вибрано: {list} · відкрий планшет, щоб запустити зміну',
  'hud.help': 'WASD — рух · Затисни ЛКМ — огляд · Клік по модулю — вибір · T — планшет',
  'hud.helpMoon': 'WASD — рух · Пробіл — стрибок · Затисни ЛКМ — огляд · Клік по модулю — вибір · T — планшет',
  'scene.label': 'База від першої особи. W A S D — рух, пробіл — стрибок на Місяці, затисни ліву кнопку миші й веди, щоб оглянутися, стрілки — огляд, E — вибрати модуль у центрі, T — планшет.',
  'scene.unavailable': '3D-вигляд недоступний. Плануй кожну зміну на планшеті місії.',

  'tablet.label': 'Планшет місії',
  'tablet.back': 'Назад на базу',
  'tablet.idleTitle': 'ПЛАНШЕТ МІСІЇ',
  'tablet.idleStatus': 'Зв’язок із базою є',
  'tablet.unit': 'ПОЛЬОВИЙ БЛОК 01',

  'warmup.title': 'Перед стартом',
  'warmup.sub': 'Розминка · без підказок, просто твій найкращий план',
  'warmup.lead': 'У тебе 6 одиниць заряду. Гірлянда зараз забере 3. Метеорадіо сьогодні вночі потребує 4.',
  'warmup.q1': 'Що ти зробиш?',
  'warmup.save': 'Збережу заряд на ніч',
  'warmup.spend': 'Увімкну гірлянду зараз',
  'warmup.q2': 'Чому?',
  'warmup.later': 'Згодом радіо знадобиться достатньо енергії',
  'warmup.now': 'Гірлянда може використати енергію просто зараз',
  'warmup.begin': 'Почати місію на Місяці',

  'plan.shiftOf': 'Зміна {n} з {total}',
  'plan.lastShift': 'Що змінилося за минулу зміну',
  'plan.title': 'Сплануй цю зміну',
  'plan.energy': 'Енергія: {n}',
  'plan.planned': 'Заплановано: {n}',
  'plan.batteryAfter': 'Заряд після зміни: {n}',
  'plan.air': 'Повітря: {n}',
  'plan.water': 'Вода: {n}',
  'plan.samples': 'Зразки: {n}',
  'plan.food': 'Їжа: {n}',
  'plan.growth': 'Ріст урожаю: {n}/2',
  'plan.harvests': 'Урожаї: {n}',
  'plan.cost': '{n} од. енергії',
  'plan.unavailable': 'Недоступно в цю зміну.',
  'plan.selected': 'Вибрано',
  'plan.warning': 'Твоєму плану потрібно більше енергії, ніж у тебе є.',
  'plan.hintButton': 'Отримати підказку',
  'plan.hint': 'Після заходу сонця насосу потрібно 5 од. енергії. Перевір, скільки можна залишити в батареї.',
  'plan.run': 'Запустити зміну',

  'predict.label': 'Спрогнозуй заряд батареї після цієї зміни',
  'predict.notSet': 'Не вибрано',
  'predict.optional': 'Необов’язково',
  'predict.zero': '0 · Батарея розряджена',
  'predict.choose': 'Вибрати {n}',
  'predict.valueText': '{n} од. енергії',
  'predict.unit': 'од. енергії',
  'predict.emptyUnit': 'батарея розряджена',
  'predict.help': 'Перетягни повзунок або натискай стрілки.',

  'science.summary': 'Як дані NASA формують цю місію',
  'science.link': 'Читати оновлення місії NASA/JPL',

  'result.won': 'Місію виконано',
  'result.review': 'Переглянь свій план',
  'result.happened': 'Що сталося',
  'result.next': 'Наступна місія',
  'result.retry': 'Повторити місію',
  'earth.question': 'Чому було важливо зберегти енергію до заходу сонця?',
  'earth.answerPump': 'Після заходу сонця насосу знадобиться живлення.',
  'earth.answerLab': 'Лабораторії була потрібна вся енергія одразу.',

  'complete.title': 'Тренування завершено',
  'complete.sub': 'Завдяки плануванню наперед земна станція продовжила працювати.',
  'complete.scores': 'До тренування: {b} / 2 · Перша спроба на Землі: {f} / 2 · Остання спроба на Землі: {e} / 2',
  'complete.hints': 'Підказки на Землі: {h} · Повтори на Землі: {r}',
  'complete.home': 'Спробуй удома',
  'complete.homeText': 'Разом із дорослим склади план на випадок, якщо вимкнуть світло. Виріши, коли знадобляться ліхтарик і заряджений телефон. Що варто тримати в резерві?',
  'complete.again': 'Грати знову',

  'settings.title': 'Налаштування',
  'settings.language': 'Мова',
  'settings.close': 'Закрити',

  'map.lifeSupport': 'ЖИТТЄЗАБЕЗПЕЧЕННЯ',
  'map.scienceLab': 'ЛАБОРАТОРІЯ',
  'map.solarArray': 'СОНЯЧНІ ПАНЕЛІ',
  'map.solarOutput': 'Сонячна енергія',
  'map.inSunlight': 'На сонці',
  'map.inShadow': 'У тіні',
  'map.selected': 'Вибрано',

  'feedback.prediction': 'Твій прогноз: {p} од. енергії. Зараз у батареї {b}.',
};

// Mission + module texts in Ukrainian (English source: missions.js).
const ukMissions = {
  moon: {
    title: 'Місяць · Довга тінь',
    objective: 'Збережи екіпаж у безпеці й проаналізуй два зразки за чотири зміни. Запас повітря малий.',
    forecast: [
      'Панелі на сонці. Наступної зміни їх затінить гребінь.',
      'Панелі в тіні. Батарея — єдине джерело живлення.',
      'Панелі знову на сонці.',
      'Панелі все ще на сонці. Заверши наукову роботу.',
    ],
  },
  mars: {
    title: 'Марс · Пил на обрії',
    objective: 'Збережи екіпаж у безпеці, вирости один урожай і проаналізуй два зразки.',
    forecast: [
      'Наближається пилова буря. Це найкраща нагода запасти енергію.',
      'Пил закриває більшу частину сонячного світла. Наступної зміни очікується радіаційна тривога.',
      'Сонячної енергії все ще мало. Через окрему радіаційну тривогу екіпажу треба в укриття.',
      'Небо трохи світлішає. Сонячної енергії все ще менше за норму.',
    ],
    science: 'Під час пилової бурі 2007 року марсохід NASA Opportunity отримував понад 700 ват-годин за марсіанську добу, а потім лише 128. Згодом показник зріс до 243. Ця тренувальна місія перетворює ці дані на ігрову енергію й утримує найнижчий рівень дві зміни.',
  },
  earth: {
    title: 'Земля · Насос напоготові',
    objective: 'Збережи достатньо енергії, щоб увімкнути зрошувальний насос, коли він знадобиться.',
    forecast: [
      'На станції 7 од. енергії. Лабораторія може працювати зараз, а теплиці потрібна вода після заходу сонця.',
      'Електромережа досі не працює. Увімкни зрошувальний насос, щоб полити теплицю.',
    ],
  },
};
const ukModules = {
  crew: { name: 'Життєзабезпечення', description: 'Дає повітря й відновлює воду.' },
  lab: { name: 'Наукова лабораторія', description: 'Аналізує один зразок.' },
  greenhouse: { name: 'Теплиця', description: 'Витрачає 1 воду на ріст урожаю. Потрібно дві зміни росту.' },
  shelter: { name: 'Укриття', description: 'Переводить екіпаж усередину й живить вентиляцію укриття.' },
  pump: { name: 'Зрошувальний насос', description: 'Поливає рослини після заходу сонця.' },
};

// Simulation reports: English source -> Ukrainian template. {n} captures numbers.
const ukFeedback = [
  [/^You stored (\d+) energy for the next shift\.$/, 'У батареї залишилось {1} од. енергії на наступну зміну.'],
  [/^Life support restored air and recovered water\.$/, 'Життєзабезпечення відновило повітря й воду.'],
  [/^The crew used emergency air and water\.$/, 'Екіпаж використав аварійний запас повітря й води.'],
  [/^The crew stayed protected in the shelter\.$/, 'Екіпаж перечекав в укритті й був у безпеці.'],
  [/^The crew missed the shelter during the radiation alert\.$/, 'Під час радіаційної тривоги екіпаж не перейшов в укриття.'],
  [/^The crop is ready\. You added (\d+) food to the supply\.$/, 'Урожай дозрів. До запасів додано {1} од. їжі.'],
  [/^The crop grew\. One more growing shift will finish it\.$/, 'Урожай підріс. Ще одна зміна росту — і він дозріє.'],
  [/^The greenhouse had no water\. The crop did not grow\.$/, 'У теплиці не було води. Урожай не виріс.'],
  [/^The crew ate (\d+) food\.$/, 'Екіпаж з’їв {1} од. їжі.'],
  [/^The lab analyzed a sample\.$/, 'Лабораторія проаналізувала зразок.'],
  [/^The pump used the reserve to water the plants after sunset\.$/, 'Насос використав запас енергії й полив рослини після заходу сонця.'],
  [/^The crew needs a safer plan\. Review this shift and try again\.$/, 'Екіпажу потрібен безпечніший план. Переглянь цю зміну й спробуй ще раз.'],
  [/^The pump needed (\d+) energy after sunset\.$/, 'Після заходу сонця насосу було потрібно {1} од. енергії.'],
  [/^The mission ended before you reached the science or harvest goal\.$/, 'Місія закінчилася до того, як було досягнуто наукової мети чи мети врожаю.'],
  [/^You predicted (\d+) energy\. Your battery now has (\d+)\.$/, 'Твій прогноз: {1} од. енергії. Зараз у батареї {2}.'],
];

const dictionaries = { en, uk };
let current = 'en';
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && dictionaries[saved]) current = saved;
} catch { /* storage unavailable: stay in English */ }
const listeners = new Set();

function fill(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m));
}

export function t(key, params) {
  const s = dictionaries[current][key] ?? en[key] ?? key;
  return fill(s, params);
}

export function getLanguage() { return current; }

export function setLanguage(code) {
  if (!dictionaries[code] || code === current) return;
  current = code;
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.lang = code;
  listeners.forEach((cb) => cb(code));
}

export function onLanguageChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }

export function missionText(mission, field, index) {
  if (current === 'uk') {
    const m = ukMissions[mission.id];
    if (field === 'forecast') return m?.forecast?.[index] ?? mission.forecast[index];
    if (field === 'science') return m?.science ?? mission.science?.description;
    return m?.[field] ?? mission[field];
  }
  if (field === 'forecast') return mission.forecast[index];
  if (field === 'science') return mission.science?.description;
  return mission[field];
}

export function moduleText(modules, key, field) {
  if (current === 'uk') return ukModules[key]?.[field] ?? modules[key][field];
  return modules[key][field];
}

export function feedbackText(message) {
  if (current !== 'uk') return message;
  for (const [re, tpl] of ukFeedback) {
    const m = message.match(re);
    if (m) return tpl.replace(/\{(\d)\}/g, (_, i) => m[Number(i)]);
  }
  return message; // unknown message: show the original rather than nothing
}

// For tests: every English report the simulation can produce has a translation.
export const FEEDBACK_PATTERNS = ukFeedback.map(([re]) => re);

if (typeof document !== 'undefined') document.documentElement.lang = current;
