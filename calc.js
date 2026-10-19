// 花園 メニュー・オーダーシステム：画面に依存しない関数をまとめたファイル
// ブラウザでは window.Calc として、Node.js（テスト）では require で使う

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.Calc = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  const STORAGE_KEY_MENU = "hanazono_menu";
  const STORAGE_KEY_ORDER = "hanazono_order";

  // メニューの区切り（表示順）
  const CATEGORIES = [
    { id: "maguro", name: "まぐろ" },
    { id: "nigiri", name: "にぎり" },
    { id: "gunkan", name: "軍艦・巻物" },
    { id: "special", name: "創作にぎり" },
    { id: "side", name: "サイド" },
  ];

  // メニュー：名前と値段を組み合わせて保存する（すしは1皿2貫）
  // category：区切り / allergens：含まれるアレルゲン / photo: false にすると「写真準備中」
  // targets：おすすめ対象
  //   kids＝子供向け、adult＝大人向け、男性＝肉、女性＝さわやかなもの
  // cost：原価（お客さんには表示しない）
  //   子供向けは薄利多売（原価率およそ55〜60%）、大人向けは利益を多く（原価率およそ30〜35%）
  const MENU = [
    // まぐろ
    { id: "maguro", category: "maguro", name: "まぐろ赤身", price: 280, cost: 90, allergens: [], targets: ["adult"] },
    { id: "chutoro", category: "maguro", name: "中トロ", price: 480, cost: 160, allergens: [], targets: ["adult"] },
    { id: "otoro", category: "maguro", name: "大トロ", price: 720, cost: 240, allergens: [], targets: ["adult"] },
    { id: "negitoro_gunkan", category: "maguro", name: "ねぎとろ軍艦", price: 160, cost: 90, allergens: [], targets: ["kids"] },
    // にぎり
    { id: "salmon", category: "nigiri", name: "サーモン", price: 180, cost: 100, allergens: ["サケ"], targets: ["kids"] },
    { id: "ebi", category: "nigiri", name: "えび", price: 180, cost: 100, allergens: ["エビ"], targets: ["kids"] },
    { id: "tamago", category: "nigiri", name: "玉子", price: 120, cost: 70, allergens: ["タマゴ"], targets: ["kids"] },
    { id: "hamachi", category: "nigiri", name: "はまち", price: 260, cost: 85, allergens: [], targets: ["adult"] },
    { id: "buri", category: "nigiri", name: "ぶり", price: 300, cost: 95, allergens: [], targets: ["adult"] },
    { id: "madai", category: "nigiri", name: "真鯛", price: 300, cost: 95, allergens: [], targets: ["adult", "女性"] },
    { id: "kohada", category: "nigiri", name: "こはだ", price: 240, cost: 75, allergens: [], targets: ["adult", "女性"] },
    { id: "engawa", category: "nigiri", name: "えんがわ（炙り）", price: 300, cost: 95, allergens: [], targets: ["adult"] },
    { id: "anago", category: "nigiri", name: "煮穴子", price: 380, cost: 125, allergens: [], targets: ["adult"] },
    { id: "ika", category: "nigiri", name: "いか", price: 220, cost: 70, allergens: ["イカ"], targets: ["adult"] },
    { id: "hotate", category: "nigiri", name: "ほたて", price: 320, cost: 105, allergens: ["貝類"], targets: ["adult", "女性"] },
    { id: "akagai", category: "nigiri", name: "赤貝", price: 380, cost: 125, allergens: ["貝類"], targets: ["adult"] },
    // 軍艦・巻物
    { id: "ikura", category: "gunkan", name: "いくら軍艦", price: 480, cost: 160, allergens: ["イクラ"], targets: ["adult"] },
    { id: "uni", category: "gunkan", name: "うに軍艦", price: 680, cost: 230, allergens: [], targets: ["adult"] },
    { id: "shirako", category: "gunkan", name: "白子ポン酢軍艦", price: 450, cost: 145, allergens: [], targets: ["adult", "女性"] },
    { id: "negitoro", category: "gunkan", name: "ねぎとろ巻", price: 200, cost: 115, allergens: [], targets: ["kids"] },
    { id: "kappa", category: "gunkan", name: "かっぱ巻", price: 100, cost: 55, allergens: [], targets: ["kids"] },
    // 創作にぎり
    { id: "namaham", category: "special", name: "生ハム握り", price: 420, cost: 135, allergens: ["豚肉"], targets: ["adult", "女性"] },
    { id: "iberico", category: "special", name: "イベリコ豚の炙り", price: 420, cost: 135, allergens: ["豚肉"], targets: ["adult", "男性"] },
    { id: "aburi_wagyu", category: "special", name: "炙り和牛軍艦", price: 620, cost: 200, allergens: ["牛肉"], targets: ["adult", "男性"] },
    { id: "basashi", category: "special", name: "馬刺し握り", price: 500, cost: 160, allergens: [], targets: ["adult", "男性"] },
    { id: "foie_gras", category: "special", name: "フォアグラの炙り", price: 750, cost: 245, allergens: [], targets: ["adult"] },
    { id: "kamo", category: "special", name: "鴨ロース握り（オレンジソースを添えて）", price: 450, cost: 145, allergens: ["オレンジ"], targets: ["adult", "男性"] },
    // サイド
    { id: "chawanmushi", category: "side", name: "茶碗蒸し", price: 250, cost: 140, allergens: ["タマゴ", "エビ"], targets: ["kids"] },
    { id: "udon", category: "side", name: "かけうどん", price: 300, cost: 170, allergens: ["小麦"], targets: ["kids"] },
    { id: "miso", category: "side", name: "味噌汁", price: 180, cost: 60, allergens: ["大豆"], targets: [] },
  ].map((m) => Object.assign({}, m, { image: m.photo === false ? null : "images/" + m.id + ".jpg" }));

  // アレルギーのチェックシートの項目
  const ALLERGENS = ["エビ", "カニ", "タマゴ", "小麦", "乳製品", "そば", "イカ", "イクラ", "サケ", "サバ", "貝類", "大豆", "山芋", "ゴマ",
    "豚肉", "牛肉", "オレンジ"];

  // ---------- 入力チェック ----------

  // 入力途中の年齢として許すか（数字のみ、または NO の途中まで）
  function isAllowedAgeTyping(value) {
    return /^[0-9]*$/.test(value) || /^(N|NO)$/i.test(value);
  }

  // 確定した年齢が正しいか（0〜120 の整数、または NO）
  function validateAge(value) {
    const v = String(value).trim();
    if (/^NO$/i.test(v)) return { ok: true, age: null };
    if (!/^[0-9]{1,3}$/.test(v)) return { ok: false, message: "年齢は数字か『NO』で入力してください" };
    const age = Number(v);
    if (age > 120) return { ok: false, message: "年齢は0〜120の範囲で入力してください" };
    return { ok: true, age };
  }

  const GENDERS = ["男性", "女性", "NO"];

  function validateGender(value) {
    return GENDERS.includes(value);
  }

  function validateQuantity(qty) {
    return Number.isInteger(qty) && qty >= 1 && qty <= 99;
  }

  // ---------- おすすめ・アレルゲン ----------

  // 中学生以下（15歳以下）は子供向け、それ以上は大人向け
  function ageGroup(age) {
    if (age === null || age === undefined) return null;
    return age <= 15 ? "kids" : "adult";
  }

  // 年代（2点）と性別（1点）が合うメニューを点数の高い順に返す（どちらも NO なら定番を返す）
  function getRecommendations(menu, age, gender, limit = 6) {
    const group = ageGroup(age);
    const g = gender === "NO" ? null : gender;
    if (!group && !g) {
      return menu.filter((m) => ["maguro", "chutoro", "salmon", "ikura"].includes(m.id));
    }
    return menu
      .map((m, i) => ({
        m, i,
        score: (group && m.targets.includes(group) ? 2 : 0) + (g && m.targets.includes(g) ? 1 : 0),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .slice(0, limit)
      .map((x) => x.m);
  }

  // 利益率（(値段 − 原価) ÷ 値段）
  function profitRate(m) {
    return (m.price - m.cost) / m.price;
  }

  // メニューを区切りごとにまとめる（中身のない区切りは除く）
  function groupByCategory(menu) {
    return CATEGORIES
      .map((c) => ({ id: c.id, name: c.name, items: menu.filter((m) => m.category === c.id) }))
      .filter((c) => c.items.length > 0);
  }

  // 選択されたアレルギーを1つでも含むメニューを除外する
  function excludeAllergens(menu, selected) {
    return menu.filter((m) => !m.allergens.some((a) => selected.includes(a)));
  }

  // ---------- 注文データ ----------

  // 注文は { メニューid: 個数 } の形で記録する
  function addToOrder(order, menuId, qty) {
    if (!validateQuantity(qty)) throw new Error("数量が正しくありません");
    const next = Object.assign({}, order);
    next[menuId] = (next[menuId] || 0) + qty;
    return next;
  }

  // 注文データから明細（名前・単価・個数・小計）と合計金額を算出する
  function calcBill(menu, order) {
    const items = Object.keys(order)
      .map((id) => {
        const m = menu.find((x) => x.id === id);
        if (!m || !(order[id] > 0)) return null;
        return { id, name: m.name, price: m.price, qty: order[id], subtotal: m.price * order[id] };
      })
      .filter(Boolean);
    const total = items.reduce((sum, it) => sum + it.subtotal, 0);
    return { items, total };
  }

  function formatYen(n) {
    return "¥" + n.toLocaleString("ja-JP");
  }

  // ---------- localStorage ----------

  function saveMenu(storage, menu) {
    storage.setItem(STORAGE_KEY_MENU, JSON.stringify(menu.map((m) => ({ name: m.name, price: m.price }))));
  }

  function loadOrder(storage) {
    try {
      const data = JSON.parse(storage.getItem(STORAGE_KEY_ORDER) || "{}");
      return data && typeof data === "object" ? data : {};
    } catch (e) {
      return {};
    }
  }

  function saveOrder(storage, order) {
    storage.setItem(STORAGE_KEY_ORDER, JSON.stringify(order));
  }

  function clearOrder(storage) {
    storage.removeItem(STORAGE_KEY_ORDER);
  }

  return {
    MENU, CATEGORIES, ALLERGENS, GENDERS, STORAGE_KEY_MENU, STORAGE_KEY_ORDER,
    isAllowedAgeTyping, validateAge, validateGender, validateQuantity,
    ageGroup, getRecommendations, excludeAllergens, profitRate, groupByCategory,
    addToOrder, calcBill, formatYen,
    saveMenu, loadOrder, saveOrder, clearOrder,
  };
});
