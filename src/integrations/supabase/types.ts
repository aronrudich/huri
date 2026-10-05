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
      business_inquiries: {
        Row: {
          business_name: string
          business_type: string
          created_at: string
          email: string
          email_notification_error: string | null
          email_notification_sent_at: string | null
          id: string
          message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submission_key: string | null
          updated_at: string
        }
        Insert: {
          business_name: string
          business_type: string
          created_at?: string
          email: string
          email_notification_error?: string | null
          email_notification_sent_at?: string | null
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_key?: string | null
          updated_at?: string
        }
        Update: {
          business_name?: string
          business_type?: string
          created_at?: string
          email?: string
          email_notification_error?: string | null
          email_notification_sent_at?: string | null
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      car_events: {
        Row: {
          actor_id: string | null
          created_at: string
          dealership_id: string
          detail: string | null
          event_type: string
          id: string
          notes: string | null
          ro_number: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          dealership_id: string
          detail?: string | null
          event_type: string
          id?: string
          notes?: string | null
          ro_number?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          dealership_id?: string
          detail?: string | null
          event_type?: string
          id?: string
          notes?: string | null
          ro_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "car_events_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
        ]
      }
      car_photos: {
        Row: {
          created_at: string
          dealership_id: string
          id: string
          ro_number: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          dealership_id: string
          id?: string
          ro_number: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          dealership_id?: string
          id?: string
          ro_number?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "car_photos_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
        ]
      }
      car_washes: {
        Row: {
          created_at: string
          dealership_id: string
          id: string
          ro_number: string
          updated_at: string
          washed_at: string
          washed_by: string | null
        }
        Insert: {
          created_at?: string
          dealership_id: string
          id?: string
          ro_number: string
          updated_at?: string
          washed_at?: string
          washed_by?: string | null
        }
        Update: {
          created_at?: string
          dealership_id?: string
          id?: string
          ro_number?: string
          updated_at?: string
          washed_at?: string
          washed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "car_washes_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
        ]
      }
      dealerships: {
        Row: {
          claim_hide_minutes: number
          company_code: string
          created_at: string
          enable_parts: boolean
          enable_staging: boolean
          enable_wash: boolean
          flagged_days: number
          id: string
          name: string
          reminder_minutes: number
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          claim_hide_minutes?: number
          company_code: string
          created_at?: string
          enable_parts?: boolean
          enable_staging?: boolean
          enable_wash?: boolean
          flagged_days?: number
          id?: string
          name: string
          reminder_minutes?: number
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          claim_hide_minutes?: number
          company_code?: string
          created_at?: string
          enable_parts?: boolean
          enable_staging?: boolean
          enable_wash?: boolean
          flagged_days?: number
          id?: string
          name?: string
          reminder_minutes?: number
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      help_messages: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          id: string
          sender_id: string | null
          sender_type: string
          thread_id: string
        }
        Insert: {
          attachments?: Json
          body: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_type: string
          thread_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_type?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "help_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      help_threads: {
        Row: {
          company_code: string
          created_at: string
          dealership_id: string
          dealership_name: string
          hidden_by_user: boolean
          id: string
          last_message_at: string
          status: string
          support_read_at: string | null
          updated_at: string
          user_email: string
          user_id: string
          user_name: string
          user_read_at: string | null
          user_role: string
        }
        Insert: {
          company_code: string
          created_at?: string
          dealership_id: string
          dealership_name?: string
          hidden_by_user?: boolean
          id?: string
          last_message_at?: string
          status?: string
          support_read_at?: string | null
          updated_at?: string
          user_email: string
          user_id: string
          user_name: string
          user_read_at?: string | null
          user_role: string
        }
        Update: {
          company_code?: string
          created_at?: string
          dealership_id?: string
          dealership_name?: string
          hidden_by_user?: boolean
          id?: string
          last_message_at?: string
          status?: string
          support_read_at?: string | null
          updated_at?: string
          user_email?: string
          user_id?: string
          user_name?: string
          user_read_at?: string | null
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_threads_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          dealership_id: string
          id: string
          read_at: string | null
          recipient_id: string | null
          recipient_role_id: string | null
          sender_id: string | null
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          dealership_id: string
          id?: string
          read_at?: string | null
          recipient_id?: string | null
          recipient_role_id?: string | null
          sender_id?: string | null
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          dealership_id?: string
          id?: string
          read_at?: string | null
          recipient_id?: string | null
          recipient_role_id?: string | null
          sender_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_role_id_fkey"
            columns: ["recipient_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_fired: {
        Row: {
          fired_at: string
          key: string
          pushed_at: string | null
        }
        Insert: {
          fired_at?: string
          key: string
          pushed_at?: string | null
        }
        Update: {
          fired_at?: string
          key?: string
          pushed_at?: string | null
        }
        Relationships: []
      }
      parked_cars: {
        Row: {
          bay_tech: string | null
          car_model: string | null
          created_at: string
          dealership_id: string
          flag_dismissed_at: string | null
          flagged_at: string | null
          id: string
          is_staged: boolean
          located_at: string
          lot_position: string
          notes: string | null
          notes_updated_at: string | null
          parked_by: string | null
          ro_number: string | null
          stale_alerted_at: string | null
          tag_number: string | null
          updated_at: string
        }
        Insert: {
          bay_tech?: string | null
          car_model?: string | null
          created_at?: string
          dealership_id: string
          flag_dismissed_at?: string | null
          flagged_at?: string | null
          id?: string
          is_staged?: boolean
          located_at?: string
          lot_position?: string
          notes?: string | null
          notes_updated_at?: string | null
          parked_by?: string | null
          ro_number?: string | null
          stale_alerted_at?: string | null
          tag_number?: string | null
          updated_at?: string
        }
        Update: {
          bay_tech?: string | null
          car_model?: string | null
          created_at?: string
          dealership_id?: string
          flag_dismissed_at?: string | null
          flagged_at?: string | null
          id?: string
          is_staged?: boolean
          located_at?: string
          lot_position?: string
          notes?: string | null
          notes_updated_at?: string | null
          parked_by?: string | null
          ro_number?: string | null
          stale_alerted_at?: string | null
          tag_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parked_cars_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_requests: {
        Row: {
          advisor_name: string | null
          car_model: string | null
          car_notes: string | null
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          customer_address: string | null
          customer_arrived_at: string | null
          customer_eta: string | null
          customer_name: string | null
          customer_phone: string | null
          dealership_id: string
          eta_notified_at: string | null
          id: string
          is_staged: boolean
          kind: string
          lot_position: string | null
          reminded_at: string | null
          requested_by: string | null
          ro_number: string | null
          shuttle_kind: string | null
          source_role: string | null
          status: string
          tag_number: string | null
        }
        Insert: {
          advisor_name?: string | null
          car_model?: string | null
          car_notes?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_address?: string | null
          customer_arrived_at?: string | null
          customer_eta?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          dealership_id: string
          eta_notified_at?: string | null
          id?: string
          is_staged?: boolean
          kind?: string
          lot_position?: string | null
          reminded_at?: string | null
          requested_by?: string | null
          ro_number?: string | null
          shuttle_kind?: string | null
          source_role?: string | null
          status?: string
          tag_number?: string | null
        }
        Update: {
          advisor_name?: string | null
          car_model?: string | null
          car_notes?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_address?: string | null
          customer_arrived_at?: string | null
          customer_eta?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          dealership_id?: string
          eta_notified_at?: string | null
          id?: string
          is_staged?: boolean
          kind?: string
          lot_position?: string | null
          reminded_at?: string | null
          requested_by?: string | null
          ro_number?: string | null
          shuttle_kind?: string | null
          source_role?: string | null
          status?: string
          tag_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pickup_requests_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          avatar_version: string | null
          created_at: string
          deactivated_at: string | null
          deactivated_by: string | null
          dealership_id: string
          email: string
          full_name: string
          has_avatar: boolean | null
          id: string
          is_active: boolean
          is_owner: boolean
          nickname: string | null
          notifications_enabled: boolean
          pending_role_name: string | null
          role_id: string | null
          role_name: string
          status: string
        }
        Insert: {
          avatar_url?: string | null
          avatar_version?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          dealership_id?: string
          email: string
          full_name: string
          has_avatar?: boolean | null
          id: string
          is_active?: boolean
          is_owner?: boolean
          nickname?: string | null
          notifications_enabled?: boolean
          pending_role_name?: string | null
          role_id?: string | null
          role_name: string
          status?: string
        }
        Update: {
          avatar_url?: string | null
          avatar_version?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          dealership_id?: string
          email?: string
          full_name?: string
          has_avatar?: boolean | null
          id?: string
          is_active?: boolean
          is_owner?: boolean
          nickname?: string | null
          notifications_enabled?: boolean
          pending_role_name?: string | null
          role_id?: string | null
          role_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          id: string
          is_group: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_group?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_group?: boolean
          name?: string
        }
        Relationships: []
      }
      signup_attempts: {
        Row: {
          attempt_key: string
          created_at: string
          id: string
        }
        Insert: {
          attempt_key: string
          created_at?: string
          id?: string
        }
        Update: {
          attempt_key?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      thread_hides: {
        Row: {
          dealership_id: string
          hidden_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          dealership_id: string
          hidden_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          dealership_id?: string
          hidden_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_stale_pickups: { Args: never; Returns: undefined }
      assign_lot_position: {
        Args: {
          _car_model: string
          _confirm_displace?: boolean
          _notes: string
          _position: string
          _ro_number: string
          _target_id: string
        }
        Returns: Json
      }
      claim_milestone_push: { Args: { _key: string }; Returns: boolean }
      claim_pickup_request: {
        Args: { _pickup_id: string }
        Returns: {
          advisor_name: string | null
          car_model: string | null
          car_notes: string | null
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          customer_address: string | null
          customer_arrived_at: string | null
          customer_eta: string | null
          customer_name: string | null
          customer_phone: string | null
          dealership_id: string
          eta_notified_at: string | null
          id: string
          is_staged: boolean
          kind: string
          lot_position: string | null
          reminded_at: string | null
          requested_by: string | null
          ro_number: string | null
          shuttle_kind: string | null
          source_role: string | null
          status: string
          tag_number: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pickup_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      directory_for: {
        Args: { _uid: string }
        Returns: {
          avatar_version: string
          full_name: string
          has_avatar: boolean
          id: string
          is_active: boolean
          nickname: string
          role_id: string
          role_name: string
        }[]
      }
      log_car_event: {
        Args: {
          _actor: string
          _dealership_id: string
          _detail: string
          _notes: string
          _ro: string
          _type: string
        }
        Returns: undefined
      }
      lot_snapshot_at: {
        Args: { _at: string }
        Returns: {
          created_at: string
          dealership_id: string
          detail: string
          event_type: string
          ro_number: string
        }[]
      }
      message_recipients_for: {
        Args: { _uid: string }
        Returns: {
          avatar_version: string
          full_name: string
          has_avatar: boolean
          id: string
          nickname: string
          role_name: string
        }[]
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
