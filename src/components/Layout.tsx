import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import CartDrawer from "./CartDrawer";

const Layout = () => (
  <div className="flex flex-col min-h-screen">
    <Header />
    <main className="flex-1">
      <Outlet />
    </main>
    <Footer />
    <CartDrawer />
  </div>
);

export default Layout;
