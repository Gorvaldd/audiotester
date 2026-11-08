# B2 First — Listening Practice

Статический сайт для тренировки аудирования. Работает на GitHub Pages без сборки и сервера.

## Структура

```
index.html      ← страница сайта
app.js          ← логика (парсер txt, плееры, проверка)
style.css       ← оформление
tests/          ← по одному txt-файлу на тест: Test01.txt, Test02.txt, …
AUDIO/          ← mp3-файлы (имена должны совпадать с указанными в txt)
.nojekyll       ← чтобы GitHub Pages отдавал файлы как есть
```

## Деплой на GitHub Pages

1. Положите папку `AUDIO` со всеми mp3 рядом с `index.html`.
2. Создайте репозиторий и загрузите туда всё содержимое этой папки.
3. Откройте **Settings → Pages**, в поле **Source** выберите *Deploy from a branch*, затем ветку `main` и папку `/ (root)`.
4. Через минуту сайт будет доступен по адресу `https://<username>.github.io/<repo>/`.

> GitHub Pages различает регистр в именах: `AUDIO/Test01_Part01_Question_1.mp3` и `audio/test01_…` — это разные файлы.

## Как добавить новый тест

Создайте файл `tests/Test09.txt` (дальше `Test10.txt` и т. д.). Сайт найдёт его сам: он перебирает `Test01…Test99`. Если удалить один файл посередине, это не страшно.

### Формат файла

```
TITLE: Test 9
# AUDIO_FOLDER: AUDIO        ← необязательно, по умолчанию AUDIO

=== PART 1 ===
TYPE: choice                 ← choice | gap | match
INSTRUCTIONS: Текст задания…
AUDIO: Test09_Part01_Instructions.mp3 | Instructions     ← файл | подпись

--- 1                        ← номер вопроса
AUDIO: Test09_Part01_Question_1.mp3                      ← аудио только для этого вопроса
CONTEXT: You hear a woman recommending a campsite.
QUESTION: Why does she recommend it?
A: It's close to tourist attractions.
B: It's in an area of natural beauty.
C: It has a wide range of facilities.
ANSWER: B
```

Строки `AUDIO:` можно указывать на уровне части (под `=== PART ===`) и на уровне вопроса, сколько угодно раз. Строки, начинающиеся с `#`, — комментарии. Строка без ключа продолжает предыдущий текст.

**gap** — заполнение пропусков. Пропуск обозначается `___` (три и более подчёркивания):

```
=== PART 2 ===
TYPE: gap
HEADING: Sailing solo across the Atlantic
AUDIO: Test09_Part02_Questions.mp3 | Recording

--- 9
TEXT: Michael had to sail a total of ___ kilometres without any help.
ANSWER: 5,600 | five thousand six hundred

--- 18
TEXT: The aim is to study all the ___ and ___ living in Loch Ness.
ANSWER: plants
ANSWER: animals
ANY_ORDER: yes
```

Как проверяются ответы:
- `|` разделяет допустимые варианты;
- `(…)` — необязательная часть: `(large) ships` засчитывает и `ships`, и `large ships`, а `photo(graph)s` — и `photos`, и `photographs`;
- регистр, пробелы, дефисы и знаки препинания не учитываются (`sun-gun` = `sun gun` = `Sungun`);
- если в предложении несколько пропусков, на каждый пишется своя строка `ANSWER:`, а `ANY_ORDER: yes` разрешает вводить слова в любом порядке.

**match** — выбор буквы из списка. Варианты перечисляются на уровне части, до первого вопроса:

```
=== PART 3 ===
TYPE: match
A: It helped me to renew my enthusiasm for cooking.
B: …
H: …

--- 19
QUESTION: Speaker 1
ANSWER: C
```

## Прогресс

Ответы и результаты хранятся в браузере (localStorage), поэтому после перезагрузки страницы ничего не теряется. Кнопка «Пройти заново» очищает данные теста.
