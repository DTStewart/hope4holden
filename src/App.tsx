import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import About from "./pages/About";
import Tournament from "./pages/Tournament";
import Register from "./pages/Register";
import Sponsor from "./pages/Sponsor";
import Donate from "./pages/Donate";
import Gallery from "./pages/Gallery";
import FAQ from "./pages/FAQ";
import Contact from "./pages/Contact";
import Checkout from "./pages/Checkout";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Unsubscribe from "./pages/Unsubscribe";
import SponsorUpload from "./pages/SponsorUpload";
import SponsorInvite from "./pages/SponsorInvite";
import Auction from "./pages/Auction";
import AuctionMyWins from "./pages/AuctionMyWins";
import AuctionPay from "./pages/AuctionPay";
import Scorecard from "./pages/Scorecard";
import Leaderboard from "./pages/Leaderboard";
import DayOf from "./pages/DayOf";
import LiveDashboard from "./pages/LiveDashboard";
import SaveTheDate from "./pages/SaveTheDate";
import AdminMobile from "./pages/admin/AdminMobile";
import TeamManage from "./pages/TeamManage";
import TeamPublic from "./pages/TeamPublic";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Index />} />
                <Route path="/about" element={<About />} />
                <Route path="/tournament" element={<Tournament />} />
                <Route path="/register" element={<Register />} />
                <Route path="/sponsor" element={<Sponsor />} />
                <Route path="/donate" element={<Donate />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/participate" element={<Register />} />
                <Route path="/auction" element={<Auction />} />
                <Route path="/auction/my-wins" element={<AuctionMyWins />} />
                <Route path="/auction/pay/:token" element={<AuctionPay />} />
                <Route path="/score/:token" element={<Scorecard />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/day-of" element={<DayOf />} />
                <Route path="/team/manage/:token" element={<TeamManage />} />
                <Route path="/team/:slug" element={<TeamPublic />} />
                <Route path="/save-the-date" element={<SaveTheDate />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
              </Route>
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/mobile"
                element={
                  <ProtectedRoute>
                    <AdminMobile />
                  </ProtectedRoute>
                }
              />
              <Route path="/live" element={<LiveDashboard />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/sponsor-upload/:token" element={<SponsorUpload />} />
              <Route path="/sponsor-invite/:token" element={<Layout />}>
                <Route index element={<SponsorInvite />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
