import React, { useState } from "react";

const App: React.FC = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Electron + React + TypeScript</h1>
        <p>
          Edit <code>src/renderer/App.tsx</code> and save to reload.
        </p>
        <div className="card">
          <button onClick={() => setCount((count) => count + 1)}>
            Count is {count}
          </button>
        </div>
      </header>
    </div>
  );
};

export default App;
