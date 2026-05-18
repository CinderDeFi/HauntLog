// Database type shapes mirroring the SQL schema in supabase/01-schema.sql.
// Used by the typed Supabase client so queries get autocomplete and
// compile-time field checking.
//
// Naming convention: snake_case here (matches Postgres). Conversion to
// camelCase happens in the data-access layer we'll write in step 4.

export type Visibility = 'public' | 'private' | 'anonymous';
export type LocationSource = 'user' | 'catalog';
export type TeamRole = 'owner' | 'admin' | 'member';
export type ClaimStatus = 'pending' | 'approved' | 'rejected';

export type ProfileRow = {
  id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  tier: string;
  is_admin: boolean;
  handle_changed_at: string | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  youtube: string | null;
  field_mode: boolean;
  created_at: string;
  updated_at: string;
};

export type TeamRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  youtube: string | null;
  verified: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'rescinded' | 'expired';

export type TeamInviteRow = {
  id: string;
  team_id: string;
  invitee_id: string;
  invited_by: string | null;
  role: TeamRole;
  message: string | null;
  status: InviteStatus;
  expires_at: string;
  created_at: string;
  decided_at: string | null;
};

export type TeamMemberRow = {
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
};

export type LocationClaimStatus = 'unclaimed' | 'claimed' | 'verified';

/** Per-tier pricing entry inside locations.pricing */
export type LocationPricingTier = {
  label: string;        // "FRI – SAT"
  price: number;        // 550
  subtitle?: string;    // "up to 10 guests"
  promo?: string;       // "SAVE $150"
};

export type LocationPricing = {
  currency?: string;    // "USD"
  tiers: LocationPricingTier[];
  fine_print?: string;
};

export type LocationRow = {
  id: string;
  source: LocationSource;
  name: string;
  lat: number;
  lng: number;
  description: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  website: string | null;
  hours: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  rules: string[] | null;
  booking_url: string | null;
  tags: string[] | null;
  photos: string[] | null;
  notes: string | null;
  claimed_by: string | null;
  verified: boolean;
  created_by_handle: string;
  created_at: string;
  updated_at: string;

  // Step 11 — rich venue profile fields
  built_year: number | null;
  tagline: string | null;
  hero_image: string | null;
  claim_status: LocationClaimStatus;
  claimed_by_team_id: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  features: string[];
  operating_window: string | null;
  pricing: LocationPricing | null;
};

export type LocationZoneRow = {
  id: string;
  location_id: string;
  name: string;
  icon: string | null;
  tags: string[];
  description: string | null;
  sort_order: number;
  created_at: string;
};

export type LocationRevisionRow = {
  id: string;
  location_id: string;
  edited_by: string;
  edited_at: string;
  changes: Record<string, unknown>;
};

export type LocationClaimRow = {
  id: string;
  location_id: string;
  claimant_id: string;
  status: ClaimStatus;
  proof_url: string | null;
  message: string | null;
  admin_note: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  // Step 16 additions
  claimed_role: string | null;
  proof_links: string[] | null;
};

export type CheckInRow = {
  id: string;
  hunt_id: string;
  location_id: string | null;
  location_name: string;
  lat: number | null;
  lng: number | null;
  visibility: Visibility;
  owner_id: string;
  team_id: string | null;
  started_at: string;
  expires_at: string;
  active: boolean;
  created_at: string;
};

export type CaseRow = {
  id: string;
  owner_id: string;
  team_id: string | null;
  title: string;
  summary: string | null;
  location_id: string | null;
  location_name: string;
  zone: string | null;
  lat: number | null;
  lng: number | null;
  started_at: string;
  ended_at: string | null;
  visibility: Visibility;
  gps_verified: boolean;
  equipment_used: string[] | null;
  custom_equipment: Record<string, string> | null;
  tags: string[] | null;
  sealed: boolean;
  investigation_id: string | null;
  group_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  /** Step 42: denormalized aggregate of case_reactions, kept fresh
   * by a trigger. Shape: {examine?, witnessed?, skeptical?, chilled?}. */
  reaction_counts: Record<string, number>;
};

export type LogEntryRow = {
  id: string;
  case_id: string;
  logged_by: string;
  timestamp: string;
  equipment_id: string;
  equipment_label: string | null;
  observation: string;
  note: string | null;
  starred: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
};

