/* =========================================================
   Calculator — arithmetic + live result + keyboard support
   Safe recursive-descent parser (no eval).
   ========================================================= */
(function () {
  'use strict';

  const exprEl = document.getElementById('expr');
  const resultEl = document.getElementById('result');
  const keypad = document.getElementById('keypad');

  let current = '';          // raw expression string (uses + - * / % . )
  let justEvaluated = false;  // true right after "=" was pressed

  /* ---------- Safe expression parser ---------- */
  function evaluate(expression) {
    const s = String(expression).replace(/\s+/g, '');
    let i = 0;

    function eof() { return i >= s.length; }
    function peek() { return s[i]; }
    function next() { return s[i++]; }

    function parseExpression() {
      let left = parseTerm();
      while (!eof() && (peek() === '+' || peek() === '-')) {
        const op = next();
        const right = parseTerm();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    }

    function parseTerm() {
      let left = parseFactor();
      while (!eof() && (peek() === '*' || peek() === '/' || peek() === '%')) {
        const op = next();
        const right = parseFactor();
        if (op === '*') left = left * right;
        else if (op === '/') {
          if (right === 0) throw new Error('Cannot divide by zero');
          left = left / right;
        } else {
          if (right === 0) throw new Error('Cannot mod by zero');
          left = left % right;
        }
      }
      return left;
    }

    function parseFactor() {
      if (peek() === '+') { next(); return parseFactor(); }
      if (peek() === '-') { next(); return -parseFactor(); }
      if (peek() === '(') {
        next();
        const val = parseExpression();
        if (peek() !== ')') throw new Error('Missing closing bracket');
        next();
        return val;
      }
      return parseNumber();
    }

    function parseNumber() {
      let str = '';
      while (!eof() && /[0-9.]/.test(peek())) str += next();
      if (str === '') throw new Error('Invalid expression');
      if ((str.match(/\./g) || []).length > 1) throw new Error('Invalid number');
      const num = parseFloat(str);
      if (isNaN(num)) throw new Error('Invalid number');
      return num;
    }

    const result = parseExpression();
    if (!eof()) throw new Error('Unexpected input');
    return result;
  }

  /* ---------- Formatting ---------- */
  function formatNumber(n) {
    if (!isFinite(n)) throw new Error('Error');
    // trim float noise, cap length
    const rounded = Math.round((n + Number.EPSILON) * 1e12) / 1e12;
    let str = String(rounded);
    if (str.length > 14 && rounded % 1 !== 0) str = rounded.toPrecision(10).replace(/\.?0+$/, '');
    return str;
  }

  function pretty(s) {
    return s
      .replace(/\*/g, '×')
      .replace(/\//g, '÷')
      .replace(/-/g, '−')
      .replace(/\+/g, '+');
  }

  /* ---------- Display ---------- */
  function updateDisplay(preview) {
    exprEl.textContent = current === '' ? '0' : pretty(current);
    exprEl.scrollLeft = exprEl.scrollWidth;

    if (preview && current !== '') {
      try {
        const r = evaluate(current);
        resultEl.textContent = '= ' + formatNumber(r);
        resultEl.classList.remove('error');
      } catch (e) {
        resultEl.textContent = '';
        resultEl.classList.remove('error');
      }
    } else if (!preview) {
      resultEl.textContent = '';
    }
  }

  /* ---------- Input ---------- */
  function input(val) {
    if (justEvaluated) {
      if (/[0-9.]/.test(val)) current = '';   // start fresh on new number
      justEvaluated = false;
    }

    const last = current.slice(-1);

    // operators: avoid two in a row (allow unary minus after an operator)
    if (/[+\-*/%]/.test(val)) {
      if (/[+\-*/%]/.test(last)) {
        if (val === '-' && last !== '-') {
          // allow negative number after operator
        } else {
          current = current.slice(0, -1) + val;   // replace last operator
          updateDisplay(true);
          return;
        }
      } else if (current === '' && val !== '-') {
        return; // don't allow leading + * / %
      }
    }

    // decimal: only one dot per number
    if (val === '.') {
      const seg = current.split(/[+\-*/%]/).pop();
      if (seg.includes('.')) return;
      if (seg === '') current += '0'; // leading dot -> "0."
    }

    current += val;
    updateDisplay(true);
  }

  /* ---------- Actions ---------- */
  function clearAll() {
    current = '';
    justEvaluated = false;
    exprEl.textContent = '0';
    resultEl.textContent = '';
    resultEl.classList.remove('error');
  }

  function del() {
    if (justEvaluated) { clearAll(); return; }
    current = current.slice(0, -1);
    updateDisplay(true);
  }

  function toggleSign() {
    const match = current.match(/(\d*\.?\d+)$/);
    if (!match) return;
    const numStr = match[1];
    const start = current.length - numStr.length;
    const before = current[start - 1];
    const isNeg = before === '-' && (start - 2 < 0 || /[+\-*/%(]/.test(current[start - 2]));
    if (isNeg) {
      current = current.slice(0, start - 1) + current.slice(start);
    } else {
      current = current.slice(0, start) + '-' + current.slice(start);
    }
    justEvaluated = false;
    updateDisplay(true);
  }

  function equals() {
    if (current === '') return;
    try {
      const r = evaluate(current);
      const formatted = formatNumber(r);
      resultEl.textContent = '';
      current = formatted;
      justEvaluated = true;
      exprEl.textContent = formatted;
      exprEl.scrollLeft = exprEl.scrollWidth;
    } catch (e) {
      resultEl.textContent = 'Error';
      resultEl.classList.add('error');
    }
  }

  /* ---------- Button clicks ---------- */
  keypad.addEventListener('click', e => {
    const btn = e.target.closest('.key');
    if (!btn) return;
    handleButton(btn);
  });

  function handleButton(btn) {
    const val = btn.dataset.value;
    const action = btn.dataset.action;
    if (val !== undefined) input(val);
    else if (action === 'clear') clearAll();
    else if (action === 'delete') del();
    else if (action === 'sign') toggleSign();
    else if (action === 'equals') equals();
  }

  /* ---------- Keyboard support ---------- */
  document.addEventListener('keydown', e => {
    const k = e.key;
    let selector = null;

    if (/^[0-9]$/.test(k)) { input(k); selector = `[data-value="${k}"]`; }
    else if (k === '.') { input('.'); selector = '[data-value="."]'; }
    else if (k === '+') { input('+'); selector = '[data-value="+"]'; }
    else if (k === '-') { input('-'); selector = '[data-value="-"]'; }
    else if (k === '*') { input('*'); selector = '[data-value="*"]'; }
    else if (k === '/') { e.preventDefault(); input('/'); selector = '[data-value="/"]'; }
    else if (k === '%') { input('%'); selector = '[data-value="%"]'; }
    else if (k === '(' ) { input('('); }
    else if (k === ')') { input(')'); }
    else if (k === 'Enter' || k === '=') { e.preventDefault(); equals(); selector = '[data-action="equals"]'; }
    else if (k === 'Backspace') { del(); selector = '[data-action="delete"]'; }
    else if (k === 'Escape') { clearAll(); selector = '[data-action="clear"]'; }
    else if (k === '_' ) { toggleSign(); selector = '[data-action="sign"]'; }

    if (selector) flash(selector);
  });

  function flash(selector) {
    const btn = document.querySelector(selector);
    if (!btn) return;
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 110);
  }

  // initial paint
  updateDisplay(false);
})();
