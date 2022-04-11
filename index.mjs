#!/usr/bin/env node

import { cwd } from "process";
import * as fsp from "fs/promises";
import fs from "fs";
import path from "path";
import child_process from "child_process";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const CURRENT_DIR = cwd();

const ALLOWED_EXT = ["tsx", "ts", "js", "jsx", "py", "mjs", "php"];

const IGNORED_DIR = ["node_modules", ".git", "vendor", ".idea"];

const outputFile = `${CURRENT_DIR}/listing${Date.now()}.html`;

const writableFile = fs.createWriteStream(outputFile);

// Получаем список файлов и папок по указанному пути
const getList = async (route = CURRENT_DIR) => await fsp.readdir(route, { withFileTypes: true });

// Проверяем подходит ли расширение
const getExt = (filename) => path.extname(filename).slice(1);

const isAllowed = (filename) => ALLOWED_EXT.includes(getExt(filename));

// Декодируем html теги
const encodeHTML = (code) => {
  return String(code)
    .replace(/&/g, `&amp;`)
    .replace(/>/g, `&gt;`)
    .replace(/</g, `&lt;`)
    .replace(/"/g, `&quot;`);
};

// Парсим дерево директорий
const parseTree = async (route = CURRENT_DIR) => {
  const tree = await getList(route);

  // Убираем лишнее
  const filteredTree = tree
    .filter((file) => !IGNORED_DIR.includes(file.name))
    .filter((file) => isAllowed(file.name) || file.isDirectory());

  for (const file of filteredTree) {
    // Получаем абсолютный путь
    const absPath = `${route}/${file.name}`;

    // Если файл - записываем
    if (file.isFile()) {
      const openedFile = await fsp.readFile(absPath);
      const code = openedFile.toString();
      const lines = code.split("\n");

      // Вставляем номер строки кода
      const linesArray = lines.map(
        (line, num) => `${(num + 1).toString().padStart(4, " ")}  ${encodeHTML(line)}`
      );

      const resultLines = linesArray.join("\n");

      writableFile.write(`<section><h5>${file.name}</h5>`);
      writableFile.write(
        `<pre><code class="language-${getExt(file.name)}">${resultLines}</code></pre></section>`
      );
    } else {
      // Если директория - проваливаемся
      await parseTree(absPath);
    }
  }
};

(async () => {
  // Получаем шаблоны
  const header = await fsp.readFile(path.join(__dirname, `/header.html`));
  const footer = await fsp.readFile(path.join(__dirname, `/footer.html`));

  // Записываем шапку документа
  writableFile.write(header.toString().replace("{LISTING_NAME}", path.basename(CURRENT_DIR)));
  writableFile.write("<h1>Программа для ЭВМ</h1>");

  // Парсим дерево исходников
  await parseTree();

  // Записываем подвал
  writableFile.write(footer.toString());

  // Завершаем запись и открываем результат в браузере
  writableFile.end(() => {
    child_process.exec(`open ${outputFile}`);
  });
})();
