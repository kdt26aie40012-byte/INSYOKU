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

  // メニュー：名前と値段を組み合わせて保存する（すしは1皿2貫）
  // image：写真（images/ 内）/ allergens：含まれるアレルゲン / targets：おすすめ対象（年代・性別）
  const MENU = [
    { id: "maguro", name: "まぐろ", price: 220, allergens: [], targets: ["middle", "senior", "男性"] },
    { id: "otoro", name: "大とろ", price: 480, allergens: [], targets: ["middle", "senior", "男性"] },
    { id: "salmon", name: "サーモン", price: 180, allergens: ["サケ"], targets: ["kids", "young", "女性"] },
    { id: "hamachi", name: "はまち", price: 220, allergens: [], targets: ["middle", "senior"] },
    { id: "ebi", name: "えび", price: 180, allergens: ["エビ"], targets: ["kids", "young"] },
    { id: "ika", name: "いか", price: 180, allergens: ["イカ"], targets: ["senior", "男性"] },
    { id: "tamago", name: "玉子", price: 120, allergens: ["タマゴ"], targets: ["kids", "女性"] },
    { id: "ikura", name: "いくら軍艦", price: 380, allergens: ["イクラ"], targets: ["young", "女性"] },
    { id: "uni", name: "うに軍艦", price: 480, allergens: [], targets: ["middle", "男性"] },
    { id: "negitoro", name: "ねぎとろ巻", price: 260, allergens: [], targets: ["young", "男性"] },
    { id: "kappa", name: "かっぱ巻", price: 150, allergens: [], targets: ["kids", "young", "女性"] },
    { id: "chawanmushi", name: "茶碗蒸し", price: 320, allergens: ["タマゴ", "エビ"], targets: ["kids", "senior", "女性"] },
    { id: "udon", name: "かけうどん", price: 380, allergens: ["小麦"], targets: ["kids", "senior"] },
    { id: "miso", name: "味噌汁", price: 200, allergens: ["大豆"], targets: ["middle", "senior"] },
  ].map((m) => Object.assign({ image: "images/" + m.id + ".jpg" }, m));

  // アレルギーのチェックシートの項目
  const ALLERGENS = ["エビ", "カニ", "タマゴ", "小麦", "乳製品", "そば", "イカ", "イクラ", "サケ", "サバ", "貝類", "大豆", "山芋", "ゴマ"];

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

  function ageGroup(age) {
    if (age === null || age === undefined) return null;
    if (age < 13) return "kids";
    if (age < 30) return "young";
    if (age < 60) return "middle";
    return "senior";
  }

  // 年齢・性別に合うメニューを一致数の多い順に返す（どちらも NO なら定番を返す）
  function getRecommendations(menu, age, gender, limit = 4) {
    const group = ageGroup(age);
    const g = gender === "NO" ? null : gender;
    if (!group && !g) {
      return menu.filter((m) => ["maguro", "salmon", "otoro", "ikura"].includes(m.id));
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
    MENU, ALLERGENS, GENDERS, STORAGE_KEY_MENU, STORAGE_KEY_ORDER,
    isAllowedAgeTyping, validateAge, validateGender, validateQuantity,
    ageGroup, getRecommendations, excludeAllergens,
    addToOrder, calcBill, formatYen,
    saveMenu, loadOrder, saveOrder, clearOrder,
  };
});
