import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { Toasty } from "@cloudflare/kumo/components/toast";

const Home = lazy(() => import("./pages/home"));
const Chat = lazy(() => import("./pages/chat"));
const Action = lazy(() => import("./pages/action"));
const CasePage = lazy(() => import("./pages/case"));

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
            <Route path="/case" element={<CasePage />} />
          </Routes>
        </BrowserRouter>
      </Suspense>
    </Toasty>
  );
}
