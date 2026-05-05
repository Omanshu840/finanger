(async function fetchAllSwiggyOrders() {
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  // ── GENERIC PAGINATED FETCHER ─────────────────────────────────
  // Handles both order_id-based (food) and from_time-based (dash/dineout) pagination
  async function fetchOrdersByTime(label, emoji, url_base, order_type) {
    let allOrders = [];
    let from_time = Date.now();
    let page = 1;
    console.log(`${emoji} Fetching ${label} orders...`);

    while (true) {
      const url = `${url_base}?count=20&from_time=${from_time}&order_type=${order_type}`;
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          console.warn(`⚠️ ${label}: HTTP ${res.status} — stopping.`);
          break;
        }
        const json = await res.json();

        // Try common response shapes
        const orders =
          json?.data?.orders ||
          json?.data?.order_list ||
          json?.orders ||
          [];

        if (!orders || orders.length === 0) {
          console.log(`✅ ${label} orders done.`);
          break;
        }

        allOrders = allOrders.concat(orders);

        // Next page: use the oldest order's order_time as the new from_time
        const oldest = orders[orders.length - 1];
        const nextTime =
          oldest?.order_time ||        // epoch ms
          oldest?.created_at ||
          oldest?.placed_at ||
          null;

        if (!nextTime || nextTime === from_time) {
          console.log(`✅ ${label}: no further pages.`);
          break;
        }

        from_time = nextTime;
        console.log(`${emoji} Page ${page++}: +${orders.length} orders (total: ${allOrders.length})`);
        await delay(500);
      } catch (err) {
        console.error(`❌ ${label} error:`, err);
        break;
      }
    }
    return allOrders;
  }

  // ── FOOD ORDERS (order_id cursor pagination) ──────────────────
  async function fetchFoodOrders() {
    let allOrders = [];
    let lastOrderId = "";
    let page = 1;
    console.log("🍔 Fetching food orders...");

    while (true) {
      const url = `https://www.swiggy.com/dapi/order/all?order_id=${lastOrderId}`;
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) { console.error(`❌ Food: HTTP ${res.status}`); break; }
        const json = await res.json();
        const orders = json?.data?.orders;
        if (!orders || orders.length === 0) { console.log("✅ Food orders done."); break; }
        allOrders = allOrders.concat(orders);
        lastOrderId = orders[orders.length - 1].order_id;
        console.log(`🍔 Page ${page++}: +${orders.length} orders (total: ${allOrders.length})`);
        await delay(500);
      } catch (err) { console.error("❌ Food error:", err); break; }
    }
    return allOrders;
  }

  // ── RUN ALL THREE ─────────────────────────────────────────────
  const foodOrders      = await fetchFoodOrders();
  const instamartOrders = await fetchOrdersByTime(
    "Instamart", "🛒",
    "https://www.swiggy.com/mapi/order/dash",
    "DASH"
  );
  const dineoutOrders   = await fetchOrdersByTime(
    "Dineout", "🍽️",
    "https://www.swiggy.com/mapi/order/dineout",
    "DINEOUT"
  );

  // ── COMBINE & SUMMARISE ───────────────────────────────────────
  const combined = {
    food_orders:      foodOrders,
    instamart_orders: instamartOrders,
    dineout_orders:   dineoutOrders,
    summary: {
      total_food:      foodOrders.length,
      total_instamart: instamartOrders.length,
      total_dineout:   dineoutOrders.length,
      total:           foodOrders.length + instamartOrders.length + dineoutOrders.length,
    },
  };

  window.__swiggyOrders = combined;

  console.log("─────────────────────────────────────");
  console.log(`📊 SUMMARY`);
  console.log(`   🍔 Food:      ${foodOrders.length}`);
  console.log(`   🛒 Instamart: ${instamartOrders.length}`);
  console.log(`   🍽️ Dineout:   ${dineoutOrders.length}`);
  console.log(`   📦 Total:     ${combined.summary.total}`);
  console.log("─────────────────────────────────────");
  console.log("💡 Inspect anytime: window.__swiggyOrders");

  // ── AUTO-DOWNLOAD JSON ────────────────────────────────────────
  const blob = new Blob([JSON.stringify(combined, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "swiggy_orders_all.json";
  a.click();
  console.log("💾 Download triggered: swiggy_orders_all.json");

})();