export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      auction_bidders: {
        Row: {
          attending_event: boolean
          auth_user_id: string | null
          created_at: string
          display_name: string
          email: string
          id: string
          notify_outbid_sms: boolean
          payment_method_id: string | null
          phone: string
          phone_verified_at: string | null
          session_token: string | null
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          attending_event?: boolean
          auth_user_id?: string | null
          created_at?: string
          display_name: string
          email: string
          id?: string
          notify_outbid_sms?: boolean
          payment_method_id?: string | null
          phone: string
          phone_verified_at?: string | null
          session_token?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          attending_event?: boolean
          auth_user_id?: string | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          notify_outbid_sms?: boolean
          payment_method_id?: string | null
          phone?: string
          phone_verified_at?: string | null
          session_token?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      auction_bids: {
        Row: {
          amount: number
          bidder_id: string
          created_at: string
          id: string
          item_id: string
        }
        Insert: {
          amount: number
          bidder_id: string
          created_at?: string
          id?: string
          item_id: string
        }
        Update: {
          amount?: number
          bidder_id?: string
          created_at?: string
          id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_bids_bidder_id_fkey"
            columns: ["bidder_id"]
            isOneToOne: false
            referencedRelation: "auction_bidders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_bids_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "auction_items"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_invoices: {
        Row: {
          amount: number
          bidder_id: string
          created_at: string
          error_message: string | null
          id: string
          item_id: string
          notified_at: string | null
          paid_at: string | null
          payment_link_token: string | null
          status: string
          stripe_payment_intent_id: string | null
          tax_receipt_amount: number
          updated_at: string
        }
        Insert: {
          amount: number
          bidder_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          item_id: string
          notified_at?: string | null
          paid_at?: string | null
          payment_link_token?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          tax_receipt_amount?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          bidder_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          item_id?: string
          notified_at?: string | null
          paid_at?: string | null
          payment_link_token?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          tax_receipt_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_invoices_bidder_id_fkey"
            columns: ["bidder_id"]
            isOneToOne: false
            referencedRelation: "auction_bidders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_invoices_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "auction_items"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_items: {
        Row: {
          bid_increment: number | null
          created_at: string
          description: string | null
          donated_by: string | null
          ends_at: string | null
          id: string
          images: Json
          market_value: number
          pickup_notes: string | null
          pickup_option: string
          sort_order: number
          starting_bid: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          bid_increment?: number | null
          created_at?: string
          description?: string | null
          donated_by?: string | null
          ends_at?: string | null
          id?: string
          images?: Json
          market_value?: number
          pickup_notes?: string | null
          pickup_option?: string
          sort_order?: number
          starting_bid?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          bid_increment?: number | null
          created_at?: string
          description?: string | null
          donated_by?: string | null
          ends_at?: string | null
          id?: string
          images?: Json
          market_value?: number
          pickup_notes?: string | null
          pickup_option?: string
          sort_order?: number
          starting_bid?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      auction_settings: {
        Row: {
          anti_snipe_seconds: number
          bidding_closes_at: string | null
          bidding_opens_at: string | null
          default_bid_increment: number
          id: number
          is_live: boolean
          notes: string | null
          updated_at: string
        }
        Insert: {
          anti_snipe_seconds?: number
          bidding_closes_at?: string | null
          bidding_opens_at?: string | null
          default_bid_increment?: number
          id?: number
          is_live?: boolean
          notes?: string | null
          updated_at?: string
        }
        Update: {
          anti_snipe_seconds?: number
          bidding_closes_at?: string | null
          bidding_opens_at?: string | null
          default_bid_increment?: number
          id?: number
          is_live?: boolean
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dinners: {
        Row: {
          amount: number
          created_at: string
          guest_email: string
          guest_name: string
          guest_phone: string
          id: string
          paid: boolean
          quantity: number
          stripe_session_id: string | null
          tournament_year: number
        }
        Insert: {
          amount: number
          created_at?: string
          guest_email: string
          guest_name: string
          guest_phone: string
          id?: string
          paid?: boolean
          quantity?: number
          stripe_session_id?: string | null
          tournament_year?: number
        }
        Update: {
          amount?: number
          created_at?: string
          guest_email?: string
          guest_name?: string
          guest_phone?: string
          id?: string
          paid?: boolean
          quantity?: number
          stripe_session_id?: string | null
          tournament_year?: number
        }
        Relationships: []
      }
      donations: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          donor_address: string | null
          donor_city: string | null
          donor_email: string
          donor_name: string
          donor_postal_code: string | null
          donor_province: string | null
          id: string
          method: string
          paid: boolean
          public_display_consent: boolean
          public_display_name: string | null
          stripe_session_id: string | null
          team_id: string | null
          tournament_year: number
          wants_recurring: boolean
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          donor_address?: string | null
          donor_city?: string | null
          donor_email: string
          donor_name: string
          donor_postal_code?: string | null
          donor_province?: string | null
          id?: string
          method?: string
          paid?: boolean
          public_display_consent?: boolean
          public_display_name?: string | null
          stripe_session_id?: string | null
          team_id?: string | null
          tournament_year?: number
          wants_recurring?: boolean
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          donor_address?: string | null
          donor_city?: string | null
          donor_email?: string
          donor_name?: string
          donor_postal_code?: string | null
          donor_province?: string | null
          id?: string
          method?: string
          paid?: boolean
          public_display_consent?: boolean
          public_display_name?: string | null
          stripe_session_id?: string | null
          team_id?: string | null
          tournament_year?: number
          wants_recurring?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "donations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      extra_golfer_invites: {
        Row: {
          created_at: string
          golfer_count: number
          golfing_with: string | null
          id: string
          price_per_golfer: number
          token: string
          used: boolean
          used_at: string | null
        }
        Insert: {
          created_at?: string
          golfer_count: number
          golfing_with?: string | null
          id?: string
          price_per_golfer?: number
          token?: string
          used?: boolean
          used_at?: string | null
        }
        Update: {
          created_at?: string
          golfer_count?: number
          golfing_with?: string | null
          id?: string
          price_per_golfer?: number
          token?: string
          used?: boolean
          used_at?: string | null
        }
        Relationships: []
      }
      gallery_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          photo_url: string
          sort_order: number
          year: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_url: string
          sort_order?: number
          year: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_url?: string
          sort_order?: number
          year?: number
        }
        Relationships: []
      }
      live_dashboard_settings: {
        Row: {
          id: number
          refresh_interval_seconds: number
          show_auction: boolean
          show_fundraising: boolean
          show_leaderboard: boolean
          show_rainbow: boolean
          updated_at: string
        }
        Insert: {
          id?: number
          refresh_interval_seconds?: number
          show_auction?: boolean
          show_fundraising?: boolean
          show_leaderboard?: boolean
          show_rainbow?: boolean
          updated_at?: string
        }
        Update: {
          id?: number
          refresh_interval_seconds?: number
          show_auction?: boolean
          show_fundraising?: boolean
          show_leaderboard?: boolean
          show_rainbow?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          sender_email: string
          sender_name: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          sender_email: string
          sender_name: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          sender_email?: string
          sender_name?: string
          subject?: string | null
        }
        Relationships: []
      }
      next_year_interest: {
        Row: {
          attended_prior_year: boolean
          created_at: string
          email: string
          id: string
          name: string | null
          source: string
        }
        Insert: {
          attended_prior_year?: boolean
          created_at?: string
          email: string
          id?: string
          name?: string | null
          source?: string
        }
        Update: {
          attended_prior_year?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          source?: string
        }
        Relationships: []
      }
      pending_orders: {
        Row: {
          created_at: string
          id: string
          items: Json
          status: string
          stripe_session_id: string | null
          total_amount: number
          tournament_year: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          status?: string
          stripe_session_id?: string | null
          total_amount?: number
          tournament_year?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          status?: string
          stripe_session_id?: string | null
          total_amount?: number
          tournament_year?: number
          updated_at?: string
        }
        Relationships: []
      }
      rainbow_auction_winners: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          prize_description: string
          sort_order: number
          updated_at: string
          winner_name: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          prize_description: string
          sort_order?: number
          updated_at?: string
          winner_name: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          prize_description?: string
          sort_order?: number
          updated_at?: string
          winner_name?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          business_name: string | null
          captain_address: string | null
          captain_city: string | null
          captain_email: string
          captain_name: string
          captain_phone: string
          captain_postal_code: string | null
          captain_province: string | null
          created_at: string
          golfer_count: number | null
          golfing_with: string | null
          id: string
          is_extra_golfers: boolean
          paid: boolean
          parent_token: string | null
          score_token: string
          status: string
          stripe_session_id: string | null
          team_members: Json
          team_name: string
          team_photo_url: string | null
          team_slug: string
          tournament_year: number
          updated_at: string
        }
        Insert: {
          business_name?: string | null
          captain_address?: string | null
          captain_city?: string | null
          captain_email: string
          captain_name: string
          captain_phone: string
          captain_postal_code?: string | null
          captain_province?: string | null
          created_at?: string
          golfer_count?: number | null
          golfing_with?: string | null
          id?: string
          is_extra_golfers?: boolean
          paid?: boolean
          parent_token?: string | null
          score_token?: string
          status?: string
          stripe_session_id?: string | null
          team_members?: Json
          team_name: string
          team_photo_url?: string | null
          team_slug: string
          tournament_year?: number
          updated_at?: string
        }
        Update: {
          business_name?: string | null
          captain_address?: string | null
          captain_city?: string | null
          captain_email?: string
          captain_name?: string
          captain_phone?: string
          captain_postal_code?: string | null
          captain_province?: string | null
          created_at?: string
          golfer_count?: number | null
          golfing_with?: string | null
          id?: string
          is_extra_golfers?: boolean
          paid?: boolean
          parent_token?: string | null
          score_token?: string
          status?: string
          stripe_session_id?: string | null
          team_members?: Json
          team_name?: string
          team_photo_url?: string | null
          team_slug?: string
          tournament_year?: number
          updated_at?: string
        }
        Relationships: []
      }
      scorecard_submissions: {
        Row: {
          admin_note: string | null
          created_at: string
          disqualified: boolean
          final_score: number
          id: string
          photo_url: string
          registration_id: string
          submitter_note: string | null
          updated_at: string
          verified: boolean
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          disqualified?: boolean
          final_score: number
          id?: string
          photo_url: string
          registration_id: string
          submitter_note?: string | null
          updated_at?: string
          verified?: boolean
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          disqualified?: boolean
          final_score?: number
          id?: string
          photo_url?: string
          registration_id?: string
          submitter_note?: string | null
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "scorecard_submissions_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      sponsor_invites: {
        Row: {
          amount: number
          created_at: string
          expires_at: string
          id: string
          tier_id: string
          tier_name: string
          token: string
          used: boolean
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string
          id?: string
          tier_id: string
          tier_name: string
          token?: string
          used?: boolean
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string
          id?: string
          tier_id?: string
          tier_name?: string
          token?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_invites_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "sponsorship_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          amount: number
          approved: boolean
          brand_assets: Json
          business_name: string
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          facebook_handle: string | null
          id: string
          instagram_handle: string | null
          logo_upload_token: string | null
          logo_url: string | null
          paid: boolean
          stripe_session_id: string | null
          tier_id: string | null
          tier_name: string
          tournament_year: number
          updated_at: string
        }
        Insert: {
          amount: number
          approved?: boolean
          brand_assets?: Json
          business_name: string
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          facebook_handle?: string | null
          id?: string
          instagram_handle?: string | null
          logo_upload_token?: string | null
          logo_url?: string | null
          paid?: boolean
          stripe_session_id?: string | null
          tier_id?: string | null
          tier_name: string
          tournament_year?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          approved?: boolean
          brand_assets?: Json
          business_name?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          facebook_handle?: string | null
          id?: string
          instagram_handle?: string | null
          logo_upload_token?: string | null
          logo_url?: string | null
          paid?: boolean
          stripe_session_id?: string | null
          tier_id?: string | null
          tier_name?: string
          tournament_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "sponsorship_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsorship_tiers: {
        Row: {
          active: boolean
          benefits: Json
          created_at: string
          id: string
          max_slots: number | null
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          benefits?: Json
          created_at?: string
          id?: string
          max_slots?: number | null
          name: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          benefits?: Json
          created_at?: string
          id?: string
          max_slots?: number | null
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      ugc_photos: {
        Row: {
          admin_note: string | null
          caption: string | null
          created_at: string
          id: string
          photo_url: string
          registration_id: string
          status: string
          submitter_note: string | null
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          caption?: string | null
          created_at?: string
          id?: string
          photo_url: string
          registration_id: string
          status?: string
          submitter_note?: string | null
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          caption?: string | null
          created_at?: string
          id?: string
          photo_url?: string
          registration_id?: string
          status?: string
          submitter_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ugc_photos_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          team_name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone: string
          team_name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          team_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      auction_bid_display: {
        Row: {
          amount: number | null
          bidder_display_name: string | null
          bidder_id: string | null
          created_at: string | null
          id: string | null
          item_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auction_bids_bidder_id_fkey"
            columns: ["bidder_id"]
            isOneToOne: false
            referencedRelation: "auction_bidders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_bids_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "auction_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors_public: {
        Row: {
          approved: boolean | null
          brand_assets: Json | null
          business_name: string | null
          id: string | null
          logo_url: string | null
          tier_id: string | null
          tier_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_next_year_interest: {
        Args: {
          _attended_prior_year?: boolean
          _email: string
          _name?: string
          _source?: string
        }
        Returns: Json
      }
      admin_clear_bidder_payment_method: {
        Args: { _bidder_id: string }
        Returns: boolean
      }
      attach_bidder_payment_method: {
        Args: { _payment_method_id: string }
        Returns: boolean
      }
      decrement_sponsor_slots: { Args: { _tier_id: string }; Returns: number }
      decrement_spots: { Args: never; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_approved_ugc: {
        Args: { _limit?: number }
        Returns: {
          caption: string
          created_at: string
          id: string
          photo_url: string
          team_name: string
        }[]
      }
      get_current_tournament_year: { Args: never; Returns: number }
      get_fundraising_total: { Args: never; Returns: Json }
      get_leaderboard: {
        Args: never
        Returns: {
          business_name: string
          final_score: number
          photo_url: string
          registration_id: string
          submitted_at: string
          team_name: string
        }[]
      }
      get_live_dashboard_state: { Args: never; Returns: Json }
      get_my_bidder_profile: {
        Args: never
        Returns: {
          attending_event: boolean
          display_name: string
          email: string
          has_payment_method: boolean
          id: string
          notify_outbid_sms: boolean
          phone: string
        }[]
      }
      get_public_recent_donors: {
        Args: { _limit?: number }
        Returns: {
          amount: number
          created_at: string
          display_name: string
        }[]
      }
      get_public_sponsors: {
        Args: never
        Returns: {
          approved: boolean
          brand_assets: Json
          business_name: string
          id: string
          logo_url: string
          tier_id: string
          tier_name: string
        }[]
      }
      get_team_for_management: {
        Args: { _token: string }
        Returns: {
          business_name: string
          captain_email: string
          captain_name: string
          registration_id: string
          team_fundraising_total: number
          team_members: Json
          team_name: string
          team_photo_url: string
          team_slug: string
        }[]
      }
      get_team_id_by_slug: { Args: { _slug: string }; Returns: string }
      get_team_public: {
        Args: { _slug: string }
        Returns: {
          business_name: string
          member_first_names: string[]
          registration_id: string
          team_fundraising_total: number
          team_name: string
          team_photo_url: string
          team_slug: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lookup_auction_invoice_by_token: {
        Args: { _token: string }
        Returns: {
          amount: number
          bidder_display_name: string
          id: string
          item_id: string
          item_title: string
          status: string
          stripe_payment_intent_id: string
        }[]
      }
      lookup_extra_golfer_invite: {
        Args: { _token: string }
        Returns: {
          golfer_count: number
          golfing_with: string
          id: string
          price_per_golfer: number
          token: string
          used: boolean
        }[]
      }
      lookup_sponsor_invite: {
        Args: { invite_token: string }
        Returns: {
          amount: number
          created_at: string
          expires_at: string
          id: string
          tier_id: string
          tier_name: string
          token: string
          used: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "sponsor_invites"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lookup_team_by_score_token: {
        Args: { _token: string }
        Returns: {
          already_submitted: boolean
          business_name: string
          registration_id: string
          team_name: string
        }[]
      }
      mark_auction_invoice_paid: {
        Args: { _payment_intent_id: string; _token: string }
        Returns: Json
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_auction_invoices: {
        Args: never
        Returns: {
          amount: number
          created_at: string
          id: string
          item_id: string
          item_title: string
          paid_at: string
          payment_link_token: string
          status: string
        }[]
      }
      place_bid: { Args: { _amount: number; _item_id: string }; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      submit_scorecard: {
        Args: {
          _final_score: number
          _photo_url: string
          _submitter_note?: string
          _token: string
        }
        Returns: Json
      }
      submit_team_ugc: {
        Args: { _caption?: string; _photo_url: string; _token: string }
        Returns: Json
      }
      update_bidder_attending: {
        Args: { _attending: boolean }
        Returns: boolean
      }
      update_bidder_notify_outbid: {
        Args: { _enabled: boolean }
        Returns: boolean
      }
      update_team_details: {
        Args: { _team_members: Json; _team_photo_url: string; _token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
