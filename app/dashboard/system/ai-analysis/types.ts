export interface AiStats {
  pending: number;
  processing: number;
  failed: number;
  noContent: number;
  noteInvalid: number;
  total: number;
}

export interface SystemConfig {
  config_id: string;
  config_key: string;
  config_value: string;
  config_desc: string | null;
}

export interface FailedNote {
  NoteId: string;
  XhsNoteId: string | null;
  Title: string;
  AiStatus: string;
  AiErr: string;
  AiErrType: string | null;
  PublishTime: string;
  BloggerNickName: string;
  BrandName: string | null;
  XhsNoteLink: string | null;
  XhsUserId: string | null;
  XhsImages: string | null;
  XhsVideo: string | null;
  AiFilterMediaId: string | null; // 敏感图片ID，逗号分隔
}

