import {
  NiimbotBluetoothClient,
  ImageEncoder,
  LabelType,
} from "@mmote/niimbluelib";

// Niimbot's primary GATT service UUID — required so the GATT calls inside
// the library succeed after the user picks a device.
const NIIMBOT_SERVICE = "e7810a71-73ae-499d-8c15-faa9aef0c3f2";

let client = null;
let connectionInfo = null;
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn(getStatus()));

export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getStatus = () => ({
  connected: !!client?.isConnected(),
  printerInfo: connectionInfo,
});

export const isBluetoothAvailable = () =>
  typeof navigator !== "undefined" && !!navigator.bluetooth;

/**
 * Temporarily replace `navigator.bluetooth.requestDevice` with a version
 * that uses `acceptAllDevices: true` instead of the namePrefix filter
 * niimbluelib ships with. Restored on exit.
 *
 * Why: niimbluelib builds its filter list from a hardcoded `modelsLibrary`
 * — `{ namePrefix: <first-letter-of-each-known-model> }` — plus the
 * niimbot service UUID. In practice a lot of real-world Niimbot printers
 * advertise either:
 *   - under a non-letter-prefixed name (a number, a localised string,
 *     or a sticker-style serial that doesn't match the lib's letters); or
 *   - without their primary service UUID in the advertising payload (BLE
 *     peripherals routinely omit it to save power, exposing it only on
 *     GATT connect).
 * Both fail Chrome's filter logic and the chooser shows "No compatible
 * devices found" — even though the printer is sitting right there and
 * the user's phone (which never filters) finds it instantly.
 *
 * We merge the niimbot service UUID into `optionalServices` so the
 * post-pair GATT traversal still finds the printer's characteristic.
 */
const installPermissiveRequestDevice = () => {
  const bt = navigator.bluetooth;
  const original = bt.requestDevice.bind(bt);
  bt.requestDevice = (options) => {
    const opts = options || {};
    const optionalServices = new Set([NIIMBOT_SERVICE]);
    if (Array.isArray(opts.optionalServices)) {
      for (const s of opts.optionalServices) optionalServices.add(s);
    }
    if (Array.isArray(opts.filters)) {
      for (const f of opts.filters) {
        if (Array.isArray(f.services)) {
          for (const s of f.services) optionalServices.add(s);
        }
      }
    }
    // eslint-disable-next-line no-console
    console.info("[niimbot] requestDevice override → acceptAllDevices=true", {
      optionalServices: Array.from(optionalServices),
    });
    return original({
      acceptAllDevices: true,
      optionalServices: Array.from(optionalServices),
    });
  };
  return () => {
    bt.requestDevice = original;
  };
};

/**
 * Map low-level Web Bluetooth errors to actionable guidance. The native
 * messages ("User cancelled", "GATT operation failed", etc.) don't tell
 * the user *what to do next*, so we translate them.
 */
const friendlyConnectError = (err) => {
  const raw = err?.message || String(err) || "";
  const name = err?.name || "";

  // User dismissed the chooser (or there was nothing to pick).
  if (name === "NotFoundError" || /user cancelled|chooser cancelled|no device selected/i.test(raw)) {
    return new Error(
      "No printer was picked. If your Niimbot doesn't appear in the list:\n" +
      "1. Make sure it's powered on and *not* currently connected to your phone (Bluetooth bonds are exclusive — disconnect from the NIIMBOT app first).\n" +
      "2. Hold the printer's power button for ~2 seconds until you hear the pairing tone (or the LED blinks).\n" +
      "3. Try the chooser again."
    );
  }

  // Chrome's internal abort when the page hasn't gestured recently or
  // the OS refused the request (Windows: BT off, Mac: privacy denied).
  if (name === "SecurityError" || /security|permission/i.test(raw)) {
    return new Error(
      "Bluetooth access was refused. Open chrome://bluetooth-internals " +
      "(or check OS Bluetooth settings) and make sure Bluetooth is on " +
      "and the browser has permission."
    );
  }

  // GATT failed mid-connect → bad pairing state or wrong device picked.
  if (name === "NetworkError" || /gatt/i.test(raw)) {
    return new Error(
      "Couldn't talk to the printer after pairing. This usually means " +
      "the wrong device was picked, or the printer is already bonded to " +
      "your phone. Disconnect it on the phone (Settings → Bluetooth → " +
      "Forget) and try again."
    );
  }

  if (/suitable device characteristic/i.test(raw)) {
    return new Error(
      "The device you picked isn't a recognised Niimbot printer. " +
      "Make sure you selected your label printer (model name usually " +
      "starts with B, D, or K) and not headphones / another BLE device."
    );
  }

  return new Error(raw || "Failed to connect to the printer.");
};

export const connect = async () => {
  if (!isBluetoothAvailable()) {
    throw new Error("Web Bluetooth is not supported on this device. Please use Chrome or Edge on a desktop/Android.");
  }
  if (client?.isConnected()) return getStatus();

  client = new NiimbotBluetoothClient();

  client.on("disconnect", () => {
    client = null;
    connectionInfo = null;
    notify();
  });

  const restoreRequestDevice = installPermissiveRequestDevice();
  try {
    await client.connect();
    const info = await client.fetchPrinterInfo();
    connectionInfo = info;
    notify();
    return getStatus();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[niimbot] connect failed:", err);
    // Clean up the half-instantiated client so the next attempt starts fresh.
    try { await client?.disconnect?.(); } catch { /* ignore */ }
    client = null;
    connectionInfo = null;
    notify();
    throw friendlyConnectError(err);
  } finally {
    restoreRequestDevice();
  }
};

export const disconnect = async () => {
  if (client) {
    try {
      await client.disconnect();
    } catch {
      // force cleanup even if BLE disconnect fails
    }
    client = null;
    connectionInfo = null;
    notify();
  }
};

/**
 * Print a single canvas to the connected printer.
 * Canvas should be portrait (96x176) matching 12x22mm at 203 DPI.
 */
export const printCanvas = async (canvas, quantity = 1, onProgress) => {
  if (!client?.isConnected()) throw new Error("Printer not connected");

  const encoded = ImageEncoder.encodeCanvas(canvas, "left");

  const printTaskName = client.getPrintTaskType() ?? "D110";
  const printTask = client.abstraction.newPrintTask(printTaskName, {
    totalPages: quantity,
    labelType: LabelType.Transparent,
    density: 3,
    statusPollIntervalMs: 100,
    statusTimeoutMs: 10_000,
  });

  try {
    await printTask.printInit();
    for (let i = 0; i < quantity; i++) {
      await printTask.printPage(encoded, 1);
      if (onProgress) onProgress(i + 1, quantity);
    }
    await printTask.waitForFinished();
  } finally {
    await printTask.printEnd();
  }
};

/**
 * Print multiple canvases (batch).
 */
export const printBatch = async (canvases, onProgress) => {
  if (!client?.isConnected()) throw new Error("Printer not connected");

  for (let i = 0; i < canvases.length; i++) {
    await printCanvas(canvases[i], 1);
    if (onProgress) onProgress(i + 1, canvases.length);
  }
};
