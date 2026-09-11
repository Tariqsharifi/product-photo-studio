import { BrowserRouter, Routes, Route } from "react-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import Dashboard from "./pages/Dashboard";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function App() {
  return (
    <ConvexProvider client={convex}>
      <BrowserRouter basename="/product-photo-studio">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </ConvexProvider>
  );
}

export default App;
