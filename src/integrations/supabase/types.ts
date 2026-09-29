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
      approval_limits: {
        Row: {
          id: string
          max_amount: number
          permission_key: string
          role_id: string
          tenant_id: string | null
        }
        Insert: {
          id?: string
          max_amount: number
          permission_key: string
          role_id: string
          tenant_id?: string | null
        }
        Update: {
          id?: string
          max_amount?: number
          permission_key?: string
          role_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_limits_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "approval_limits_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_limits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          reason: string | null
          record_id: string | null
          table_name: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_codes: {
        Row: {
          category: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_taxable: boolean
          name: string
          property_id: string
          tenant_id: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_taxable?: boolean
          name: string
          property_id: string
          tenant_id: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_taxable?: boolean
          name?: string
          property_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "charge_codes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          doc_type: string
          id: string
          next_number: number
          padding: number
          prefix: string
          property_id: string
          tenant_id: string
        }
        Insert: {
          doc_type: string
          id?: string
          next_number?: number
          padding?: number
          prefix?: string
          property_id: string
          tenant_id: string
        }
        Update: {
          doc_type?: string
          id?: string
          next_number?: number
          padding?: number
          prefix?: string
          property_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_sequences_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_sequences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string
          currency: string
          id: string
          property_id: string
          rate: number
          rate_date: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency: string
          id?: string
          property_id: string
          rate: number
          rate_date: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          property_id?: string
          rate?: number
          rate_date?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_bookings: {
        Row: {
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          property_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          property_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          property_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_documents: {
        Row: {
          created_at: string
          doc_number: string
          doc_type: string
          expiry: string | null
          guest_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          doc_number: string
          doc_type: string
          expiry?: string | null
          guest_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          doc_number?: string
          doc_type?: string
          expiry?: string | null
          guest_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_documents_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_feedback: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          guest_id: string
          id: string
          status: string
          tenant_id: string
          text: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          guest_id: string
          id?: string
          status?: string
          tenant_id: string
          text: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          guest_id?: string
          id?: string
          status?: string
          tenant_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_feedback_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          address: string | null
          anonymised_at: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          merged_into: string | null
          nationality: string | null
          notes: string | null
          phone: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          anonymised_at?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name?: string
          merged_into?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          anonymised_at?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          merged_into?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
          property_id: string
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          name: string
          property_id: string
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          property_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string
          key: string
          module: string
        }
        Insert: {
          description: string
          key: string
          module: string
        }
        Update: {
          description?: string
          key?: string
          module?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          code: string
          created_at: string
          max_properties: number | null
          max_rooms: number | null
          max_users: number | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          max_properties?: number | null
          max_rooms?: number | null
          max_users?: number | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          max_properties?: number | null
          max_rooms?: number | null
          max_users?: number | null
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          base_currency: string
          business_date: string
          check_in_time: string
          check_out_time: string
          city: string | null
          code: string
          country: string | null
          created_at: string
          id: string
          max_stay_nights: number
          name: string
          tenant_id: string
          tentative_hold_hours: number
          timezone: string
        }
        Insert: {
          address?: string | null
          base_currency?: string
          business_date?: string
          check_in_time?: string
          check_out_time?: string
          city?: string | null
          code: string
          country?: string | null
          created_at?: string
          id?: string
          max_stay_nights?: number
          name: string
          tenant_id: string
          tentative_hold_hours?: number
          timezone?: string
        }
        Update: {
          address?: string | null
          base_currency?: string
          business_date?: string
          check_in_time?: string
          check_out_time?: string
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string
          id?: string
          max_stay_nights?: number
          name?: string
          tenant_id?: string
          tentative_hold_hours?: number
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_plan_prices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          property_id: string
          rate_plan_id: string
          room_type_id: string
          tenant_id: string
          valid_from: string
          valid_to: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          property_id: string
          rate_plan_id: string
          room_type_id: string
          tenant_id: string
          valid_from: string
          valid_to: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          property_id?: string
          rate_plan_id?: string
          room_type_id?: string
          tenant_id?: string
          valid_from?: string
          valid_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_plan_prices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_plan_prices_rate_plan_id_fkey"
            columns: ["rate_plan_id"]
            isOneToOne: false
            referencedRelation: "rate_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_plan_prices_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_plan_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_plans: {
        Row: {
          cancellation_policy_type: string
          cancellation_policy_value: number
          code: string
          created_at: string
          deposit_policy_type: string
          deposit_policy_value: number
          id: string
          is_active: boolean
          is_corporate: boolean
          name: string
          no_show_policy_type: string
          no_show_policy_value: number
          property_id: string
          tenant_id: string
        }
        Insert: {
          cancellation_policy_type?: string
          cancellation_policy_value?: number
          code: string
          created_at?: string
          deposit_policy_type?: string
          deposit_policy_value?: number
          id?: string
          is_active?: boolean
          is_corporate?: boolean
          name: string
          no_show_policy_type?: string
          no_show_policy_value?: number
          property_id: string
          tenant_id: string
        }
        Update: {
          cancellation_policy_type?: string
          cancellation_policy_value?: number
          code?: string
          created_at?: string
          deposit_policy_type?: string
          deposit_policy_value?: number
          id?: string
          is_active?: boolean
          is_corporate?: boolean
          name?: string
          no_show_policy_type?: string
          no_show_policy_value?: number
          property_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_plans_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_guests: {
        Row: {
          guest_id: string
          is_primary: boolean
          reservation_id: string
          tenant_id: string
        }
        Insert: {
          guest_id: string
          is_primary?: boolean
          reservation_id: string
          tenant_id: string
        }
        Update: {
          guest_id?: string
          is_primary?: boolean
          reservation_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_guests_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_guests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_guests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_nights: {
        Row: {
          id: string
          property_id: string
          rate_amount: number
          reservation_id: string
          room_id: string | null
          room_type_id: string
          stay_date: string
          tenant_id: string
        }
        Insert: {
          id?: string
          property_id: string
          rate_amount: number
          reservation_id: string
          room_id?: string | null
          room_type_id: string
          stay_date: string
          tenant_id: string
        }
        Update: {
          id?: string
          property_id?: string
          rate_amount?: number
          reservation_id?: string
          room_id?: string | null
          room_type_id?: string
          stay_date?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_nights_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_nights_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_nights_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_nights_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_nights_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          adults: number
          arrival_date: string
          cancellation_fee: number | null
          cancelled_at: string | null
          children: number
          company_name: string | null
          created_at: string
          created_by: string | null
          currency: string
          departure_date: string
          deposit_required: number
          fee_waived: boolean
          group_id: string | null
          guarantee: string
          guest_id: string
          hold_until: string | null
          id: string
          idempotency_key: string
          no_show_fee: number | null
          notes: string | null
          number: string
          override_reason: string | null
          property_id: string
          rate_override: number | null
          rate_plan_id: string
          room_type_id: string
          source: string
          special_requests: string | null
          status: string
          status_reason: string | null
          tenant_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          adults?: number
          arrival_date: string
          cancellation_fee?: number | null
          cancelled_at?: string | null
          children?: number
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          departure_date: string
          deposit_required?: number
          fee_waived?: boolean
          group_id?: string | null
          guarantee?: string
          guest_id: string
          hold_until?: string | null
          id?: string
          idempotency_key: string
          no_show_fee?: number | null
          notes?: string | null
          number: string
          override_reason?: string | null
          property_id: string
          rate_override?: number | null
          rate_plan_id: string
          room_type_id: string
          source?: string
          special_requests?: string | null
          status?: string
          status_reason?: string | null
          tenant_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          adults?: number
          arrival_date?: string
          cancellation_fee?: number | null
          cancelled_at?: string | null
          children?: number
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          departure_date?: string
          deposit_required?: number
          fee_waived?: boolean
          group_id?: string | null
          guarantee?: string
          guest_id?: string
          hold_until?: string | null
          id?: string
          idempotency_key?: string
          no_show_fee?: number | null
          notes?: string | null
          number?: string
          override_reason?: string | null
          property_id?: string
          rate_override?: number | null
          rate_plan_id?: string
          room_type_id?: string
          source?: string
          special_requests?: string | null
          status?: string
          status_reason?: string | null
          tenant_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_rate_plan_id_fkey"
            columns: ["rate_plan_id"]
            isOneToOne: false
            referencedRelation: "rate_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          grant_level: string
          permission_key: string
          role_id: string
          tenant_id: string | null
        }
        Insert: {
          grant_level: string
          permission_key: string
          role_id: string
          tenant_id?: string | null
        }
        Update: {
          grant_level?: string
          permission_key?: string
          role_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          tenant_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          tenant_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      room_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          from_date: string
          id: string
          is_active: boolean
          property_id: string
          released_at: string | null
          reservation_id: string
          room_id: string
          tenant_id: string
          to_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_date: string
          id?: string
          is_active?: boolean
          property_id: string
          released_at?: string | null
          reservation_id: string
          room_id: string
          tenant_id: string
          to_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_date?: string
          id?: string
          is_active?: boolean
          property_id?: string
          released_at?: string | null
          reservation_id?: string
          room_id?: string
          tenant_id?: string
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_assignments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_assignments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_assignments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_adults: number
          max_children: number
          name: string
          property_id: string
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_adults?: number
          max_children?: number
          name: string
          property_id: string
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_adults?: number
          max_children?: number
          name?: string
          property_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_types_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          condition: string
          created_at: string
          floor: string | null
          id: string
          is_active: boolean
          is_occupied: boolean
          property_id: string
          room_number: string
          room_type_id: string
          tenant_id: string
        }
        Insert: {
          condition?: string
          created_at?: string
          floor?: string | null
          id?: string
          is_active?: boolean
          is_occupied?: boolean
          property_id: string
          room_number: string
          room_type_id: string
          tenant_id: string
        }
        Update: {
          condition?: string
          created_at?: string
          floor?: string | null
          id?: string
          is_active?: boolean
          is_occupied?: boolean
          property_id?: string
          room_number?: string
          room_type_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          code: string
          compounds_on_previous: boolean
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          percent: number
          property_id: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          code: string
          compounds_on_previous?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          percent: number
          property_id: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          code?: string
          compounds_on_previous?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          percent?: number
          property_id?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_code: string
          status: string
          tenant_id: string
          trial_ends_at: string | null
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_code: string
          status?: string
          tenant_id: string
          trial_ends_at?: string | null
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_code?: string
          status?: string
          tenant_id?: string
          trial_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          country: string
          created_at: string
          id: string
          name: string
          status: string
        }
        Insert: {
          country: string
          created_at?: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      user_property_roles: {
        Row: {
          created_at: string
          id: string
          property_id: string
          role_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          role_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          role_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_property_roles_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_property_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_property_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_property_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_guest_feedback: {
        Args: { p_category: string; p_guest_id: string; p_text: string }
        Returns: string
      }
      anonymise_guest: {
        Args: { p_guest: string; p_reason: string }
        Returns: undefined
      }
      assign_room: {
        Args: { p_id: string; p_room_id: string }
        Returns: undefined
      }
      bulk_add_rooms: {
        Args: {
          p_floor?: string
          p_from: number
          p_property_id: string
          p_room_type_id: string
          p_to: number
        }
        Returns: number
      }
      calculate_tax: {
        Args: {
          p_amount: number
          p_property_id: string
          p_tax_inclusive?: boolean
        }
        Returns: {
          amount: number
          line_no: number
          percent: number
          tax_code: string
          tax_name: string
          taxable_base: number
        }[]
      }
      cancel_reservation: {
        Args: {
          p_id: string
          p_reason: string
          p_waive_fee?: boolean
          p_waive_reason?: string
        }
        Returns: Json
      }
      confirm_reservation: { Args: { p_id: string }; Returns: undefined }
      create_hotel: {
        Args: {
          p_business_name: string
          p_city: string
          p_country: string
          p_full_name: string
          p_property_name: string
        }
        Returns: {
          property_id: string
          tenant_id: string
        }[]
      }
      create_reservation: {
        Args: {
          p_adults: number
          p_arrival: string
          p_children: number
          p_company_name?: string
          p_departure: string
          p_group_id?: string
          p_guarantee?: string
          p_guest_id: string
          p_hold_until?: string
          p_idempotency_key: string
          p_notes?: string
          p_override_reason?: string
          p_property_id: string
          p_rate_override?: number
          p_rate_plan_id: string
          p_room_type_id: string
          p_source?: string
          p_special_requests?: string
          p_status?: string
        }
        Returns: string
      }
      delete_rate_plan_price: { Args: { p_id: string }; Returns: undefined }
      get_assignable_rooms: {
        Args: { p_id: string }
        Returns: {
          condition: string
          floor: string
          id: string
          is_occupied: boolean
          room_number: string
        }[]
      }
      get_availability: {
        Args: { p_arrival: string; p_departure: string; p_property_id: string }
        Returns: {
          available: number
          reserved: number
          room_type_code: string
          room_type_id: string
          room_type_name: string
          sellable: number
          stay_date: string
        }[]
      }
      get_guest: { Args: { p_id: string }; Returns: Json }
      get_reservation: { Args: { p_id: string }; Returns: Json }
      mark_no_show: {
        Args: {
          p_id: string
          p_reason: string
          p_waive_fee?: boolean
          p_waive_reason?: string
        }
        Returns: Json
      }
      merge_guests: {
        Args: { p_keep: string; p_reason: string; p_remove: string }
        Returns: undefined
      }
      modify_reservation: {
        Args: {
          p_adults: number
          p_arrival: string
          p_children: number
          p_company_name: string
          p_departure: string
          p_group_id: string
          p_guarantee: string
          p_hold_until: string
          p_id: string
          p_notes: string
          p_override_reason: string
          p_rate_override: number
          p_rate_plan_id: string
          p_room_type_id: string
          p_source: string
          p_special_requests: string
        }
        Returns: undefined
      }
      my_context: { Args: never; Returns: Json }
      reinstate_reservation: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      remove_guest_document: { Args: { p_id: string }; Returns: undefined }
      save_charge_code: {
        Args: {
          p_category: string
          p_code: string
          p_id: string
          p_is_active: boolean
          p_is_taxable: boolean
          p_name: string
          p_property_id: string
        }
        Returns: string
      }
      save_group_booking: {
        Args: {
          p_contact_name: string
          p_contact_phone: string
          p_id: string
          p_name: string
          p_notes: string
          p_property_id: string
        }
        Returns: string
      }
      save_guest: {
        Args: {
          p_address: string
          p_email: string
          p_first_name: string
          p_id: string
          p_last_name: string
          p_nationality: string
          p_notes: string
          p_phone: string
        }
        Returns: string
      }
      save_guest_document: {
        Args: {
          p_doc_number: string
          p_doc_type: string
          p_expiry: string
          p_guest_id: string
          p_id: string
        }
        Returns: string
      }
      save_payment_method: {
        Args: {
          p_code: string
          p_id: string
          p_is_active: boolean
          p_kind: string
          p_name: string
          p_property_id: string
        }
        Returns: string
      }
      save_rate_plan: {
        Args: {
          p_cancellation_type: string
          p_cancellation_value: number
          p_code: string
          p_deposit_type: string
          p_deposit_value: number
          p_id: string
          p_is_active: boolean
          p_is_corporate: boolean
          p_name: string
          p_no_show_type: string
          p_no_show_value: number
          p_property_id: string
        }
        Returns: string
      }
      save_rate_plan_price: {
        Args: {
          p_amount: number
          p_currency: string
          p_id: string
          p_rate_plan_id: string
          p_room_type_id: string
          p_valid_from: string
          p_valid_to: string
        }
        Returns: string
      }
      save_room: {
        Args: {
          p_floor: string
          p_id: string
          p_is_active: boolean
          p_property_id: string
          p_room_number: string
          p_room_type_id: string
        }
        Returns: string
      }
      save_room_type: {
        Args: {
          p_code: string
          p_description: string
          p_id: string
          p_is_active: boolean
          p_max_adults: number
          p_max_children: number
          p_name: string
          p_property_id: string
        }
        Returns: string
      }
      save_tax_rate: {
        Args: {
          p_code: string
          p_compounds_on_previous: boolean
          p_description: string
          p_id: string
          p_is_active: boolean
          p_name: string
          p_percent: number
          p_property_id: string
          p_sort_order: number
        }
        Returns: string
      }
      search_guests: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          anonymised_at: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          nationality: string
          phone: string
        }[]
      }
      search_reservations: {
        Args: {
          p_from?: string
          p_limit?: number
          p_property_id: string
          p_query?: string
          p_status?: string
          p_to?: string
        }
        Returns: {
          adults: number
          arrival_date: string
          children: number
          company_name: string
          currency: string
          departure_date: string
          guest_id: string
          guest_name: string
          hold_until: string
          id: string
          number: string
          room_number: string
          room_type_code: string
          source: string
          status: string
          total_amount: number
        }[]
      }
      set_exchange_rate: {
        Args: {
          p_currency: string
          p_property_id: string
          p_rate: number
          p_rate_date: string
        }
        Returns: string
      }
      set_guest_feedback_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      set_reservation_guests: {
        Args: {
          p_guest_ids: string[]
          p_id: string
          p_primary_guest_id: string
        }
        Returns: undefined
      }
      tenant_is_writable: { Args: never; Returns: boolean }
      unassign_room: { Args: { p_id: string }; Returns: undefined }
      update_property: {
        Args: {
          p_address: string
          p_check_in_time: string
          p_check_out_time: string
          p_city: string
          p_country: string
          p_name: string
          p_property_id: string
          p_timezone: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