export type MediaAttachmentRow = {
  id: string;
  log_entry_id: string | null;
  case_id: string | null;
  kind: 'video' | 'audio' | 'image';
  url: string;
  caption: string | null;
  added_by: string;
  added_at: string;
};

export type AdminReviewRow = {
  id: string;
  kind: 'location_claim' | 'team_verification' | 'location_submission';
  target_id: string;
  status: ClaimStatus;
  submitted_by: string;
  notes: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
};

export type CaseCommentRow = {
  id: string;
  case_id: string;
  author_id: string | null;
  body: string;
  pinned: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FollowRow = {
  follower_id: string;
  followee_id: string;
  created_at: string;
};

export type VenueFollowRow = {
  follower_id: string;
  location_id: string;
  created_at: string;
};

export type NotificationKind =
  | 'follow'
  | 'venue_follow'
  | 'case_at_venue'
  | 'claim_approved'
  | 'claim_rejected'
  | 'claim_submitted'
  | 'case_comment';

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  actor_id: string | null;
  target_type: string | null;
  target_id: string | null;
  data: Record<string, any> | null;
  read_at: string | null;
  created_at: string;
};

export type LogEntryPhotoRow = {
  id: string;
  log_entry_id: string;
  case_id: string;
  owner_id: string;
  storage_path: string;
  mime_type: string;
  bytes: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  created_at: string;
};

export type LogEntryAudioRow = {
  id: string;
  log_entry_id: string;
  case_id: string;
  owner_id: string;
  storage_path: string;
  mime_type: string;
  bytes: number;
  duration_seconds: number | null;
  caption: string | null;
  created_at: string;
};

export type LocationManagerRole = 'owner' | 'manager';

