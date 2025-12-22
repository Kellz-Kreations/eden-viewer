export interface CallParticipant {
  id: string;
  displayName: string;
  endpointType?: string;
  role?: string;
  raw?: unknown;
}

export interface SipEvent {
  id: string;
  fromParticipantId: string;
  toParticipantId: string;
  timestamp: string;
  messageType: string;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
  sessionId?: string;
}

export interface SipLadder {
  callId: string;
  startedAt?: string;
  endedAt?: string;
  participants: CallParticipant[];
  events: SipEvent[];
  raw?: unknown;
}
