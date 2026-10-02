/**
 * Generated from the live schema (Supabase `generate_typescript_types`).
 * Regenerate with:  npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      categories: {
        Row: { color: string; created_at: string; id: string; name: string; user_id: string };
        Insert: { color?: string; created_at?: string; id?: string; name: string; user_id?: string };
        Update: { color?: string; created_at?: string; id?: string; name?: string; user_id?: string };
        Relationships: [];
      };
      notes: {
        Row: {
          color: string;
          content: string;
          created_at: string;
          id: string;
          updated_at: string;
          user_id: string;
          x: number;
          y: number;
          z: number;
        };
        Insert: {
          color?: string;
          content?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
          x?: number;
          y?: number;
          z?: number;
        };
        Update: {
          color?: string;
          content?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
          x?: number;
          y?: number;
          z?: number;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          read_at: string | null;
          scheduled_for: string;
          sent_at: string | null;
          status: Database['public']['Enums']['notification_status'];
          task_id: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message: string;
          read_at?: string | null;
          scheduled_for: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['notification_status'];
          task_id?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          read_at?: string | null;
          scheduled_for?: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['notification_status'];
          task_id?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          default_reminder_minutes: number | null;
          full_name: string | null;
          id: string;
          notifications_enabled: boolean;
          theme: Database['public']['Enums']['theme_pref'];
          time_format: Database['public']['Enums']['time_format'];
          timezone: string;
          updated_at: string;
          week_starts_on: number;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          default_reminder_minutes?: number | null;
          full_name?: string | null;
          id: string;
          notifications_enabled?: boolean;
          theme?: Database['public']['Enums']['theme_pref'];
          time_format?: Database['public']['Enums']['time_format'];
          timezone?: string;
          updated_at?: string;
          week_starts_on?: number;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          default_reminder_minutes?: number | null;
          full_name?: string | null;
          id?: string;
          notifications_enabled?: boolean;
          theme?: Database['public']['Enums']['theme_pref'];
          time_format?: Database['public']['Enums']['time_format'];
          timezone?: string;
          updated_at?: string;
          week_starts_on?: number;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          last_used_at: string | null;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          last_used_at?: string | null;
          p256dh: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          last_used_at?: string | null;
          p256dh?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          category_id: string | null;
          completed_at: string | null;
          created_at: string;
          description: string | null;
          due_at: string | null;
          due_date: string | null;
          due_time: string | null;
          id: string;
          priority: Database['public']['Enums']['task_priority'];
          reminder_offset_minutes: number | null;
          status: Database['public']['Enums']['task_status'];
          timezone: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          due_at?: string | null;
          due_date?: string | null;
          due_time?: string | null;
          id?: string;
          priority?: Database['public']['Enums']['task_priority'];
          reminder_offset_minutes?: number | null;
          status?: Database['public']['Enums']['task_status'];
          timezone?: string;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          category_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          due_at?: string | null;
          due_date?: string | null;
          due_time?: string | null;
          id?: string;
          priority?: Database['public']['Enums']['task_priority'];
          reminder_offset_minutes?: number | null;
          status?: Database['public']['Enums']['task_status'];
          timezone?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_category_fk';
            columns: ['category_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number };
      register_push_subscription: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string; p_user_agent?: string };
        Returns: undefined;
      };
      unregister_push_subscription: { Args: { p_endpoint: string }; Returns: undefined };
    };
    Enums: {
      notification_status: 'pending' | 'sent' | 'read';
      task_priority: 'low' | 'medium' | 'high';
      task_status: 'pending' | 'completed' | 'cancelled';
      theme_pref: 'light' | 'dark' | 'system';
      time_format: '24h' | '12h';
    };
    CompositeTypes: { [_ in never]: never };
  };
};
