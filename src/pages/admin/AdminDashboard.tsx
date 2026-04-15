import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Users, Handshake, Heart, Mail, Settings, UserPlus, Image, ShoppingCart, ClipboardList, UtensilsCrossed } from "lucide-react";
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

export default function AdminDashboard() {
  const { user, signOut } = useAuth();

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
        <Tabs defaultValue="registrations" className="space-y-6">
          <TabsList className="grid grid-cols-5 md:grid-cols-10 w-full">
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
        </Tabs>
      </div>
    </div>
  );
}
