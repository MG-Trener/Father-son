export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      achievement_awards: {
        Row: { awarded_at: string; awarded_by: string | null; definition_id: string; evidence: Json; family_id: string; id: string; recipient_user_id: string | null }
        Insert: { awarded_at?: string; awarded_by?: string | null; definition_id: string; evidence?: Json; family_id: string; id?: string; recipient_user_id?: string | null }
        Update: { awarded_at?: string; awarded_by?: string | null; definition_id?: string; evidence?: Json; family_id?: string; id?: string; recipient_user_id?: string | null }
        Relationships: []
      }
      achievement_definitions: {
        Row: { category: string; created_at: string; description: string; hidden: boolean; id: string; rule: Json; rule_version: number; tier: number; title: string }
        Insert: { category: string; created_at?: string; description: string; hidden?: boolean; id: string; rule?: Json; rule_version?: number; tier?: number; title: string }
        Update: { category?: string; created_at?: string; description?: string; hidden?: boolean; id?: string; rule?: Json; rule_version?: number; tier?: number; title?: string }
        Relationships: []
      }
      activity_event_reads: {
        Row: { event_id: string; family_id: string; read_at: string; user_id: string }
        Insert: { event_id: string; family_id: string; read_at?: string; user_id: string }
        Update: { event_id?: string; family_id?: string; read_at?: string; user_id?: string }
        Relationships: []
      }
      activity_events: {
        Row: { actor_user_id: string | null; category: string | null; created_at: string; event_type: string; family_id: string; id: string; occurred_at: string; payload: Json }
        Insert: { actor_user_id?: string | null; category?: string | null; created_at?: string; event_type: string; family_id: string; id?: string; occurred_at?: string; payload?: Json }
        Update: { actor_user_id?: string | null; category?: string | null; created_at?: string; event_type?: string; family_id?: string; id?: string; occurred_at?: string; payload?: Json }
        Relationships: []
      }
      age_seasons: {
        Row: { age_year: number; created_at: string; ended_on: string | null; family_id: string; id: string; started_on: string; status: string; subject_user_id: string; title: string }
        Insert: { age_year: number; created_at?: string; ended_on?: string | null; family_id: string; id?: string; started_on: string; status?: string; subject_user_id: string; title: string }
        Update: { age_year?: number; created_at?: string; ended_on?: string | null; family_id?: string; id?: string; started_on?: string; status?: string; subject_user_id?: string; title?: string }
        Relationships: []
      }
      app_releases: {
        Row: { channel: string; created_at: string; download_url: string | null; id: number; is_enabled: boolean; minimum_supported_code: number; notes: string | null; platform: string; published_at: string; sha256: string | null; size_bytes: number | null; storage_bucket: string | null; storage_path: string | null; title: string | null; version_code: number; version_name: string }
        Insert: { channel?: string; created_at?: string; download_url?: string | null; id?: number; is_enabled?: boolean; minimum_supported_code?: number; notes?: string | null; platform: string; published_at?: string; sha256?: string | null; size_bytes?: number | null; storage_bucket?: string | null; storage_path?: string | null; title?: string | null; version_code: number; version_name: string }
        Update: { channel?: string; created_at?: string; download_url?: string | null; id?: number; is_enabled?: boolean; minimum_supported_code?: number; notes?: string | null; platform?: string; published_at?: string; sha256?: string | null; size_bytes?: number | null; storage_bucket?: string | null; storage_path?: string | null; title?: string | null; version_code?: number; version_name?: string }
        Relationships: []
      }
      families: {
        Row: { created_at: string; created_by: string; id: string; name: string; timezone: string }
        Insert: { created_at?: string; created_by: string; id?: string; name?: string; timezone?: string }
        Update: { created_at?: string; created_by?: string; id?: string; name?: string; timezone?: string }
        Relationships: []
      }
      family_agreement_confirmations: {
        Row: { agreement_id: string; confirmed_at: string; user_id: string }
        Insert: { agreement_id: string; confirmed_at?: string; user_id: string }
        Update: { agreement_id?: string; confirmed_at?: string; user_id?: string }
        Relationships: []
      }
      family_agreements: {
        Row: { archived_at: string | null; created_at: string; created_by: string; family_id: string; id: string; note: string | null; title: string }
        Insert: { archived_at?: string | null; created_at?: string; created_by: string; family_id: string; id?: string; note?: string | null; title: string }
        Update: { archived_at?: string | null; created_at?: string; created_by?: string; family_id?: string; id?: string; note?: string | null; title?: string }
        Relationships: []
      }
      family_members: {
        Row: { birth_date: string | null; display_name: string; family_id: string; joined_at: string; onboarding_completed_at: string | null; role: string; user_id: string }
        Insert: { birth_date?: string | null; display_name: string; family_id: string; joined_at?: string; onboarding_completed_at?: string | null; role: string; user_id: string }
        Update: { birth_date?: string | null; display_name?: string; family_id?: string; joined_at?: string; onboarding_completed_at?: string | null; role?: string; user_id?: string }
        Relationships: []
      }
      family_rituals: {
        Row: { active: boolean; cadence: string; cadence_value: number | null; created_at: string; created_by: string; description: string | null; family_id: string; id: string; symbol: string; title: string; updated_at: string }
        Insert: { active?: boolean; cadence?: string; cadence_value?: number | null; created_at?: string; created_by: string; description?: string | null; family_id: string; id?: string; symbol?: string; title: string; updated_at?: string }
        Update: { active?: boolean; cadence?: string; cadence_value?: number | null; created_at?: string; created_by?: string; description?: string | null; family_id?: string; id?: string; symbol?: string; title?: string; updated_at?: string }
        Relationships: []
      }
      future_letter_contents: {
        Row: { body: string; letter_id: string; updated_at: string }
        Insert: { body: string; letter_id: string; updated_at?: string }
        Update: { body?: string; letter_id?: string; updated_at?: string }
        Relationships: []
      }
      future_letters: {
        Row: { author_user_id: string; created_at: string; family_id: string; id: string; opened_at: string | null; recipient_user_id: string; sealed_at: string | null; status: string; title: string; unlock_at: string; updated_at: string }
        Insert: { author_user_id: string; created_at?: string; family_id: string; id?: string; opened_at?: string | null; recipient_user_id: string; sealed_at?: string | null; status?: string; title: string; unlock_at: string; updated_at?: string }
        Update: { author_user_id?: string; created_at?: string; family_id?: string; id?: string; opened_at?: string | null; recipient_user_id?: string; sealed_at?: string | null; status?: string; title?: string; unlock_at?: string; updated_at?: string }
        Relationships: []
      }
      growth_entries: {
        Row: { activity_date: string; category: string; created_at: string; created_by: string; entry_type: string; family_id: string; id: string; metrics: Json; note: string | null; title: string | null; user_id: string }
        Insert: { activity_date?: string; category: string; created_at?: string; created_by: string; entry_type: string; family_id: string; id?: string; metrics?: Json; note?: string | null; title?: string | null; user_id: string }
        Update: { activity_date?: string; category?: string; created_at?: string; created_by?: string; entry_type?: string; family_id?: string; id?: string; metrics?: Json; note?: string | null; title?: string | null; user_id?: string }
        Relationships: []
      }
      meeting_idea_reactions: {
        Row: { created_at: string; family_id: string; id: string; idea_id: string; reaction: string; updated_at: string; user_id: string }
        Insert: { created_at?: string; family_id: string; id?: string; idea_id: string; reaction: string; updated_at?: string; user_id: string }
        Update: { created_at?: string; family_id?: string; id?: string; idea_id?: string; reaction?: string; updated_at?: string; user_id?: string }
        Relationships: []
      }
      meeting_ideas: {
        Row: { created_at: string; created_by: string; family_id: string; id: string; meeting_id: string; reaction: string | null; title: string }
        Insert: { created_at?: string; created_by: string; family_id: string; id?: string; meeting_id: string; reaction?: string | null; title: string }
        Update: { created_at?: string; created_by?: string; family_id?: string; id?: string; meeting_id?: string; reaction?: string | null; title?: string }
        Relationships: []
      }
      meetings: {
        Row: { created_at: string; created_by: string; family_id: string; id: string; meeting_date: string; note: string | null; status: string; title: string; updated_at: string }
        Insert: { created_at?: string; created_by: string; family_id: string; id?: string; meeting_date: string; note?: string | null; status?: string; title?: string; updated_at?: string }
        Update: { created_at?: string; created_by?: string; family_id?: string; id?: string; meeting_date?: string; note?: string | null; status?: string; title?: string; updated_at?: string }
        Relationships: []
      }
      missions: {
        Row: { assigned_to: string | null; category: string; completed_at: string | null; created_at: string; created_by: string; description: string | null; due_at: string | null; family_id: string; id: string; skill_node_id: string | null; status: string; title: string; xp_reward: number }
        Insert: { assigned_to?: string | null; category: string; completed_at?: string | null; created_at?: string; created_by: string; description?: string | null; due_at?: string | null; family_id: string; id?: string; skill_node_id?: string | null; status?: string; title: string; xp_reward?: number }
        Update: { assigned_to?: string | null; category?: string; completed_at?: string | null; created_at?: string; created_by?: string; description?: string | null; due_at?: string | null; family_id?: string; id?: string; skill_node_id?: string | null; status?: string; title?: string; xp_reward?: number }
        Relationships: []
      }
      moods: {
        Row: { created_at: string; family_id: string; id: string; mood: string; note: string | null; user_id: string }
        Insert: { created_at?: string; family_id: string; id?: string; mood: string; note?: string | null; user_id: string }
        Update: { created_at?: string; family_id?: string; id?: string; mood?: string; note?: string | null; user_id?: string }
        Relationships: []
      }
      notification_deliveries: {
        Row: { created_at: string; error_message: string | null; event_id: string; expo_push_token: string; id: string; recipient_user_id: string; status: string; ticket_id: string | null; updated_at: string }
        Insert: { created_at?: string; error_message?: string | null; event_id: string; expo_push_token: string; id?: string; recipient_user_id: string; status?: string; ticket_id?: string | null; updated_at?: string }
        Update: { created_at?: string; error_message?: string | null; event_id?: string; expo_push_token?: string; id?: string; recipient_user_id?: string; status?: string; ticket_id?: string | null; updated_at?: string }
        Relationships: []
      }
      push_devices: {
        Row: { created_at: string; enabled: boolean; expo_push_token: string; id: string; last_seen_at: string; platform: string; updated_at: string; user_id: string }
        Insert: { created_at?: string; enabled?: boolean; expo_push_token: string; id?: string; last_seen_at?: string; platform: string; updated_at?: string; user_id: string }
        Update: { created_at?: string; enabled?: boolean; expo_push_token?: string; id?: string; last_seen_at?: string; platform?: string; updated_at?: string; user_id?: string }
        Relationships: []
      }
      recognitions: {
        Row: { category: string; created_at: string; family_id: string; from_user_id: string; id: string; note: string; quality: string; related_event_id: string | null; title: string; to_user_id: string }
        Insert: { category: string; created_at?: string; family_id: string; from_user_id: string; id?: string; note: string; quality: string; related_event_id?: string | null; title: string; to_user_id: string }
        Update: { category?: string; created_at?: string; family_id?: string; from_user_id?: string; id?: string; note?: string; quality?: string; related_event_id?: string | null; title?: string; to_user_id?: string }
        Relationships: []
      }
      reflections: {
        Row: { author_user_id: string; body: string; category: string | null; created_at: string; family_id: string; id: string; prompt: string | null; visibility: string }
        Insert: { author_user_id: string; body: string; category?: string | null; created_at?: string; family_id: string; id?: string; prompt?: string | null; visibility?: string }
        Update: { author_user_id?: string; body?: string; category?: string | null; created_at?: string; family_id?: string; id?: string; prompt?: string | null; visibility?: string }
        Relationships: []
      }
      ritual_moments: {
        Row: { created_at: string; created_by: string; family_id: string; happened_on: string; id: string; note: string | null; ritual_id: string }
        Insert: { created_at?: string; created_by: string; family_id: string; happened_on: string; id?: string; note?: string | null; ritual_id: string }
        Update: { created_at?: string; created_by?: string; family_id?: string; happened_on?: string; id?: string; note?: string | null; ritual_id?: string }
        Relationships: []
      }
      skill_nodes: {
        Row: { created_at: string; description: string; hidden: boolean; id: string; node_type: string; path_id: string; recommended_age_from: number | null; recommended_age_to: number | null; stage_order: number; title: string }
        Insert: { created_at?: string; description: string; hidden?: boolean; id: string; node_type?: string; path_id: string; recommended_age_from?: number | null; recommended_age_to?: number | null; stage_order: number; title: string }
        Update: { created_at?: string; description?: string; hidden?: boolean; id?: string; node_type?: string; path_id?: string; recommended_age_from?: number | null; recommended_age_to?: number | null; stage_order?: number; title?: string }
        Relationships: []
      }
      skill_paths: {
        Row: { created_at: string; description: string; id: string; sort_order: number; title: string }
        Insert: { created_at?: string; description: string; id: string; sort_order?: number; title: string }
        Update: { created_at?: string; description?: string; id?: string; sort_order?: number; title?: string }
        Relationships: []
      }
      skill_progress: {
        Row: { completed_at: string | null; evidence: Json; family_id: string; id: string; node_id: string; opened_at: string; status: string; user_id: string }
        Insert: { completed_at?: string | null; evidence?: Json; family_id: string; id?: string; node_id: string; opened_at?: string; status?: string; user_id: string }
        Update: { completed_at?: string | null; evidence?: Json; family_id?: string; id?: string; node_id?: string; opened_at?: string; status?: string; user_id?: string }
        Relationships: []
      }
      voice_stories: {
        Row: { author_user_id: string; created_at: string; duration_ms: number; family_id: string; id: string; prompt: string | null; recorded_at: string; status: string; storage_path: string; title: string | null; updated_at: string }
        Insert: { author_user_id: string; created_at?: string; duration_ms: number; family_id: string; id?: string; prompt?: string | null; recorded_at?: string; status?: string; storage_path: string; title?: string | null; updated_at?: string }
        Update: { author_user_id?: string; created_at?: string; duration_ms?: number; family_id?: string; id?: string; prompt?: string | null; recorded_at?: string; status?: string; storage_path?: string; title?: string | null; updated_at?: string }
        Relationships: []
      }
      weekly_focuses: {
        Row: { category: string; created_at: string; created_by: string; family_id: string; id: string; note: string | null; target_user_id: string | null; title: string; updated_at: string; week_start: string }
        Insert: { category: string; created_at?: string; created_by: string; family_id: string; id?: string; note?: string | null; target_user_id?: string | null; title: string; updated_at?: string; week_start: string }
        Update: { category?: string; created_at?: string; created_by?: string; family_id?: string; id?: string; note?: string | null; target_user_id?: string | null; title?: string; updated_at?: string; week_start?: string }
        Relationships: []
      }
      year_reviews: {
        Row: { created_at: string; family_id: string; finalized_at: string | null; generated_summary: string | null; highlights: Json; id: string; season_id: string; subject_user_id: string }
        Insert: { created_at?: string; family_id: string; finalized_at?: string | null; generated_summary?: string | null; highlights?: Json; id?: string; season_id: string; subject_user_id: string }
        Update: { created_at?: string; family_id?: string; finalized_at?: string | null; generated_summary?: string | null; highlights?: Json; id?: string; season_id?: string; subject_user_id?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      archive_family_agreement: { Args: { p_agreement_id: string }; Returns: Json }
      complete_meeting_plan: { Args: { p_meeting_id: string }; Returns: Json }
      complete_mission: { Args: { p_mission_id: string }; Returns: Json }
      confirm_family_agreement: { Args: { p_agreement_id: string }; Returns: Json }
      create_family_agreement: { Args: { p_family_id: string; p_note?: string; p_title: string }; Returns: Json }
      create_family_invite: { Args: { p_display_name_hint?: string; p_family_id: string }; Returns: Json }
      create_family_team: { Args: { p_display_name: string; p_family_name?: string }; Returns: Json }
      create_future_letter: { Args: { p_body: string; p_family_id: string; p_recipient_user_id: string; p_title: string; p_unlock_at: string }; Returns: Json }
      create_growth_entry: { Args: { p_activity_date?: string; p_category: string; p_entry_type: string; p_family_id: string; p_metrics?: Json; p_note?: string; p_title?: string; p_user_id: string }; Returns: Json }
      create_meeting_plan: { Args: { p_family_id: string; p_meeting_date: string; p_note?: string; p_title: string }; Returns: Json }
      create_mission: { Args: { p_assigned_to?: string; p_category: string; p_description?: string; p_due_at?: string; p_family_id: string; p_skill_node_id?: string; p_title: string; p_xp_reward?: number }; Returns: Json }
      create_reflection_entry: { Args: { p_body: string; p_family_id: string; p_prompt?: string }; Returns: Json }
      delete_future_letter_draft: { Args: { p_letter_id: string }; Returns: boolean }
      get_latest_app_release: { Args: { p_channel?: string; p_platform?: string }; Returns: { download_url: string; minimum_supported_code: number; notes: string; published_at: string; sha256: string; size_bytes: number; storage_bucket: string; storage_path: string; title: string; version_code: number; version_name: string }[] }
      join_family_by_code: { Args: { p_birth_date?: string; p_display_name: string; p_invite_code: string }; Returns: Json }
      mark_activity_events_read: { Args: { p_event_ids: string[]; p_family_id: string }; Returns: number }
      open_future_letter: { Args: { p_letter_id: string }; Returns: Json }
      register_push_device: { Args: { p_expo_push_token: string; p_platform: string }; Returns: string }
      register_voice_story: { Args: { p_duration_ms: number; p_family_id: string; p_prompt?: string; p_storage_path: string; p_title?: string }; Returns: Json }
      respond_connection_signal: { Args: { p_response: string; p_signal_event_id: string }; Returns: Json }
      seal_future_letter: { Args: { p_letter_id: string }; Returns: Json }
      send_connection_signal: { Args: { p_family_id: string; p_message?: string; p_signal_type: string }; Returns: Json }
      unregister_all_push_devices: { Args: never; Returns: number }
      unregister_push_device: { Args: { p_expo_push_token: string }; Returns: boolean }
      update_future_letter_draft: { Args: { p_body: string; p_letter_id: string; p_recipient_user_id: string; p_title: string; p_unlock_at: string }; Returns: Json }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<TableName extends keyof Database['public']['Tables']> = Database['public']['Tables'][TableName]['Row']
export type TablesInsert<TableName extends keyof Database['public']['Tables']> = Database['public']['Tables'][TableName]['Insert']
export type TablesUpdate<TableName extends keyof Database['public']['Tables']> = Database['public']['Tables'][TableName]['Update']
