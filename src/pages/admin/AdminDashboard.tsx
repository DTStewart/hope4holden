import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Users, Handshake, Heart, Mail, Settings, UserPlus, Image, ShoppingCart, ClipboardList, UtensilsCrossed, Send, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import RegistrationsTab from "./RegistrationsTab";
import SponsorsTab from "./SponsorsTab";
import DonationsTab from "./DonationsTab";
import OrdersTab from "./OrdersTab";
import MessagesTab from "./MessagesTab";
import SettingsTab from "./SettingsTab";
import SubscribersTab from "./SubscribersTab";
import GalleryTab from "./GalleryTab";
import WaitlistTab from "./WaitlistTab";
import DinnersTab from "./DinnersTab";
import EmailsTab from "./EmailsTab";
import BulkEmailTab from "./BulkEmailTab";
import DashboardStats from "./DashboardStats";

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Session-expiry guard: verify the auth session before any tab loads,
  // and re-check periodically. If expired/missing, toast + redirect.
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data, error } = await supabase.auth.getSession();
      let session = data?.session ?? null;
      const now = Math.floor(Date.now() / 1000);

      if (session?.expires_at && session.expires_at - now < 30) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        session = refreshed?.session ?? null;
      }

      if (cancelled) return;
      if (error || !session) {
        toast({
          title: "Session expired",
          description: "Please sign in again to continue.",
          variant: "destructive",
        });
        navigate("/admin/login", { replace: true });
      }
    };

    check();
    const id = setInterval(check, 60_000); // re-check every minute
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [navigate, toast]);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">
            Hope 4 Holden Admin
          </h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        <DashboardStats />
        <Tabs defaultValue="registrations" className="space-y-6">
          <TabsList className="grid grid-cols-4 md:grid-cols-12 w-full">
            <TabsTrigger value="registrations" className="text-xs md:text-sm">
              <Users className="h-4 w-4 mr-1 hidden md:inline" />
              Registrations
            </TabsTrigger>
            <TabsTrigger value="sponsors" className="text-xs md:text-sm">
              <Handshake className="h-4 w-4 mr-1 hidden md:inline" />
              Sponsors
            </TabsTrigger>
            <TabsTrigger value="donations" className="text-xs md:text-sm">
              <Heart className="h-4 w-4 mr-1 hidden md:inline" />
              Donations
            </TabsTrigger>
            <TabsTrigger value="orders" className="text-xs md:text-sm">
              <ShoppingCart className="h-4 w-4 mr-1 hidden md:inline" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="messages" className="text-xs md:text-sm">
              <Mail className="h-4 w-4 mr-1 hidden md:inline" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs md:text-sm">
              <Settings className="h-4 w-4 mr-1 hidden md:inline" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="subscribers" className="text-xs md:text-sm">
              <UserPlus className="h-4 w-4 mr-1 hidden md:inline" />
              Subscribers
            </TabsTrigger>
            <TabsTrigger value="gallery" className="text-xs md:text-sm">
              <Image className="h-4 w-4 mr-1 hidden md:inline" />
              Gallery
            </TabsTrigger>
            <TabsTrigger value="waitlist" className="text-xs md:text-sm">
              <ClipboardList className="h-4 w-4 mr-1 hidden md:inline" />
              Waitlist
            </TabsTrigger>
            <TabsTrigger value="dinners" className="text-xs md:text-sm">
              <UtensilsCrossed className="h-4 w-4 mr-1 hidden md:inline" />
              Dinners
            </TabsTrigger>
            <TabsTrigger value="emails" className="text-xs md:text-sm">
              <Send className="h-4 w-4 mr-1 hidden md:inline" />
              Emails
            </TabsTrigger>
            <TabsTrigger value="bulk-email" className="text-xs md:text-sm">
              <Megaphone className="h-4 w-4 mr-1 hidden md:inline" />
              Bulk Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="registrations"><RegistrationsTab /></TabsContent>
          <TabsContent value="sponsors"><SponsorsTab /></TabsContent>
          <TabsContent value="donations"><DonationsTab /></TabsContent>
          <TabsContent value="orders"><OrdersTab /></TabsContent>
          <TabsContent value="messages"><MessagesTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
          <TabsContent value="subscribers"><SubscribersTab /></TabsContent>
          <TabsContent value="gallery"><GalleryTab /></TabsContent>
          <TabsContent value="waitlist"><WaitlistTab /></TabsContent>
          <TabsContent value="dinners"><DinnersTab /></TabsContent>
          <TabsContent value="emails"><EmailsTab /></TabsContent>
          <TabsContent value="bulk-email"><BulkEmailTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
