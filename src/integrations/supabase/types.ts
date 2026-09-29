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
      approvals: {
        Row: {
          amount: number
          currency: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          entity: string
          folio_id: string
          id: string
          idempotency_key: string
          kind: string
          payload: Json
          posted_transaction_id: string | null
          property_id: string
          reason: string
          requested_at: string
          requested_by: string
          reservation_id: string | null
          status: string
          tenant_id: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          currency: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          entity?: string
          folio_id: string
          id?: string
          idempotency_key: string
          kind: string
          payload?: Json
          posted_transaction_id?: string | null
          property_id: string
          reason: string
          requested_at?: string
          requested_by?: string
          reservation_id?: string | null
          status?: string
          tenant_id: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          entity?: string
          folio_id?: string
          id?: string
          idempotency_key?: string
          kind?: string
          payload?: Json
          posted_transaction_id?: string | null
          property_id?: string
          reason?: string
          requested_at?: string
          requested_by?: string
          reservation_id?: string | null
          status?: string
          tenant_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "folios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "v_folio_balances"
            referencedColumns: ["folio_id"]
          },
          {
            foreignKeyName: "approvals_posted_transaction_id_fkey"
            columns: ["posted_transaction_id"]
            isOneToOne: false
            referencedRelation: "folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_posted_transaction_id_fkey"
            columns: ["posted_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_arrivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_in_house"
            referencedColumns: ["reservation_id"]
          },
          {
            foreignKeyName: "approvals_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["current_reservation_id"]
          },
          {
            foreignKeyName: "approvals_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["next_reservation_id"]
          },
          {
            foreignKeyName: "approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_folio_transactions"
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
      folio_tax_lines: {
        Row: {
          amount: number
          base_amount: number
          id: string
          line_no: number
          percent: number
          property_id: string
          tax_code: string
          tax_name: string
          taxable_base: number
          tenant_id: string
          transaction_id: string
        }
        Insert: {
          amount: number
          base_amount: number
          id?: string
          line_no: number
          percent: number
          property_id: string
          tax_code: string
          tax_name: string
          taxable_base: number
          tenant_id: string
          transaction_id: string
        }
        Update: {
          amount?: number
          base_amount?: number
          id?: string
          line_no?: number
          percent?: number
          property_id?: string
          tax_code?: string
          tax_name?: string
          taxable_base?: number
          tenant_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folio_tax_lines_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_tax_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_tax_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_tax_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_folio_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      folio_transactions: {
        Row: {
          amount: number
          base_amount: number
          business_date: string
          charge_code_id: string | null
          currency: string
          description: string | null
          folio_id: string
          fx_rate: number
          id: string
          idempotency_key: string
          is_deposit: boolean
          kind: string
          original_id: string | null
          payment_method_id: string | null
          posted_at: string
          posted_by: string | null
          property_id: string
          reference: string | null
          tax_inclusive: boolean
          tenant_id: string
        }
        Insert: {
          amount: number
          base_amount: number
          business_date: string
          charge_code_id?: string | null
          currency: string
          description?: string | null
          folio_id: string
          fx_rate?: number
          id?: string
          idempotency_key: string
          is_deposit?: boolean
          kind: string
          original_id?: string | null
          payment_method_id?: string | null
          posted_at?: string
          posted_by?: string | null
          property_id: string
          reference?: string | null
          tax_inclusive?: boolean
          tenant_id: string
        }
        Update: {
          amount?: number
          base_amount?: number
          business_date?: string
          charge_code_id?: string | null
          currency?: string
          description?: string | null
          folio_id?: string
          fx_rate?: number
          id?: string
          idempotency_key?: string
          is_deposit?: boolean
          kind?: string
          original_id?: string | null
          payment_method_id?: string | null
          posted_at?: string
          posted_by?: string | null
          property_id?: string
          reference?: string | null
          tax_inclusive?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folio_transactions_charge_code_id_fkey"
            columns: ["charge_code_id"]
            isOneToOne: false
            referencedRelation: "charge_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_transactions_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "folios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_transactions_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "v_folio_balances"
            referencedColumns: ["folio_id"]
          },
          {
            foreignKeyName: "folio_transactions_original_id_fkey"
            columns: ["original_id"]
            isOneToOne: false
            referencedRelation: "folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_transactions_original_id_fkey"
            columns: ["original_id"]
            isOneToOne: false
            referencedRelation: "v_folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_transactions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      folios: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          guest_id: string | null
          id: string
          idempotency_key: string | null
          is_main: boolean
          label: string
          number: string
          property_id: string
          reservation_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          guest_id?: string | null
          id?: string
          idempotency_key?: string | null
          is_main?: boolean
          label?: string
          number: string
          property_id: string
          reservation_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          guest_id?: string | null
          id?: string
          idempotency_key?: string | null
          is_main?: boolean
          label?: string
          number?: string
          property_id?: string
          reservation_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folios_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_arrivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_in_house"
            referencedColumns: ["reservation_id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["current_reservation_id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["next_reservation_id"]
          },
          {
            foreignKeyName: "folios_tenant_id_fkey"
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
      hk_tasks: {
        Row: {
          assigned_at: string | null
          assignee_id: string | null
          business_date: string
          cancel_reason: string | null
          cancelled_at: string | null
          checklist: Json
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          defects: Json
          fail_count: number
          id: string
          inspected_at: string | null
          inspected_by: string | null
          inspection_result: string | null
          notes: string | null
          priority: string
          property_id: string
          room_id: string
          started_at: string | null
          status: string
          stay_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          assigned_at?: string | null
          assignee_id?: string | null
          business_date: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          checklist?: Json
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          defects?: Json
          fail_count?: number
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          inspection_result?: string | null
          notes?: string | null
          priority?: string
          property_id: string
          room_id: string
          started_at?: string | null
          status?: string
          stay_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          assigned_at?: string | null
          assignee_id?: string | null
          business_date?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          checklist?: Json
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          defects?: Json
          fail_count?: number
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          inspection_result?: string | null
          notes?: string | null
          priority?: string
          property_id?: string
          room_id?: string
          started_at?: string | null
          status?: string
          stay_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hk_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hk_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hk_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hk_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hk_tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hk_tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "v_checkouts"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "hk_tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "v_in_house"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "hk_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      housekeeping_tasks: {
        Row: {
          business_date: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          notes: string | null
          property_id: string
          room_id: string
          status: string
          stay_id: string | null
          tenant_id: string
        }
        Insert: {
          business_date: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          notes?: string | null
          property_id: string
          room_id: string
          status?: string
          stay_id?: string | null
          tenant_id: string
        }
        Update: {
          business_date?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          notes?: string | null
          property_id?: string
          room_id?: string
          status?: string
          stay_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "housekeeping_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "v_checkouts"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "v_in_house"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "housekeeping_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance: number
          business_date: string
          currency: string
          folio_id: string
          gross_total: number
          header: Json
          id: string
          idempotency_key: string
          issued_at: string
          issued_by: string | null
          kind: string
          lines: Json
          net_total: number
          number: string
          payments_total: number
          property_id: string
          tax_split: Json
          tax_total: number
          tenant_id: string
        }
        Insert: {
          balance: number
          business_date: string
          currency: string
          folio_id: string
          gross_total: number
          header?: Json
          id?: string
          idempotency_key: string
          issued_at?: string
          issued_by?: string | null
          kind: string
          lines?: Json
          net_total: number
          number: string
          payments_total: number
          property_id: string
          tax_split?: Json
          tax_total: number
          tenant_id: string
        }
        Update: {
          balance?: number
          business_date?: string
          currency?: string
          folio_id?: string
          gross_total?: number
          header?: Json
          id?: string
          idempotency_key?: string
          issued_at?: string
          issued_by?: string | null
          kind?: string
          lines?: Json
          net_total?: number
          number?: string
          payments_total?: number
          property_id?: string
          tax_split?: Json
          tax_total?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "folios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "v_folio_balances"
            referencedColumns: ["folio_id"]
          },
          {
            foreignKeyName: "invoices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_found_items: {
        Row: {
          claimed_by_name: string | null
          created_at: string
          description: string
          found_at: string
          found_by: string | null
          id: string
          location: string
          property_id: string
          room_id: string | null
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          status_note: string | null
          tenant_id: string
        }
        Insert: {
          claimed_by_name?: string | null
          created_at?: string
          description: string
          found_at?: string
          found_by?: string | null
          id?: string
          location: string
          property_id: string
          room_id?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_note?: string | null
          tenant_id: string
        }
        Update: {
          claimed_by_name?: string | null
          created_at?: string
          description?: string
          found_at?: string
          found_by?: string | null
          id?: string
          location?: string
          property_id?: string
          room_id?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_note?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lost_found_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lost_found_items_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lost_found_items_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lost_found_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tickets: {
        Row: {
          assignee_id: string | null
          business_date: string
          cancel_reason: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          last_reopen_reason: string | null
          location: string | null
          priority: string
          property_id: string
          reopen_count: number
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          room_id: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
          wait_reason: string | null
        }
        Insert: {
          assignee_id?: string | null
          business_date: string
          cancel_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_reopen_reason?: string | null
          location?: string | null
          priority?: string
          property_id: string
          reopen_count?: number
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          room_id?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          wait_reason?: string | null
        }
        Update: {
          assignee_id?: string | null
          business_date?: string
          cancel_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_reopen_reason?: string | null
          location?: string | null
          priority?: string
          property_id?: string
          reopen_count?: number
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          room_id?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          wait_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          id: string
          kind: string
          link: string | null
          property_id: string | null
          read_at: string | null
          tenant_id: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          kind: string
          link?: string | null
          property_id?: string | null
          read_at?: string | null
          tenant_id: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          kind?: string
          link?: string | null
          property_id?: string | null
          read_at?: string | null
          tenant_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "reservation_guests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_arrivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_guests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_in_house"
            referencedColumns: ["reservation_id"]
          },
          {
            foreignKeyName: "reservation_guests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["current_reservation_id"]
          },
          {
            foreignKeyName: "reservation_guests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["next_reservation_id"]
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
            foreignKeyName: "reservation_nights_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_arrivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_nights_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_in_house"
            referencedColumns: ["reservation_id"]
          },
          {
            foreignKeyName: "reservation_nights_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["current_reservation_id"]
          },
          {
            foreignKeyName: "reservation_nights_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["next_reservation_id"]
          },
          {
            foreignKeyName: "reservation_nights_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_nights_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
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
            foreignKeyName: "room_assignments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_arrivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_assignments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_in_house"
            referencedColumns: ["reservation_id"]
          },
          {
            foreignKeyName: "room_assignments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["current_reservation_id"]
          },
          {
            foreignKeyName: "room_assignments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["next_reservation_id"]
          },
          {
            foreignKeyName: "room_assignments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_assignments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
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
      room_blocks: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          block_type: string
          created_at: string
          decision_reason: string | null
          from_date: string
          id: string
          property_id: string
          reason: string
          release_reason: string | null
          released_at: string | null
          released_by: string | null
          requested_by: string | null
          room_id: string
          status: string
          tenant_id: string
          ticket_id: string | null
          to_date: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          block_type: string
          created_at?: string
          decision_reason?: string | null
          from_date: string
          id?: string
          property_id: string
          reason: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          requested_by?: string | null
          room_id: string
          status?: string
          tenant_id: string
          ticket_id?: string | null
          to_date: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          block_type?: string
          created_at?: string
          decision_reason?: string | null
          from_date?: string
          id?: string
          property_id?: string
          reason?: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          requested_by?: string | null
          room_id?: string
          status?: string
          tenant_id?: string
          ticket_id?: string | null
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_blocks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_blocks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_blocks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_blocks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_blocks_ticket_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_blocks_ticket_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "v_maintenance_tickets"
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
      service_requests: {
        Row: {
          assignee_id: string | null
          business_date: string
          cancel_reason: string | null
          category: string
          charge_amount: number | null
          charge_code_id: string | null
          chargeable: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          id: string
          posted_transaction_id: string | null
          property_id: string
          reservation_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          assignee_id?: string | null
          business_date: string
          cancel_reason?: string | null
          category: string
          charge_amount?: number | null
          charge_code_id?: string | null
          chargeable?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          description: string
          id?: string
          posted_transaction_id?: string | null
          property_id: string
          reservation_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          assignee_id?: string | null
          business_date?: string
          cancel_reason?: string | null
          category?: string
          charge_amount?: number | null
          charge_code_id?: string | null
          chargeable?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          id?: string
          posted_transaction_id?: string | null
          property_id?: string
          reservation_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_charge_code_id_fkey"
            columns: ["charge_code_id"]
            isOneToOne: false
            referencedRelation: "charge_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_posted_transaction_id_fkey"
            columns: ["posted_transaction_id"]
            isOneToOne: false
            referencedRelation: "folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_posted_transaction_id_fkey"
            columns: ["posted_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_arrivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_in_house"
            referencedColumns: ["reservation_id"]
          },
          {
            foreignKeyName: "service_requests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["current_reservation_id"]
          },
          {
            foreignKeyName: "service_requests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["next_reservation_id"]
          },
          {
            foreignKeyName: "service_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stays: {
        Row: {
          business_date: string
          checked_in_at: string
          checked_out_at: string | null
          checked_out_by: string | null
          checkout_approval_id: string | null
          checkout_business_date: string | null
          checkout_reason: string | null
          checkout_snapshot: Json | null
          created_at: string
          created_by: string | null
          deposit_waive_reason: string | null
          id: string
          property_id: string
          registration: Json
          reservation_id: string
          room_id: string
          room_override_reason: string | null
          status: string
          tenant_id: string
          void_reason: string | null
        }
        Insert: {
          business_date: string
          checked_in_at?: string
          checked_out_at?: string | null
          checked_out_by?: string | null
          checkout_approval_id?: string | null
          checkout_business_date?: string | null
          checkout_reason?: string | null
          checkout_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          deposit_waive_reason?: string | null
          id?: string
          property_id: string
          registration?: Json
          reservation_id: string
          room_id: string
          room_override_reason?: string | null
          status?: string
          tenant_id: string
          void_reason?: string | null
        }
        Update: {
          business_date?: string
          checked_in_at?: string
          checked_out_at?: string | null
          checked_out_by?: string | null
          checkout_approval_id?: string | null
          checkout_business_date?: string | null
          checkout_reason?: string | null
          checkout_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          deposit_waive_reason?: string | null
          id?: string
          property_id?: string
          registration?: Json
          reservation_id?: string
          room_id?: string
          room_override_reason?: string | null
          status?: string
          tenant_id?: string
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stays_checkout_approval_id_fkey"
            columns: ["checkout_approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_checkout_approval_id_fkey"
            columns: ["checkout_approval_id"]
            isOneToOne: false
            referencedRelation: "v_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_arrivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_in_house"
            referencedColumns: ["reservation_id"]
          },
          {
            foreignKeyName: "stays_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["current_reservation_id"]
          },
          {
            foreignKeyName: "stays_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["next_reservation_id"]
          },
          {
            foreignKeyName: "stays_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_tenant_id_fkey"
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
      v_approvals: {
        Row: {
          amount: number | null
          currency: string | null
          decided_at: string | null
          decided_by: string | null
          decided_by_name: string | null
          decision_reason: string | null
          folio_id: string | null
          folio_number: string | null
          guest_name: string | null
          id: string | null
          is_used: boolean | null
          kind: string | null
          posted_transaction_id: string | null
          property_id: string | null
          reason: string | null
          requested_at: string | null
          requested_by: string | null
          requested_by_name: string | null
          reservation_id: string | null
          status: string | null
          transaction_description: string | null
          transaction_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "folios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "v_folio_balances"
            referencedColumns: ["folio_id"]
          },
          {
            foreignKeyName: "approvals_posted_transaction_id_fkey"
            columns: ["posted_transaction_id"]
            isOneToOne: false
            referencedRelation: "folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_posted_transaction_id_fkey"
            columns: ["posted_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "v_folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_arrivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_in_house"
            referencedColumns: ["reservation_id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["current_reservation_id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["next_reservation_id"]
          },
        ]
      }
      v_arrivals: {
        Row: {
          adults: number | null
          arrival_date: string | null
          children: number | null
          company_name: string | null
          currency: string | null
          departure_date: string | null
          deposit_paid: number | null
          deposit_required: number | null
          guest_id: string | null
          guest_name: string | null
          guest_phone: string | null
          hold_until: string | null
          id: string | null
          is_late: boolean | null
          nights: number | null
          number: string | null
          property_id: string | null
          rate_plan_id: string | null
          room_condition: string | null
          room_id: string | null
          room_is_occupied: boolean | null
          room_is_ready: boolean | null
          room_number: string | null
          room_type_code: string | null
          room_type_id: string | null
          room_type_name: string | null
          special_requests: string | null
          status: string | null
          total_amount: number | null
        }
        Relationships: [
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
            foreignKeyName: "room_assignments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_assignments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["id"]
          },
        ]
      }
      v_checkouts: {
        Row: {
          arrival_date: string | null
          can_undo: boolean | null
          checked_out_at: string | null
          checkout_business_date: string | null
          checkout_reason: string | null
          currency: string | null
          departure_date: string | null
          guest_name: string | null
          number: string | null
          property_id: string | null
          reservation_id: string | null
          reservation_status: string | null
          room_number: string | null
          status: string | null
          stay_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_arrivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_in_house"
            referencedColumns: ["reservation_id"]
          },
          {
            foreignKeyName: "stays_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["current_reservation_id"]
          },
          {
            foreignKeyName: "stays_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["next_reservation_id"]
          },
        ]
      }
      v_folio_balances: {
        Row: {
          arrival_date: string | null
          balance: number | null
          closed_at: string | null
          created_at: string | null
          currency: string | null
          departure_date: string | null
          folio_id: string | null
          guest_id: string | null
          guest_name: string | null
          is_main: boolean | null
          label: string | null
          number: string | null
          property_id: string | null
          reservation_id: string | null
          reservation_number: string | null
          reservation_status: string | null
          room_number: string | null
          status: string | null
          total_credits: number | null
          total_debits: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folios_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_arrivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_in_house"
            referencedColumns: ["reservation_id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["current_reservation_id"]
          },
          {
            foreignKeyName: "folios_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["next_reservation_id"]
          },
        ]
      }
      v_folio_transactions: {
        Row: {
          amount: number | null
          base_amount: number | null
          business_date: string | null
          charge_code: string | null
          charge_code_id: string | null
          charge_code_name: string | null
          currency: string | null
          description: string | null
          folio_id: string | null
          fx_rate: number | null
          id: string | null
          is_deposit: boolean | null
          is_reversed: boolean | null
          is_transferred: boolean | null
          kind: string | null
          original_id: string | null
          payment_method_id: string | null
          payment_method_name: string | null
          posted_at: string | null
          posted_by: string | null
          posted_by_name: string | null
          property_id: string | null
          reference: string | null
          tax_amount: number | null
          tax_inclusive: boolean | null
          tax_lines: Json | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folio_transactions_charge_code_id_fkey"
            columns: ["charge_code_id"]
            isOneToOne: false
            referencedRelation: "charge_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_transactions_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "folios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_transactions_folio_id_fkey"
            columns: ["folio_id"]
            isOneToOne: false
            referencedRelation: "v_folio_balances"
            referencedColumns: ["folio_id"]
          },
          {
            foreignKeyName: "folio_transactions_original_id_fkey"
            columns: ["original_id"]
            isOneToOne: false
            referencedRelation: "folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_transactions_original_id_fkey"
            columns: ["original_id"]
            isOneToOne: false
            referencedRelation: "v_folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_transactions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      v_hk_board: {
        Row: {
          assigned_at: string | null
          assignee_id: string | null
          assignee_name: string | null
          board_column: string | null
          business_date: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          checklist: Json | null
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          created_at: string | null
          created_by: string | null
          defects: Json | null
          fail_count: number | null
          floor: string | null
          id: string | null
          inspected_at: string | null
          inspected_by: string | null
          inspected_by_name: string | null
          inspection_result: string | null
          is_occupied: boolean | null
          notes: string | null
          priority: string | null
          property_id: string | null
          room_condition: string | null
          room_id: string | null
          room_number: string | null
          room_type_name: string | null
          started_at: string | null
          status: string | null
          stay_id: string | null
          tenant_id: string | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hk_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hk_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hk_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hk_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hk_tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hk_tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "v_checkouts"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "hk_tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "v_in_house"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "hk_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_in_house: {
        Row: {
          adults: number | null
          arrival_date: string | null
          can_void: boolean | null
          checked_in_at: string | null
          checked_in_business_date: string | null
          children: number | null
          company_name: string | null
          currency: string | null
          departure_date: string | null
          guest_id: string | null
          guest_name: string | null
          guest_phone: string | null
          is_departing: boolean | null
          number: string | null
          property_id: string | null
          reservation_id: string | null
          room_id: string | null
          room_number: string | null
          room_type_code: string | null
          room_type_id: string | null
          stay_id: string | null
          total_amount: number | null
        }
        Relationships: [
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
            foreignKeyName: "reservations_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["id"]
          },
        ]
      }
      v_maintenance_tickets: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          business_date: string | null
          cancel_reason: string | null
          closed_at: string | null
          closed_by: string | null
          closed_by_name: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          description: string | null
          has_active_block: boolean | null
          id: string | null
          last_reopen_reason: string | null
          location: string | null
          priority: string | null
          property_id: string | null
          reopen_count: number | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_by_name: string | null
          room_id: string | null
          room_number: string | null
          status: string | null
          tenant_id: string | null
          title: string | null
          updated_at: string | null
          wait_reason: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_room_board: {
        Row: {
          block_id: string | null
          block_to_date: string | null
          block_type: string | null
          condition: string | null
          current_departure_date: string | null
          current_guest_name: string | null
          current_number: string | null
          current_reservation_id: string | null
          floor: string | null
          id: string | null
          is_active: boolean | null
          is_occupied: boolean | null
          is_sellable: boolean | null
          next_arrival_date: string | null
          next_guest_name: string | null
          next_number: string | null
          next_reservation_id: string | null
          pending_blocks: number | null
          property_id: string | null
          room_number: string | null
          room_type_code: string | null
          room_type_id: string | null
          room_type_name: string | null
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
        ]
      }
      v_service_requests: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          business_date: string | null
          cancel_reason: string | null
          category: string | null
          charge_amount: number | null
          charge_code_id: string | null
          charge_code_name: string | null
          chargeable: boolean | null
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          guest_name: string | null
          id: string | null
          posted_transaction_id: string | null
          property_id: string | null
          reservation_id: string | null
          reservation_number: string | null
          room_number: string | null
          status: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_charge_code_id_fkey"
            columns: ["charge_code_id"]
            isOneToOne: false
            referencedRelation: "charge_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_posted_transaction_id_fkey"
            columns: ["posted_transaction_id"]
            isOneToOne: false
            referencedRelation: "folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_posted_transaction_id_fkey"
            columns: ["posted_transaction_id"]
            isOneToOne: false
            referencedRelation: "v_folio_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_arrivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_in_house"
            referencedColumns: ["reservation_id"]
          },
          {
            foreignKeyName: "service_requests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["current_reservation_id"]
          },
          {
            foreignKeyName: "service_requests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "v_room_board"
            referencedColumns: ["next_reservation_id"]
          },
          {
            foreignKeyName: "service_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      apply_discount: {
        Args: {
          p_amount: number
          p_idempotency_key: string
          p_reason: string
          p_transaction_id: string
        }
        Returns: Json
      }
      approve_room_block: { Args: { p_id: string }; Returns: undefined }
      assign_hk_task: {
        Args: { p_assignee_id: string; p_id: string }
        Returns: undefined
      }
      assign_room: {
        Args: { p_id: string; p_room_id: string }
        Returns: undefined
      }
      assign_service_request: {
        Args: { p_assignee_id: string; p_id: string }
        Returns: undefined
      }
      assign_ticket: {
        Args: { p_assignee_id: string; p_id: string }
        Returns: undefined
      }
      block_room_for_ticket: {
        Args: {
          p_from: string
          p_id: string
          p_reason?: string
          p_to: string
          p_type: string
        }
        Returns: string
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
      cancel_hk_task: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
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
      cancel_service_request: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      cancel_ticket: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      check_in: {
        Args: {
          p_deposit_waive_reason?: string
          p_id: string
          p_registration: Json
          p_room_id?: string
          p_room_override_reason?: string
        }
        Returns: string
      }
      check_out: {
        Args: { p_approval_id?: string; p_id: string; p_reason?: string }
        Returns: string
      }
      close_folio: { Args: { p_id: string }; Returns: undefined }
      close_ticket: { Args: { p_id: string }; Returns: undefined }
      complete_hk_task: {
        Args: { p_checklist?: Json; p_id: string; p_notes?: string }
        Returns: undefined
      }
      complete_service_request: { Args: { p_id: string }; Returns: string }
      confirm_reservation: { Args: { p_id: string }; Returns: undefined }
      create_hk_task: {
        Args: {
          p_assignee_id?: string
          p_notes?: string
          p_priority?: string
          p_room_id: string
          p_type: string
        }
        Returns: string
      }
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
      create_service_request: {
        Args: {
          p_assignee_id?: string
          p_category: string
          p_charge_amount?: number
          p_charge_code_id?: string
          p_chargeable?: boolean
          p_description: string
          p_reservation_id: string
        }
        Returns: string
      }
      create_ticket: {
        Args: {
          p_assignee_id?: string
          p_description: string
          p_location: string
          p_priority?: string
          p_property_id: string
          p_room_id: string
          p_title: string
        }
        Returns: string
      }
      decide_approval: {
        Args: { p_approve: boolean; p_id: string; p_reason: string }
        Returns: string
      }
      delete_rate_plan_price: { Args: { p_id: string }; Returns: undefined }
      extend_stay: {
        Args: { p_id: string; p_new_departure: string; p_reason?: string }
        Returns: undefined
      }
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
      get_front_desk_rooms: {
        Args: {
          p_from: string
          p_property_id: string
          p_reservation_id?: string
          p_room_type_id: string
          p_to: string
        }
        Returns: {
          condition: string
          floor: string
          id: string
          is_occupied: boolean
          is_ready: boolean
          room_number: string
          room_type_code: string
          room_type_id: string
        }[]
      }
      get_guest: { Args: { p_id: string }; Returns: Json }
      get_reservation: { Args: { p_id: string }; Returns: Json }
      hk_staff: {
        Args: { p_property_id: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      inspect_hk_task: {
        Args: {
          p_defects?: Json
          p_id: string
          p_notes?: string
          p_pass: boolean
          p_result?: string
        }
        Returns: undefined
      }
      issue_invoice: {
        Args: { p_folio_id: string; p_idempotency_key: string; p_kind: string }
        Returns: string
      }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_no_show: {
        Args: {
          p_id: string
          p_reason: string
          p_waive_fee?: boolean
          p_waive_reason?: string
        }
        Returns: Json
      }
      mark_notification_read: { Args: { p_id: string }; Returns: undefined }
      merge_guests: {
        Args: { p_keep: string; p_reason: string; p_remove: string }
        Returns: undefined
      }
      mnt_staff: {
        Args: { p_property_id: string }
        Returns: {
          full_name: string
          id: string
        }[]
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
      move_room: {
        Args: {
          p_id: string
          p_reason: string
          p_room_id: string
          p_room_override_reason?: string
        }
        Returns: string
      }
      my_context: { Args: never; Returns: Json }
      open_main_folio: { Args: { p_reservation_id: string }; Returns: string }
      post_charge: {
        Args: {
          p_amount: number
          p_charge_code_id: string
          p_description: string
          p_folio_id: string
          p_idempotency_key: string
          p_reference: string
          p_tax_inclusive: boolean
        }
        Returns: string
      }
      post_payment: {
        Args: {
          p_amount: number
          p_currency: string
          p_description: string
          p_folio_id: string
          p_idempotency_key: string
          p_is_deposit: boolean
          p_payment_method_id: string
          p_reference: string
        }
        Returns: string
      }
      post_room_charges: {
        Args: { p_business_date?: string; p_property_id: string }
        Returns: Json
      }
      reinstate_reservation: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      reject_room_block: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      release_room_block: {
        Args: { p_id: string; p_reason?: string }
        Returns: undefined
      }
      remove_guest_document: { Args: { p_id: string }; Returns: undefined }
      reopen_folio: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      reopen_ticket: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      request_adjustment: {
        Args: {
          p_amount: number
          p_charge_code_id: string
          p_folio_id: string
          p_idempotency_key: string
          p_reason: string
        }
        Returns: Json
      }
      request_refund: {
        Args: {
          p_amount: number
          p_currency: string
          p_folio_id: string
          p_idempotency_key: string
          p_payment_method_id: string
          p_reason: string
          p_reference: string
        }
        Returns: Json
      }
      request_reversal: {
        Args: {
          p_idempotency_key: string
          p_reason: string
          p_transaction_id: string
        }
        Returns: Json
      }
      request_room_block: {
        Args: {
          p_from: string
          p_reason: string
          p_room_id: string
          p_ticket_id?: string
          p_to: string
          p_type: string
        }
        Returns: string
      }
      request_unsettled_checkout: {
        Args: { p_id: string; p_idempotency_key: string; p_reason: string }
        Returns: Json
      }
      resolve_ticket: {
        Args: { p_id: string; p_resolution: string }
        Returns: undefined
      }
      reverse_transaction: {
        Args: { p_id: string; p_idempotency_key: string; p_reason: string }
        Returns: string
      }
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
      save_lost_found_item: {
        Args: {
          p_description: string
          p_found_at?: string
          p_location: string
          p_property_id: string
          p_room_id?: string
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
      set_lost_found_status: {
        Args: {
          p_claimed_by?: string
          p_id: string
          p_note?: string
          p_status: string
        }
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
      set_room_condition: {
        Args: { p_condition: string; p_reason?: string; p_room_id: string }
        Returns: undefined
      }
      split_folio: {
        Args: {
          p_folio_id: string
          p_guest_id: string
          p_idempotency_key: string
          p_label: string
          p_transaction_ids: string[]
        }
        Returns: string
      }
      start_hk_task: { Args: { p_id: string }; Returns: undefined }
      start_service_request: { Args: { p_id: string }; Returns: undefined }
      start_ticket: { Args: { p_id: string }; Returns: undefined }
      svc_staff: {
        Args: { p_property_id: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      tenant_is_writable: { Args: never; Returns: boolean }
      transfer_transaction: {
        Args: { p_id: string; p_idempotency_key: string; p_to_folio_id: string }
        Returns: string
      }
      unassign_room: { Args: { p_id: string }; Returns: undefined }
      undo_checkout: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
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
      void_check_in: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      wait_ticket: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      walk_in_check_in: {
        Args: {
          p_adults: number
          p_children: number
          p_company_name?: string
          p_departure: string
          p_deposit_waive_reason?: string
          p_guest_id: string
          p_idempotency_key: string
          p_notes?: string
          p_override_reason?: string
          p_property_id: string
          p_rate_override?: number
          p_rate_plan_id: string
          p_registration: Json
          p_room_id: string
          p_room_override_reason?: string
          p_room_type_id: string
        }
        Returns: string
      }
      withdraw_approval: { Args: { p_id: string }; Returns: undefined }
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
