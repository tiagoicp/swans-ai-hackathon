import { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { Toasty } from "@cloudflare/kumo/components/toast";
import Home from "./pages/home";
import Chat from "./pages/chat";
import Action from "./pages/action";

export default function App() {
  return (
    <Toasty>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen text-kumo-inactive">
            Loading...
          </div>
        }
      >
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/action" element={<Action />} />
          </Routes>
        </BrowserRouter>
      </Suspense>
    </Toasty>
  );
}
