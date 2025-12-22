import { CallParticipant, SipEvent, SipLadder } from '../domain/models';

type Identity = {
  user?: {
    id?: string;
    displayName?: string;
  };
  application?: {
    id?: string;
    displayName?: string;
  };
  applicationInstance?: {
    id?: string;
    displayName?: string;
  };
  phone?: {
    id?: string;
    displayName?: string;
    number?: string;
  };
  endpointType?: string;
};

type CallRecordLike = {
  id?: string;
  startDateTime?: string;
  endDateTime?: string;
  participants?: Array<{
    id?: string;
    identity?: Identity;
    endpointType?: string;
    role?: string;
  }>;
  sessions?: Array<{
    id?: string;
    modalities?: string[];
    startDateTime?: string;
    endDateTime?: string;
    segments?: Array<{
      id?: string;
      startDateTime?: string;
      endDateTime?: string;
      caller?: { identity?: Identity };
      callee?: { identity?: Identity };
      media?: Array<Record<string, unknown>>;
      failureInfo?: Record<string, unknown>;
      startReason?: Record<string, unknown>;
      endReason?: Record<string, unknown>;
    }>;
  }>;
  raw?: unknown;
};

const identityId = (identity?: Identity): string => {
  if (!identity) {
    return 'unknown';
  }

  return (
    identity.user?.id ||
    identity.applicationInstance?.id ||
    identity.application?.id ||
    identity.phone?.id ||
    identity.phone?.number ||
    'unknown'
  );
};

const identityDisplayName = (identity?: Identity): string => {
  if (!identity) {
    return 'Unknown';
  }

  return (
    identity.user?.displayName ||
    identity.applicationInstance?.displayName ||
    identity.application?.displayName ||
    identity.phone?.displayName ||
    identity.phone?.number ||
    'Unknown'
  );
};

const identityEndpointType = (identity?: Identity): string | undefined => {
  if (!identity) {
    return undefined;
  }

  if (identity.applicationInstance) {
    return 'application';
  }

  if (identity.application) {
    return 'application';
  }

  if (identity.phone) {
    return 'phone';
  }

  return 'user';
};

type ParticipantMap = Map<string, CallParticipant>;

const ensureParticipant = (
  participants: ParticipantMap,
  identity: Identity | undefined,
  fallbackId: string,
  endpointType?: string,
): CallParticipant => {
  const id = identityId(identity) ?? fallbackId;
  const displayName = identityDisplayName(identity);
  const finalId = id === 'unknown' ? fallbackId : id;

  const existing = participants.get(finalId);
  if (existing) {
    return existing;
  }

  const participant: CallParticipant = {
    id: finalId,
    displayName,
    endpointType: identityEndpointType(identity) ?? endpointType,
    raw: identity,
  };

  participants.set(finalId, participant);
  return participant;
};

const addStaticParticipants = (record: CallRecordLike, participants: ParticipantMap) => {
  if (!Array.isArray(record.participants)) {
    return;
  }

  for (const participant of record.participants) {
    const identity = participant.identity;
    const fallbackId = participant.id ?? identityId(identity);
    ensureParticipant(participants, identity, fallbackId ?? `participant-${participants.size + 1}`, participant.endpointType);
  }
};

const calculateDurationSeconds = (start?: string, end?: string): number | undefined => {
  if (!start || !end) {
    return undefined;
  }

  const startTime = Date.parse(start);
  const endTime = Date.parse(end);

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return undefined;
  }

  return Math.max(0, Math.round((endTime - startTime) / 1000));
};

export const normalizeCallRecord = (record: CallRecordLike): SipLadder => {
  const participants: ParticipantMap = new Map();
  addStaticParticipants(record, participants);

  const events: SipEvent[] = [];

  for (const session of record.sessions ?? []) {
    for (const segment of session.segments ?? []) {
      const caller = ensureParticipant(
        participants,
        segment.caller?.identity,
        `${session.id ?? 'session'}-caller`,
      );
      const callee = ensureParticipant(
        participants,
        segment.callee?.identity,
        `${session.id ?? 'session'}-callee`,
      );

      const messageType = String(
        (segment.media?.[0] as { label?: unknown } | undefined)?.label ??
          session.modalities?.[0] ??
          'segment',
      );

      const event: SipEvent = {
        id: segment.id ?? `${session.id ?? 'session'}-${events.length + 1}`,
        fromParticipantId: caller.id,
        toParticipantId: callee.id,
        timestamp: segment.startDateTime ?? record.startDateTime ?? new Date().toISOString(),
        messageType,
        durationSeconds: calculateDurationSeconds(segment.startDateTime, segment.endDateTime),
        metadata: {
          modalities: session.modalities,
          media: segment.media,
          failureInfo: segment.failureInfo,
          startReason: segment.startReason,
          endReason: segment.endReason,
        },
        sessionId: session.id,
      };

      events.push(event);
    }
  }

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    callId: record.id ?? 'unknown-call-id',
    startedAt: record.startDateTime,
    endedAt: record.endDateTime,
    participants: Array.from(participants.values()),
    events,
    raw: record,
  };
};
