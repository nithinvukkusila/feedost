// Remember on this phone (spec R0-2, criteria 52 to 54).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brand } from "@/config/brand";

type Module = typeof import("./remember");

/** A fresh copy of the module, so the "does storage work" answer is asked again. */
async function load(): Promise<Module> {
  vi.resetModules();
  return import("./remember");
}

const real = Object.getOwnPropertyDescriptor(window, "localStorage")!;

function setStorage(value: unknown) {
  Object.defineProperty(window, "localStorage", { configurable: true, value });
}

/** A working store whose named methods throw, as a browser with storage blocked does. */
function throwing(...methods: ("getItem" | "setItem" | "removeItem")[]) {
  const data = new Map<string, string>();
  const store = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
  for (const name of methods) {
    store[name] = () => {
      throw new DOMException("blocked", "SecurityError");
    };
  }
  return store;
}

const pair = { upiId: "meena.tuitions@okhdfc", name: "Meena Rao" };

beforeEach(() => {
  Object.defineProperty(window, "localStorage", real);
  localStorage.clear();
});

afterEach(() => {
  Object.defineProperty(window, "localStorage", real);
  localStorage.clear();
});

describe("the key and what is stored (criterion 52)", () => {
  it("uses a key with no product name in it", async () => {
    const { REMEMBER_KEY } = await load();
    expect(REMEMBER_KEY).toBe("reminder-payee");
    expect(REMEMBER_KEY.toLowerCase()).not.toContain(brand.name.toLowerCase());
  });

  it("round trips the pair, and stores exactly v, upiId and name under the one key", async () => {
    const m = await load();
    expect(m.readRaw()).toBeNull();
    expect(m.savePayee(pair)).toBe(true);
    expect(Object.keys(JSON.parse(localStorage.getItem(m.REMEMBER_KEY)!))).toEqual(["v", "upiId", "name"]);
    expect(JSON.parse(localStorage.getItem(m.REMEMBER_KEY)!)).toEqual({ v: 1, ...pair });
    expect(localStorage.length).toBe(1);
    expect(m.parsePayee(m.readRaw())).toEqual(pair);
  });

  it("forgets at once", async () => {
    const m = await load();
    m.savePayee(pair);
    m.forgetPayee();
    expect(m.readRaw()).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("gives the same text for the same stored value, so a render is not repeated for nothing", async () => {
    const m = await load();
    m.savePayee(pair);
    expect(m.readRaw()).toBe(m.readRaw());
  });
});

describe("parsePayee (criterion 54: a stored value that no longer passes is ignored)", () => {
  const text = (value: unknown) => JSON.stringify(value);
  const bad: [string, string | null][] = [
    ["nothing stored", null],
    ["not JSON", "{ nope"],
    ["an array", text([1, "meena.tuitions@okhdfc", "Meena Rao"])],
    ["null", "null"],
    ["a number", "5"],
    ["a string", text("meena.tuitions@okhdfc")],
    ["no name", text({ v: 1, upiId: pair.upiId })],
    ["no UPI ID", text({ v: 1, name: pair.name })],
    ["a number for the name", text({ v: 1, upiId: pair.upiId, name: 5 })],
    ["another version", text({ v: 2, ...pair })],
    ["no version", text(pair)],
    ["an invalid UPI ID", text({ v: 1, upiId: "meena tuitions@okhdfc", name: pair.name })],
    ["a UPI ID with outer spaces", text({ v: 1, upiId: " meena.tuitions@okhdfc", name: pair.name })],
    ["a 41-character name", text({ v: 1, upiId: pair.upiId, name: "a".repeat(41) })],
    ["an empty name", text({ v: 1, upiId: pair.upiId, name: "" })],
    ["a name with outer spaces, which is not the cleaned form", text({ v: 1, upiId: pair.upiId, name: " Meena Rao " })],
  ];

  it.each(bad)("returns null for %s", async (_name, raw) => {
    const { parsePayee } = await load();
    expect(parsePayee(raw)).toBeNull();
  });

  it("returns the pair, and only the pair, for a good value with extra fields", async () => {
    const { parsePayee } = await load();
    expect(parsePayee(text({ v: 1, ...pair, parent: "Suresh" }))).toEqual(pair);
  });

  it("accepts names in any script and a UPI ID's case as typed", async () => {
    const { parsePayee } = await load();
    const other = { upiId: "Meena.Rao@OkHDFC", name: "మీనా రావు" };
    expect(parsePayee(text({ v: 1, ...other }))).toEqual(other);
  });
});

describe("blocked storage (criterion 54)", () => {
  it("storage works in a normal browser, and the probe leaves nothing behind", async () => {
    const m = await load();
    expect(m.storageWorks()).toBe(true);
    expect(localStorage.length).toBe(0);
  });

  it("probes once, not on every call", async () => {
    const store = throwing();
    const setItem = vi.fn(store.setItem);
    setStorage({ ...store, setItem });
    const m = await load();
    for (let i = 0; i < 5; i++) expect(m.storageWorks()).toBe(true);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("setItem throwing: storage does not work, saving answers false, nothing throws", async () => {
    setStorage(throwing("setItem"));
    const m = await load();
    expect(m.storageWorks()).toBe(false);
    expect(m.savePayee(pair)).toBe(false);
    expect(m.readRaw()).toBeNull();
  });

  it("getItem throwing: reading answers null", async () => {
    setStorage(throwing("getItem"));
    const m = await load();
    expect(m.readRaw()).toBeNull();
    expect(m.parsePayee(m.readRaw())).toBeNull();
  });

  it("removeItem throwing: forgetting does not throw, and storage counts as not working", async () => {
    setStorage(throwing("removeItem"));
    const m = await load();
    expect(() => m.forgetPayee()).not.toThrow();
    expect(m.storageWorks()).toBe(false);
  });

  it("no localStorage at all: every call answers quietly", async () => {
    setStorage(undefined);
    const m = await load();
    expect(m.storageWorks()).toBe(false);
    expect(m.readRaw()).toBeNull();
    expect(m.savePayee(pair)).toBe(false);
    expect(() => m.forgetPayee()).not.toThrow();
  });

  it("a localStorage that throws when touched: every call answers quietly", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    const m = await load();
    expect(m.storageWorks()).toBe(false);
    expect(m.readRaw()).toBeNull();
    expect(m.savePayee(pair)).toBe(false);
    expect(() => m.forgetPayee()).not.toThrow();
  });
});
