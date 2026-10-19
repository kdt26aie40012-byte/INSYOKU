// 花園 メニュー・オーダーシステム：画面表示と操作

(function () {
  const C = window.Calc;
  const $ = (id) => document.getElementById(id);

  const SPLASH_MS = 1500;
  const THANKS_MS = 5000;

  const state = {
    tab: "all",
    recommendations: null, // 年齢・性別の入力後に設定
    allergies: [],         // アレルゲンなしタブで選択されたアレルギー
    selected: null,        // 数量指定中のメニュー
    qty: 1,
  };

  // ---------- 起動・初期化 ----------

  function start() {
    C.saveMenu(localStorage, C.MENU);
    resetView();
    $("splash").hidden = false;
    $("main").hidden = true;
    setTimeout(() => {
      $("splash").hidden = true;
      $("main").hidden = false;
    }, SPLASH_MS);
  }

  // 初期状態（おすすめなし・すべてタブ）に戻す
  function resetView() {
    state.tab = "all";
    state.recommendations = null;
    state.allergies = [];
    $("tab-reco").hidden = true;
    $("reco-banner").hidden = false;
    $("profile-form").reset();
    $("profile-error").textContent = "";
    document.querySelectorAll(".modal").forEach((m) => (m.hidden = true));
    renderMenu();
  }

  // ---------- メニュー表示 ----------

  function currentItems() {
    if (state.tab === "reco") return state.recommendations || [];
    if (state.tab === "free") return C.excludeAllergens(C.MENU, state.allergies);
    return C.MENU;
  }

  function renderMenu() {
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === state.tab);
    });
    renderAllergyChecks();
    const grid = $("menu-grid");
    grid.innerHTML = "";
    const items = currentItems();
    if (items.length === 0) {
      grid.innerHTML = '<p class="empty">該当するメニューがありません</p>';
      return;
    }
    items.forEach((m) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "card";
      card.innerHTML = `
        <div class="thumb-wrap">
          <img class="thumb" src="${m.image}" alt="" loading="lazy">
          ${m.allergens.length ? `<span class="allergen-badge">${m.allergens.join("・")}</span>` : ""}
        </div>
        <div class="card-body">
          <div class="card-name"></div>
          <div class="card-price">${C.formatYen(m.price)}</div>
        </div>`;
      card.querySelector(".card-name").textContent = m.name;
      card.addEventListener("click", () => openQty(m));
      grid.appendChild(card);
    });
  }

  // アレルゲンなしタブのチェックシート
  function renderAllergyChecks() {
    const box = $("allergy-checks");
    box.hidden = state.tab !== "free";
    if (box.hidden) return;
    const list = $("allergy-list");
    if (list.children.length === 0) {
      C.ALLERGENS.forEach((a) => {
        const label = document.createElement("label");
        label.className = "check";
        label.innerHTML = `<input type="checkbox" value="${a}"> ${a}`;
        list.appendChild(label);
      });
    }
    list.querySelectorAll("input").forEach((cb) => (cb.checked = state.allergies.includes(cb.value)));
    $("soy-note").hidden = !state.allergies.includes("大豆");
  }

  $("allergy-list").addEventListener("change", () => {
    state.allergies = [...$("allergy-list").querySelectorAll("input:checked")].map((cb) => cb.value);
    renderMenu();
  });

  $("tabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    state.tab = tab.dataset.tab;
    renderMenu();
  });

  // ---------- おすすめ（年齢・性別入力） ----------

  $("open-profile").addEventListener("click", () => {
    $("profile-modal").hidden = false;
    $("age-input").focus();
  });

  // 年齢欄は数字と『NO』以外を入力させない
  const ageInput = $("age-input");
  let lastAge = "";
  ageInput.addEventListener("input", () => {
    const v = ageInput.value.toUpperCase();
    if (C.isAllowedAgeTyping(v)) {
      ageInput.value = v;
      lastAge = v;
      $("profile-error").textContent = "";
    } else {
      ageInput.value = lastAge;
      $("profile-error").textContent = "年齢は数字か『NO』のみ入力できます";
    }
  });

  $("profile-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const ageResult = C.validateAge(ageInput.value);
    if (!ageResult.ok) {
      $("profile-error").textContent = ageResult.message;
      return;
    }
    const checked = document.querySelector('input[name="gender"]:checked');
    if (!checked || !C.validateGender(checked.value)) {
      $("profile-error").textContent = "性別を選択してください";
      return;
    }
    state.recommendations = C.getRecommendations(C.MENU, ageResult.age, checked.value);
    state.tab = "reco";
    $("tab-reco").hidden = false;
    $("reco-banner").hidden = true;
    $("profile-modal").hidden = true;
    lastAge = "";
    renderMenu();
  });

  // ---------- 数量指定・注文 ----------

  function openQty(m) {
    state.selected = m;
    state.qty = 1;
    $("qty-thumb").src = m.image;
    $("qty-thumb").alt = m.name;
    $("qty-name").textContent = m.name;
    $("qty-price").textContent = C.formatYen(m.price);
    $("qty-value").textContent = state.qty;
    $("qty-modal").hidden = false;
  }

  function changeQty(diff) {
    const next = state.qty + diff;
    if (!C.validateQuantity(next)) return;
    state.qty = next;
    $("qty-value").textContent = next;
  }

  $("qty-minus").addEventListener("click", () => changeQty(-1));
  $("qty-plus").addEventListener("click", () => changeQty(1));

  $("qty-ok").addEventListener("click", () => {
    const order = C.addToOrder(C.loadOrder(localStorage), state.selected.id, state.qty);
    C.saveOrder(localStorage, order);
    $("qty-modal").hidden = true;
    toast(`${state.selected.name} を ${state.qty} 個注文しました`);
  });

  // ---------- 注文履歴・会計 ----------

  function orderTableHtml(bill) {
    if (bill.items.length === 0) return '<p class="empty">まだ注文はありません</p>';
    const rows = bill.items.map((it) => `
      <tr><td>${it.name}</td><td class="num">${it.qty}個</td><td class="num">${C.formatYen(it.subtotal)}</td></tr>`).join("");
    return `<table class="order-table">
      <thead><tr><th>メニュー</th><th class="num">個数</th><th class="num">小計</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  $("open-history").addEventListener("click", () => {
    const bill = C.calcBill(C.MENU, C.loadOrder(localStorage));
    $("history-list").innerHTML = orderTableHtml(bill);
    $("history-modal").hidden = false;
  });

  $("open-bill").addEventListener("click", () => {
    const bill = C.calcBill(C.MENU, C.loadOrder(localStorage));
    $("bill-list").innerHTML = orderTableHtml(bill);
    $("bill-total").textContent = C.formatYen(bill.total);
    $("bill-pay").disabled = bill.items.length === 0;
    $("bill-modal").hidden = false;
  });

  // 『会計に進む』：お礼を5秒表示 → 注文データを初期化 → 初期状態で待機
  $("bill-pay").addEventListener("click", () => {
    $("bill-modal").hidden = true;
    $("main").hidden = true;
    $("thanks").hidden = false;
    setTimeout(() => {
      C.clearOrder(localStorage);
      $("thanks").hidden = true;
      start();
    }, THANKS_MS);
  });

  // 閉じる系ボタン（『食事に戻る』含む）はポップアップを閉じて元の画面へ
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.closest(".modal").hidden = true;
    });
  });

  // ---------- その他 ----------

  let toastTimer = null;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 2000);
  }

  start();
})();
