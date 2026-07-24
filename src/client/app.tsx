import { lazy, Suspense, type ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation
} from "react-router";
import { Toasty } from "@cloudflare/kumo/components/toast";
import { Loader } from "@cloudflare/kumo";
import { AuthProvider, useAuth } from "@client/lib/auth";

const Home = lazy(() => import("./pages/home"));
const Chat = lazy(() => import("./pages/chat"));
const Action = lazy(() => import("./pages/action"));
const Login = lazy(() => import("./pages/login"));

/**
 * Gates a route behind the login. While the initial `GET /api/me` is in flight
 * we render nothing decisive (a spinner); once resolved, a logged-out visitor is
 * sent to `/login` with the path they wanted, so login can return them there.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Toasty>
      <AuthProvider>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-screen text-kumo-inactive">
              Loading...
            </div>
          }
        >
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <Home />
                  </RequireAuth>
                }
              />
              <Route
                path="/chat"
                element={
                  <RequireAuth>
                    <Chat />
                  </RequireAuth>
                }
              />
              <Route
                path="/action"
                element={
                  <RequireAuth>
                    <Action />
                  </RequireAuth>
                }
              />
            </Routes>
          </BrowserRouter>
        </Suspense>
      </AuthProvider>
    </Toasty>
  );
}
