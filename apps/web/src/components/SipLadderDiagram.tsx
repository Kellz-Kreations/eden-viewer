import dayjs from 'dayjs';
import { memo, useMemo } from 'react';

import type { CallParticipant, SipEvent, SipLadder } from '../types/ladder';

interface SipLadderDiagramProps {
  ladder: SipLadder;
}

interface LaneLayout {
  participant: CallParticipant;
  x: number;
}

interface EventLayout {
  event: SipEvent;
  y: number;
  fromX: number;
  toX: number;
  isLoopback: boolean;
}

const LANE_WIDTH = 180;
const LANE_GAP = 48;
const EVENT_SPACING = 80;
const TOP_PADDING = 120;

const createLaneLayouts = (participants: CallParticipant[]): LaneLayout[] =>
  participants.map((participant, index) => ({
    participant,
    x: index * (LANE_WIDTH + LANE_GAP) + LANE_WIDTH / 2,
  }));

const findLane = (lanes: LaneLayout[], participantId: string) =>
  lanes.find((lane) => lane.participant.id === participantId) ?? lanes[0];

const createEventLayouts = (events: SipEvent[], lanes: LaneLayout[]): EventLayout[] =>
  events.map((event, index) => {
    const fromLane = findLane(lanes, event.fromParticipantId);
    const toLane = findLane(lanes, event.toParticipantId);
    const y = TOP_PADDING + index * EVENT_SPACING;
    const isLoopback = fromLane.participant.id === toLane.participant.id;

    return {
      event,
      y,
      fromX: fromLane.x,
      toX: toLane.x,
      isLoopback,
    };
  });

const formatTimestamp = (timestamp: string) =>
  dayjs(timestamp).isValid() ? dayjs(timestamp).format('HH:mm:ss.SSS') : timestamp;

const formatDuration = (seconds?: number) =>
  typeof seconds === 'number' ? `${seconds}s` : undefined;

export const SipLadderDiagram = memo(({ ladder }: SipLadderDiagramProps) => {
  const lanes = useMemo(() => createLaneLayouts(ladder.participants), [ladder.participants]);
  const events = useMemo(() => createEventLayouts(ladder.events, lanes), [ladder.events, lanes]);

  const width =
    lanes.length > 0 ? lanes.length * LANE_WIDTH + (lanes.length - 1) * LANE_GAP + LANE_WIDTH : 600;
  const height = events.length > 0 ? TOP_PADDING + events.length * EVENT_SPACING + 120 : 280;

  return (
    <div className="ladder-diagram">
      <svg className="ladder-diagram__svg" width={width} height={height} role="presentation">
        <defs>
          <marker
            id="ladder-arrow"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent-color)" />
          </marker>
        </defs>

        {lanes.map((lane) => (
          <g key={lane.participant.id} transform={`translate(${lane.x}, 0)`}>
            <line
              x1={0}
              y1={TOP_PADDING - 60}
              x2={0}
              y2={height - 60}
              stroke="var(--lane-line-color)"
              strokeDasharray="6 8"
            />
            <rect
              className="ladder-diagram__lane-label"
              x={-LANE_WIDTH / 2}
              y={20}
              width={LANE_WIDTH}
              height={64}
              rx={16}
            />
            <text className="ladder-diagram__lane-text" x={0} y={60} textAnchor="middle">
              {lane.participant.displayName}
            </text>
            {lane.participant.endpointType ? (
              <text className="ladder-diagram__lane-subtext" x={0} y={82} textAnchor="middle">
                {lane.participant.endpointType}
              </text>
            ) : null}
          </g>
        ))}

        {events.map((layout) => (
          <g key={layout.event.id} className="ladder-diagram__event">
            {layout.isLoopback ? (
              <path
                d={`M${layout.fromX - 60} ${layout.y} Q${layout.fromX} ${layout.y - 40} ${layout.toX} ${layout.y}`}
                stroke="var(--accent-color)"
                strokeWidth={2}
                fill="none"
              />
            ) : (
              <line
                x1={layout.fromX}
                y1={layout.y}
                x2={layout.toX}
                y2={layout.y}
                stroke="var(--accent-color)"
                strokeWidth={2}
                markerEnd="url(#ladder-arrow)"
              />
            )}

            <rect
              className="ladder-diagram__event-box"
              x={Math.min(layout.fromX, layout.toX) + (layout.isLoopback ? -100 : 12)}
              y={layout.y - 26}
              width={200}
              height={56}
              rx={12}
            />
            <text className="ladder-diagram__event-title" x={Math.min(layout.fromX, layout.toX) + 12} y={layout.y - 4}>
              {layout.event.messageType}
            </text>
            <text className="ladder-diagram__event-meta" x={Math.min(layout.fromX, layout.toX) + 12} y={layout.y + 16}>
              {formatTimestamp(layout.event.timestamp)}
              {formatDuration(layout.event.durationSeconds) ? ` · ${formatDuration(layout.event.durationSeconds)}` : ''}
            </text>
          </g>
        ))}
      </svg>

      <section className="ladder-diagram__details">
        <h3>Event Details</h3>
        <ol>
          {ladder.events.map((event) => {
            const from = lanes.find((lane) => lane.participant.id === event.fromParticipantId)?.participant;
            const to = lanes.find((lane) => lane.participant.id === event.toParticipantId)?.participant;

            return (
              <li key={event.id}>
                <div className="ladder-diagram__details-header">
                  <span className="ladder-diagram__badge">{event.messageType}</span>
                  <span>{formatTimestamp(event.timestamp)}</span>
                </div>
                <p>
                  {from?.displayName ?? event.fromParticipantId} → {to?.displayName ?? event.toParticipantId}
                  {event.durationSeconds ? ` (${event.durationSeconds}s)` : ''}
                </p>
                {event.metadata ? (
                  <pre className="ladder-diagram__metadata">{JSON.stringify(event.metadata, null, 2)}</pre>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
});

SipLadderDiagram.displayName = 'SipLadderDiagram';
