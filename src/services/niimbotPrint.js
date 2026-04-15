import {
  NiimbotBluetoothClient,
  ImageEncoder,
  LabelType,
} from "@mmote/niimbluelib";

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

  await client.connect();
  const info = await client.fetchPrinterInfo();
  connectionInfo = info;
  notify();
  return getStatus();
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
