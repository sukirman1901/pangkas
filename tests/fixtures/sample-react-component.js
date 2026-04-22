export const fixture = `
import React, { useState } from 'react';

// TODO: Add prop types
function Counter({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);
  
  // IMPORTANT: Don't mutate state directly
  const increment = () => {
    setCount(count + 1);
  };
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
}

export default Counter;
`;
