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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          contract_currency: string
          created_at: string
          display_name: string
          generation_run_id: string
          id: string
          lifecycle_stage: string
          monthly_recurring_revenue: number
          plan_tier: string
          region: string
          renewal_at: string
          seats_purchased: number
          sector: string
          slug: string
          source_updated_at: string
          synthetic: boolean
        }
        Insert: {
          contract_currency: string
          created_at?: string
          display_name: string
          generation_run_id: string
          id?: string
          lifecycle_stage: string
          monthly_recurring_revenue: number
          plan_tier: string
          region: string
          renewal_at: string
          seats_purchased: number
          sector: string
          slug: string
          source_updated_at: string
          synthetic?: boolean
        }
        Update: {
          contract_currency?: string
          created_at?: string
          display_name?: string
          generation_run_id?: string
          id?: string
          lifecycle_stage?: string
          monthly_recurring_revenue?: number
          plan_tier?: string
          region?: string
          renewal_at?: string
          seats_purchased?: number
          sector?: string
          slug?: string
          source_updated_at?: string
          synthetic?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "accounts_generation_run_id_fkey"
            columns: ["generation_run_id"]
            isOneToOne: false
            referencedRelation: "demo_generation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          currency: string
          event_type: string
          evidence_key: string
          id: string
          occurred_at: string
          source_system: string
          source_updated_at: string
          status: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          currency: string
          event_type: string
          evidence_key: string
          id?: string
          occurred_at: string
          source_system?: string
          source_updated_at: string
          status: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          currency?: string
          event_type?: string
          evidence_key?: string
          id?: string
          occurred_at?: string
          source_system?: string
          source_updated_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_preferences: {
        Row: {
          account_id: string
          allow_product_email: boolean
          allow_recovery_outreach: boolean
          allow_usage_personalisation: boolean
          created_at: string
          evidence_key: string
          lawful_basis: string
          preferred_channel: string
          source_system: string
          source_updated_at: string
        }
        Insert: {
          account_id: string
          allow_product_email: boolean
          allow_recovery_outreach: boolean
          allow_usage_personalisation: boolean
          created_at?: string
          evidence_key: string
          lawful_basis: string
          preferred_channel: string
          source_system?: string
          source_updated_at: string
        }
        Update: {
          account_id?: string
          allow_product_email?: boolean
          allow_recovery_outreach?: boolean
          allow_usage_personalisation?: boolean
          created_at?: string
          evidence_key?: string
          lawful_basis?: string
          preferred_channel?: string
          source_system?: string
          source_updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_preferences_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_generation_runs: {
        Row: {
          completed_at: string | null
          failure_reason: string | null
          generated_at: string
          generator_key: string
          generator_version: string
          id: string
          row_counts: Json
          seed: number
          status: string
        }
        Insert: {
          completed_at?: string | null
          failure_reason?: string | null
          generated_at?: string
          generator_key: string
          generator_version: string
          id?: string
          row_counts?: Json
          seed: number
          status?: string
        }
        Update: {
          completed_at?: string | null
          failure_reason?: string | null
          generated_at?: string
          generator_key?: string
          generator_version?: string
          id?: string
          row_counts?: Json
          seed?: number
          status?: string
        }
        Relationships: []
      }
      product_signals: {
        Row: {
          account_id: string
          comparison_value: number | null
          comparison_window: string | null
          created_at: string
          evidence_key: string
          id: string
          metadata: Json
          metric_value: number
          observed_at: string
          signal_type: string
          source_system: string
          source_updated_at: string
          unit: string
        }
        Insert: {
          account_id: string
          comparison_value?: number | null
          comparison_window?: string | null
          created_at?: string
          evidence_key: string
          id?: string
          metadata?: Json
          metric_value: number
          observed_at: string
          signal_type: string
          source_system?: string
          source_updated_at: string
          unit: string
        }
        Update: {
          account_id?: string
          comparison_value?: number | null
          comparison_window?: string | null
          created_at?: string
          evidence_key?: string
          id?: string
          metadata?: Json
          metric_value?: number
          observed_at?: string
          signal_type?: string
          source_system?: string
          source_updated_at?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_signals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      support_events: {
        Row: {
          account_id: string
          category: string
          created_at: string
          evidence_key: string
          id: string
          occurred_at: string
          resolved_at: string | null
          sentiment_score: number
          severity: string
          source_system: string
          source_updated_at: string
          status: string
          summary: string
        }
        Insert: {
          account_id: string
          category: string
          created_at?: string
          evidence_key: string
          id?: string
          occurred_at: string
          resolved_at?: string | null
          sentiment_score: number
          severity: string
          source_system?: string
          source_updated_at: string
          status: string
          summary: string
        }
        Update: {
          account_id?: string
          category?: string
          created_at?: string
          evidence_key?: string
          id?: string
          occurred_at?: string
          resolved_at?: string | null
          sentiment_score?: number
          severity?: string
          source_system?: string
          source_updated_at?: string
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_status_events: {
        Row: {
          created_at: string
          evidence_key: string
          generation_run_id: string
          id: string
          incident_key: string | null
          resolved_at: string | null
          service_name: string
          source_system: string
          source_updated_at: string
          started_at: string
          status: string
          summary: string
          vendor_key: string
        }
        Insert: {
          created_at?: string
          evidence_key: string
          generation_run_id: string
          id?: string
          incident_key?: string | null
          resolved_at?: string | null
          service_name: string
          source_system?: string
          source_updated_at: string
          started_at: string
          status: string
          summary: string
          vendor_key: string
        }
        Update: {
          created_at?: string
          evidence_key?: string
          generation_run_id?: string
          id?: string
          incident_key?: string | null
          resolved_at?: string | null
          service_name?: string
          source_system?: string
          source_updated_at?: string
          started_at?: string
          status?: string
          summary?: string
          vendor_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_status_events_generation_run_id_fkey"
            columns: ["generation_run_id"]
            isOneToOne: false
            referencedRelation: "demo_generation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

