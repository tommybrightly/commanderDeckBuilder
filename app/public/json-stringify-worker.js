self.onmessage = function (e) {
  if (e.data === "abort") return;
  try {
    const str = JSON.stringify(e.data);
    self.postMessage(str);
  } catch (err) {
    self.postMessage({ error: err.message });
  }
};
