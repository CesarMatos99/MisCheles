import React, { createContext, useContext } from 'react';

interface WebAccessContextValue {
  mode: 'account' | 'demo';
  exitDemo: () => void;
}

const WebAccessContext = createContext<WebAccessContextValue>({ mode: 'account', exitDemo: () => undefined });

export const WebAccessProvider: React.FC<React.PropsWithChildren<WebAccessContextValue>> = ({ mode, exitDemo, children }) => (
  <WebAccessContext.Provider value={{ mode, exitDemo }}>{children}</WebAccessContext.Provider>
);

export function useWebAccess() {
  return useContext(WebAccessContext);
}
