import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import HomePage from "../pages/HomePage.jsx";
import LoginPage from "../pages/LoginPage.jsx";
import AdminPage from "../pages/AdminPage.jsx";
import DisplayPage from "../pages/DisplayPage.jsx";
import {
  DetailPage,
  FeaturesPage,
  HistoryPage,
  LivePage,
} from "../pages/PublicPages.jsx";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/live/:id" element={<LiveRoute />} />
        <Route path="/match/:id" element={<DetailRoute />} />
        <Route path="/display/:id" element={<DisplayRoute />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
function LiveRoute() {
  const { id } = useParams();
  return <LivePage id={id} />;
}
function DetailRoute() {
  const { id } = useParams();
  return <DetailPage id={id} />;
}
function DisplayRoute() {
  const { id } = useParams();
  return <DisplayPage id={id} />;
}
