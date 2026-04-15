import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type CartItemType = "registration" | "sponsorship" | "donation" | "dinner";

export interface CartItem {
  id: string;
  type: CartItemType;
  description: string;
  amount: number;
  formData: Record<string, any>;
}

export interface CartContact {
  name: string;
  email: string;
  phone: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  totalAmount: number;
  itemCount: number;
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  contact: CartContact;
  setContact: (contact: Partial<CartContact>) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "h4h_cart";
const CONTACT_STORAGE_KEY = "h4h_contact";

const emptyContact: CartContact = { name: "", email: "", phone: "" };

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [contact, setContactState] = useState<CartContact>(() => {
    try {
      const stored = localStorage.getItem(CONTACT_STORAGE_KEY);
      return stored ? { ...emptyContact, ...JSON.parse(stored) } : emptyContact;
    } catch {
      return emptyContact;
    }
  });
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(contact));
  }, [contact]);

  const setContact = useCallback((partial: Partial<CartContact>) => {
    setContactState((prev) => ({ ...prev, ...partial }));
  }, []);

  const addItem = useCallback((item: Omit<CartItem, "id">) => {
    const newItem: CartItem = { ...item, id: crypto.randomUUID() };
    setItems((prev) => [...prev, newItem]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setContactState(emptyContact);
    localStorage.removeItem(CONTACT_STORAGE_KEY);
  }, []);

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const itemCount = items.length;

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, clearCart, totalAmount, itemCount, isDrawerOpen, setDrawerOpen, contact, setContact }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
};
