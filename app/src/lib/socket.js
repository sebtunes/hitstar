let socket = null;
let listeners = new Set();
let queue = [];

export function connect(url) {
  return new Promise((resolve, reject) => {
    try {
      socket = new WebSocket(url);
    } catch (err) {
      return reject(err);
    }
    socket.onopen = () => resolve(socket);
    socket.onerror = (e) => reject(e);
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      listeners.forEach((fn) => fn(msg));
    };
  });
}

export function onMessage(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function send(type, payload) {
  if (socket && socket.readyState === 1) {
    socket.send(JSON.stringify({ type, ...payload }));
  }
}

export function disconnect() {
  if (socket) {
    socket.close();
    socket = null;
  }
  listeners.clear();
}
