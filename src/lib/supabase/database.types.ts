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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      games: {
        Row: {
          base_game_hash: string | null
          created_at: string
          generation: number
          id: string
          is_rom_hack: boolean | null
          metadata: Json | null
          patch_storage_path: string | null
          region: string | null
          sha1_hash: string
          system: string
          title: string
        }
        Insert: {
          base_game_hash?: string | null
          created_at?: string
          generation: number
          id?: string
          is_rom_hack?: boolean | null
          metadata?: Json | null
          patch_storage_path?: string | null
          region?: string | null
          sha1_hash: string
          system: string
          title: string
        }
        Update: {
          base_game_hash?: string | null
          created_at?: string
          generation?: number
          id?: string
          is_rom_hack?: boolean | null
          metadata?: Json | null
          patch_storage_path?: string | null
          region?: string | null
          sha1_hash?: string
          system?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_base_game_hash_fkey"
            columns: ["base_game_hash"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["sha1_hash"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rom_comments: {
        Row: {
          body: string
          created_at: string | null
          id: string
          listing_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          listing_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          listing_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rom_comments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "rom_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      rom_likes: {
        Row: {
          created_at: string | null
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rom_likes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "rom_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      rom_listings: {
        Row: {
          base_game_hash: string | null
          base_game_title: string | null
          comment_count: number | null
          created_at: string | null
          description: string | null
          generation: number | null
          id: string
          image_url: string | null
          is_public: boolean | null
          like_count: number | null
          owner_id: string
          rom_sha1: string
          rom_size_bytes: number | null
          rom_storage_path: string | null
          system: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          base_game_hash?: string | null
          base_game_title?: string | null
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          generation?: number | null
          id?: string
          image_url?: string | null
          is_public?: boolean | null
          like_count?: number | null
          owner_id: string
          rom_sha1: string
          rom_size_bytes?: number | null
          rom_storage_path?: string | null
          system?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          base_game_hash?: string | null
          base_game_title?: string | null
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          generation?: number | null
          id?: string
          image_url?: string | null
          is_public?: boolean | null
          like_count?: number | null
          owner_id?: string
          rom_sha1?: string
          rom_size_bytes?: number | null
          rom_storage_path?: string | null
          system?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      room_members: {
        Row: {
          id: string
          is_active: boolean
          joined_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          joined_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          joined_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          created_by: string
          game_hash: string | null
          id: string
          is_active: boolean
          last_activity_at: string
          max_players: number
          name: string
          password_hash: string | null
          settings: Json | null
          system: string
        }
        Insert: {
          created_at?: string
          created_by: string
          game_hash?: string | null
          id?: string
          is_active?: boolean
          last_activity_at?: string
          max_players?: number
          name: string
          password_hash?: string | null
          settings?: Json | null
          system: string
        }
        Update: {
          created_at?: string
          created_by?: string
          game_hash?: string | null
          id?: string
          is_active?: boolean
          last_activity_at?: string
          max_players?: number
          name?: string
          password_hash?: string | null
          settings?: Json | null
          system?: string
        }
        Relationships: []
      }
      save_history: {
        Row: {
          checksum: string | null
          created_at: string
          id: string
          save_id: string
          size_bytes: number
          storage_path: string
          version: number
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          id?: string
          save_id: string
          size_bytes: number
          storage_path: string
          version: number
        }
        Update: {
          checksum?: string | null
          created_at?: string
          id?: string
          save_id?: string
          size_bytes?: number
          storage_path?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "save_history_save_id_fkey"
            columns: ["save_id"]
            isOneToOne: false
            referencedRelation: "saves"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          checksum: string | null
          created_at: string
          game_hash: string
          id: string
          playtime_seconds: number | null
          progress: Json | null
          save_type: string
          size_bytes: number
          slot: number
          storage_path: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          game_hash: string
          id?: string
          playtime_seconds?: number | null
          progress?: Json | null
          save_type: string
          size_bytes: number
          slot?: number
          storage_path: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          checksum?: string | null
          created_at?: string
          game_hash?: string
          id?: string
          playtime_seconds?: number | null
          progress?: Json | null
          save_type?: string
          size_bytes?: number
          slot?: number
          storage_path?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      user_games: {
        Row: {
          added_at: string
          game_hash: string
          id: string
          last_played_at: string | null
          total_playtime_seconds: number | null
          user_id: string
        }
        Insert: {
          added_at?: string
          game_hash: string
          id?: string
          last_played_at?: string | null
          total_playtime_seconds?: number | null
          user_id: string
        }
        Update: {
          added_at?: string
          game_hash?: string
          id?: string
          last_played_at?: string | null
          total_playtime_seconds?: number | null
          user_id?: string
        }
        Relationships: []
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