export type LocationManagerRow = {
  location_id: string;
  user_id: string;
  role: LocationManagerRole;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Pick<ProfileRow, 'id' | 'handle' | 'display_name'> & Partial<ProfileRow>;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      teams: {
        Row: TeamRow;
        Insert: Pick<TeamRow, 'slug' | 'name' | 'created_by'> & Partial<TeamRow>;
        Update: Partial<TeamRow>;
        Relationships: [];
      };
      team_members: {
        Row: TeamMemberRow;
        Insert: Pick<TeamMemberRow, 'team_id' | 'user_id'> & Partial<TeamMemberRow>;
        Update: Partial<TeamMemberRow>;
        Relationships: [];
      };
      locations: {
        Row: LocationRow;
        Insert: Pick<LocationRow, 'id' | 'name' | 'lat' | 'lng'> & Partial<LocationRow>;
        Update: Partial<LocationRow>;
        Relationships: [];
      };
      location_revisions: {
        Row: LocationRevisionRow;
        Insert: Pick<LocationRevisionRow, 'location_id' | 'edited_by' | 'changes'> & Partial<LocationRevisionRow>;
        Update: Partial<LocationRevisionRow>;
        Relationships: [];
      };
      location_claims: {
        Row: LocationClaimRow;
        Insert: Pick<LocationClaimRow, 'location_id' | 'claimant_id'> & Partial<LocationClaimRow>;
        Update: Partial<LocationClaimRow>;
        Relationships: [];
      };
      location_zones: {
        Row: LocationZoneRow;
        Insert: Pick<LocationZoneRow, 'location_id' | 'name'> & Partial<LocationZoneRow>;
        Update: Partial<LocationZoneRow>;
        Relationships: [];
      };
      check_ins: {
        Row: CheckInRow;
        Insert: Pick<CheckInRow, 'hunt_id' | 'location_name' | 'visibility' | 'owner_id' | 'expires_at'> & Partial<CheckInRow>;
        Update: Partial<CheckInRow>;
        Relationships: [];
      };
      cases: {
        Row: CaseRow;
        Insert: Pick<CaseRow, 'id' | 'owner_id' | 'title' | 'location_name' | 'started_at' | 'visibility'> & Partial<CaseRow>;
        Update: Partial<CaseRow>;
        Relationships: [];
      };
      log_entries: {
        Row: LogEntryRow;
        Insert: Pick<LogEntryRow, 'case_id' | 'logged_by' | 'timestamp' | 'equipment_id' | 'observation'> & Partial<LogEntryRow>;
        Update: Partial<LogEntryRow>;
        Relationships: [];
      };
      media_attachments: {
        Row: MediaAttachmentRow;
        Insert: Pick<MediaAttachmentRow, 'kind' | 'url' | 'added_by'> & Partial<MediaAttachmentRow>;
        Update: Partial<MediaAttachmentRow>;
        Relationships: [];
      };
      admin_reviews: {
        Row: AdminReviewRow;
        Insert: Pick<AdminReviewRow, 'kind' | 'target_id' | 'submitted_by'> & Partial<AdminReviewRow>;
        Update: Partial<AdminReviewRow>;
        Relationships: [];
      };
      case_comments: {
        Row: CaseCommentRow;
        Insert: Pick<CaseCommentRow, 'case_id' | 'author_id' | 'body'> & Partial<CaseCommentRow>;
        Update: Partial<CaseCommentRow>;
        Relationships: [];
      };
      team_invites: {
        Row: TeamInviteRow;
        Insert: Pick<TeamInviteRow, 'team_id' | 'invitee_id' | 'invited_by'> & Partial<TeamInviteRow>;
        Update: Partial<TeamInviteRow>;
        Relationships: [];
      };
      follows: {
        Row: FollowRow;
        Insert: Pick<FollowRow, 'follower_id' | 'followee_id'> & Partial<FollowRow>;
        Update: Partial<FollowRow>;
        Relationships: [];
      };
      venue_follows: {
        Row: VenueFollowRow;
        Insert: Pick<VenueFollowRow, 'follower_id' | 'location_id'> & Partial<VenueFollowRow>;
        Update: Partial<VenueFollowRow>;
        Relationships: [];
      };
      location_managers: {
        Row: LocationManagerRow;
        Insert: Pick<LocationManagerRow, 'location_id' | 'user_id'> & Partial<LocationManagerRow>;
        Update: Partial<LocationManagerRow>;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: Pick<NotificationRow, 'user_id' | 'kind'> & Partial<NotificationRow>;
        Update: Partial<NotificationRow>;
        Relationships: [];
      };
      log_entry_photos: {
        Row: LogEntryPhotoRow;
        Insert: Pick<
          LogEntryPhotoRow,
          'log_entry_id' | 'case_id' | 'owner_id' | 'storage_path' | 'mime_type' | 'bytes'
        > & Partial<LogEntryPhotoRow>;
        Update: Partial<LogEntryPhotoRow>;
        Relationships: [];
      };
      log_entry_audio: {
        Row: LogEntryAudioRow;
        Insert: Pick<
          LogEntryAudioRow,
          'log_entry_id' | 'case_id' | 'owner_id' | 'storage_path' | 'mime_type' | 'bytes'
        > & Partial<LogEntryAudioRow>;
        Update: Partial<LogEntryAudioRow>;
        Relationships: [];
      };
      equipment_loadouts: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          equipment_ids: string[];
          custom_equipment: Record<string, string> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          name: string;
          equipment_ids?: string[];
          custom_equipment?: Record<string, string> | null;
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          equipment_ids?: string[];
          custom_equipment?: Record<string, string> | null;
        };
        Relationships: [];
      };
      investigations: {
        Row: {
          id: string;
          team_id: string;
          host_id: string;
          name: string | null;
          venue_id: string | null;
          location_name: string;
          join_code: string;
          status: 'open' | 'closed';
          started_at: string;
          closed_at: string | null;
          last_activity_at: string;
        };
        Insert: {
          team_id: string;
          host_id: string;
          location_name: string;
          join_code: string;
          name?: string | null;
          venue_id?: string | null;
          status?: 'open' | 'closed';
          id?: string;
          started_at?: string;
          closed_at?: string | null;
          last_activity_at?: string;
        };
        Update: {
          name?: string | null;
          venue_id?: string | null;
          status?: 'open' | 'closed';
          closed_at?: string | null;
          last_activity_at?: string;
        };
        Relationships: [];
      };
      investigation_members: {
        Row: {
          investigation_id: string;
          user_id: string;
          joined_at: string;
          left_at: string | null;
          group_id: string | null;
        };
        Insert: {
          investigation_id: string;
          user_id: string;
          joined_at?: string;
          left_at?: string | null;
          group_id?: string | null;
        };
        Update: {
          left_at?: string | null;
          group_id?: string | null;
        };
        Relationships: [];
      };
      investigation_groups: {
        Row: {
          id: string;
          investigation_id: string;
          leader_id: string;
          zone: string;
          created_at: string;
          ended_at: string | null;
        };
        Insert: {
          investigation_id: string;
          leader_id: string;
          zone: string;
          id?: string;
          created_at?: string;
          ended_at?: string | null;
        };
        Update: {
          zone?: string;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      investigation_group_members: {
        Row: {
          group_id: string;
          user_id: string;
          added_by: string;
          added_at: string;
          left_at: string | null;
        };
        Insert: {
          group_id: string;
          user_id: string;
          added_by: string;
          added_at?: string;
          left_at?: string | null;
        };
        Update: {
          left_at?: string | null;
        };
        Relationships: [];
      };
      hunt_drafts: {
        Row: {
          owner_id: string;
          hunt_id: string;
          payload: any;
          started_at: string;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          hunt_id: string;
          payload: any;
          started_at: string;
          updated_at?: string;
        };
        Update: {
          hunt_id?: string;
          payload?: any;
          started_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      case_reactions: {
        Row: {
          case_id: string;
          user_id: string;
          reaction: 'examine' | 'witnessed' | 'skeptical' | 'chilled';
          created_at: string;
        };
        Insert: {
          case_id: string;
          user_id: string;
          reaction: 'examine' | 'witnessed' | 'skeptical' | 'chilled';
          created_at?: string;
        };
        Update: {
          reaction?: 'examine' | 'witnessed' | 'skeptical' | 'chilled';
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      delete_my_account: {
        Args: Record<string, never>;
        Returns: void;
      };
      create_team_with_owner: {
        Args: {
          p_slug: string;
          p_name: string;
          p_description?: string | null;
          p_website?: string | null;
          p_instagram?: string | null;
          p_tiktok?: string | null;
          p_facebook?: string | null;
          p_youtube?: string | null;
        };
        Returns: string;
      };
      create_team_invite: {
        Args: {
          p_team_id: string;
          p_invitee_handle: string;
          p_role?: TeamRole;
          p_message?: string | null;
        };
        Returns: string;
      };
      accept_team_invite: {
        Args: { p_invite_id: string };
        Returns: void;
      };
      decline_team_invite: {
        Args: { p_invite_id: string };
        Returns: void;
      };
      rescind_team_invite: {
        Args: { p_invite_id: string };
        Returns: void;
      };
      change_team_member_role: {
        Args: {
          p_team_id: string;
          p_user_id: string;
          p_new_role: TeamRole;
        };
        Returns: void;
      };
      delete_team: {
        Args: { p_team_id: string };
        Returns: void;
      };
      leave_team: {
        Args: { p_team_id: string };
        Returns: void;
      };
      seal_case_with_logs: {
        Args: {
          p_id: string;
          p_title: string;
          p_summary: string | null;
          p_location_id: string | null;
          p_location_name: string;
          p_zone: string | null;
          p_lat: number | null;
          p_lng: number | null;
          p_started_at: string;
          p_ended_at: string;
          p_visibility: Visibility;
          p_gps_verified: boolean;
          p_equipment_used: string[];
          p_custom_equipment: Record<string, string> | null;
          p_tags: string[] | null;
          p_team_id: string | null;
          p_logs: unknown;
        };
        Returns: string;
      };
      delete_case: {
        Args: { p_case_id: string };
        Returns: void;
      };
      undelete_case: {
        Args: { p_case_id: string };
        Returns: void;
      };
      list_my_deleted_cases: {
        Args: Record<string, never>;
        Returns: CaseRow[];
      };
      approve_claim: {
        Args: { p_claim_id: string };
        Returns: void;
      };
      reject_claim: {
        Args: { p_claim_id: string; p_note: string | null };
        Returns: void;
      };
      withdraw_claim: {
        Args: { p_claim_id: string };
        Returns: void;
      };
      submit_location_claim: {
        Args: {
          p_location_id: string;
          p_claimed_role: string;
          p_message: string;
          p_proof_links: string[];
        };
        Returns: string;
      };
      withdraw_location_claim: {
        Args: { p_claim_id: string };
        Returns: void;
      };
      get_unread_notification_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      mark_all_notifications_read: {
        Args: Record<string, never>;
        Returns: void;
      };
      list_case_photos: {
        Args: { p_case_id: string };
        Returns: LogEntryPhotoRow[];
      };
      list_case_audio: {
        Args: { p_case_id: string };
        Returns: LogEntryAudioRow[];
      };
      submit_location: {
        Args: { p_payload: unknown };
        Returns: string;
      };
      approve_location_submission: {
        Args: { p_submission_id: string };
        Returns: string;
      };
      reject_location_submission: {
        Args: { p_submission_id: string; p_note: string | null };
        Returns: void;
      };
      create_investigation: {
        Args: {
          p_team_id: string;
          p_location_name: string;
          p_venue_id: string | null;
          p_name: string | null;
        };
        Returns: string;
      };
      join_investigation_by_code: {
        Args: { p_code: string };
        Returns: string;
      };
      close_investigation: {
        Args: { p_investigation_id: string };
        Returns: void;
      };
      auto_close_idle_investigations: {
        Args: Record<string, never>;
        Returns: number;
      };
      list_active_investigations_for_user: {
        Args: Record<string, never>;
        Returns: Array<{
          id: string;
          team_id: string;
          team_name: string;
          team_slug: string;
          host_id: string;
          host_handle: string;
          name: string | null;
          location_name: string;
          venue_id: string | null;
          join_code: string;
          started_at: string;
          last_activity_at: string;
          member_count: number;
          i_am_member: boolean;
        }>;
      };
      list_investigation_cases: {
        Args: { p_investigation_id: string };
        Returns: Array<{
          id: string;
          owner_id: string;
          team_id: string | null;
          title: string;
          summary: string | null;
          location_id: string | null;
          location_name: string;
          zone: string | null;
          lat: number | null;
          lng: number | null;
          started_at: string;
          ended_at: string | null;
          visibility: 'public' | 'private' | 'anonymous';
          gps_verified: boolean;
          equipment_used: string[] | null;
          custom_equipment: Record<string, string> | null;
          tags: string[] | null;
          sealed: boolean;
          investigation_id: string | null;
          group_id: string | null;
          redacted: boolean;
          created_at: string;
          updated_at: string;
        }>;
      };
      create_investigation_group: {
        Args: { p_investigation_id: string; p_zone: string };
        Returns: string;
      };
      join_investigation_group: {
        Args: { p_group_id: string };
        Returns: void;
      };
      leave_investigation_group: {
        Args: { p_investigation_id: string };
        Returns: void;
      };
      end_investigation_group: {
        Args: { p_group_id: string };
        Returns: void;
      };
      list_investigation_groups: {
        Args: { p_investigation_id: string };
        Returns: Array<{
          id: string;
          investigation_id: string;
          leader_id: string;
          leader_handle: string | null;
          leader_display_name: string | null;
          leader_avatar_url: string | null;
          zone: string;
          created_at: string;
          ended_at: string | null;
          member_count: number;
        }>;
      };
      create_investigation_group_with_members: {
        Args: {
          p_investigation_id: string;
          p_zone: string;
          p_member_ids: string[];
        };
        Returns: string;
      };
      tag_member_into_group: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: void;
      };
      untag_member_from_group: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: void;
      };
      list_my_groups_in_investigation: {
        Args: { p_investigation_id: string };
        Returns: any[];
      };
      list_group_members: {
        Args: { p_group_id: string };
        Returns: Array<{
          user_id: string;
          added_at: string;
          added_by: string;
          handle: string | null;
          display_name: string | null;
          avatar_url: string | null;
        }>;
      };
      list_active_hunts_in_investigation: {
        Args: { p_investigation_id: string };
        Returns: Array<{
          check_in_id: string;
          hunt_id: string;
          owner_id: string;
          owner_handle: string | null;
          owner_display_name: string | null;
          owner_avatar_url: string | null;
          is_anonymous: boolean;
          location_name: string;
          started_at: string;
          expires_at: string;
          group_id: string | null;
          group_zone: string | null;
        }>;
      };
      investigation_summary_stats: {
        Args: { p_investigation_id: string };
        Returns: Array<{
          total_cases: number;
          total_log_entries: number;
          total_photos: number;
          total_audio: number;
          duration_seconds: number;
        }>;
      };
      get_my_case_reaction: {
        Args: { p_case_id: string };
        Returns: 'examine' | 'witnessed' | 'skeptical' | 'chilled' | null;
      };
    };
  };
};
