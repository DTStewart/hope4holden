import { useCart } from "@/contexts/CartContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Trash2, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CartDrawer = () => {
  const { items, removeItem, totalAmount, isDrawerOpen, setDrawerOpen } = useCart();
  const navigate = useNavigate();

  const handleCheckout = () => {
    setDrawerOpen(false);
    navigate("/checkout");
  };

  return (
    <Sheet open={isDrawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-heading">
            <ShoppingCart className="h-5 w-5" />
            Your Cart
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <ShoppingCart className="h-12 w-12" />
            <p>Your cart is empty</p>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              Continue Shopping
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 py-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg bg-secondary"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.description}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold">${item.amount.toLocaleString()}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove ${item.description}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <Separator />
              <div className="flex items-center justify-between font-heading font-semibold text-lg">
                <span>Total</span>
                <span>${totalAmount.toLocaleString()}</span>
              </div>
              <SheetFooter className="flex flex-col gap-2 sm:flex-col">
                <Button onClick={handleCheckout} className="w-full" size="lg">
                  Proceed to Checkout
                </Button>
                <Button variant="outline" onClick={() => setDrawerOpen(false)} className="w-full">
                  Continue Shopping
                </Button>
              </SheetFooter>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
