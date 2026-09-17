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
      chore_completions: {
        Row: {
          chore_id: string
          completed_on: string
          created_at: string
          household_id: string
          id: string
          member_id: string | null
        }
        Insert: {
          chore_id: string
          completed_on?: string
          created_at?: string
          household_id?: string
          id?: string
          member_id?: string | null
        }
        Update: {
          chore_id?: string
          completed_on?: string
          created_at?: string
          household_id?: string
          id?: string
          member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chore_completions_chore_id_fkey"
            columns: ["chore_id"]
            isOneToOne: false
            referencedRelation: "chores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_completions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_completions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      chore_edits: {
        Row: {
          after_data: Json
          before_data: Json
          chore_id: string
          created_at: string
          dismissed: boolean
          edited_by: string | null
          editor_name: string
          household_id: string
          id: string
          undone: boolean
        }
        Insert: {
          after_data: Json
          before_data: Json
          chore_id: string
          created_at?: string
          dismissed?: boolean
          edited_by?: string | null
          editor_name?: string
          household_id?: string
          id?: string
          undone?: boolean
        }
        Update: {
          after_data?: Json
          before_data?: Json
          chore_id?: string
          created_at?: string
          dismissed?: boolean
          edited_by?: string | null
          editor_name?: string
          household_id?: string
          id?: string
          undone?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chore_edits_chore_id_fkey"
            columns: ["chore_id"]
            isOneToOne: false
            referencedRelation: "chores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_edits_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      chores: {
        Row: {
          archived: boolean
          created_at: string
          due_date: string
          frequency: string
          household_id: string
          id: string
          member_id: string | null
          notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          due_date?: string
          frequency?: string
          household_id?: string
          id?: string
          member_id?: string | null
          notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          due_date?: string
          frequency?: string
          household_id?: string
          id?: string
          member_id?: string | null
          notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chores_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      household_settings: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      households: {
        Row: {
          created_at: string
          id: string
          join_key: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_key: string
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          join_key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_edits: {
        Row: {
          action: string
          after_name: string
          before_name: string
          created_at: string
          dismissed: boolean
          edited_by: string | null
          editor_name: string
          household_id: string
          id: string
          item_id: string
          undone: boolean
        }
        Insert: {
          action?: string
          after_name: string
          before_name: string
          created_at?: string
          dismissed?: boolean
          edited_by?: string | null
          editor_name?: string
          household_id?: string
          id?: string
          item_id: string
          undone?: boolean
        }
        Update: {
          action?: string
          after_name?: string
          before_name?: string
          created_at?: string
          dismissed?: boolean
          edited_by?: string | null
          editor_name?: string
          household_id?: string
          id?: string
          item_id?: string
          undone?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inventory_edits_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_edits_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          created_at: string
          deleted: boolean
          household_id: string
          id: string
          low_threshold: number
          name: string
          note: string | null
          note_updated_at: string | null
          note_updated_by: string | null
          quantity: number
          reviewed_at: string
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          deleted?: boolean
          household_id?: string
          id?: string
          low_threshold?: number
          name: string
          note?: string | null
          note_updated_at?: string | null
          note_updated_by?: string | null
          quantity?: number
          reviewed_at?: string
          status?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          deleted?: boolean
          household_id?: string
          id?: string
          low_threshold?: number
          name?: string
          note?: string | null
          note_updated_at?: string | null
          note_updated_by?: string | null
          quantity?: number
          reviewed_at?: string
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          created_at: string
          display_name: string
          household_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          household_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          household_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_ingredients: {
        Row: {
          created_at: string
          household_id: string
          id: string
          meal_id: string
          name: string
          quantity: string | null
        }
        Insert: {
          created_at?: string
          household_id?: string
          id?: string
          meal_id: string
          name: string
          quantity?: string | null
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          meal_id?: string
          name?: string
          quantity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_ingredients_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_ingredients_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          cooked: boolean
          created_at: string
          household_id: string
          id: string
          meal_date: string
          notes: string | null
          slot: string
          title: string
          toddler_note: string
          updated_at: string
        }
        Insert: {
          cooked?: boolean
          created_at?: string
          household_id?: string
          id?: string
          meal_date: string
          notes?: string | null
          slot: string
          title: string
          toddler_note?: string
          updated_at?: string
        }
        Update: {
          cooked?: boolean
          created_at?: string
          household_id?: string
          id?: string
          meal_date?: string
          notes?: string | null
          slot?: string
          title?: string
          toddler_note?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          color: string
          created_at: string
          emoji: string
          household_id: string
          id: string
          initial: string
          name: string
          role: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          emoji?: string
          household_id?: string
          id?: string
          initial?: string
          name: string
          role?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          emoji?: string
          household_id?: string
          id?: string
          initial?: string
          name?: string
          role?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          household_id: string | null
          id: string
          inventory_reviewed_on: string | null
          member_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          household_id?: string | null
          id: string
          inventory_reviewed_on?: string | null
          member_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          household_id?: string | null
          id?: string
          inventory_reviewed_on?: string | null
          member_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          buy_after: string | null
          category: string
          checked: boolean
          created_at: string
          household_id: string
          id: string
          name: string
          quantity: string | null
          updated_at: string
        }
        Insert: {
          buy_after?: string | null
          category?: string
          checked?: boolean
          created_at?: string
          household_id?: string
          id?: string
          name: string
          quantity?: string | null
          updated_at?: string
        }
        Update: {
          buy_after?: string | null
          category?: string
          checked?: boolean
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          quantity?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          household_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_household: {
        Args: { _display_name: string; _name: string }
        Returns: string
      }
      current_household_id: { Args: never; Returns: string }
      gen_join_key: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      household_member_roles: {
        Args: never
        Returns: {
          member_id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      is_household_admin: { Args: never; Returns: boolean }
      my_onboarding_state: {
        Args: never
        Returns: {
          household_id: string
          household_name: string
          join_status: string
        }[]
      }
      request_join_household: {
        Args: { _display_name: string; _key: string }
        Returns: string
      }
      resolve_join_request: {
        Args: { _approve: boolean; _request_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "member"
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
    Enums: {
      app_role: ["admin", "member"],
    },
  },
} as const
