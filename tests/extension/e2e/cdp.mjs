// Helpers for driving elements inside a CLOSED shadow root (the on-page widget uses one, on purpose). Page JavaScript — and
// therefore ordinary puppeteer selectors — cannot see into it; the DevTools protocol's DOM domain can (pierce: true).

const hasClass = (node, cls) => {
  const a = node.attributes || [];
  for (let i = 0; i < a.length; i += 2) if (a[i] === "class" && a[i + 1].split(/\s+/).includes(cls)) return true;
  return false;
};
const attr = (node, name) => {
  const a = node.attributes || [];
  for (let i = 0; i < a.length; i += 2) if (a[i] === name) return a[i + 1];
  return null;
};

function* walk(node) {
  yield node;
  for (const c of node.children || []) yield* walk(c);
  for (const s of node.shadowRoots || []) yield* walk(s);
  if (node.contentDocument) yield* walk(node.contentDocument);
}

export class Shadow {
  constructor(page) {
    this.page = page;
  }
  async open() {
    this.cdp = await this.page.createCDPSession();
    await this.cdp.send("DOM.enable");
  }
  async root() {
    return (await this.cdp.send("DOM.getDocument", { depth: -1, pierce: true })).root;
  }
  /** First node matching { cls, tag, label (aria-label), id }. */
  async find(q) {
    const root = await this.root();
    for (const n of walk(root)) {
      if (n.nodeType !== 1) continue;
      if (q.tag && n.nodeName.toLowerCase() !== q.tag) continue;
      if (q.cls && !hasClass(n, q.cls)) continue;
      if (q.id && attr(n, "id") !== q.id) continue;
      if (q.label && attr(n, "aria-label") !== q.label) continue;
      return n;
    }
    return null;
  }
  async waitFor(q, { timeout = 15000 } = {}) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const n = await this.find(q);
      if (n) return n;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Timed out waiting for ${JSON.stringify(q)}`);
  }
  async call(node, fn) {
    const { object } = await this.cdp.send("DOM.resolveNode", { backendNodeId: node.backendNodeId });
    const r = await this.cdp.send("Runtime.callFunctionOn", { objectId: object.objectId, functionDeclaration: fn, returnByValue: true });
    return r.result.value;
  }
  text(node) {
    return this.call(node, "function () { return (this.innerText || this.textContent || '').trim(); }");
  }
  value(node) {
    return this.call(node, "function () { return this.value; }");
  }
  async click(node) {
    // A real mouse click at the element's centre, exactly as a person would do it.
    await this.cdp.send("DOM.scrollIntoViewIfNeeded", { backendNodeId: node.backendNodeId }).catch(() => {});
    const { model } = await this.cdp.send("DOM.getBoxModel", { backendNodeId: node.backendNodeId });
    const q = model.content;
    const x = (q[0] + q[2] + q[4] + q[6]) / 4;
    const y = (q[1] + q[3] + q[5] + q[7]) / 4;
    await this.page.mouse.click(x, y);
  }
  async type(node, text) {
    await this.cdp.send("DOM.focus", { backendNodeId: node.backendNodeId });
    await this.call(node, "function () { this.select(); }");
    await this.page.keyboard.type(text, { delay: 10 });
  }
  /** Visible text of everything in the widget's root. */
  async widgetText() {
    const root = await this.find({ cls: "w-wrap" });
    return root ? this.text(root) : "";
  }
}
