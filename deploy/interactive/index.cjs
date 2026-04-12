#!/usr/bin/env node

const readline = require('readline');
const { Writable } = require('stream');

const mode = process.argv[2];

function fail(message, code = 1) {
  if (message) process.stderr.write(`${message}\n`);
  process.exit(code);
}

function assertInteractive() {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    fail('当前环境不支持交互式菜单，请在本地终端中运行。', 2);
  }
}

function parseChoices(raw) {
  if (!raw) return [];
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [value = '', name = '', checked = '', disabled = ''] = line.split('\t');
      return {
        value,
        name: name || value,
        checked: checked === '1' || checked === 'true',
        disabled: disabled === '1' || disabled === 'true',
      };
    });
}

function createMaskedOutput() {
  let muted = false;
  return {
    stream: new Writable({
      write(chunk, encoding, callback) {
        if (!muted) {
          process.stderr.write(chunk, encoding, callback);
          return;
        }
        callback();
      },
    }),
    setMuted(value) {
      muted = value;
    },
  };
}

function nextEnabledIndex(choices, startIndex, delta) {
  let index = startIndex;
  for (let count = 0; count < choices.length; count += 1) {
    index = (index + delta + choices.length) % choices.length;
    if (!choices[index].disabled) return index;
  }
  return startIndex;
}

function renderOptionLine(choice, index, cursor, multi, selected) {
  const pointer = index === cursor ? '›' : ' ';
  const marker = multi ? `[${selected.has(choice.value) ? 'x' : ' '}] ` : '';
  const suffix = choice.disabled ? ' (不可选)' : '';
  return `${pointer} ${marker}${choice.name}${suffix}`;
}

function rewriteOptionLine(lineOffsetFromBottom, content) {
  readline.moveCursor(process.stderr, 0, -lineOffsetFromBottom);
  readline.cursorTo(process.stderr, 0);
  readline.clearLine(process.stderr, 0);
  process.stderr.write(content);
  readline.cursorTo(process.stderr, 0);
  readline.moveCursor(process.stderr, 0, lineOffsetFromBottom);
}

async function promptInput({ message, defaultValue = '', password = false }) {
  assertInteractive();
  const output = password ? createMaskedOutput() : { stream: process.stderr, setMuted() {} };
  const rl = readline.createInterface({
    input: process.stdin,
    output: output.stream,
    terminal: true,
  });

  return new Promise((resolve, reject) => {
    const suffix = defaultValue ? ` (${defaultValue})` : '';
    const promptText = `${message}${suffix}: `;
    rl.question(promptText, (answer) => {
      rl.close();
      process.stderr.write('\n');
      resolve(answer || defaultValue);
    });

    if (password) output.setMuted(true);

    rl.on('SIGINT', () => {
      rl.close();
      reject(Object.assign(new Error('cancelled'), { cancelled: true }));
    });
  });
}

async function promptSelection({ message, choices, multi = false, defaultValue }) {
  assertInteractive();
  if (!choices.length) fail('交互选项不能为空。', 1);

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  let cursor = Math.max(
    0,
    choices.findIndex((choice) =>
      multi
        ? Array.isArray(defaultValue) && defaultValue.includes(choice.value)
        : choice.value === defaultValue
    )
  );
  if (choices[cursor] && choices[cursor].disabled) {
    cursor = nextEnabledIndex(choices, cursor, 1);
  }

  const selected = new Set(
    multi
      ? [
          ...choices.filter((choice) => choice.checked).map((choice) => choice.value),
          ...(Array.isArray(defaultValue) ? defaultValue : []),
        ]
      : []
  );

  let hasRendered = false;

  const renderInitial = () => {
    const hints = multi
      ? '上下切换，空格选择，回车确认，Ctrl+C 取消'
      : '上下切换，回车确认，Ctrl+C 取消';
    const lines = [
      message,
      hints,
      '',
      ...choices.map((choice, index) => renderOptionLine(choice, index, cursor, multi, selected)),
    ];
    process.stderr.write(lines.join('\n'));
    process.stderr.write('\n');
    hasRendered = true;
  };

  const cleanup = () => {
    process.stdin.removeListener('keypress', onKeypress);
    process.stdin.setRawMode(false);
    process.stdin.pause();
    if (hasRendered) {
      readline.moveCursor(process.stderr, 0, -1);
      readline.clearLine(process.stderr, 0);
      readline.cursorTo(process.stderr, 0);
      process.stderr.write('\n');
    }
  };

  const refreshCursorLines = (previousCursor) => {
    const totalOptions = choices.length;
    const previousOffset = totalOptions - previousCursor;
    const currentOffset = totalOptions - cursor;

    rewriteOptionLine(
      previousOffset,
      renderOptionLine(choices[previousCursor], previousCursor, cursor, multi, selected)
    );

    if (currentOffset !== previousOffset) {
      rewriteOptionLine(
        currentOffset,
        renderOptionLine(choices[cursor], cursor, cursor, multi, selected)
      );
    }
  };

  const onKeypress = (_, key = {}) => {
    if (key.ctrl && key.name === 'c') {
      cleanup();
      process.exit(130);
    }

    if (key.name === 'up' || key.name === 'k') {
      const previousCursor = cursor;
      cursor = nextEnabledIndex(choices, cursor, -1);
      refreshCursorLines(previousCursor);
      return;
    }

    if (key.name === 'down' || key.name === 'j') {
      const previousCursor = cursor;
      cursor = nextEnabledIndex(choices, cursor, 1);
      refreshCursorLines(previousCursor);
      return;
    }

    if (multi && key.name === 'space') {
      const current = choices[cursor];
      if (!current.disabled) {
        if (selected.has(current.value)) selected.delete(current.value);
        else selected.add(current.value);
      }
      const currentOffset = choices.length - cursor;
      rewriteOptionLine(
        currentOffset,
        renderOptionLine(choices[cursor], cursor, cursor, multi, selected)
      );
      return;
    }

    if (key.name === 'return') {
      const current = choices[cursor];
      cleanup();

      if (multi) {
        process.stdout.write(JSON.stringify(Array.from(selected)));
        process.exit(0);
      }

      if (current.disabled) process.exit(1);
      process.stdout.write(current.value);
      process.exit(0);
    }
  };

  process.stdin.on('keypress', onKeypress);
  renderInitial();
}

async function main() {
  const message = process.env.CLI_MESSAGE || '';
  const defaultValueRaw = process.env.CLI_DEFAULT;
  const choices = parseChoices(process.env.CLI_CHOICES || '');

  switch (mode) {
    case 'select':
      await promptSelection({ message, choices, defaultValue: defaultValueRaw });
      return;
    case 'multi-select':
      await promptSelection({
        message,
        choices,
        multi: true,
        defaultValue: defaultValueRaw ? JSON.parse(defaultValueRaw) : [],
      });
      return;
    case 'confirm':
      await promptSelection({
        message,
        choices: [
          { name: '是', value: 'true' },
          { name: '否', value: 'false' },
        ],
        defaultValue: defaultValueRaw === 'false' ? 'false' : 'true',
      });
      return;
    case 'input': {
      const result = await promptInput({ message, defaultValue: defaultValueRaw || '' });
      process.stdout.write(result);
      return;
    }
    case 'password': {
      const result = await promptInput({ message, defaultValue: defaultValueRaw || '', password: true });
      process.stdout.write(result);
      return;
    }
    default:
      fail(`不支持的交互模式: ${mode}`, 1);
  }
}

main().catch((error) => {
  if (error && error.cancelled) process.exit(130);
  fail(error && error.message ? error.message : '交互执行失败');
});
