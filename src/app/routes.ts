import { createBrowserRouter } from "react-router";
import Portal from "./pages/Portal";
import InternDashboard from "./pages/InternDashboard";
import QuizInterface from "./pages/QuizInterface";
import MentorDashboard from "./pages/MentorDashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Portal,
  },
  {
    path: "/intern",
    Component: InternDashboard,
  },
  {
    path: "/quiz",
    Component: QuizInterface,
  },
  {
    path: "/mentor",
    Component: MentorDashboard,
  },
]);
