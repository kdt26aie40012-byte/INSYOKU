// calc.js のテスト
// 実行方法：ブラウザで test.html を開く（Node.js がある場合は node test_calc.js でも可）

const C = typeof require === "function" ? require("./calc.js") : window.Calc;
const results = [];

function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, error: e.message }); }
}

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
const assert = {
  ok(v) { if (!v) throw new Error("ok に失敗"); },
  strictEqual(a, b) { if (a !== b) throw new Error(`${a} !== ${b}`); },
  deepStrictEqual(a, b) { if (!deepEqual(a, b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`); },
  throws(fn) { try { fn(); } catch (e) { return; } throw new Error("例外が発生しなかった"); },
};

// localStorage の代わり
function memoryStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

test("年齢の入力途中チェック：数字とNOのみ通す", () => {
  assert.ok(C.isAllowedAgeTyping(""));
  assert.ok(C.isAllowedAgeTyping("25"));
  assert.ok(C.isAllowedAgeTyping("N"));
  assert.ok(C.isAllowedAgeTyping("NO"));
  assert.ok(C.isAllowedAgeTyping("no"));
  assert.ok(!C.isAllowedAgeTyping("2a"));
  assert.ok(!C.isAllowedAgeTyping("NOO"));
  assert.ok(!C.isAllowedAgeTyping("-1"));
  assert.ok(!C.isAllowedAgeTyping("1.5"));
});

test("年齢の確定チェック", () => {
  assert.deepStrictEqual(C.validateAge("30"), { ok: true, age: 30 });
  assert.deepStrictEqual(C.validateAge("NO"), { ok: true, age: null });
  assert.strictEqual(C.validateAge("").ok, false);
  assert.strictEqual(C.validateAge("121").ok, false);
  assert.strictEqual(C.validateAge("abc").ok, false);
});

test("性別は 男性・女性・NO のみ", () => {
  assert.ok(C.validateGender("男性"));
  assert.ok(C.validateGender("女性"));
  assert.ok(C.validateGender("NO"));
  assert.ok(!C.validateGender("その他"));
  assert.ok(!C.validateGender(""));
});

test("数量は 1〜99 の整数", () => {
  assert.ok(C.validateQuantity(1));
  assert.ok(C.validateQuantity(99));
  assert.ok(!C.validateQuantity(0));
  assert.ok(!C.validateQuantity(100));
  assert.ok(!C.validateQuantity(1.5));
});

test("おすすめ：年代に合うものが返る", () => {
  const recos = C.getRecommendations(C.MENU, 8, "NO");
  assert.ok(recos.length > 0);
  recos.forEach((m) => assert.ok(m.targets.includes("kids")));
});

test("おすすめ：両方NOでも定番が返る", () => {
  assert.ok(C.getRecommendations(C.MENU, null, "NO").length > 0);
});

test("選択したアレルギーを含むメニューは除外される", () => {
  const list = C.excludeAllergens(C.MENU, ["エビ", "タマゴ"]);
  assert.ok(list.length > 0);
  list.forEach((m) => {
    assert.ok(!m.allergens.includes("エビ"));
    assert.ok(!m.allergens.includes("タマゴ"));
  });
  assert.ok(!list.some((m) => m.id === "chawanmushi"));
  assert.ok(list.some((m) => m.id === "maguro"));
});

test("小麦を選ぶとうどんが除外される", () => {
  const list = C.excludeAllergens(C.MENU, ["小麦"]);
  assert.ok(!list.some((m) => m.id === "udon"));
  assert.strictEqual(list.length, C.MENU.length - 1);
});

test("アレルギー未選択なら全メニューを表示", () => {
  assert.strictEqual(C.excludeAllergens(C.MENU, []).length, C.MENU.length);
});

test("メニューのアレルゲンはすべてチェックシートの項目にある", () => {
  C.MENU.forEach((m) => m.allergens.forEach((a) => assert.ok(C.ALLERGENS.includes(a))));
});

test("注文の追加と合計金額の計算", () => {
  let order = {};
  order = C.addToOrder(order, "maguro", 2); // 220 × 2
  order = C.addToOrder(order, "miso", 1);   // 200
  order = C.addToOrder(order, "maguro", 1); // 同じメニューは個数を足す
  const bill = C.calcBill(C.MENU, order);
  assert.strictEqual(bill.items.find((i) => i.id === "maguro").qty, 3);
  assert.strictEqual(bill.total, 220 * 3 + 200);
});

test("不正な数量は注文できない", () => {
  assert.throws(() => C.addToOrder({}, "maguro", 0));
});

test("存在しないメニューは会計に含めない", () => {
  const bill = C.calcBill(C.MENU, { unknown: 3, miso: 2 });
  assert.strictEqual(bill.items.length, 1);
  assert.strictEqual(bill.total, 400);
});

test("注文なしの会計は0円", () => {
  assert.deepStrictEqual(C.calcBill(C.MENU, {}), { items: [], total: 0 });
});

test("localStorage への保存・読込・初期化", () => {
  const s = memoryStorage();
  assert.deepStrictEqual(C.loadOrder(s), {});
  C.saveOrder(s, { miso: 2 });
  assert.deepStrictEqual(C.loadOrder(s), { miso: 2 });
  C.clearOrder(s);
  assert.deepStrictEqual(C.loadOrder(s), {});
});

test("壊れた注文データは空として扱う", () => {
  const s = memoryStorage();
  s.setItem(C.STORAGE_KEY_ORDER, "{broken");
  assert.deepStrictEqual(C.loadOrder(s), {});
});

test("メニューは名前と値段の組で保存される", () => {
  const s = memoryStorage();
  C.saveMenu(s, C.MENU);
  const saved = JSON.parse(s.getItem(C.STORAGE_KEY_MENU));
  assert.deepStrictEqual(saved[0], { name: "まぐろ", price: 220 });
});

test("すべてのメニューに写真が設定されている", () => {
  C.MENU.forEach((m) => assert.strictEqual(m.image, `images/${m.id}.jpg`));
});

test("金額の表示形式", () => {
  assert.strictEqual(C.formatYen(1580), "¥1,580");
});

// ---------- 結果表示 ----------
const failed = results.filter((r) => !r.ok);
if (typeof document !== "undefined") {
  const out = document.getElementById("result");
  out.innerHTML = `<h2>${results.length - failed.length} / ${results.length} 件 成功</h2>` +
    results.map((r) => `<div class="${r.ok ? "pass" : "fail"}">${r.ok ? "✔" : "✘"} ${r.name}${r.ok ? "" : "：" + r.error}</div>`).join("");
} else {
  results.forEach((r) => console.log(`${r.ok ? "✔" : "✘"} ${r.name}${r.ok ? "" : "：" + r.error}`));
  console.log(`${results.length - failed.length} / ${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}
