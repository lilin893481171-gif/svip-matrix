const getElectron = () => {
  if (typeof window !== 'undefined' && window.electron) return window.electron;
  return {
    ipcRenderer: {
      invoke: async () => ({ success: false, message: '非原生环境' }),
      on: () => {},
      send: () => {},
      removeAllListeners: () => {}
    }
  };
};

export default getElectron;
