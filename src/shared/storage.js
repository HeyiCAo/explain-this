export const hasExtensionStorage = () => (
  typeof chrome !== 'undefined' && Boolean(chrome?.storage?.local)
);

export const getStorage = (keys) => new Promise((resolve) => {
  if (!hasExtensionStorage()) {
    resolve({});
    return;
  }
  chrome.storage.local.get(keys, resolve);
});

export const setStorage = (values) => new Promise((resolve) => {
  if (!hasExtensionStorage()) {
    resolve();
    return;
  }
  chrome.storage.local.set(values, resolve);
});

export const removeStorage = (keys) => new Promise((resolve) => {
  if (!hasExtensionStorage()) {
    resolve();
    return;
  }
  chrome.storage.local.remove(keys, resolve);
});
